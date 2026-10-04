"""Planted mistakes (SYSTEM.md §3.2, USP U20).

Each mistake turns one step of a passing run into a `Change` that `fork`
applies at that step. If the forked run then fails, that step is the known
guilty step. Nothing here calls a model: the mistakes are mechanical edits
of what was recorded.

    allowed_steps(trace, "F2")              -> step indices where F2 can be planted
    make_change(trace, "F2", idx, rng)      -> Change, or None if it does not apply there

    F1  wrong tool argument        tool        args
    F2  tool returns a wrong value tool        output
    F3  tool returns nothing       tool        output
    F4  misleading paragraph       retrieval   output
    F5  search misses the paragraph retrieval  output
    F6  wrong intermediate fact    llm         output

Kept back from training, to test mistakes the ranker has never seen:

    F7  model picks the wrong tool llm         output
    F8  memory value lost          any         state
    F9  instruction dropped        llm         messages
    F10 model answers too early    llm         output
"""

from __future__ import annotations

import random
import re
from dataclasses import dataclass
from typing import Callable

from blackbox.agents.tools.registry import all_tools, get_tool
from blackbox.core.schema import Change, Step, Trace

_NUMBER = re.compile(r"(?<![\w.])\d+(?:\.\d+)?(?![\w]|\.\d)")
_LIST_MARKER = re.compile(r"^\s*\d+[.)]\s", re.MULTILINE)
_YES_NO = re.compile(r"\b(yes|no)\b", re.IGNORECASE)
_RECORD_ID = re.compile(r"^([A-Za-z]+)(\d+)$")
_ACTION_LINE = re.compile(r"^(\s*ACTION\s*:\s*)([A-Za-z_]\w*)", re.IGNORECASE | re.MULTILINE)
_CALC_LINE = re.compile(r"^\s*CALC\s*:", re.IGNORECASE | re.MULTILINE)
_NEXT_SEARCH = re.compile(r"^(\s*NEXT\s*:\s*)SEARCH\b.*$", re.IGNORECASE | re.MULTILINE)
_SENTENCE_END = re.compile(r"(?<=[.:])\s+")
ANY_STEP = "any"

MakeChange = Callable[[Trace, Step, random.Random], "Change | None"]


@dataclass(frozen=True)
class Fault:
    type: str
    name: str
    step_kind: str
    make: MakeChange


# ---- small edits ----------------------------------------------------------------
def perturb_number(value: float | int, rng: random.Random) -> float | int:
    """A different number of the same sort: off by one, wrong unit, or doubled/halved."""
    options = [value + 1, value - 1, value * 10, value * 2]
    if value and value % 2 == 0:
        options.append(value / 2)
    if value and value % 10 == 0:
        options.append(value / 10)
    options = [o for o in options if o != value]
    out = rng.choice(options)
    if isinstance(value, int) or float(value).is_integer():
        return int(out) if float(out).is_integer() else round(out, 4)
    return round(out, 4)


def _to_number(raw: str) -> float | int:
    return float(raw) if "." in raw else int(raw)


def perturb_number_in_text(text: str, rng: random.Random) -> tuple[str, str, str] | None:
    """Change one number in `text`. Returns (new_text, before, after), or None if it has none.
    List markers ("1. ", "2) ") are not facts and are left alone."""
    spans = _number_spans(text)
    if not spans:
        return None
    m = rng.choice(spans)
    after = str(perturb_number(_to_number(m.group()), rng))
    return text[: m.start()] + after + text[m.end():], m.group(), after


def _number_spans(text: str) -> list[re.Match]:
    markers = {m.start() + len(m.group()) - len(m.group().lstrip()) for m in _LIST_MARKER.finditer(text)}
    return [m for m in _NUMBER.finditer(text) if m.start() not in markers]


def _paragraphs(trace: Trace) -> list[dict]:
    return trace.run.task_input.get("paragraphs") or []


def _gold_titles(trace: Trace) -> set[str]:
    expected = trace.run.task_expected
    return set(expected.get("supporting_titles") or []) if isinstance(expected, dict) else set()


def _docs(step: Step) -> list[dict] | None:
    docs = (step.output or {}).get("docs")
    return docs if isinstance(docs, list) and docs else None


def _word_overlap(a: str, b: str) -> int:
    return len(set(a.lower().split()) & set(b.lower().split()))


