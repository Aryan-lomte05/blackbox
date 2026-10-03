"""RunContext: the only door between an agent and the world (CLAUDE.md hard rule 2).

Every ctx.llm / ctx.tool / ctx.retrieve / ctx.final call becomes one Step.
Reads and writes to ctx.state are logged, so each Step knows which earlier
steps produced what it used (`parents`) without anyone labelling it (U4).

Replay works by re-executing the agent's own Python logic while serving
steps from the recording instead of calling providers:

    before the fork step  -> served from the recording, must match exactly
    at the fork step      -> the Change is applied
    after the fork step   -> re-used if an identical step (same input_hash)
                             exists in the original run, else executed live

So a replay with no change makes zero provider calls (U2), and a fork only
pays for steps its change actually reaches (U15).
"""

from __future__ import annotations

import contextvars
import copy
import random
import time
import traceback
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any, Callable, Iterator

from blackbox.core.hashing import fingerprint, step_input_hash
from blackbox.core.schema import Change, Run, Step, StepKind, Trace
from blackbox.core.store import Store
from blackbox.recorder import providers
from blackbox.recorder.providers import LLMResult

INTERNAL_PREFIX = "__"

# The context of the run executing on this thread/task. Integrations
# (blackbox.wrap, @blackbox.tool) record into it; outside a run they pass through.
current: contextvars.ContextVar["RunContext | None"] = contextvars.ContextVar("blackbox_ctx", default=None)


class ToolError(Exception):
    """A tool/retrieval call failed. Recorded on the step, then raised to the agent."""


class ReplayDivergence(Exception):
    """A replayed step asked something different from the recording.

    Before the fork point this means the agent is not deterministic given its
    recorded inputs: it used randomness, time or I/O outside ctx. That is a
    bug in the agent, never something to paper over.
    """


@dataclass
class ReplayPlan:
    parent: Trace
    fork_idx: int | None = None  # None = pure replay of the whole run
    change: Change | None = None
    reuse_after_fork: bool = True
    _used: set[int] = field(default_factory=set)
    _by_hash: dict[str, list[Step]] = field(default_factory=dict)

    def __post_init__(self) -> None:
        for s in self.parent.steps:
            self._by_hash.setdefault(s.input_hash, []).append(s)

    def recorded(self, idx: int) -> Step | None:
        return self.parent.steps[idx] if idx < len(self.parent.steps) else None

    def find_reusable(self, input_hash: str) -> Step | None:
        for s in self._by_hash.get(input_hash, []):
            if s.idx not in self._used and s.error is None:
                self._used.add(s.idx)
                return s
        return None


class StateProxy:
    """The agent's memory. Logs reads/writes; hands out copies so in-place
    mutation cannot sneak past the log (agents must assign: state[k] = v)."""

    def __init__(self, ctx: "RunContext", initial: dict):
        self._ctx = ctx
        self._data: dict[str, Any] = copy.deepcopy(initial)

    def __getitem__(self, key: str) -> Any:
        self._ctx._note_read(key)
        return copy.deepcopy(self._data[key])

    def get(self, key: str, default: Any = None) -> Any:
        self._ctx._note_read(key)
        return copy.deepcopy(self._data.get(key, default))

    def __contains__(self, key: str) -> bool:
        self._ctx._note_read(key)
        return key in self._data

    def __setitem__(self, key: str, value: Any) -> None:
        self._ctx._note_write(key, self._data.get(key), value)
        self._data[key] = copy.deepcopy(value)

    def __delitem__(self, key: str) -> None:
        self._ctx._note_write(key, self._data.get(key), None)
        del self._data[key]

    def update(self, values: dict) -> None:
        for k, v in values.items():
            self[k] = v

    def snapshot(self) -> dict:
        return copy.deepcopy(self._data)

    def _set_internal(self, key: str, value: Any) -> None:
        self._data[key] = value


Monitor = Callable[[Step, Run, list[Step]], dict | None]
StepListener = Callable[[Step], None]


