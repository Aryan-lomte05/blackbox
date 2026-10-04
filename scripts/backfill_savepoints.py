"""Write save-points that are missing from the store (runs planted before the farm.plant fix).

    py -3 scripts/backfill_savepoints.py            # report and fix
    py -3 scripts/backfill_savepoints.py --check    # report only

Each affected run is replayed from its own recording (0 model calls). Save-points are content-addressed, so
the replay recomputes exactly the missing files. Only save-points are written: the replay itself is not saved
as a new run. A run whose replay produces a different save-point is reported, never patched over.
"""

from __future__ import annotations

import argparse
import sys

from blackbox.core.store import DEFAULT_DIR, Store


class SavePointsOnly:
    """Store adapter for the replay: keeps save-points, drops everything else."""

    def __init__(self, store: Store):
        self._store = store

    def put_blob(self, value) -> str:
        return self._store.put_blob(value)

    def has_blob(self, digest: str) -> bool:
        return self._store.has_blob(digest)

    def get_blob(self, digest: str):
        return self._store.get_blob(digest)

    def save_trace(self, trace) -> None:  # the replay is not a new run
        return None

    def load_trace(self, run_id: str):
        return self._store.load_trace(run_id)


def missing(store: Store, trace) -> list[int]:
    return [s.idx for s in trace.steps if s.state_hash_after and not store.has_blob(s.state_hash_after)]


def main(argv: list[str] | None = None) -> int:
    import blackbox.agents.builtin  # noqa: F401 - the agents must be registered to replay their runs
    from blackbox.replay.engine import replay

    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--data", default=str(DEFAULT_DIR))
    ap.add_argument("--check", action="store_true", help="report only")
    args = ap.parse_args(argv)
    store = Store(args.data)
    affected = fixed = still = failed = 0
    try:
        for run in store.list_runs(limit=1_000_000):
            trace = store.load_trace(run.run_id)
            gaps = missing(store, trace)
            if not gaps:
                continue
            affected += 1
            if args.check:
                continue
            try:
                replay(trace, store=SavePointsOnly(store))
            except Exception as exc:  # noqa: BLE001 - reported, the backfill continues
                failed += 1
                print(f"cannot replay {run.run_id}: {type(exc).__name__}: {exc}", file=sys.stderr)
                continue
            if missing(store, trace):
                still += 1
                print(f"{run.run_id}: replay produced different save-points; left as is", file=sys.stderr)
            else:
                fixed += 1
    finally:
        store.close()
    print(f"runs missing save-points: {affected}; fixed {fixed}; differing {still}; could not replay {failed}")
    return 0 if (args.check or still + failed == 0) else 1


if __name__ == "__main__":
    sys.exit(main())
