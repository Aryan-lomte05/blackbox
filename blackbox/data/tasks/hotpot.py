"""HotpotQA questions as QA tasks. Each question brings its own 10 paragraphs."""

from __future__ import annotations

import json
from pathlib import Path

from blackbox.agents.base import Task
from blackbox.data.download import HOTPOT_FILE, RAW_DIR


def to_task(row: dict) -> Task:
    return Task(
        family="qa",
        task_id=f"qa-{row['id']}",
        input={"question": row["question"], "paragraphs": row["paragraphs"]},
        # the agent never sees this; planted search mistakes (F4/F5) need the gold titles
        expected={"answer": row["answer"], "supporting_titles": row["supporting_titles"]},
        meta={"type": row.get("type"), "level": row.get("level")},
    )


def load(n: int | None = None, offset: int = 0, path: Path | None = None) -> list[Task]:
    path = path or RAW_DIR / HOTPOT_FILE
    if not path.exists():
        raise FileNotFoundError(f"{path} is missing. Run: py -3 -m blackbox.data.download")
    tasks: list[Task] = []
    with path.open(encoding="utf-8") as f:
        for i, line in enumerate(f):
            if i < offset:
                continue
            if n is not None and len(tasks) >= n:
                break
            tasks.append(to_task(json.loads(line)))
    return tasks
