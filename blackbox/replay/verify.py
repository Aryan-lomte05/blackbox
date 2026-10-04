"""Verify (SYSTEM.md §6.2, USPs U13, U14): prove which suspect caused a failure.

For each suspect step, re-run the failed run with only that step repaired:

  twin      the matching step from a passing run of the same task (U7)
  stronger  the same model call re-asked with a stronger model
  rerun     the step re-executed with no change, nothing re-used after it:
            if this alone fixes the run, the failure was bad luck, not this step

Each live strategy is repeated `repeats` times. A suspect is VERIFIED when a
repair (not a plain rerun) makes the run pass in at least half the attempts.
The same routine labels natural failures for the test set (label.source =
"verified"), so labels come from experiments, never from the model under test.
"""

from __future__ import annotations

from typing import Any, Callable

from blackbox.core.schema import Change, Label, Step, Trace
from blackbox.core.store import Store
from blackbox.replay.autopilot import decision_step
from blackbox.replay.diff import align
from blackbox.replay.engine import fork, savings

Event = Callable[[dict], None]


def find_twin(store: Store, trace: Trace) -> Trace | None:
    """A passing run of the same task (not a fork of a fork of this one)."""
    for run in store.list_runs(task_id=trace.run.task_id, success=True, limit=20):
        if run.run_id != trace.run.run_id and run.agent == trace.run.agent:
            return store.load_trace(run.run_id)
    return None


def _twin_change(trace: Trace, twin: Trace, idx: int) -> Change | None:
    for i, j in align(trace.steps, twin.steps):
        if i == idx and j is not None and twin.steps[j].kind == trace.steps[idx].kind:
            if twin.steps[j].output != trace.steps[idx].output:
                return Change(kind="output", value=twin.steps[j].output, note=f"from passing run "
                              f"{twin.run.run_id} step {j}")
    return None


def answer_steps(trace: Trace) -> set[int]:
    """Steps whose output the final answer is built from directly."""
    finals = [s for s in trace.steps if s.kind == "final"]
    if not finals:
        return set()
    direct = set(finals[-1].parents)
    return direct or {finals[-1].idx - 1}


def _strategies(trace: Trace, idx: int, twin: Trace | None, strong_model: str) -> list[tuple[str, int, Change | None, bool]]:
    """(name, step to fork at, change, deterministic?)"""
    out = []
    # Pasting a passing run's output into a step that writes the answer always "fixes"
    # the run: it copies the answer and proves nothing. Twins are evidence only upstream.
    if twin is not None and idx not in answer_steps(trace) and (ch := _twin_change(trace, twin, idx)) is not None:
        out.append(("twin", idx, ch, True))
    target = decision_step(trace.steps, idx)
    if trace.steps[target].kind == "llm":
        if trace.steps[target].request.get("model_id") != strong_model:
            out.append(("stronger", target, Change(kind="model", value=strong_model), False))
        else:
            # The step already ran on the verify model, so "a stronger model" is the same model. Re-ask it with a
            # double-check instruction instead: still a different answer at exactly this step, on the same model.
            messages = [*trace.steps[target].request.get("messages", []), {"role": "system", "content": CAREFUL}]
            out.append(("careful", target, Change(kind="messages", value=messages, note="re-asked with a double-check"),
                        False))
    out.append(("rerun", idx, None, False))
    return out


CAREFUL = ("Before you answer, double-check your previous step against the information you were given. If something "
           "does not match the question or the evidence, correct it. Then continue exactly as instructed.")


def verify_model() -> str:
    """The model Verify re-asks a suspect step with: BLACKBOX_VERIFY_MODEL (models.yaml id), default the local 7B.
    For a hosted model in the morning: BLACKBOX_VERIFY_MODEL=agent-strong-groq."""
    import os

    return os.environ.get("BLACKBOX_VERIFY_MODEL") or "agent-local-7b"


