"""Scoring for "find the guilty step" (SYSTEM.md §7).

A method gives, for one failed run, a ranking of step indices, most suspect
first. Against the known guilty step we report:

    top1   the first suspect is the guilty step
    top3   the guilty step is among the first three
    pm1    the first suspect is within one step of the guilty step
    mrr    mean of 1 / rank (0 when the guilty step is not ranked at all)
"""

from __future__ import annotations

import random
from statistics import mean

from blackbox.core.schema import Trace


def candidates(trace: Trace) -> list[int]:
    """Steps that can be blamed: every step except the final answer itself."""
    return [s.idx for s in trace.steps if s.kind != "final"]


def guilty_step(trace: Trace) -> int | None:
    """The known guilty step of a labelled failure, else None."""
    label = trace.run.label
    if label is None or label.root_cause_step is None:
        return None
    return label.root_cause_step if label.root_cause_step in candidates(trace) else None


def bootstrap_ci(values: list[float], reps: int = 1000, seed: int = 0) -> list[float] | None:
    """95% interval of the mean by resampling runs. None below 2 runs."""
    if len(values) < 2:
        return None
    rng = random.Random(seed)
    means = sorted(mean(rng.choices(values, k=len(values))) for _ in range(reps))
    return [round(means[int(0.025 * reps)], 4), round(means[int(0.975 * reps) - 1], 4)]


def score(rankings: list[list[int]], roots: list[int]) -> dict:
    """Metrics over runs. rankings[i] is the method's ranking for the run whose guilty step is roots[i]."""
    if len(rankings) != len(roots):
        raise ValueError(f"{len(rankings)} rankings for {len(roots)} runs")
    if not roots:
        return {"n": 0}
    top1, top3, pm1, rr = [], [], [], []
    for ranking, root in zip(rankings, roots):
        rank = ranking.index(root) + 1 if root in ranking else None
        top1.append(float(rank == 1))
        top3.append(float(rank is not None and rank <= 3))
        pm1.append(float(bool(ranking) and abs(ranking[0] - root) <= 1))
        rr.append(1.0 / rank if rank else 0.0)
    return {"n": len(roots), "top1": round(mean(top1), 4), "top1_ci95": bootstrap_ci(top1),
            "top3": round(mean(top3), 4), "pm1": round(mean(pm1), 4), "mrr": round(mean(rr), 4)}


def expected_random(traces: list[Trace]) -> dict:
    """What picking steps uniformly at random scores on average. Computed, not
    drawn: one random draw per run is noise, and "the first of equal scores"
    is not random at all."""
    top1, top3, pm1, rr = [], [], [], []
    for trace in traces:
        cand, root = candidates(trace), guilty_step(trace)
        n = len(cand)
        top1.append(1 / n)
        top3.append(min(1.0, 3 / n))
        pm1.append(sum(abs(c - root) <= 1 for c in cand) / n)
        rr.append(sum(1 / r for r in range(1, n + 1)) / n)
    if not traces:
        return {"n": 0}
    return {"n": len(traces), "top1": round(mean(top1), 4), "top1_ci95": None, "top3": round(mean(top3), 4),
            "pm1": round(mean(pm1), 4), "mrr": round(mean(rr), 4)}
