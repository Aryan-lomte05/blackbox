"""Task loaders: one module per task family, each with load(n, offset) -> list[Task]."""

from __future__ import annotations

from blackbox.agents.base import Task


def load_tasks(family: str, n: int | None = None, offset: int = 0) -> list[Task]:
    if family == "qa":
        from blackbox.data.tasks import hotpot

        return hotpot.load(n, offset)
    if family == "math":
        from blackbox.data.tasks import gsm8k

        return gsm8k.load(n, offset)
    if family == "ops":
        from blackbox.data.tasks import ops_tasks

        return ops_tasks.load(n, offset)
    raise KeyError(f"no task loader for family {family!r}. Known: math, ops, qa")