def verify(
    trace: Trace,
    suspects: list[int],
    *,
    store: Store | None = None,
    strong_model: str | None = None,
    repeats: int = 3,
    on_event: Event | None = None,
    stop_at_first: bool = False,
) -> dict[str, Any]:
    """Root cause = the EARLIEST verified step (SYSTEM.md §6.2): later steps that a
    repair also flips are downstream symptoms. stop_at_first trades that for speed."""
    if trace.run.outcome is None or trace.run.outcome.success:
        raise ValueError("verify needs a finished, failed run")
    emit = on_event or (lambda e: None)
    strong_model = strong_model or verify_model()
    twin = find_twin(store, trace) if store is not None else None
    results = []
    verified: int | None = None
    for idx in suspects:
        per = {"step": idx, "kind": trace.steps[idx].kind, "name": trace.steps[idx].name, "strategies": []}
        for name, at, change, deterministic in _strategies(trace, idx, twin, strong_model):
            attempts = []
            for attempt in range(1 if deterministic else repeats):
                emit({"type": "attempt", "step": idx, "strategy": name, "attempt": attempt + 1})
                # Repair ONLY this step: later steps are re-used unless the repair changes their inputs.
                # (Re-running everything after it would regenerate a later mistake and blame this step.)
                child = fork(trace, at, change, store=store, reuse_after_fork=True)
                ok = child.run.status == "done" and child.run.outcome is not None and child.run.outcome.success
                attempts.append({"run_id": child.run.run_id, "passed": ok, "status": child.run.status,
                                 "savings": savings(child)})
                emit({"type": "result", "step": idx, "strategy": name, **attempts[-1]})
            flips = sum(a["passed"] for a in attempts)
            per["strategies"].append({"strategy": name, "forked_at": at, "flipped": flips,
                                      "attempts": len(attempts), "runs": attempts,
                                      "change": change.model_dump(mode="json") if change else None})
        rerun = next(s for s in per["strategies"] if s["strategy"] == "rerun")
        # "Bad luck" only exists for model calls, which can answer differently each time. A tool or
        # search step is a deterministic function: if re-running it fixes the run, its recorded output
        # was wrong (a planted mistake or a transient tool failure), so the rerun counts as a repair.
        deterministic_step = trace.steps[idx].kind in ("tool", "retrieval")
        repair = [s for s in per["strategies"] if s["strategy"] != "rerun" or deterministic_step]
        best = max(repair, key=lambda s: s["flipped"] / s["attempts"], default=None)
        per["flaky"] = (not deterministic_step) and rerun["flipped"] * 2 >= rerun["attempts"] and rerun["flipped"] > 0
        per["causal_effect"] = round(best["flipped"] / best["attempts"], 3) if best else 0.0
        per["verified"] = bool(best) and per["causal_effect"] >= 0.5 and not per["flaky"]
        # Credit the step where the working fix was applied: a tool step whose
        # input came from a bad model decision is a symptom; the decision is the cause.
        per["cause_step"] = best["forked_at"] if per["verified"] else None
        per["verdict"] = ("verified" if per["verified"] else "bad luck (plain rerun fixes it)" if per["flaky"]
                          else "not the cause")
        results.append(per)
        emit({"type": "verdict", **{k: per[k] for k in ("step", "cause_step", "verdict", "causal_effect", "flaky")}})
        if per["verified"]:
            verified = per["cause_step"] if verified is None else min(verified, per["cause_step"])
            if stop_at_first:
                break
    return {"run_id": trace.run.run_id, "verified_step": verified, "suspects": results,
            "twin_run": twin.run.run_id if twin else None}


def label_from_verification(trace: Trace, report: dict, store: Store | None = None) -> Label | None:
    """Turn a verification into a test label for a natural failure (Radhesh's test_natural)."""
    if report["verified_step"] is None:
        return None
    cause = next(s for s in report["suspects"] if s.get("cause_step") == report["verified_step"])
    label = Label(root_cause_step=report["verified_step"], source="verified",
                  notes=f"causal effect {cause['causal_effect']}; suspect {cause['step']}")
    trace.run.label = label
    if store is not None:
        store.save_trace(trace)
    return label


def suspects_by_position(trace: Trace) -> list[int]:
    """Fallback ordering until the trained ranker is wired in: errors first, then model calls late-to-early."""
    steps: list[Step] = [s for s in trace.steps if s.kind != "final"]
    errors = [s.idx for s in steps if s.error]
    rest = sorted((s.idx for s in steps if not s.error), key=lambda i: (trace.steps[i].kind != "llm", -i))
    return errors + rest
