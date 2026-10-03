"""Load BlackBox-3K traces into (X, y, groups) for LightGBM lambdarank.

One ROW per step of a FAILED run with a KNOWN guilty step.
One GROUP per run (LightGBM lambdarank groups = runs).
LABEL: 1 if this step is the guilty step, else 0.

LEAK RULES:
- Only failed runs with label.root_cause_step are used for training.
- test_new_tasks is NEVER passed here for training.
- Embeddings/scalers are fit on train only (passed in, not re-fit here).
"""
from __future__ import annotations

import gzip
import json
from pathlib import Path

import numpy as np

from blackbox.core.schema import Trace
from blackbox.diagnosis.embeddings import OddnessBank
from blackbox.diagnosis.features import extract_features

DATASET_ROOT = Path("/Users/aditya4/Downloads/blackbox-3k")


def _get_root_cause(label: object) -> int | None:
    if label is None:
        return None
    if isinstance(label, dict):
        return label.get("root_cause_step")
    return getattr(label, "root_cause_step", None)


def _get_success(outcome: object) -> bool:
    if outcome is None:
        return False
    if isinstance(outcome, dict):
        return bool(outcome.get("success", False))
    return bool(getattr(outcome, "success", False))


def load_traces(split_path: str | Path, labelled_only: bool = True) -> list[Trace]:
    """Load traces from a jsonl or jsonl.gz file. Self-contained in diagnosis."""
    split_path = Path(split_path)
    traces: list[Trace] = []

    opener = gzip.open if str(split_path).endswith(".gz") else open
    with opener(split_path, "rt", encoding="utf-8") as f:
        for line in f:
            line_str = line.strip()
            if not line_str:
                continue
            rec = json.loads(line_str)
            tr = Trace.model_validate(rec.get("trace", rec))
            if labelled_only:
                has_label = _get_root_cause(tr.run.label) is not None
                is_failed = not _get_success(tr.run.outcome)
                if not (has_label and is_failed):
                    continue
            traces.append(tr)
    return traces


def build_arrays(
    traces: list[Trace],
    *,
    include_monitor: bool,
    bank: OddnessBank | None = None,
) -> tuple[np.ndarray, np.ndarray, list[int]]:
    """Build feature matrix X, ground truth binary labels y, and query groups.

    Returns:
        X:      (n_samples, n_features) float32
        y:      (n_samples,) int32 — 1 for guilty step, 0 for others
        groups: list[int] — number of steps per run (LightGBM group format)
    """
    X_rows: list[list[float]] = []
    y_rows: list[int] = []
    groups: list[int] = []

    for tr in traces:
        steps = [s for s in tr.steps if s.kind != "final"]
        if not steps:
            continue
        guilty = _get_root_cause(tr.run.label)

        # Only include runs where the guilty step is actually in our steps list
        if guilty is None or not any(s.idx == guilty for s in steps):
            continue

        group_X: list[list[float]] = []
        group_y: list[int] = []
        for s in steps:
            oddness = bank.score(s) if bank else 1.0
            row = extract_features(
                s,
                tr.run,
                tr.steps,
                include_monitor=include_monitor,
                oddness_score=oddness,
            )
            group_X.append(row)
            group_y.append(1 if s.idx == guilty else 0)

        X_rows.extend(group_X)
        y_rows.extend(group_y)
        groups.append(len(group_X))

    X = np.array(X_rows, dtype=np.float32) if X_rows else np.zeros((0, 14 if not include_monitor else 20), dtype=np.float32)
    y = np.array(y_rows, dtype=np.int32) if y_rows else np.zeros((0,), dtype=np.int32)
    return X, y, groups
