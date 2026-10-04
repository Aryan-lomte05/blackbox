"""GSM8K word problems as Math tasks. The gold number follows '####' in the answer."""

from __future__ import annotations

import json
from pathlib import Path

from blackbox.agents.base import Task
from blackbox.data.download import GSM8K_FILE, RAW_DIR


def gold_number(answer: str) -> str:
    if "####" not in answer:
        raise ValueError(f"GSM8K answer has no '####' marker: {answer[-80:]!r}")
    return answer.rsplit("####", 1)[1].strip().replace(",", "")


def to_task(row: dict) -> Task:
    return Task(
        family="math",
        task_id=f"math-{row['id']}",
        input={"question": row["question"]},
        expected=gold_number(row["answer"]),
    )


def load(n: int | None = None, offset: int = 0, path: Path | None = None) -> list[Task]:
    path = path or RAW_DIR / GSM8K_FILE
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
