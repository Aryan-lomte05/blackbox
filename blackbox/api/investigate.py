"""One call, the whole investigation of one failed run: the 'case file' for the demo.

    case -> steps -> diagnosis -> verify -> compare (-> repair) -> story

Every field is read from recorded runs or from runs this call creates; the
story lines are written from those fields, never the other way round.
"""

from __future__ import annotations

import json
import time
from typing import Any

from blackbox.core.schema import Trace
from blackbox.core.store import Store
from blackbox.replay.diff import compare
from blackbox.replay.verify import verify

FAULT_NAMES = {
    "F1": "wrong tool argument", "F2": "wrong tool result", "F3": "tool returned nothing",
    "F4": "misleading paragraph", "F5": "missing paragraph", "F6": "wrong fact",
    "F7": "wrong tool", "F8": "lost memory", "F9": "dropped instruction", "F10": "answered too early",
}
FAMILY = {"qa": "QA", "math": "Math", "ops": "Shop", "external": "Who&When"}


def _short(v: Any, n: int = 160) -> str:
    t = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False, default=str)
    t = " ".join(t.split())
    return t if len(t) <= n else t[: n - 1] + "…"


def _step_text(s) -> str:
    if s.error:
        return "ERROR " + s.error
    o = s.output or {}
    if "text" in o:
        return o["text"]
    if "docs" in o:
        return " | ".join(f"{d.get('title', d.get('id'))}" for d in o["docs"] if isinstance(d, dict))
    if "answer" in o:
        return json.dumps(o["answer"], default=str)
    return json.dumps(o, default=str)


