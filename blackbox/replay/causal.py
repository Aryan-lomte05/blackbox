"""Causal report: past "which step is suspicious" to "what caused this, and how else could it have gone".

For each suspect step of a failed run, by experiment (forks; unchanged steps re-used):
  NECESSARY   repairing this step alone makes the run pass (Verify)
  SUFFICIENT  putting this step's output into a PASSING run of the same task (the original run for a
              planted mistake, else a passing twin) makes that run fail too
  root cause = necessary and sufficient; contributing = necessary only; sufficient only = another path
  fails as well. If no single step is necessary, pairs of suspects are repaired together
  (failure composition: a JOINT cause). Every intervention that made the run pass is a RECOVERY PATH.
  Blast radius: every later step the cause contaminated, and whether money-moving tools are among them.
Money-moving tools never execute during these re-runs.
"""

from __future__ import annotations

from itertools import combinations
from typing import Any, Callable

from blackbox.core.schema import Change, Trace
from blackbox.core.store import Store
from blackbox.diagnosis.evidence import trail
from blackbox.recorder.context import dry_run_tools
from blackbox.replay.diff import align
from blackbox.replay.engine import fork
from blackbox.replay.fleet import MONEY_TOOLS
from blackbox.replay.verify import _strategies, find_twin, verify

Event = Callable[[dict], None]


def _passed(tr: Trace) -> bool:
    return tr.run.status == "done" and tr.run.outcome is not None and bool(tr.run.outcome.success)


def _reference(store: Store, trace: Trace) -> Trace | None:
    """A passing run of the same task to test sufficiency against."""
    r = trace.run
    if r.parent_run_id and r.patch is not None:
        parent = store.load_trace(r.parent_run_id)
        if _passed(parent):
            return parent
    return find_twin(store, trace)


def sufficient(store: Store, trace: Trace, k: int, ref: Trace | None) -> dict:
    """Does this step's output alone break a passing run?"""
    if ref is None:
        return {"sufficient": None, "note": "no passing run of this task to test against"}
    j = next((b for a, b in align(trace.steps, ref.steps) if a == k and b is not None), None)
    if j is None or ref.steps[j].kind != trace.steps[k].kind:
        return {"sufficient": None, "note": "the passing run has no matching step"}
    if ref.steps[j].output == trace.steps[k].output:
        return {"sufficient": False, "note": "the passing run did exactly the same here"}
    child = fork(ref, j, Change(kind="output", value=trace.steps[k].output, note="sufficiency test"), store=store)
    return {"sufficient": not _passed(child), "run": child.run.run_id, "into": ref.run.run_id,
            "note": f"pasted into step {j} of passing run {ref.run.run_id}: it "
                    f"{'failed' if not _passed(child) else 'still passed'}"}


def _repair_change(trace: Trace, idx: int, twin: Trace | None, strong: str) -> tuple[int, Change | None]:
    strategies = _strategies(trace, idx, twin, strong)
    best = next((s for s in strategies if s[0] != "rerun"), strategies[-1])
    return best[1], best[2]


def joint_causes(store: Store, trace: Trace, suspects: list[int], twin: Trace | None, strong: str,
                 max_pairs: int = 3, emit: Event | None = None) -> list[dict]:
    out = []
    for a, b in list(combinations(sorted(suspects), 2))[:max_pairs]:
        at_a, ch_a = _repair_change(trace, a, twin, strong)
        at_b, ch_b = _repair_change(trace, b, twin, strong)
        if at_a >= at_b:
            continue
        first = fork(trace, at_a, ch_a, store=store)
        if at_b >= len(first.steps) or first.steps[at_b].kind != trace.steps[at_b].kind:
            continue
        both = fork(first, at_b, ch_b, store=store)
        row = {"steps": [a, b], "passed": _passed(both), "run": both.run.run_id}
        out.append(row)
        if emit:
            emit({"type": "pair", **row})
    return out