class RunContext:
    def __init__(
        self,
        run: Run,
        initial_state: dict,
        *,
        store: Store | None = None,
        tool_caller: Callable[[str, dict], Any] | None = None,
        retriever: Callable[..., list[dict]] | None = None,
        plan: ReplayPlan | None = None,
        monitor: Monitor | None = None,
        on_step: list[StepListener] | None = None,
    ):
        self.run = run
        self.store = store
        self.tool_caller = tool_caller
        self.retriever = retriever
        self.plan = plan
        self.monitor = monitor
        self.on_step = list(on_step or [])
        self.steps: list[Step] = []
        self.node = ""
        self.rng = random.Random(int(fingerprint(run.task_id)[:12], 16))
        self._clock = plan.parent.run.created_at if plan else run.created_at
        self._reads: list[str] = []
        self._last_writer: dict[str, int] = {}
        self._open: Step | None = None
        self._open_before: dict[str, Any] = {}
        self._pending_state_patch: dict | None = None
        self._executor = ThreadPoolExecutor(max_workers=2) if monitor else None
        self._monitor_futures: dict[int, Future] = {}
        self.state = StateProxy(self, initial_state)

    # ---- public API for agents ---------------------------------------------
    @property
    def model_id(self) -> str:
        return self.run.model_id

    def now(self) -> str:
        """Logical clock: identical on replay."""
        return self._clock

    def llm(self, model_id: str, messages: list[dict], tools: list[dict] | None = None, **params) -> LLMResult:
        request = {"model_id": model_id, "messages": messages, "tools": tools or [], "params": params}

        def execute(req: dict) -> tuple[dict, dict]:
            res = providers.chat(req["model_id"], req["messages"], req["tools"] or None, **req["params"])
            meta = {"provider": res.provider, "model_tag": res.model_tag,
                    "tokens_in": res.tokens_in, "tokens_out": res.tokens_out}
            return res.as_output(), meta

        step = self._step("llm", model_id, request, execute)
        return LLMResult.from_output(step.output or {}, provider=step.meta.get("provider", "replay"),
                                     model_tag=step.meta.get("model_tag", ""))

    def tool(self, name: str, **args) -> Any:
        if self.tool_caller is None:
            raise RuntimeError("this agent registered no tools")
        request = {"args": args}

        def execute(req: dict) -> tuple[dict, dict]:
            return {"result": self.tool_caller(name, req["args"])}, {}

        return self._step("tool", name, request, execute).output["result"]

    def retrieve(self, query: str, k: int = 5, **kw) -> list[dict]:
        if self.retriever is None:
            raise RuntimeError("this agent registered no retriever")
        request = {"args": {"query": query, "k": k, **kw}}

        def execute(req: dict) -> tuple[dict, dict]:
            return {"docs": self.retriever(**req["args"])}, {}

        return self._step("retrieval", "search", request, execute).output["docs"]

    def final(self, answer: Any) -> Any:
        request = {"answer": answer}
        return self._step("final", "final", request, lambda req: ({"answer": req["answer"]}, {})).output["answer"]

    def record(self, kind: StepKind, name: str, request: dict, execute) -> Step:
        """Record one step. `execute(request) -> (output_dict, meta)` runs it for real;
        on replay it is skipped and the recorded output is served. Integrations use this."""
        return self._step(kind, name, request, execute)

    # ---- the step machine -----------------------------------------------------
    def _step(self, kind: StepKind, name: str, request: dict, execute) -> Step:
        self._close_open_step()
        if self._pending_state_patch:
            patch, self._pending_state_patch = self._pending_state_patch, None
            self.state.update(patch)
            self._close_open_step()

        idx = len(self.steps)
        reads = list(dict.fromkeys(self._reads))
        self._reads = []
        read_values = {k: self.state._data.get(k) for k in reads}
        parents = sorted({self._last_writer[k] for k in reads if k in self._last_writer})
        step = Step(
            run_id=self.run.run_id, idx=idx, kind=kind, name=name, node=self.node,
            request=request, reads=reads, parents=parents,
            input_hash=step_input_hash(kind, name, request, read_values),
        )

        plan = self.plan
        recorded = plan.recorded(idx) if plan else None
        in_prefix = plan is not None and (plan.fork_idx is None or idx < plan.fork_idx)
        at_fork = plan is not None and plan.fork_idx == idx

        if in_prefix:
            if recorded is None or recorded.input_hash != step.input_hash:
                raise ReplayDivergence(
                    f"step {idx} ({kind}:{name}) differs from the recording"
                    + ("" if recorded is None else f" (recorded {recorded.kind}:{recorded.name})")
                    + ". The agent used something outside ctx (randomness, time, I/O)."
                )
            plan._used.add(idx)
            self._reuse(step, recorded)
        elif at_fork:
            self._apply_change(step, execute)
        else:
            reusable = plan.find_reusable(step.input_hash) if (plan and plan.reuse_after_fork) else None
            if reusable is not None:
                self._reuse(step, reusable)
            else:
                self._execute(step, execute)

        self.steps.append(step)
        self._open = step
        self._open_before = {}
        if step.error is not None:
            self._close_open_step()
            raise ToolError(step.error)
        return step

    def _reuse(self, step: Step, recorded: Step) -> None:
        step.output = copy.deepcopy(recorded.output)
        step.error = recorded.error
        step.cached = True
        step.latency_ms = 0.0
        step.meta = {**recorded.meta, "reused_from": [recorded.run_id, recorded.idx],
                     "saved_ms": recorded.latency_ms,
                     "saved_tokens": (recorded.tokens_in or 0) + (recorded.tokens_out or 0)}

    def _execute(self, step: Step, execute) -> None:
        t0 = time.perf_counter()
        try:
            output, meta = execute(step.request)
            step.output = output
            step.tokens_in = meta.pop("tokens_in", None)
            step.tokens_out = meta.pop("tokens_out", None)
            step.meta.update(meta)
        except ToolError as exc:
            step.error = str(exc)
        except Exception as exc:  # noqa: BLE001 - a tool/retriever raising is a recorded step error
            if step.kind in ("tool", "retrieval"):
                step.error = f"{type(exc).__name__}: {exc}"
            else:
                raise
        step.latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    def _apply_change(self, step: Step, execute) -> None:
        change = self.plan.change
        step.meta["fork_change"] = change.model_dump(mode="json") if change else None
        if change is None:
            self._execute(step, execute)
            return
        if change.kind == "output":
            step.output = copy.deepcopy(change.value)
            return
        if change.kind == "args":
            step.request = {**step.request, "args": {**step.request.get("args", {}), **change.value}}
        elif change.kind == "messages":
            step.request = {**step.request, "messages": change.value}
        elif change.kind == "model":
            step.request = {**step.request, "model_id": change.value}
        elif change.kind == "state":
            recorded = self.plan.recorded(step.idx)
            if recorded is not None and recorded.input_hash == step.input_hash:
                self._reuse(step, recorded)
            else:
                self._execute(step, execute)
            self._pending_state_patch = dict(change.value)
            return
        self._execute(step, execute)

    def _note_read(self, key: str) -> None:
        if not key.startswith(INTERNAL_PREFIX):
            self._reads.append(key)

    def _note_write(self, key: str, before: Any, after: Any) -> None:
        if key.startswith(INTERNAL_PREFIX):
            return
        if self._open is not None:
            if key not in self._open_before:
                self._open_before[key] = copy.deepcopy(before)
            if key not in self._open.writes:
                self._open.writes.append(key)
            self._last_writer[key] = self._open.idx

    def _close_open_step(self) -> None:
        step = self._open
        if step is None:
            return
        self._open = None
        self.state._set_internal("__node__", self.node)
        snapshot = self.state.snapshot()
        step.state_hash_after = self.store.put_blob(snapshot) if self.store else fingerprint(snapshot)
        step.state_diff = {k: {"before": self._open_before.get(k), "after": snapshot.get(k)} for k in step.writes}
        if self.monitor is not None:
            prior = list(self.steps[: step.idx])
            self._monitor_futures[step.idx] = self._executor.submit(self._safe_monitor, step, prior)
        for listener in self.on_step:
            try:
                listener(step)
            except Exception:  # noqa: BLE001 - observers must never change what they observe
                traceback.print_exc()

    def _safe_monitor(self, step: Step, prior: list[Step]) -> dict | None:
        try:
            return self.monitor(step, self.run, prior)
        except Exception as exc:  # noqa: BLE001 - recorded as absent, never faked (CLAUDE.md rule 9)
            return {"error": f"{type(exc).__name__}: {exc}"}

    # ---- lifecycle -----------------------------------------------------------
    def close(self, monitor_timeout: float = 30.0) -> None:
        self._close_open_step()
        if self._executor is not None:
            deadline = time.monotonic() + monitor_timeout
            for idx, fut in self._monitor_futures.items():
                try:
                    self.steps[idx].monitor = fut.result(timeout=max(0.0, deadline - time.monotonic()))
                except Exception as exc:  # noqa: BLE001
                    self.steps[idx].monitor = {"error": f"monitor did not finish: {type(exc).__name__}"}
            self._executor.shutdown(wait=False, cancel_futures=True)

    def stats(self) -> dict:
        executed = [s for s in self.steps if not s.cached and s.kind != "final"]
        reused = [s for s in self.steps if s.cached]
        tin = [s.tokens_in for s in executed if s.tokens_in is not None]
        tout = [s.tokens_out for s in executed if s.tokens_out is not None]
        return {
            "n_steps": len(self.steps),
            "n_executed": len(executed),
            "n_reused": len(reused),
            "n_llm_calls": sum(1 for s in executed if s.kind == "llm"),
            "tokens_in": sum(tin) if tin else None,
            "tokens_out": sum(tout) if tout else None,
            "latency_ms": round(sum(s.latency_ms for s in self.steps), 2),
            "tokens_saved": sum(s.meta.get("saved_tokens", 0) for s in reused),
            "seconds_saved": round(sum(s.meta.get("saved_ms", 0.0) for s in reused) / 1000, 3),
        }

    def iter_steps(self) -> Iterator[Step]:
        return iter(self.steps)
