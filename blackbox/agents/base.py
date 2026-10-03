"""Agents are resumable state machines (CLAUDE.md hard rule 3).

    class QAAgent(Agent):
        name, version, family, entry = "qa_agent", "v1", "qa", "plan"
        def init_state(self, task): return {"question": task.input["question"]}
        def plan(self, ctx):   ...; return "search"     # next node name
        def search(self, ctx): ...; return "answer"
        def answer(self, ctx): ctx.final(...); return None   # None = finished
        nodes = {"plan": plan, "search": search, "answer": answer}

Rules:
- Every model/tool/search call goes through ctx (ctx.llm / ctx.tool / ctx.retrieve).
- All memory lives in ctx.state; assign values (state[k] = v), never mutate in place.
- Randomness: ctx.rng. Time: ctx.now(). Nothing else.
- Finish by calling ctx.final(answer) and returning None.
"""

from __future__ import annotations

import os
import socket
import traceback
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, ClassVar

from blackbox.core.schema import Change, Outcome, Run, Trace
from blackbox.core.store import Store
from blackbox.recorder.context import Monitor, ReplayPlan, RunContext, StepListener

MAX_NODE_VISITS = 60

Checker = Callable[[Any, Any], Outcome]  # (final_answer, expected) -> Outcome


@dataclass
class Task:
    family: str
    task_id: str
    input: dict  # what the agent may see
    expected: Any  # what the checker compares against; the agent never sees it
    meta: dict = field(default_factory=dict)


class Agent:
    name: ClassVar[str] = "base"
    version: ClassVar[str] = "v1"
    family: ClassVar[str] = ""
    entry: ClassVar[str] = ""
    nodes: ClassVar[dict[str, Callable[["Agent", RunContext], str | None]]] = {}

    def init_state(self, task: Task) -> dict:
        return {}

    def tool_caller(self, task: Task) -> Callable[[str, dict], Any] | None:
        return None

    def retriever(self, task: Task) -> Callable[..., list[dict]] | None:
        return None

    @classmethod
    def ref(cls) -> str:
        return f"{cls.name}@{cls.version}"


# ---- registries (agents and checkers are looked up by name on replay) ----------
_AGENTS: dict[str, type[Agent]] = {}
_CHECKERS: dict[str, Checker] = {}


def register_agent(cls: type[Agent]) -> type[Agent]:
    _AGENTS[cls.ref()] = cls
    return cls


def register_checker(family: str, fn: Checker) -> Checker:
    _CHECKERS[family] = fn
    return fn


def get_agent(ref: str) -> Agent:
    if ref not in _AGENTS:
        raise KeyError(f"agent {ref!r} not registered (import its module). Known: {sorted(_AGENTS)}")
    return _AGENTS[ref]()


def get_checker(family: str) -> Checker:
    if family not in _CHECKERS:
        raise KeyError(f"no checker for family {family!r}. Known: {sorted(_CHECKERS)}")
    return _CHECKERS[family]


def machine_name() -> str:
    return os.environ.get("BLACKBOX_MACHINE") or socket.gethostname()


def run_task(
    agent: Agent,
    task: Task,
    model_id: str,
    *,
    store: Store | None = None,
    plan: ReplayPlan | None = None,
    monitor: Monitor | None = None,
    on_step: list[StepListener] | None = None,
    run_id: str | None = None,
    parent_run_id: str | None = None,
    fork_step_idx: int | None = None,
    patch: Change | None = None,
    split: str | None = None,
) -> Trace:
    """Run (or replay/fork) one task and return its trace. Saved if a store is given.

    A crash (exception escaping the agent) marks the run "crashed" with the
    traceback. It is our bug, never a task failure, and never a label
    (CLAUDE.md review rule 3).
    """
    run = Run(
        run_id=run_id or uuid.uuid4().hex[:16],
        task_family=task.family,
        task_id=task.task_id,
        task_input=task.input,
        agent=agent.ref(),
        model_id=model_id,
        parent_run_id=parent_run_id,
        fork_step_idx=fork_step_idx,
        patch=patch,
        split=split,
        machine=machine_name(),
        task_expected=task.expected,
    )
    ctx = RunContext(
        run, agent.init_state(task), store=store,
        tool_caller=agent.tool_caller(task), retriever=agent.retriever(task),
        plan=plan, monitor=monitor, on_step=on_step,
    )
    try:
        node: str | None = agent.entry
        visits = 0
        while node is not None:
            if node not in agent.nodes:
                raise KeyError(f"{agent.ref()}: unknown node {node!r}")
            visits += 1
            if visits > MAX_NODE_VISITS:
                # Looping forever is a genuine agent failure, not a crash.
                run.stats["stopped"] = f"exceeded {MAX_NODE_VISITS} node visits"
                if not ctx.steps or ctx.steps[-1].kind != "final":
                    ctx.final(None)
                break
            ctx.node = node
            node = agent.nodes[node](agent, ctx)
        ctx.close()
        final_steps = [s for s in ctx.steps if s.kind == "final"]
        answer = final_steps[-1].output["answer"] if final_steps else None
        run.outcome = get_checker(task.family)(answer, task.expected)
        run.status = "done"
    except Exception:  # noqa: BLE001 - recorded loudly as a crash, see docstring
        ctx.close(monitor_timeout=5.0)
        run.status = "crashed"
        run.error = traceback.format_exc()
    run.stats = {**ctx.stats(), **run.stats}
    trace = Trace(run=run, steps=ctx.steps)
    if store is not None:
        store.save_trace(trace)
    return trace


def task_from_run(run: Run) -> Task:
    return Task(family=run.task_family, task_id=run.task_id, input=run.task_input, expected=run.task_expected)
