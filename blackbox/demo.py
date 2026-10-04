"""`blackbox demo`: the whole investigation on one real failed run, printed as a story.

    blackbox demo                       # newest failed run in the DB
    blackbox demo --run <run_id>
    blackbox demo --repeats 1           # fewer calls (free OpenRouter keys are rate-limited)

Steps: diagnose -> verify (prove the cause) -> repair (GenAI fixes, each tested)
-> compare (original vs fixed). Every number printed is read from the runs
it creates; nothing is assumed.
"""

from __future__ import annotations

import json
import sys

from blackbox.core.schema import Trace
from blackbox.core.store import Store


def _say(text: str = "") -> None:
    print(text, flush=True)


def _short(value, n: int = 90) -> str:
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, default=str)
    text = " ".join(text.split())
    return text if len(text) <= n else text[: n - 1] + "…"


def pick_failed(store: Store, run_id: str | None) -> Trace | None:
    if run_id:
        return store.load_trace(run_id)
    for run in store.list_runs(success=False, limit=200):
        if run.status == "done" and run.parent_run_id is None and run.fault is None:
            return store.load_trace(run.run_id)  # a natural failure is the honest demo
    for run in store.list_runs(success=False, limit=200):
        if run.status == "done":
            return store.load_trace(run.run_id)
    return None


def demo(store: Store, run_id: str | None = None, repeats: int = 1, repair_rounds: int = 1) -> int:
    import blackbox.agents.builtin  # noqa: F401 - registers our agents so their runs can be replayed
    from blackbox.api.main import diagnose
    from blackbox.replay.diff import compare
    from blackbox.replay.repair import repair
    from blackbox.replay.verify import verify

    trace = pick_failed(store, run_id)
    if trace is None:
        _say("No failed run recorded yet. Generate some: py -3 -m blackbox.data.farm --family qa --n 20")
        return 1
    r = trace.run
    _say(f"✈  RUN {r.run_id}  ({r.agent}, model {r.model_id}, {len(trace.steps)} steps)")
    _say(f"   task:     {_short(r.task_input.get('question') or r.task_input, 100)}")
    _say(f"   answer:   {_short(r.outcome.final_answer)}")
    _say(f"   expected: {_short(r.outcome.expected)}   →  FAILED")
    if r.fault:
        _say(f"   (planted mistake {r.fault.type} at step {r.fault.step_idx}: the demo must find it)")

    diag = diagnose(trace)
    suspects = diag["suspects"]
    _say(f"\n🔎 DIAGNOSE  suspects {suspects}   [{diag['source']}]")
    for idx in suspects:
        s = trace.steps[idx]
        _say(f"   step {idx}: {s.kind}:{s.name}  → {_short(s.error or s.output, 70)}")

    _say("\n🧪 VERIFY  re-running with one suspect repaired at a time…")
    report = verify(trace, suspects, store=store, repeats=repeats,
                    on_event=lambda e: e["type"] == "result" and _say(
                        f"   step {e['step']} via {e['strategy']:8} → {'PASS' if e['passed'] else 'fail'}"
                        f"   (re-ran {e['savings']['steps_executed']}/{e['savings']['steps_total']} steps)"))
    for s in report["suspects"]:
        _say(f"   ⇒ step {s['step']}: {s['verdict']} (causal effect {s['causal_effect']})")
    cause = report["verified_step"]
    if cause is None:
        _say("   No single suspect verified. Honest result: the cause is elsewhere or needs two fixes at once.")
        return 0
    _say(f"   ✅ VERIFIED ROOT CAUSE: step {cause}")
    if r.fault:
        _say(f"   planted mistake was at step {r.fault.step_idx}: "
             f"{'match' if r.fault.step_idx == cause else 'different step'}")

    _say(f"\n🛠  REPAIR  asking judge-large for fixes at step {cause} (each one tested by replay)…")
    rep = repair(trace, cause, store=store, rounds=repair_rounds,
                 on_event=lambda e: e["type"] == "candidate" and _say(
                     f"   {'✅' if e['passed'] else '❌'} {e['change']['kind']:8} {_short(e['change']['note'], 70)}"
                     f"  (re-ran {e['savings']['steps_executed']} steps, saved {e['savings']['tokens_saved']} tokens)"))
    best = rep["best"]
    if best is None:
        _say("   No proposed fix passed. Shown as-is: nothing is claimed that replay did not confirm.")
        return 0

    fixed = store.load_trace(best["run_id"])
    cmp = compare(trace, fixed)
    _say(f"\n🔁 COMPARE  first difference at aligned position {cmp['first_divergence']}, "
         f"{cmp['n_changed']} steps changed, outcome flipped: {cmp['outcome']['flipped']}")
    _say(f"   fixed answer: {_short(fixed.run.outcome.final_answer)}")
    _say(f"\nOpen in the UI: /runs/{r.run_id}  vs  /runs/{fixed.run.run_id}")
    return 0


def main(argv: list[str] | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(prog="blackbox demo")
    p.add_argument("--run")
    p.add_argument("--repeats", type=int, default=1)
    p.add_argument("--data", default=None)
    args = p.parse_args(argv)
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")
    return demo(Store(args.data) if args.data else Store(), args.run, args.repeats)


if __name__ == "__main__":
    sys.exit(main())
