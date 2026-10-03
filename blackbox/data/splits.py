"""Splits are by task id (SYSTEM.md §3.3, CLAUDE.md hard rule 6).

A run, its planted-mistake forks and its counterfactual forks carry the same
task id, so the same question never sits in both training and test.

    train / val / calib / test_known   70 / 10 / 10 / 10 % of QA + Math tasks
    test_new_tasks                     every Shop ("ops") task

The bucket comes from sha1, not Python's hash(): hash() of a string is
salted per process, so two machines would split the same task differently.
"""

from __future__ import annotations

import hashlib

BUCKETS = (("train", 70), ("val", 80), ("calib", 90), ("test_known", 100))
NEW_TASK_FAMILIES = ("ops",)


def bucket(task_id: str) -> int:
    """Stable 0-99 bucket for a task id."""
    return int(hashlib.sha1(task_id.encode("utf-8")).hexdigest()[:8], 16) % 100


def split_for(task_id: str, family: str) -> str:
    if family in NEW_TASK_FAMILIES:
        return "test_new_tasks"
    b = bucket(task_id)
    return next(name for name, upper in BUCKETS if b < upper)
