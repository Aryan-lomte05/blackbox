"""QA agent for HotpotQA: plan -> search -> read -> (search again | answer).

Multi-hop questions need two paragraphs, so the agent always reads at least
MIN_HOPS search results before answering. A run is 7 to 9 steps:

    plan(llm)  [search(retrieval)  read(llm)] x 2..3  answer(llm)  final
"""

from __future__ import annotations

from blackbox.agents import checkers  # noqa: F401 - registers the "qa" checker
from blackbox.agents.base import Agent, Task, register_agent
from blackbox.agents.parsing import clip, field
from blackbox.agents.tools.search import make_retriever
from blackbox.recorder.context import RunContext, ToolError

MIN_HOPS = 2
MAX_HOPS = 3
DOCS_PER_SEARCH = 2
DOC_CHARS = 900

PLAN_SYSTEM = (
    "You plan searches over a small set of encyclopedia paragraphs to answer a question. "
    "Reply with exactly one line:\nSEARCH: <a few keywords naming the first thing to look up>"
)
READ_SYSTEM = (
    "You are answering a question step by step from encyclopedia paragraphs. "
    "First copy the facts from the new paragraphs that relate to the question: who, what, where, "
    "when, keeping exact names, dates and numbers. Then decide what to do next.\n"
    "Reply in exactly this format:\n"
    "NOTE: <one or two sentences of facts taken from the new paragraphs>\n"
    "NEXT: SEARCH <keywords for a fact that is still missing>\n"
    "If the notes are already enough to answer, the second line is instead:\n"
    "NEXT: ANSWER"
)
ANSWER_SYSTEM = (
    "Answer the question using only the notes. If the question can be answered with yes or no, "
    "answer yes or no. Otherwise give the exact name, place, date or number from the notes. "
    "A few words only, no sentence, no explanation.\n"
    "Reply in exactly this format:\nANSWER: <answer>"
)


def _format_docs(docs: list[dict]) -> str:
    if not docs:
        return "(the search returned nothing)"
    return "\n".join(f"[{d['title']}] {clip(d['text'], DOC_CHARS)}" for d in docs)


def _format_notes(notes: list[str]) -> str:
    return "\n".join(f"- {n}" for n in notes) if notes else "(none yet)"


@register_agent
class QAAgent(Agent):
    name, version, family, entry = "qa_agent", "v1", "qa", "plan"

    def init_state(self, task: Task) -> dict:
        return {"question": task.input["question"], "notes": [], "seen": [], "hop": 0}

    def retriever(self, task: Task):
        return make_retriever(task.input["paragraphs"])

    def plan(self, ctx: RunContext) -> str:
        question = ctx.state["question"]
        res = ctx.llm(ctx.model_id, [
            {"role": "system", "content": PLAN_SYSTEM},
            {"role": "user", "content": f"Question: {question}"},
        ], max_tokens=48)
        ctx.state["query"] = field(res.text, "SEARCH") or question
        return "search"

    def search(self, ctx: RunContext) -> str:
        seen = ctx.state["seen"]
        try:
            docs = ctx.retrieve(ctx.state["query"], k=DOCS_PER_SEARCH, exclude=seen)
        except ToolError:
            docs = []  # recorded on the step; the agent carries on with nothing
        if not isinstance(docs, list):
            docs = []
        docs = [d for d in docs if isinstance(d, dict) and "title" in d and "text" in d]
        ctx.state["docs"] = docs
        ctx.state["seen"] = seen + [d["id"] for d in docs if "id" in d]
        return "read"

    def read(self, ctx: RunContext) -> str:
        question, notes, hop = ctx.state["question"], ctx.state["notes"], ctx.state["hop"]
        res = ctx.llm(ctx.model_id, [
            {"role": "system", "content": READ_SYSTEM},
            {"role": "user", "content": (
                f"Question: {question}\n\nNotes so far:\n{_format_notes(notes)}\n\n"
                f"New paragraphs:\n{_format_docs(ctx.state['docs'])}"
            )},
        ], max_tokens=160)
        note = field(res.text, "NOTE") or clip(res.text, 300)
        nxt = field(res.text, "NEXT") or ""
        hop += 1
        ctx.state["notes"] = notes + [note]
        ctx.state["hop"] = hop

        wants_search = nxt.upper().startswith("SEARCH")
        if hop >= MAX_HOPS or (hop >= MIN_HOPS and not wants_search):
            return "answer"
        query = nxt[len("SEARCH"):].strip(" :") if wants_search else ""
        ctx.state["query"] = query or question
        return "search"

    def answer(self, ctx: RunContext) -> None:
        res = ctx.llm(ctx.model_id, [
            {"role": "system", "content": ANSWER_SYSTEM},
            {"role": "user", "content": (
                f"Question: {ctx.state['question']}\n\nNotes:\n{_format_notes(ctx.state['notes'])}"
            )},
        ], max_tokens=48)
        ctx.final(field(res.text, "ANSWER") or clip(res.text, 200))
        return None

    nodes = {"plan": plan, "search": search, "read": read, "answer": answer}
