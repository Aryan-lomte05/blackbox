"""Baselines every learned method has to beat (SYSTEM.md §7).

Each is a function Trace -> ranking of step indices, most suspect first.
None of them looks at the label, the planted mistake, or anything else a
user would not have for a real failure.

    last_step     the step right before the answer, then backwards
    first_error   steps that raised an error, earliest first; then the rest, earliest first
    random        scored as an expectation: see metrics.expected_random
"""

from __future__ import annotations

from typing import Callable

from blackbox.core.schema import Trace
from blackbox.eval.metrics import candidates

Predictor = Callable[[Trace], "list[int] | None"]  # None = this method has no prediction for this run


def last_step(trace: Trace) -> list[int]:
    return sorted(candidates(trace), reverse=True)


def first_error(trace: Trace) -> list[int]:
    cand = candidates(trace)
    errors = [i for i in cand if trace.steps[i].error is not None]
    return errors + [i for i in cand if i not in errors]


BASELINES: dict[str, Predictor] = {"last_step": last_step, "first_error": first_error}
