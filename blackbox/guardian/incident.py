"""An incident: one failed, crashed or alarmed run, explained for the person who owns it.

Every sentence is filled from recorded facts (the run, the diagnosis, Verify,
tested repairs). Nothing is generated freely, so nothing can be made up.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field

Severity = Literal["critical", "high", "medium", "low"]


class Incident(BaseModel):
    incident_id: str
    run_id: str
    owner: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat(timespec="seconds"))
    kind: Literal["failure", "crash", "alarm"]
    severity: Severity
    title: str
    what_happened: str
    why: str
    how_to_fix: list[str]
    actions_taken: list[str] = Field(default_factory=list)
    needs_approval: bool = False          # money-moving / irreversible agents: a human decides the retry
    signature: str                        # groups repeats of the same problem
    repeats: int = 1
    evidence: dict[str, Any] = Field(default_factory=dict)
    link: str = ""
    notifications: list[dict] = Field(default_factory=list)  # {"channel", "status", "detail"}
    status: Literal["open", "approved", "rejected", "resolved"] = "open"
    decision: dict | None = None  # {"by", "at", "note"}: who approved / rejected a paused retry, and when


def signature_of(agent: str, kind: str, step_name: str | None, error: str | None) -> str:
    """Same agent + same kind of problem at the same kind of step = the same incident."""
    key = json.dumps([agent, kind, step_name or "", (error or "")[:80]])
    return hashlib.sha1(key.encode()).hexdigest()[:12]
