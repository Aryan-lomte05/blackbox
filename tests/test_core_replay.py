"""Record -> replay -> fork on a toy agent with a scripted fake model.

Proves: data-flow parents, save-points, replay with zero provider calls,
fork re-uses the prefix and unaffected later steps, crashes are not failures.
"""

from __future__ import annotations

import pytest

from blackbox.agents.base import Agent, Task, register_agent, register_checker, run_task
from blackbox.core.schema import Change, Outcome
from blackbox.core.store import Store
from blackbox.recorder import providers
from blackbox.recorder.providers import LLMResult
from blackbox.replay.engine import fork, replay, savings

CALLS: list[str] = []


def fake_model(messages, tools, params) -> LLMResult:
    """Answers 'capital of X?' by echoing the doc text after 'capital is'."""
    CALLS.append(messages[-1]["content"])
    content = messages[-1]["content"]
    if content.startswith("ANSWER FROM:"):
        doc = content.split("ANSWER FROM:", 1)[1]
        text = doc.split("capital is", 1)[1].strip(" .") if "capital is" in doc else "unknown"
    else:
        text = f"search: {content}"
    return LLMResult(text, [], "stop", 10, 5, "fake", "fake-1")


DOCS = {
    "france": [{"id": "d1", "text": "The capital is Paris."}],
    "japan": [{"id": "d2", "text": "The capital is Tokyo."}],
}


def check_exact(answer, expected) -> Outcome:
    return Outcome(success=answer == expected, score=float(answer == expected),
                   final_answer=answer, expected=expected, checker="exact")


@register_agent
class ToyAgent(Agent):
    name, version, family, entry = "toy_agent", "v1", "toy", "plan"

    def init_state(self, task):
        return {"country": task.input["country"], "other": task.input["other"]}

    def retriever(self, task):
        return lambda query, k=5: DOCS.get(query, [])

    def tool_caller(self, task):
        return lambda name, args: {"upper": args["text"].upper()}

    def plan(self, ctx):
        ctx.state["query"] = ctx.llm(ctx.model_id, [{"role": "user", "content": ctx.state["country"]}]).text
        return "search"

    def search(self, ctx):
        ctx.state["docs"] = ctx.retrieve(ctx.state["country"], k=1)
        # independent branch: does not depend on docs, so a fork at search can re-use it
        ctx.state["shout"] = ctx.tool("upper", text=ctx.state["other"])
        return "answer"

    def answer(self, ctx):
        docs = ctx.state["docs"]
        text = docs[0]["text"] if docs else ""
        ans = ctx.llm(ctx.model_id, [{"role": "user", "content": f"ANSWER FROM:{text}"}]).text
        ctx.final(ans)
        return None

    nodes = {"plan": plan, "search": search, "answer": answer}


register_checker("toy", check_exact)


@pytest.fixture(autouse=True)
def _fake():
    providers.register_fake("fake-model", fake_model)
    CALLS.clear()
    yield
    providers.clear_fakes()


@pytest.fixture
def store(tmp_path):
    s = Store(tmp_path)
    yield s
    s.close()


def _task():
    return Task("toy", "t-france", {"country": "france", "other": "hello"}, expected="Paris")


def test_record_builds_steps_parents_and_savepoints(store):
    tr = run_task(ToyAgent(), _task(), "fake-model", store=store)
    assert tr.run.status == "done" and tr.run.outcome.success
    kinds = [s.kind for s in tr.steps]
    assert kinds == ["llm", "retrieval", "tool", "llm", "final"]
    retrieval, final_llm = tr.steps[1], tr.steps[3]
    assert retrieval.reads == ["country"] and retrieval.writes == ["docs"]
    assert final_llm.parents == [1]  # used 'docs', written by the retrieval step
    assert all(s.state_hash_after and store.has_blob(s.state_hash_after) for s in tr.steps)
    assert store.load_trace(tr.run.run_id).steps == tr.steps
    assert tr.run.stats["tokens_in"] == 20


def test_replay_makes_zero_model_calls(store):
    tr = run_task(ToyAgent(), _task(), "fake-model", store=store)
    CALLS.clear()
    again = replay(tr)
    assert CALLS == []
    assert again.run.outcome.final_answer == "Paris"
    assert all(s.cached for s in again.steps if s.kind != "final")


def test_fork_with_bad_doc_flips_outcome_and_reuses_unaffected_steps(store):
    tr = run_task(ToyAgent(), _task(), "fake-model", store=store)
    CALLS.clear()
    child = fork(tr, 1, Change(kind="output", value={"docs": DOCS["japan"]}), store=store)
    assert child.run.outcome.success is False and child.run.outcome.final_answer == "Tokyo"
    assert child.steps[0].cached  # before the fork: from the recording
    assert child.steps[2].cached  # independent tool step after the fork: re-used
    assert not child.steps[3].cached  # depends on the changed docs: executed
    assert len(CALLS) == 1
    sv = savings(child)
    assert sv["steps_reused"] == 2 and sv["tokens_saved"] == 15
    assert child.run.parent_run_id == tr.run.run_id and child.run.fork_step_idx == 1


def test_fork_state_change(store):
    tr = run_task(ToyAgent(), _task(), "fake-model", store=store)
    child = fork(tr, 1, Change(kind="state", value={"docs": []}))
    assert child.run.outcome.final_answer == "unknown"


def test_nondeterministic_agent_is_reported_as_crash_not_failure(store):
    tr = run_task(ToyAgent(), _task(), "fake-model", store=store)
    tr.steps[0].input_hash = "tampered"
    again = replay(tr)
    assert again.run.status == "crashed" and "ReplayDivergence" in again.run.error
    assert again.run.outcome is None