def _other_id(value: str, args: dict, rng: random.Random) -> str:
    """A wrong record id: another one found in the data the tool was given, else the next number."""
    prefix, number = _RECORD_ID.match(value).groups()
    known = sorted(
        key for table in args.values() if isinstance(table, dict)
        for records in table.values() if isinstance(records, dict)
        for key in records
        if isinstance(key, str) and key != value and _RECORD_ID.match(key) and key.startswith(prefix)
    )
    return rng.choice(known) if known else f"{prefix}{int(number) + 1}"


# ---- F1-F3: tool steps ------------------------------------------------------------
def f1_wrong_tool_argument(trace: Trace, step: Step, rng: random.Random) -> Change | None:
    args = step.request.get("args") or {}
    candidates = []
    for key in sorted(args):
        value = args[key]
        if isinstance(value, bool):
            continue
        if isinstance(value, (int, float)):
            candidates.append((key, perturb_number(value, rng), value))
        elif isinstance(value, str) and _RECORD_ID.match(value):
            candidates.append((key, _other_id(value, args, rng), value))  # wrong id
        elif isinstance(value, str):
            edited = perturb_number_in_text(value, rng)
            if edited:
                candidates.append((key, edited[0], value))
    if not candidates:
        return None
    key, new, old = rng.choice(candidates)
    return Change(kind="args", value={key: new}, note=f"F1: argument {key!r} {old!r} -> {new!r}")


def f2_wrong_tool_value(trace: Trace, step: Step, rng: random.Random) -> Change | None:
    if step.output is None or "result" not in step.output:
        return None
    result = step.output["result"]
    if isinstance(result, bool) or result is None:
        return None
    if isinstance(result, (int, float)):
        new = perturb_number(result, rng)
    elif isinstance(result, str):
        edited = perturb_number_in_text(result, rng)
        if edited is None:
            return None
        new = edited[0]
    else:
        return None
    return Change(kind="output", value={**step.output, "result": new}, note=f"F2: result {result!r} -> {new!r}")


def f3_tool_returns_nothing(trace: Trace, step: Step, rng: random.Random) -> Change | None:
    if step.output is None or step.output.get("result") in (None, "", [], {}):
        return None
    return Change(kind="output", value={**step.output, "result": None}, note="F3: result -> nothing")


# ---- F4-F5: search steps ----------------------------------------------------------
def f4_misleading_paragraph(trace: Trace, step: Step, rng: random.Random) -> Change | None:
    """Swap each right paragraph for the distractor that looks most like it."""
    docs, gold = _docs(step), _gold_titles(trace)
    if not docs or not any(d.get("title") in gold for d in docs):
        return None
    shown = {d.get("title") for d in docs}
    pool = [
        {"id": i, "title": p["title"], "text": p["text"], "score": 0.0}
        for i, p in enumerate(_paragraphs(trace))
        if p["title"] not in gold and p["title"] not in shown
    ]
    if not pool:
        return None
    new_docs, swapped = [], []
    for d in docs:
        if d.get("title") in gold and pool:
            best = max(_word_overlap(p["title"], d["title"]) for p in pool)
            pick = rng.choice([p for p in pool if _word_overlap(p["title"], d["title"]) == best])
            pool.remove(pick)
            # the distractor takes the right paragraph's place in the results, id included:
            # the agent believes it has read that paragraph and will not fetch it again
            new_docs.append({**pick, "id": d.get("id", pick["id"]), "score": d.get("score", 0.0)})
            swapped.append(f"{d['title']!r} -> {pick['title']!r}")
        else:
            new_docs.append(d)
    return Change(kind="output", value={**step.output, "docs": new_docs}, note="F4: " + "; ".join(swapped))


def f5_search_misses(trace: Trace, step: Step, rng: random.Random) -> Change | None:
    docs, gold = _docs(step), _gold_titles(trace)
    if not docs:
        return None
    dropped = [d["title"] for d in docs if d.get("title") in gold]
    if not dropped:
        return None
    kept = [d for d in docs if d.get("title") not in gold]
    return Change(kind="output", value={**step.output, "docs": kept}, note=f"F5: dropped {dropped}")


