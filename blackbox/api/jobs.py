"""Background jobs with replayable event streams (Server-Sent Events).

A job runs in a thread and appends events to its log. Any number of
browsers can subscribe at any time; each gets the full history first, then
live events, then the stream closes after the terminal event.

Event types:
  run jobs:    start | step | done | error
  verify jobs: attempt | result | verdict | done | error
  repair jobs: proposing | rejected | candidate | done | error
"""

from __future__ import annotations

import json
import threading
import time
import traceback
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Iterator

TERMINAL = {"done", "error"}


@dataclass
class Job:
    job_id: str
    kind: str
    events: list[dict] = field(default_factory=list)
    finished: bool = False
    result: Any = None
    cond: threading.Condition = field(default_factory=threading.Condition)

    def emit(self, event: dict) -> None:
        with self.cond:
            self.events.append({**event, "seq": len(self.events), "t": round(time.time(), 3)})
            if event.get("type") in TERMINAL:
                self.finished = True
            self.cond.notify_all()

    def stream(self, heartbeat: float = 15.0) -> Iterator[str]:
        sent = 0
        while True:
            with self.cond:
                if sent >= len(self.events) and not self.finished:
                    self.cond.wait(timeout=heartbeat)
                batch = self.events[sent:]
                finished = self.finished
            if not batch and not finished:
                yield ": keep-alive\n\n"
                continue
            for ev in batch:
                yield f"event: {ev['type']}\ndata: {json.dumps(ev, default=str)}\n\n"
            sent += len(batch)
            if finished and sent >= len(self.events):
                return


class JobManager:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()

    def start(self, kind: str, work: Callable[[Job], Any]) -> Job:
        job = Job(job_id=uuid.uuid4().hex[:12], kind=kind)
        with self._lock:
            self._jobs[job.job_id] = job

        def runner() -> None:
            try:
                job.result = work(job)
                job.emit({"type": "done", "result": job.result})
            except Exception as exc:  # noqa: BLE001 - surfaced to the client, never swallowed
                job.emit({"type": "error", "message": f"{type(exc).__name__}: {exc}",
                          "traceback": traceback.format_exc()})

        threading.Thread(target=runner, name=f"job-{kind}-{job.job_id}", daemon=True).start()
        return job

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)
