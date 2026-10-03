"""Move runs between machines (SYSTEM.md §4.1). Owner: Aryan.

Each machine exports its runs to one gzip'd JSON-lines file; the files are
shared via the Drive folder and merged into the central DB.

    py -3 -m blackbox.data.shards export --out data/shards/          # this machine's runs
    py -3 -m blackbox.data.shards merge data/shards/                  # every *.jsonl.gz in the folder

One line per run: {"trace": Trace, "blobs": {hash: save-point}}. Merging is
idempotent: a run already present is skipped, so re-merging a folder is safe.
"""

from __future__ import annotations

import argparse
import gzip
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from blackbox.agents.base import machine_name
from blackbox.core.schema import Trace
from blackbox.core.store import DEFAULT_DIR, Store


def export(store: Store, out_dir: Path, *, machine: str | None = None, since: str | None = None) -> Path:
    machine = machine or machine_name()
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    path = out_dir / f"{machine}_{stamp}.jsonl.gz"
    n = 0
    with gzip.open(path, "wt", encoding="utf-8") as fh:
        offset = 0
        while True:
            batch = store.list_runs(limit=500, offset=offset)
            if not batch:
                break
            offset += len(batch)
            for run in batch:
                if since and run.created_at < since:
                    continue
                if run.machine and run.machine != machine:
                    continue  # merged from elsewhere: that machine exports it
                tr = store.load_trace(run.run_id)
                blobs = {s.state_hash_after: store.get_blob(s.state_hash_after)
                         for s in tr.steps if s.state_hash_after and store.has_blob(s.state_hash_after)}
                fh.write(json.dumps({"trace": tr.model_dump(mode="json"), "blobs": blobs}) + "\n")
                n += 1
    print(f"exported {n} runs -> {path}")
    return path


def merge(store: Store, paths: list[Path]) -> dict:
    files = [p for x in paths for p in (sorted(x.glob("*.jsonl.gz")) if x.is_dir() else [x])]
    added = skipped = bad = 0
    for f in files:
        with gzip.open(f, "rt", encoding="utf-8") as fh:
            for line_no, line in enumerate(fh, 1):
                try:
                    rec = json.loads(line)
                    tr = Trace.model_validate(rec["trace"])
                except Exception as exc:  # noqa: BLE001 - reported, never silently dropped
                    bad += 1
                    print(f"  {f.name}:{line_no}: unreadable ({type(exc).__name__}: {exc})", file=sys.stderr)
                    continue
                try:
                    store.load_trace(tr.run.run_id)
                    skipped += 1
                    continue
                except KeyError:
                    pass
                for value in rec.get("blobs", {}).values():
                    store.put_blob(value)
                store.save_trace(tr)
                added += 1
    result = {"files": len(files), "added": added, "already_present": skipped, "unreadable": bad}
    print(json.dumps(result))
    return result


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="blackbox.data.shards")
    p.add_argument("--data", default=str(DEFAULT_DIR))
    sub = p.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("export")
    e.add_argument("--out", default="data/shards")
    e.add_argument("--since", help="ISO time; only runs created after it")
    m = sub.add_parser("merge")
    m.add_argument("paths", nargs="+")
    args = p.parse_args(argv)
    store = Store(args.data)
    if args.cmd == "export":
        export(store, Path(args.out), since=args.since)
        return 0
    return 0 if merge(store, [Path(x) for x in args.paths])["unreadable"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