# ---- F6: model steps --------------------------------------------------------------
def _wrong_answer_fact(trace: Trace, text: str, rng: random.Random) -> tuple[str, str, str] | None:
    """If this step states the fact the run's (correct) answer rests on, get that fact wrong.

    Changing any number in a note is usually harmless: a birth year the
    question never asked about. The answer the passing run gave tells us which
    stated fact matters. Returns (new_text, before, after) or None.
    """
    outcome = trace.run.outcome
    answer = outcome.final_answer if outcome else None
    if isinstance(answer, bool) or not isinstance(answer, (str, int, float)):
        return None
    ans = str(answer).strip()
    try:
        number = float(ans.replace(",", "").lstrip("$"))
    except ValueError:
        number = None
    if number is not None:
        spans = [m for m in _number_spans(text) if float(m.group()) == number]
        if not spans:
            return None
        m = rng.choice(spans)
        after = str(perturb_number(_to_number(m.group()), rng))
        return text[: m.start()] + after + text[m.end():], m.group(), after
    if ans.lower() in ("yes", "no"):
        m = _YES_NO.search(text)
        if m is None:
            return None
        after = "no" if m.group().lower() == "yes" else "yes"
        return text[: m.start()] + after + text[m.end():], m.group(), after
    at = text.lower().find(ans.lower()) if len(ans) >= 3 else -1
    if at < 0:
        return None
    others = [p["title"] for p in _paragraphs(trace)
              if ans.lower() not in p["title"].lower() and p["title"].lower() not in ans.lower()]
    if not others:
        return None
    after = rng.choice(others)
    return text[:at] + after + text[at + len(ans):], text[at: at + len(ans)], after


def f6_wrong_fact(trace: Trace, step: Step, rng: random.Random) -> Change | None:
    """Alter one fact the model stated: the one the answer rests on if this step
    states it, else a number, a named entity, or a yes/no."""
    text = (step.output or {}).get("text")
    if not isinstance(text, str) or not text.strip():
        return None

    edited = _wrong_answer_fact(trace, text, rng) or perturb_number_in_text(text, rng)
    if edited:
        new, before, after = edited
        return Change(kind="output", value={**step.output, "text": new}, note=f"F6: {before} -> {after}")

    titles = [p["title"] for p in _paragraphs(trace)]
    present = [t for t in titles if t in text]
    if present:
        before = rng.choice(sorted(present, key=len, reverse=True)[:2])
        others = [t for t in titles if t != before and t not in before and before not in t]
        if others:
            after = rng.choice(others)
            return Change(kind="output", value={**step.output, "text": text.replace(before, after)},
                          note=f"F6: {before!r} -> {after!r}")

    m = _YES_NO.search(text)
    if m:
        after = "no" if m.group().lower() == "yes" else "yes"
        return Change(kind="output", value={**step.output, "text": text[: m.start()] + after + text[m.end():]},
                      note=f"F6: {m.group()} -> {after}")
    return None


# ---- F7-F10: kept back from training ------------------------------------------------
def f7_wrong_tool(trace: Trace, step: Step, rng: random.Random) -> Change | None:
    """The model names another tool of the same family. One that takes the same
    arguments is preferred, so the call goes through and does the wrong thing."""
    text = (step.output or {}).get("text")
    m = _ACTION_LINE.search(text) if isinstance(text, str) else None
    spec = get_tool(m.group(2)) if m else None
    if spec is None:
        return None
    others = [t for t in all_tools() if t.category == spec.category and t.name != spec.name]
    if not others:
        return None
    same_args = [t for t in others if set(t.parameters["properties"]) == set(spec.parameters["properties"])]
    pick = rng.choice(same_args or others)
    new = text[: m.start(2)] + pick.name + text[m.end(2):]
    return Change(kind="output", value={**step.output, "text": new}, note=f"F7: {spec.name} -> {pick.name}")


def memory_after(trace: Trace, step_idx: int) -> dict:
    """What the run's memory holds right after step `step_idx`, for the keys the run has written."""
    memory: dict = {}
    for s in trace.steps[: step_idx + 1]:
        for key, diff in s.state_diff.items():
            memory[key] = diff.get("after")
    return memory


def first_step_to_notice(trace: Trace, step_idx: int, key: str) -> int | None:
    """The first step that would read `key` after it is wiped at `step_idx`, or None.

    The recorder applies a memory change when the next step begins, after that
    step's request was built. So the next step cannot notice, and if it writes
    the key (from what it read before the wipe) the wipe is undone. After
    that, a write that replaces the value outright also undoes it, while one
    that builds on the old value (`results = results + [new]`) carries the
    loss forward.
    """
    following = trace.steps[step_idx + 1:]
    if not following or key in following[0].writes:
        return None
    for s in following[1:]:
        if key in s.reads:
            return s.idx
        if key in s.writes and not _builds_on_old_value(s.state_diff.get(key) or {}):
            return None
    return None


def _builds_on_old_value(diff: dict) -> bool:
    before, after = diff.get("before"), diff.get("after")
    if isinstance(before, list) and isinstance(after, list):
        return bool(before) and after[: len(before)] == before
    if isinstance(before, str) and isinstance(after, str):
        return bool(before) and before in after
    return False


