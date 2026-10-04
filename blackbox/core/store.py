"""SQLite for runs and steps, fingerprint-named files for large values (save-points).

Identical save-points are written once (USP U3).
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
from pathlib import Path
from typing import Any

from blackbox.core.hashing import canonical, fingerprint
from blackbox.core.privacy import redact
from blackbox.core.schema import Run, Step, Trace

DEFAULT_DIR = Path(os.environ.get("BLACKBOX_DATA", "data"))

_SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY,
    task_family TEXT, task_id TEXT, agent TEXT, model_id TEXT,
    parent_run_id TEXT, split TEXT, status TEXT,
    success INTEGER, has_label INTEGER, fault_type TEXT,
    created_at TEXT, body TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS runs_task ON runs(task_id);
CREATE INDEX IF NOT EXISTS runs_parent ON runs(parent_run_id);
CREATE TABLE IF NOT EXISTS steps (
    run_id TEXT NOT NULL, idx INTEGER NOT NULL, body TEXT NOT NULL,
    PRIMARY KEY (run_id, idx)
);
"""


class Store:
    def __init__(self, root: Path | str = DEFAULT_DIR, *, redact: bool | None = None):
        self.root = Path(root)
        self.redact = redact if redact is not None else os.environ.get("BLACKBOX_REDACT", "") in ("1", "true", "yes")
        self.blob_dir = self.root / "blobs"
        self.blob_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._writes = 0  # in-process writes, part of revision()
        self._counts_cache: tuple | None = None
        self._db = sqlite3.connect(self.root / "blackbox.db", check_same_thread=False)
        self._db.executescript(_SCHEMA)
        self._db.commit()

    # ---- blobs -------------------------------------------------------------
    def put_blob(self, value: Any) -> str:
        if self.redact:
            value, _ = redact(value)
        digest = fingerprint(value)
        path = self._blob_path(digest)
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(".tmp")
            tmp.write_text(canonical(value), encoding="utf-8")
            os.replace(tmp, path)
        return digest

    def get_blob(self, digest: str) -> Any:
        return json.loads(self._blob_path(digest).read_text(encoding="utf-8"))

    def has_blob(self, digest: str) -> bool:
        return self._blob_path(digest).exists()

    def _blob_path(self, digest: str) -> Path:
        return self.blob_dir / digest[:2] / f"{digest}.json"

    # ---- runs --------------------------------------------------------------
    def save_trace(self, trace: Trace) -> None:
        if self.redact:
            trace = self._redacted(trace)
        run = trace.run
        row = (
            run.run_id, run.task_family, run.task_id, run.agent, run.model_id,
            run.parent_run_id, run.split, run.status,
            None if run.outcome is None else int(run.outcome.success),
            int(run.label is not None and run.label.root_cause_step is not None),
            run.fault.type if run.fault else None,
            run.created_at, run.model_dump_json(),
        )
        with self._lock:
            self._db.execute("INSERT OR REPLACE INTO runs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", row)
            self._db.execute("DELETE FROM steps WHERE run_id = ?", (run.run_id,))
            self._db.executemany(
                "INSERT INTO steps VALUES (?,?,?)",
                [(run.run_id, s.idx, s.model_dump_json()) for s in trace.steps],
            )
            self._db.commit()
            self._writes += 1

    @staticmethod
    def _redacted(trace: Trace) -> Trace:
        """Mask personal data in everything stored. input_hash stays as computed from the
        original, so replay still recognises the same step."""
        masked_total = 0
        steps = []
        for s in trace.steps:
            data = s.model_dump(mode="json")
            for key in ("request", "output", "state_diff", "error"):
                data[key], n = redact(data[key])
                masked_total += n
            steps.append(Step.model_validate(data))
        run = trace.run.model_copy(deep=True)
        run.task_input, n = redact(run.task_input)
        masked_total += n
        run.task_expected, n = redact(run.task_expected)
        masked_total += n
        if run.error:
            run.error, n = redact(run.error)
            masked_total += n
        if run.outcome is not None:
            data, n = redact(run.outcome.model_dump(mode="json"))
            run.outcome = type(run.outcome).model_validate(data)
            masked_total += n
        run.stats = {**run.stats, "privacy_masks": masked_total}
        return Trace(run=run, steps=steps)

    def load_trace(self, run_id: str) -> Trace:
        with self._lock:
            row = self._db.execute("SELECT body FROM runs WHERE run_id = ?", (run_id,)).fetchone()
            if row is None:
                raise KeyError(f"no run {run_id!r}")
            steps = self._db.execute(
                "SELECT body FROM steps WHERE run_id = ? ORDER BY idx", (run_id,)
            ).fetchall()
        return Trace(run=Run.model_validate_json(row[0]), steps=[Step.model_validate_json(s[0]) for s in steps])

    def list_runs(
        self,
        *,
        task_family: str | None = None,
        task_id: str | None = None,
        success: bool | None = None,
        split: str | None = None,
        fault_type: str | None = None,
        parent_run_id: str | None = None,
        has_label: bool | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Run]:
        where, args = [], []
        if has_label is not None:
            where.append("has_label = ?")
            args.append(int(has_label))
        for col, val in (
            ("task_family", task_family), ("task_id", task_id), ("split", split),
            ("fault_type", fault_type), ("parent_run_id", parent_run_id),
        ):
            if val is not None:
                where.append(f"{col} = ?")
                args.append(val)
        if success is not None:
            where.append("success = ?")
            args.append(int(success))
        sql = "SELECT body FROM runs"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        with self._lock:
            rows = self._db.execute(sql, (*args, limit, offset)).fetchall()
        return [Run.model_validate_json(r[0]) for r in rows]

    def count_runs(
        self,
        *,
        task_family: str | None = None,
        task_id: str | None = None,
        success: bool | None = None,
        split: str | None = None,
        fault_type: str | None = None,
        parent_run_id: str | None = None,
        has_label: bool | None = None,
    ) -> int:
        where, args = [], []
        if has_label is not None:
            where.append("has_label = ?")
            args.append(int(has_label))
        for col, val in (
            ("task_family", task_family), ("task_id", task_id), ("split", split),
            ("fault_type", fault_type), ("parent_run_id", parent_run_id),
        ):
            if val is not None:
                where.append(f"{col} = ?")
                args.append(val)
        if success is not None:
            where.append("success = ?")
            args.append(int(success))
        sql = "SELECT COUNT(*) FROM runs"
        if where:
            sql += " WHERE " + " AND ".join(where)
        with self._lock:
            return self._db.execute(sql, tuple(args)).fetchone()[0]

    def revision(self) -> tuple:
        """Changes whenever runs are added or re-labelled (cheap: the runs table only). Keys expensive caches."""
        with self._lock:
            row = self._db.execute("SELECT COUNT(*), MAX(created_at), COALESCE(SUM(has_label), 0) FROM runs").fetchone()
        return (*row, self._writes)

    def counts(self) -> dict:
        """Totals, memoized per revision(): the save-point count scans every step and the blob folder."""
        rev = self.revision()
        if self._counts_cache is not None and self._counts_cache[0] == rev:
            return dict(self._counts_cache[1])
        out = self._compute_counts()
        self._counts_cache = (rev, out)
        return dict(out)

    def _compute_counts(self) -> dict:
        with self._lock:
            runs = self._db.execute("SELECT COUNT(*) FROM runs").fetchone()[0]
            steps = self._db.execute("SELECT COUNT(*) FROM steps").fetchone()[0]
            labelled = self._db.execute("SELECT COUNT(*) FROM runs WHERE has_label = 1").fetchone()[0]
            checkpoints = self._db.execute(
                "SELECT COUNT(*) FROM steps WHERE json_extract(body, '$.state_hash_after') IS NOT NULL"
            ).fetchone()[0]
            passed = self._db.execute("SELECT COUNT(*) FROM runs WHERE success = 1").fetchone()[0]
            failed = self._db.execute("SELECT COUNT(*) FROM runs WHERE success = 0").fetchone()[0]
            crashed = self._db.execute("SELECT COUNT(*) FROM runs WHERE status IN ('crashed', 'error')").fetchone()[0]
        blobs = list(self.blob_dir.rglob("*.json"))
        return {
            "runs": runs,
            "steps": steps,
            "labelled_failures": labelled,
            "save_points": checkpoints,
            "unique_save_points": len(blobs),
            "blob_mb": round(sum(p.stat().st_size for p in blobs) / 1e6, 2),
            "passed": passed,
            "failed": failed,
            "crashed": crashed,
        }

    def close(self) -> None:
        self._db.close()