def case_file(trace: Trace, store: Store, diagnose, *, repeats: int = 1, repair: bool = False,
              strong_model: str | None = None) -> dict[str, Any]:
    t0 = time.perf_counter()
    r = trace.run
    if r.outcome is None or r.outcome.success:
        raise ValueError("the investigation needs a finished, failed run")
    known = r.label.root_cause_step if r.label else None

    case = {
        "run_id": r.run_id, "family": FAMILY.get(r.task_family, r.task_family), "agent": r.agent, "model": r.model_id,
        "task": _short(r.task_input.get("question") or r.task_input.get("problem") or r.task_input.get("request")
                       or r.task_input, 400),
        "answer": r.outcome.final_answer, "expected": r.outcome.expected, "outcome": "FAIL",
        "planted_mistake": ({"type": r.fault.type, "name": FAULT_NAMES.get(r.fault.type, r.fault.type),
                             "step": r.fault.step_idx, "note": r.fault.params.get("note")} if r.fault else None),
        "known_guilty_step": known,
        "known_from": r.label.source if r.label else None,
        "test_set": r.split,
    }
    steps = [{"idx": s.idx, "kind": s.kind, "name": s.name, "node": s.node, "used": s.parents,
              "output": _short(_step_text(s), 220)} for s in trace.steps]

    diag = diagnose(trace)
    suspects = list(diag.get("suspects", []))[:3]
    diagnosis = {"source": diag.get("source"), "model": diag.get("model"), "top3": suspects,
                 "scores": diag.get("scores", [])[:5],
                 "known_guilty_in_top3": (known in suspects) if known is not None else None,
                 "known_guilty_is_first": (bool(suspects) and suspects[0] == known) if known is not None else None}

    rep = verify(trace, suspects, store=store, repeats=repeats, strong_model=strong_model)
    tested = []
    passing_run_id = None
    total_rerun = total_reused = 0
    for s in rep["suspects"]:
        attempts = []
        for st in s["strategies"]:
            for run in st["runs"]:
                total_rerun += run["savings"]["steps_executed"]
                total_reused += run["savings"]["steps_reused"]
                if (run["passed"] and rep["verified_step"] is not None and s.get("cause_step") == rep["verified_step"]
                        and st["forked_at"] == rep["verified_step"]):
                    passing_run_id = passing_run_id or run["run_id"]
            attempts.append({"repair": st["strategy"], "at_step": st["forked_at"],
                             "passed": f"{st['flipped']}/{st['attempts']}",
                             "re_ran": [x["savings"]["steps_executed"] for x in st["runs"]],
                             "re_used": [x["savings"]["steps_reused"] for x in st["runs"]]})
        tested.append({"suspect": s["step"], "verdict": s["verdict"], "cause_step": s.get("cause_step"),
                       "causal_effect": s["causal_effect"], "attempts": attempts})
    cause = rep["verified_step"]
    verification = {"verified_cause": cause, "matches_known_guilty_step": (cause == known) if known is not None and cause is not None else None,
                    "suspects_tested": tested, "steps_re_run_total": total_rerun, "steps_re_used_total": total_reused}

    comparison = None
    if passing_run_id:
        fixed = store.load_trace(passing_run_id)
        c = compare(trace, fixed)
        comparison = {"fixed_run_id": passing_run_id, "fixed_answer": fixed.run.outcome.final_answer if fixed.run.outcome else None,
                      "first_difference_at": c["first_divergence"], "pairs_changed": c["n_changed"],
                      "outcome_flipped": c["outcome"]["flipped"]}

    repairs = None
    if repair and cause is not None:
        from blackbox.replay.repair import repair as run_repair

        rp = run_repair(trace, cause, store=store, rounds=1)
        repairs = {"tried": len(rp["cards"]), "passed": sum(c["passed"] for c in rp["cards"]),
                   "cards": [{"fix": c["change"]["kind"], "note": _short(c["change"].get("note") or "", 160),
                              "passed": c["passed"], "re_ran": c["savings"]["steps_executed"],
                              "answer": c["answer"]} for c in rp["cards"]],
                   "best_run_id": rp["best"]["run_id"] if rp["best"] else None}

    # ---- the story, written only from the fields above ----
    story = [f"1. {case['family']} run {r.run_id} failed: answered {_short(case['answer'], 60)!s}, expected {_short(case['expected'], 60)!s}."]
    if case["planted_mistake"]:
        pm = case["planted_mistake"]
        story.append(f"2. We planted {pm['type']} ({pm['name']}) at step {pm['step']}, so the true guilty step is {known}.")
    elif known is not None:
        story.append(f"2. Nothing was planted; an earlier experiment proved step {known} is the cause.")
    else:
        story.append("2. Nothing was planted and nobody knows the cause yet: this is a real failure.")
    hit = "" if known is None else (" The true guilty step is ranked first." if diagnosis["known_guilty_is_first"]
                                    else " The true guilty step is in the top 3." if diagnosis["known_guilty_in_top3"]
                                    else " The true guilty step is NOT in the top 3.")
    story.append(f"3. The diagnosis model named steps {suspects} as the top suspects ({diagnosis['source']}).{hit}")
    if cause is not None:
        match = "" if known is None else (" That matches the known guilty step." if cause == known
                                          else (f" The known guilty step was {known}; step {cause} is an earlier decision whose repair also saves the run."
                                                if cause < known else
                                                f" The known guilty step was {known}; step {cause} is a later point where the run can also be saved."))
        story.append(f"4. Verify re-ran the run with one suspect repaired at a time and PROVED step {cause} is the cause.{match}")
    else:
        story.append("4. Verify repaired each suspect in turn; none of them alone fixed the run. Honest result: the cause is "
                     "elsewhere, or needs two fixes at once.")
    story.append(f"5. Those experiments re-ran {total_rerun} steps in total and re-used {total_reused} from the recording.")
    if comparison:
        story.append(f"6. Fixed run {comparison['fixed_run_id']} answers {_short(comparison['fixed_answer'], 60)} "
                     f"(first difference at aligned step {comparison['first_difference_at']}; outcome flipped: {comparison['outcome_flipped']}).")
    if repairs:
        story.append(f"7. GenAI proposed {repairs['tried']} fixes for step {cause}; {repairs['passed']} passed when tested by replay.")

    return {"story": story, "case": case, "diagnosis": diagnosis, "verification": verification,
            "comparison": comparison, "repair": repairs, "steps": steps,
            "seconds": round(time.perf_counter() - t0, 1)}