def f8_memory_lost(trace: Trace, step: Step, rng: random.Random) -> Change | None:
    """A memory value is wiped right after this step.

    The value is emptied, not removed: a missing key would crash the agent,
    and a crash is our bug, never a labelled failure. Only text and lists
    are wiped, and only where a later step reads the wiped value.
    """
    memory = memory_after(trace, step.idx)
    candidates = sorted(k for k, v in memory.items() if isinstance(v, (str, list)) and v
                        and first_step_to_notice(trace, step.idx, k) is not None)
    if not candidates:
        return None
    key = rng.choice(candidates)
    return Change(kind="state", value={key: "" if isinstance(memory[key], str) else []},
                  note=f"F8: memory {key!r} wiped")


def f9_instruction_dropped(trace: Trace, step: Step, rng: random.Random) -> Change | None:
    """Part of the system prompt goes missing; the step is then asked again for real.

    Either one sentence is dropped, or the whole reply-format block at the end
    (a truncated prompt). The first sentence always stays: it says what the job is.
    """
    messages = step.request.get("messages") or []
    system = next((i for i, m in enumerate(messages) if m.get("role") == "system"), None)
    if system is None:
        return None
    content = messages[system].get("content")
    pieces = _SENTENCE_END.split(content) if isinstance(content, str) else []
    if len(pieces) < 2:
        return None
    options = [(i, i + 1) for i in range(1, len(pieces))]
    fmt = next((i for i in range(1, len(pieces)) if pieces[i].lower().startswith("reply")), None)
    if fmt is not None and (fmt, len(pieces)) not in options:
        options.append((fmt, len(pieces)))
    start, stop = rng.choice(options)
    new = [dict(m) for m in messages]
    new[system]["content"] = " ".join(pieces[:start] + pieces[stop:])
    return Change(kind="messages", value=new, note=f"F9: dropped {' '.join(pieces[start:stop])[:60]!r}")


def f10_answers_too_early(trace: Trace, step: Step, rng: random.Random) -> Change | None:
    """The model stops working while there is still something to do."""
    text = (step.output or {}).get("text")
    if not isinstance(text, str):
        return None
    if _ACTION_LINE.search(text):
        new, what = "DONE: Your request has been handled.", "stopped instead of calling a tool"
    elif _CALC_LINE.search(text):
        new, what = "DONE", "stopped instead of calculating"
    elif _NEXT_SEARCH.search(text):
        new, what = _NEXT_SEARCH.sub(r"\1ANSWER", text), "answered instead of searching again"
    else:
        return None
    return Change(kind="output", value={**step.output, "text": new}, note=f"F10: {what}")


FAULTS: dict[str, Fault] = {
    f.type: f
    for f in (
        Fault("F1", "wrong tool argument", "tool", f1_wrong_tool_argument),
        Fault("F2", "tool returns a wrong value", "tool", f2_wrong_tool_value),
        Fault("F3", "tool silently returns nothing", "tool", f3_tool_returns_nothing),
        Fault("F4", "search returns a misleading paragraph", "retrieval", f4_misleading_paragraph),
        Fault("F5", "search misses the right paragraph", "retrieval", f5_search_misses),
        Fault("F6", "model states a wrong intermediate fact", "llm", f6_wrong_fact),
        Fault("F7", "model picks the wrong tool", "llm", f7_wrong_tool),
        Fault("F8", "memory value lost", ANY_STEP, f8_memory_lost),
        Fault("F9", "an instruction is dropped from the prompt", "llm", f9_instruction_dropped),
        Fault("F10", "model answers too early", "llm", f10_answers_too_early),
    )
}
TRAIN_FAULTS = ("F1", "F2", "F3", "F4", "F5", "F6")
UNSEEN_FAULTS = ("F7", "F8", "F9", "F10")  # never trained on (SYSTEM.md §3.2)


def make_change(trace: Trace, fault_type: str, step_idx: int, rng: random.Random) -> Change | None:
    """The Change that plants `fault_type` at step `step_idx`, or None if it does not apply there."""
    if fault_type not in FAULTS:
        raise KeyError(f"unknown fault {fault_type!r}. Known: {', '.join(FAULTS)}")
    fault = FAULTS[fault_type]
    step = trace.steps[step_idx]
    if step.error is not None or step.kind == "final":
        return None
    if fault.step_kind not in (ANY_STEP, step.kind):
        return None
    return fault.make(trace, step, rng)


def allowed_steps(trace: Trace, fault_type: str) -> list[int]:
    return [s.idx for s in trace.steps if make_change(trace, fault_type, s.idx, random.Random(0)) is not None]
