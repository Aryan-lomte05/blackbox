"""Split conformal prediction: find the shortest ranked list that contains
the guilty step 90% of the time. SYSTEM.md §6.1.

Uses the calib split, applied at test time to guarantee honest coverage.
"""
from __future__ import annotations

import lightgbm as lgb
import numpy as np


def calibrate(
    model: lgb.Booster,
    X_cal: np.ndarray,
    y_cal: np.ndarray,
    groups_cal: list[int],
    target_coverage: float = 0.90,
) -> int:
    """Find the minimum list size k such that guilty step is in top-k
    for at least target_coverage fraction of calib runs.

    Returns k (the list size to use at test time).
    """
    if len(groups_cal) == 0:
        return 3

    scores = model.predict(X_cal)
    guilty_ranks: list[int] = []
    offset = 0

    for g in groups_cal:
        y_g = y_cal[offset : offset + g]
        s_g = scores[offset : offset + g]
        guilty_idx = np.where(y_g == 1)[0]
        if len(guilty_idx) == 0:
            offset += g
            continue
        ranked = np.argsort(s_g)[::-1]
        rank = int(np.where(ranked == guilty_idx[0])[0][0] + 1)  # 1-indexed
        guilty_ranks.append(rank)
        offset += g

    if not guilty_ranks:
        return 3

    guilty_ranks = sorted(guilty_ranks)
    n = len(guilty_ranks)
    max_rank = max(guilty_ranks)

    # Smallest k such that coverage >= target
    for k in range(1, max_rank + 1):
        coverage = sum(1 for r in guilty_ranks if r <= k) / n
        if coverage >= target_coverage:
            print(
                f"  Conformal k={k} achieves {coverage:.3f} coverage "
                f"on calib (n={n}, target={target_coverage})"
            )
            return k
    return max_rank


def evaluate_coverage(
    model: lgb.Booster,
    X: np.ndarray,
    y: np.ndarray,
    groups: list[int],
    k: int,
    split_name: str,
) -> float:
    """Report actual coverage of list size k on a test split."""
    if len(groups) == 0:
        return 0.0

    scores = model.predict(X)
    correct = 0
    total = 0
    offset = 0

    for g in groups:
        y_g = y[offset : offset + g]
        s_g = scores[offset : offset + g]
        guilty_idx = np.where(y_g == 1)[0]
        if len(guilty_idx) == 0:
            offset += g
            continue
        ranked = np.argsort(s_g)[::-1][:k]
        if guilty_idx[0] in ranked:
            correct += 1
        total += 1
        offset += g

    cov = correct / max(1, total)
    print(f"  {split_name}: k={k} -> coverage {cov:.3f} (n={total})")
    return cov
