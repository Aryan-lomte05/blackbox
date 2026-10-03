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
"""

from __future__ import annotations

import random
import re
from dataclasses import dataclass
from typing import Callable

from blackbox.core.schema import Change, Step, Trace

_NUMBER = re.compile(r"(?<![\w.])\d+(?:\.\d+)?(?![\w]|\.\d)")
_LIST_MARKER = re.compile(r"^\s*\d+[.)]\s", re.MULTILINE)
_YES_NO = re.compile(r"\b(yes|no)\b", re.IGNORECASE)

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
    markers = {m.start() + len(m.group()) - len(m.group().lstrip()) for m in _LIST_MARKER.finditer(text)}
    spans = [m for m in _NUMBER.finditer(text) if m.start() not in markers]
    if not spans:
        return None
    m = rng.choice(spans)
    after = str(perturb_number(_to_number(m.group()), rng))
    return text[: m.start()] + after + text[m.end():], m.group(), after


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
def f6_wrong_fact(trace: Trace, step: Step, rng: random.Random) -> Change | None:
    """Alter one fact the model stated: a number, a named entity, or a yes/no."""
    text = (step.output or {}).get("text")
    if not isinstance(text, str) or not text.strip():
        return None

    edited = perturb_number_in_text(text, rng)
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


FAULTS: dict[str, Fault] = {
    f.type: f
    for f in (
        Fault("F1", "wrong tool argument", "tool", f1_wrong_tool_argument),
        Fault("F2", "tool returns a wrong value", "tool", f2_wrong_tool_value),
        Fault("F3", "tool silently returns nothing", "tool", f3_tool_returns_nothing),
        Fault("F4", "search returns a misleading paragraph", "retrieval", f4_misleading_paragraph),
        Fault("F5", "search misses the right paragraph", "retrieval", f5_search_misses),
        Fault("F6", "model states a wrong intermediate fact", "llm", f6_wrong_fact),
    )
}
TRAIN_FAULTS = ("F1", "F2", "F3", "F4", "F5", "F6")


def make_change(trace: Trace, fault_type: str, step_idx: int, rng: random.Random) -> Change | None:
    """The Change that plants `fault_type` at step `step_idx`, or None if it does not apply there."""
    if fault_type not in FAULTS:
        raise KeyError(f"unknown fault {fault_type!r}. Known: {', '.join(FAULTS)}")
    fault = FAULTS[fault_type]
    step = trace.steps[step_idx]
    if step.kind != fault.step_kind or step.error is not None:
        return None
    return fault.make(trace, step, rng)


def allowed_steps(trace: Trace, fault_type: str) -> list[int]:
    return [s.idx for s in trace.steps if make_change(trace, fault_type, s.idx, random.Random(0)) is not None]
