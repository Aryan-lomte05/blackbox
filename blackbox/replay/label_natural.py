"""Label natural failures by experiment (SYSTEM.md §3.1, Aryan #11).

Natural failures (weak model, no planted mistake) have no known guilty step.
For each one, Verify tries repairing suspects in order. The earliest
verified cause becomes its label, `source="verified"`, and the run joins
`test_natural`. Labels therefore come from experiments, never from the model
under test (CLAUDE.md hard rule 5).

    py -3 -m blackbox.replay.label_natural --limit 50 --max-suspects 4

Agents must be importable: pass --import blackbox.agents.qa_agent etc.
"""

from __future__ import annotations

import argparse
import importlib
import json
import sys

from blackbox.core.store import DEFAULT_DIR, Store
from blackbox.replay.verify import label_from_verification, suspects_by_position, verify


def candidates(store: Store, limit: int) -> list[str]:
    out, offset = [], 0
    while len(out) < limit:
        batch = store.list_runs(success=False, limit=200, offset=offset)
        if not batch:
            break
        offset += len(batch)
        out += [r.run_id for r in batch
                if r.status == "done" and r.fault is None and r.label is None and r.parent_run_id is None]
    return out[:limit]


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="blackbox.replay.label_natural")
    p.add_argument("--data", default=str(DEFAULT_DIR))
    p.add_argument("--limit", type=int, default=50)
    p.add_argument("--max-suspects", type=int, default=4)
    p.add_argument("--repeats", type=int, default=2)
    p.add_argument("--import", dest="imports", action="append", default=[],
                   help="module that registers agents/checkers (repeatable)")
    args = p.parse_args(argv)
    for mod in args.imports:
        importlib.import_module(mod)
    store = Store(args.data)
    stats = {"tried": 0, "labelled": 0, "bad_luck": 0, "unresolved": 0, "errors": 0}
    for run_id in candidates(store, args.limit):
        stats["tried"] += 1
        trace = store.load_trace(run_id)
        try:
            from blackbox.api.main import diagnose  # trained ranker if installed, else fallback order

            order = diagnose(trace)["suspects"] or suspects_by_position(trace)
            report = verify(trace, order[: args.max_suspects], store=store, repeats=args.repeats)
        except Exception as exc:  # noqa: BLE001 - reported per run, the batch continues
            stats["errors"] += 1
            print(f"{run_id}: ERROR {type(exc).__name__}: {exc}", file=sys.stderr)
            continue
        if label_from_verification(trace, report, store) is not None:
            stats["labelled"] += 1
            print(f"{run_id}: cause = step {report['verified_step']}")
        elif any(s["flaky"] for s in report["suspects"]):
            stats["bad_luck"] += 1
            print(f"{run_id}: bad luck (a plain rerun passes)")
        else:
            stats["unresolved"] += 1
            print(f"{run_id}: no single suspect verified")
    print(json.dumps(stats))
    return 0


if __name__ == "__main__":
    sys.exit(main())
