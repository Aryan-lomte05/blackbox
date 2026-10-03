"""GenAI repair (SYSTEM.md §6.3, USP U16): fixes that are tested before anyone sees them.

1. judge-large reads the steps around the bad step (never the expected answer)
   and proposes candidate fixes:
     add_rule  - an instruction added to that model call (a prompt-level fix: reusable, U17)
     model     - ask a different registry model
     args      - different tool / search arguments
2. Every candidate is tried with a cheap fork (only affected steps re-run).
3. If none works, the results go back to the LLM for one more round.

Every card carries its replay result. Nothing is shown unverified (CLAUDE.md rule 10).
"""

from __future__ import annotations

import json
import re
from typing import Any, Callable

from blackbox.core.hashing import canonical
from blackbox.core.schema import Change, Trace
from blackbox.core.store import Store
from blackbox.recorder import providers
from blackbox.replay.engine import fork, savings

Event = Callable[[dict], None]

PROMPT = """You are debugging an AI agent run that FAILED. One step has been identified as the cause.
Propose up to {n} different fixes for THAT step. Return JSON only:
{{"candidates": [{{"fix": "add_rule" | "model" | "args", "value": ..., "rationale": "one sentence"}}]}}

- "add_rule": value is ONE short instruction to add to that model call (only if the step is a model call).
- "model": value is one of {models} (only if the step is a model call).
- "args": value is an object of argument overrides for the tool/search call (only if it is a tool or search step).

TASK INPUT:
{task}

STEPS (the bad step is marked >>>):
{steps}
{evidence}{history}"""


def _clip(value: Any, n: int = 600) -> str:
    text = value if isinstance(value, str) else canonical(value)
    return text if len(text) <= n else text[:n] + "…"


def _window(trace: Trace, k: int, before: int = 3, after: int = 2) -> str:
    lines = []
    for s in trace.steps[max(0, k - before): k + after + 1]:
        mark = ">>>" if s.idx == k else "   "
        req = s.request.get("messages", [])[-2:] if s.kind == "llm" else s.request.get("args", s.request)
        out = s.error and f"ERROR {s.error}" or s.output
        lines.append(f"{mark} [{s.idx}] {s.kind}:{s.name}\n      asked: {_clip(req)}\n      got:   {_clip(out)}")
    return "\n".join(lines)


def _extract_json(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("no JSON object in the model's reply")
    return json.loads(match.group(0))


def _to_change(trace: Trace, k: int, cand: dict, models: list[str]) -> Change | None:
    step = trace.steps[k]
    fix, value = cand.get("fix"), cand.get("value")
    note = str(cand.get("rationale", ""))[:300]
    if step.kind == "llm" and fix == "add_rule" and isinstance(value, str) and value.strip():
        messages = list(step.request.get("messages", []))
        rule = {"role": "system", "content": value.strip()}
        insert_at = next((i + 1 for i, m in enumerate(messages) if m.get("role") == "system"), 0)
        return Change(kind="messages", value=messages[:insert_at] + [rule] + messages[insert_at:],
                      note=f"add_rule: {value.strip()} | {note}")
    if step.kind == "llm" and fix == "model" and value in models and value != step.request.get("model_id"):
        return Change(kind="model", value=value, note=note)
    if step.kind in ("tool", "retrieval") and fix == "args" and isinstance(value, dict) and value:
        return Change(kind="args", value=value, note=note)
    return None


def propose(trace: Trace, k: int, *, n: int = 4, evidence: str = "", history: str = "",
            judge: str = "judge-large", models: list[str] | None = None) -> tuple[list[Change], list[dict]]:
    models = models or [m for m in providers.load_registry() if m.startswith("agent-")]
    prompt = PROMPT.format(n=n, models=models, task=_clip(trace.run.task_input, 1500),
                           steps=_window(trace, k),
                           evidence=f"\nEVIDENCE:\n{evidence}\n" if evidence else "",
                           history=f"\nALREADY TRIED (all still failed):\n{history}\n" if history else "")
    reply = providers.chat(judge, [{"role": "user", "content": prompt}])
    rejected: list[dict] = []
    try:
        raw = _extract_json(reply.text).get("candidates", [])
    except (ValueError, json.JSONDecodeError) as exc:
        return [], [{"reason": f"unparseable reply: {exc}", "reply": reply.text[:500]}]
    changes, seen = [], set()
    for cand in raw[:n]:
        ch = _to_change(trace, k, cand if isinstance(cand, dict) else {}, models)
        if ch is None:
            rejected.append({"reason": "not applicable to this step", "candidate": cand})
        elif (key := canonical(ch.model_dump(mode="json"))) not in seen:
            seen.add(key)
            changes.append(ch)
    return changes, rejected


def repair(
    trace: Trace,
    k: int,
    *,
    store: Store | None = None,
    rounds: int = 2,
    n: int = 4,
    evidence: str = "",
    on_event: Event | None = None,
) -> dict[str, Any]:
    emit = on_event or (lambda e: None)
    cards: list[dict] = []
    history = ""
    for rnd in range(1, rounds + 1):
        emit({"type": "proposing", "round": rnd})
        changes, rejected = propose(trace, k, n=n, evidence=evidence, history=history)
        for r in rejected:
            emit({"type": "rejected", "round": rnd, **r})
        for ch in changes:
            child = fork(trace, k, ch, store=store)
            ok = child.run.status == "done" and child.run.outcome is not None and child.run.outcome.success
            card = {"round": rnd, "change": ch.model_dump(mode="json"), "passed": ok, "run_id": child.run.run_id,
                    "status": child.run.status, "savings": savings(child),
                    "answer": child.run.outcome.final_answer if child.run.outcome else None}
            cards.append(card)
            emit({"type": "candidate", **card})
        if any(c["passed"] for c in cards):
            break
        history = "\n".join(f"- {c['change']['kind']}: {_clip(c['change']['note'] or c['change']['value'], 200)}"
                            f" -> answer {_clip(c['answer'], 100)}" for c in cards)
    winners = sorted((c for c in cards if c["passed"]),
                     key=lambda c: (c["savings"]["steps_executed"], -c["savings"]["tokens_saved"]))
    return {"run_id": trace.run.run_id, "step": k, "cards": cards, "best": winners[0] if winners else None}