def blast_radius(trace: Trace, k: int) -> dict:
    hit = trail(trace, k)
    money = [i for i in hit if trace.steps[i].kind == "tool" and trace.steps[i].name in MONEY_TOOLS]
    return {"contaminated": hit, "of_later_steps": len(trace.steps) - k - 1,
            "reaches_answer": any(trace.steps[i].kind == "final" for i in hit),
            "money_moving_steps": money, "severity": "critical" if money else ("high" if hit else "low")}


def causal_report(trace: Trace, store: Store, suspects: list[int], *, strong_model: str = "agent-local-7b",
                  max_pairs: int = 3, on_event: Event | None = None) -> dict[str, Any]:
    if trace.run.outcome is None or trace.run.outcome.success:
        raise ValueError("a causal report needs a finished, failed run")
    emit = on_event or (lambda e: None)
    token = dry_run_tools.set(MONEY_TOOLS | dry_run_tools.get())
    try:
        ver = verify(trace, suspects, store=store, repeats=1, strong_model=strong_model, on_event=emit)
        ref = _reference(store, trace)
        twin = find_twin(store, trace)
        steps, paths = [], []
        for per in ver["suspects"]:
            k = per["step"]
            for st in per["strategies"]:
                win = next((r for r in st["runs"] if r["passed"]), None)
                if win and not (st["strategy"] == "rerun" and per["flaky"]):
                    paths.append({"step": st["forked_at"], "how": st["strategy"], "run": win["run_id"],
                                  "change": st["change"]})
            suf = sufficient(store, trace, k, ref)
            emit({"type": "sufficiency", "step": k, **suf})
            nec = per["verified"]
            verdict = ("bad luck" if per["flaky"] else
                       "root cause (necessary and sufficient)" if nec and suf["sufficient"] else
                       "cause (necessary; sufficiency untested)" if nec and suf["sufficient"] is None else
                       "contributing cause (needed, not enough alone)" if nec else
                       "sufficient but not necessary (the run also fails another way)" if suf["sufficient"] else
                       "not a cause")
            steps.append({"step": k, "kind": per["kind"], "name": per["name"], "necessary": nec,
                          "sufficient": suf["sufficient"], "sufficiency": suf, "causal_effect": per["causal_effect"],
                          "verdict": verdict})
        joint = []
        if ver["verified_step"] is None and len(suspects) >= 2:
            emit({"type": "joint_search", "suspects": suspects[:4]})
            joint = joint_causes(store, trace, suspects[:4], twin, strong_model, max_pairs, emit)
            paths += [{"step": p["steps"], "how": "repair both", "run": p["run"]} for p in joint if p["passed"]]
        cause = ver["verified_step"]
        if cause is None:
            cause = next((p["steps"][0] for p in joint if p["passed"]), None)
        report = {"run_id": trace.run.run_id, "cause": cause, "steps": steps, "joint": joint,
                  "recovery_paths": paths, "blast_radius": blast_radius(trace, cause) if cause is not None else None,
                  "reference_run": ref.run.run_id if ref else None}
        report["summary"] = summarize(report)
        emit({"type": "done", "summary": report["summary"]})
        return report
    finally:
        dry_run_tools.reset(token)


def summarize(rep: dict) -> str:
    lines = []
    for s in rep["steps"]:
        lines.append(f"Step {s['step']} ({s['kind']}:{s['name']}): {s['verdict']}.")
    joint_ok = [p for p in rep["joint"] if p["passed"]]
    if joint_ok:
        lines.append(f"No single step explains it; repairing steps {joint_ok[0]['steps']} together does: a joint cause.")
    n = len(rep["recovery_paths"])
    lines.append(f"{n} verified way{'s' if n != 1 else ''} to recover." if n else "No intervention tried made it pass.")
    br = rep["blast_radius"]
    if br:
        lines.append(f"Blast radius of step {rep['cause']}: {len(br['contaminated'])} of {br['of_later_steps']} later "
                     f"steps{', including the answer' if br['reaches_answer'] else ''}"
                     f"{'; money-moving steps ' + str(br['money_moving_steps']) if br['money_moving_steps'] else ''} "
                     f"(severity {br['severity']}).")
    return " ".join(lines)
