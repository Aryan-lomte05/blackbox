"""The contract every module exchanges. See SYSTEM.md §4.1 and CLAUDE.md §Schema.

Adding an optional field with a default is allowed. Renaming or removing a
field needs a SCHEMA_VERSION bump, regenerated fixtures and a team message.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

SCHEMA_VERSION = 1

StepKind = Literal["llm", "tool", "retrieval", "state", "final"]
LabelSource = Literal["injected", "verified", "imported"]
ChangeKind = Literal["output", "args", "messages", "model", "state"]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Step(BaseModel):
    run_id: str
    idx: int
    kind: StepKind
    name: str  # registry model id / tool name / retriever name
    node: str  # agent node that issued it
    request: dict  # what was asked
    output: dict | None = None  # what came back
    error: str | None = None
    reads: list[str] = Field(default_factory=list)  # memory keys read before this step
    writes: list[str] = Field(default_factory=list)  # memory keys written after it
    parents: list[int] = Field(default_factory=list)  # data-flow: last writer of each read key
    input_hash: str  # fingerprint of request + values read: the re-use key
    state_hash_after: str | None = None  # save-point blob after this step
    state_diff: dict = Field(default_factory=dict)  # {key: {"before": .., "after": ..}}
    latency_ms: float = 0.0
    tokens_in: int | None = None  # as reported by the provider, else None
    tokens_out: int | None = None
    cached: bool = False  # True = re-used during replay, not re-executed
    monitor: dict | None = None  # step-checker answers
    meta: dict = Field(default_factory=dict)


class FaultSpec(BaseModel):
    type: str  # "F1".."F10" or "genai"
    step_idx: int
    params: dict = Field(default_factory=dict)
    generator: str = "catalog"


class Outcome(BaseModel):
    success: bool
    score: float
    final_answer: Any = None
    expected: Any = None
    checker: str


class Label(BaseModel):
    root_cause_step: int | None
    source: LabelSource
    notes: str = ""


class Change(BaseModel):
    """What a fork alters at its step. See SYSTEM.md §4.4."""

    kind: ChangeKind
    # output: replacement output dict
    # args: tool/retrieval argument overrides (merged into request)
    # messages: replacement messages list for an llm step
    # model: replacement registry model id
    # state: {key: value} written into memory right after the step
    value: Any
    note: str = ""


class Run(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    run_id: str
    schema_version: int = SCHEMA_VERSION
    task_family: str  # "qa" | "math" | "ops" for our agents; anything for a user's project
    task_id: str
    task_input: dict
    task_expected: Any = None  # what the checker compares against; agents never see it
    agent: str  # "qa_agent@v1"
    model_id: str  # registry id, never a raw tag
    parent_run_id: str | None = None
    fork_step_idx: int | None = None
    patch: Change | None = None
    fault: FaultSpec | None = None
    outcome: Outcome | None = None
    label: Label | None = None
    split: str | None = None
    status: Literal["running", "done", "crashed"] = "running"
    error: str | None = None  # crash traceback: a recorder/agent bug, never a task failure
    stats: dict = Field(default_factory=dict)
    created_at: str = Field(default_factory=utc_now)
    machine: str = ""


class Trace(BaseModel):
    """A run with its steps: the unit stored, shipped in shards and served by the API."""

    run: Run
    steps: list[Step] = Field(default_factory=list)
