"""Run the step checker (Laya, no escalation) over recorded runs and save its answers on each step.

    py -3 scripts/backfill_monitor.py [--splits train,val,calib,test_known,test_new_tasks] [--limit N]

Why: both diagnosis models can use the checker's answers (consistent / on_track / mistake type) as
features, but runs recorded before the checker existed have step.monitor = None. The checker reads only
what a step asked and returned (no timing, no tokens), so these features are leak-safe.
Resumable: steps that already have checker answers are skipped.
"""

from __future__ import annotations

import argparse
import sys
import time

from blackbox.core.store import Store


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--splits", default="train,val,calib,test_known,test_new_tasks")
    ap.add_argument("--limit", type=int, default=100000)
    ap.add_argument("--all-runs", action="store_true", help="default: only failed runs with a known guilty step")
    args = ap.parse_args()
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")
    from blackbox.monitor import cascade
    from blackbox.monitor.check import check_step

    cascade.ESCALATE_THRESHOLD = 0.0  # Laya's own answer: fast, local, same tier for every step
    store = Store()
    t0, done, steps, skipped = time.time(), 0, 0, 0
    for split in args.splits.split(","):
        offset = 0
        while done < args.limit:
            batch = store.list_runs(split=split, limit=200, offset=offset,
                                    **({} if args.all_runs else {"has_label": True, "success": False}))
            if not batch:
                break
            offset += len(batch)
            for run in batch:
                if run.status != "done" or done >= args.limit:
                    continue
                tr = store.load_trace(run.run_id)
                changed = False
                for s in tr.steps:
                    if s.kind == "final" or (isinstance(s.monitor, dict) and s.monitor.get("tier")):
                        skipped += s.kind != "final"
                        continue
                    r = check_step(s, tr.run, tr.steps[: s.idx])
                    if r is not None:
                        s.monitor = r
                        changed = True
                        steps += 1
                if changed:
                    store.save_trace(tr)
                done += 1
                if done % 50 == 0:
                    rate = steps / max(1, time.time() - t0)
                    print(f"{done} runs, {steps} steps checked ({rate:.1f} steps/s), {skipped} already had answers", flush=True)
    print(f"done: {done} runs, {steps} steps checked, {skipped} skipped, {time.time() - t0:.0f} s", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
