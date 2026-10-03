"""Add Black Box to an existing agent project (SYSTEM.md §0A, USP X4).

    import blackbox
    from openai import OpenAI

    client = blackbox.wrap(OpenAI())              # 1. record every model call

    @blackbox.tool                                # 2. record tool calls
    def get_weather(city: str) -> dict: ...

    def my_agent(question: str) -> str:           # the user's existing agent, unchanged
        ...client.chat.completions.create(...)...
        ...get_weather("Pune")...

    trace = blackbox.run(my_agent, "Will it rain in Pune?")   # 3. run it under the recorder
    child = blackbox.fork(trace, 2, blackbox.Change(kind="output", value={"result": {"rain": True}}))

Without blackbox.run / blackbox.session, wrapped clients and tools behave
exactly like the originals: nothing is recorded, nothing changes.
"""

from __future__ import annotations

import dataclasses
import functools
import importlib
import inspect
import json
import uuid
import warnings
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable, Iterator

from blackbox.agents.base import Agent, Checker, Task, _AGENTS, register_agent, register_checker, run_task
from blackbox.core.schema import Run, Trace
from blackbox.core.store import DEFAULT_DIR, Store
from blackbox.recorder.context import Monitor, RunContext, current

_store: Store | None = None


def configure(data_dir: str | Path = DEFAULT_DIR) -> Store:
    """Where recordings are kept (default ./data, or $BLACKBOX_DATA)."""
    global _store
    _store = Store(data_dir)
    return _store


def default_store() -> Store:
    return _store or configure()


# ---- JSON safety ------------------------------------------------------------
def to_jsonable(value: Any) -> Any:
    """Recordings must survive a round trip to disk; replay serves what was stored."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(k): to_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [to_jsonable(v) for v in value]
    if hasattr(value, "model_dump"):
        return to_jsonable(value.model_dump(mode="json", exclude_none=True))
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return to_jsonable(dataclasses.asdict(value))
    try:
        return json.loads(json.dumps(value))
    except TypeError:
        warnings.warn(f"blackbox: recorded {type(value).__name__} as text; replay will return a string")
        return repr(value)


# ---- OpenAI-compatible clients ----------------------------------------------------
def _parse_tool_calls(message) -> list[dict]:
    calls = []
    for c in getattr(message, "tool_calls", None) or []:
        try:
            args = json.loads(c.function.arguments or "{}")
        except json.JSONDecodeError:
            args = {"__unparsed__": c.function.arguments}
        calls.append({"id": c.id, "name": c.function.name, "arguments": args})
    return calls


def _to_completion(output: dict, model: str):
    """Rebuild the object the user's code expects, from a recording or a fork change."""
    from openai.types.chat import ChatCompletion

    if "raw" in output:
        return ChatCompletion.model_validate(output["raw"])
    tool_calls = [
        {"id": c.get("id") or f"call_{i}", "type": "function",
         "function": {"name": c["name"], "arguments": json.dumps(c.get("arguments", {}))}}
        for i, c in enumerate(output.get("tool_calls") or [])
    ]
    message = {"role": "assistant", "content": output.get("text", "")}
    if tool_calls:
        message["tool_calls"] = tool_calls
    return ChatCompletion.model_validate({
        "id": "blackbox-replay", "object": "chat.completion", "created": 0, "model": model,
        "choices": [{"index": 0, "message": message,
                     "finish_reason": output.get("finish_reason") or ("tool_calls" if tool_calls else "stop")}],
    })


def _llm_request(kwargs: dict) -> tuple[str, dict]:
    model = kwargs.pop("model")
    messages = to_jsonable(kwargs.pop("messages"))
    tools = to_jsonable(kwargs.pop("tools", None) or [])
    return model, {"model_id": model, "messages": messages, "tools": tools, "params": to_jsonable(kwargs)}


def _call_kwargs(req: dict) -> dict:
    extra = {"tools": req["tools"]} if req["tools"] else {}
    return {"model": req["model_id"], "messages": req["messages"], **extra, **req["params"]}


def _llm_result(resp, provider: str, model_tag: str) -> tuple[dict, dict]:
    msg = resp.choices[0].message
    usage = getattr(resp, "usage", None)
    out = {"text": msg.content or "", "tool_calls": _parse_tool_calls(msg),
           "finish_reason": resp.choices[0].finish_reason, "raw": resp.model_dump(mode="json")}
    meta = {"provider": provider, "model_tag": model_tag,
            "tokens_in": getattr(usage, "prompt_tokens", None) if usage else None,
            "tokens_out": getattr(usage, "completion_tokens", None) if usage else None}
    return out, meta


class _Completions:
    def __init__(self, real, provider: str):
        self._real = real
        self._provider = provider

    def create(self, **kwargs):
        ctx = current.get()
        if ctx is None:
            return self._real.create(**kwargs)
        if kwargs.get("stream"):
            warnings.warn("blackbox: streaming calls are passed through unrecorded")
            return self._real.create(**kwargs)
        model, request = _llm_request(kwargs)

        def execute(req: dict) -> tuple[dict, dict]:
            return _llm_result(self._real.create(**_call_kwargs(req)), self._provider, req["model_id"])

        step = ctx.record("llm", model, request, execute)
        return _to_completion(step.output or {}, model)


class _AsyncCompletions(_Completions):
    async def create(self, **kwargs):  # type: ignore[override]
        ctx = current.get()
        if ctx is None:
            return await self._real.create(**kwargs)
        if kwargs.get("stream"):
            warnings.warn("blackbox: streaming calls are passed through unrecorded")
            return await self._real.create(**kwargs)
        model, request = _llm_request(kwargs)

        async def aexecute(req: dict) -> tuple[dict, dict]:
            return _llm_result(await self._real.create(**_call_kwargs(req)), self._provider, req["model_id"])

        step = await ctx.arecord("llm", model, request, aexecute)
        return _to_completion(step.output or {}, model)


class _Chat:
    def __init__(self, real_chat, provider: str):
        real = real_chat.completions
        is_async = inspect.iscoroutinefunction(getattr(real, "create", None))
        self.completions = (_AsyncCompletions if is_async else _Completions)(real, provider)
        self._real = real_chat

    def __getattr__(self, name):
        return getattr(self._real, name)


class WrappedClient:
    """Behaves like the wrapped OpenAI-compatible client; records chat completions."""

    def __init__(self, client, provider: str | None = None):
        self._client = client
        base = str(getattr(client, "base_url", "") or "")
        self.blackbox_provider = provider or next(
            (p for p in ("groq", "openrouter", "11434") if p in base), "openai"
        ).replace("11434", "ollama")
        self.chat = _Chat(client.chat, self.blackbox_provider)

    def __getattr__(self, name):
        return getattr(self._client, name)


def wrap(client, provider: str | None = None) -> WrappedClient:
    """Wrap an `openai.OpenAI(...)` or `openai.AsyncOpenAI(...)` client
    (also Groq / OpenRouter / Ollama via base_url)."""
    return WrappedClient(client, provider)


# ---- tools and retrievers -----------------------------------------------------
def _recorded(kind: str, fn: Callable | None, name: str | None):
    def decorate(f: Callable) -> Callable:
        sig = inspect.signature(f)
        step_name = name or f.__name__

        def request_for(args, kwargs) -> dict:
            bound = sig.bind(*args, **kwargs)
            bound.apply_defaults()
            return {"args": to_jsonable(dict(bound.arguments))}

        if inspect.iscoroutinefunction(f):
            @functools.wraps(f)
            async def awrapper(*args, **kwargs):
                ctx = current.get()
                if ctx is None:
                    return await f(*args, **kwargs)

                async def aexecute(req: dict) -> tuple[dict, dict]:
                    return {"result": to_jsonable(await f(**req["args"]))}, {}

                return (await ctx.arecord(kind, step_name, request_for(args, kwargs), aexecute)).output["result"]

            awrapper.__blackbox_kind__ = kind
            return awrapper

        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            ctx = current.get()
            if ctx is None:
                return f(*args, **kwargs)

            def execute(req: dict) -> tuple[dict, dict]:
                return {"result": to_jsonable(f(**req["args"]))}, {}

            return ctx.record(kind, step_name, request_for(args, kwargs), execute).output["result"]

        wrapper.__blackbox_kind__ = kind
        return wrapper

    return decorate(fn) if fn is not None else decorate


def tool(fn: Callable | None = None, *, name: str | None = None):
    """Record calls to this function as tool steps. Results must be JSON-like."""
    return _recorded("tool", fn, name)


def retriever(fn: Callable | None = None, *, name: str | None = None):
    """Record calls to this function as retrieval steps."""
    return _recorded("retrieval", fn, name)


# ---- running a user's agent function ------------------------------------------------
def _function_agent(fn: Callable, family: str) -> type[Agent]:
    ref_name = f"{fn.__module__}:{fn.__qualname__}"

    class FunctionAgent(Agent):
        name, version, entry = ref_name, "fn", "main"

        def init_state(self, task: Task) -> dict:
            return {"input": task.input["input"]}

        def main(self, ctx: RunContext):
            ctx.final(to_jsonable(fn(ctx.state["input"])))
            return None

        nodes = {"main": main}

    FunctionAgent.family = family
    return register_agent(FunctionAgent)


def resolve_function_agent(ref: str) -> type[Agent] | None:
    """Re-create a function agent in another process (e.g. the UI) from 'module:qualname@fn'."""
    if not ref.endswith("@fn") or ":" not in ref:
        return None
    module, qualname = ref[: -len("@fn")].split(":", 1)
    obj: Any = importlib.import_module(module)
    for part in qualname.split("."):
        obj = getattr(obj, part)
    return _function_agent(obj, family="app")


def run(
    agent_fn: Callable[[Any], Any],
    input: Any,
    *,
    family: str = "app",
    task_id: str | None = None,
    expected: Any = None,
    check: Checker | None = None,
    monitor: Monitor | None = None,
    store: Store | None = None,
    save: bool = True,
    guardian=None,
) -> Trace:
    """Run `agent_fn(input)` under the recorder. Returns the trace (also saved).

    With `guardian=blackbox.Guardian(...)`, a failed, crashed or flagged run opens an
    incident and notifies the owner (email / WhatsApp), with a link to the incident page.

    `check(answer, expected) -> Outcome` gives the run a pass/fail. Without
    one the run is recorded with no verdict, never an invented one.
    """
    if check is not None:
        register_checker(family, check)
    agent_cls = _function_agent(agent_fn, family)
    task = Task(family=family, task_id=task_id or uuid.uuid4().hex[:12],
                input={"input": to_jsonable(input)}, expected=to_jsonable(expected))
    trace = run_task(agent_cls(), task, model_id="app", store=(store or default_store()) if save else None,
                     monitor=monitor)
    if guardian is not None:
        if guardian.store is None:
            guardian.store = store or default_store()
        trace.run.stats["incident"] = getattr(guardian.handle(trace), "incident_id", None)
    return trace


class Session:
    def __init__(self, ctx: RunContext):
        self._ctx = ctx
        self.answer: Any = None
        self.trace: Trace | None = None

    @property
    def run_id(self) -> str:
        return self._ctx.run.run_id

    def final(self, answer: Any) -> Any:
        self.answer = to_jsonable(answer)
        return self._ctx.final(self.answer)


@contextmanager
def session(
    task_id: str | None = None,
    *,
    family: str = "app",
    task_input: dict | None = None,
    expected: Any = None,
    monitor: Monitor | None = None,
    store: Store | None = None,
) -> Iterator[Session]:
    """Record whatever wrapped calls happen inside the block (record-only: no fork,
    since there is no function to re-run). Call `s.final(answer)` to set the answer."""
    from blackbox.agents.base import get_checker, machine_name

    run_obj = Run(run_id=uuid.uuid4().hex[:16], task_family=family, task_id=task_id or uuid.uuid4().hex[:12],
                  task_input=to_jsonable(task_input or {}), task_expected=to_jsonable(expected),
                  agent="session@record-only", model_id="app", machine=machine_name())
    ctx = RunContext(run_obj, {}, store=store or default_store(), monitor=monitor)
    token = current.set(ctx)
    sess = Session(ctx)
    try:
        yield sess
        run_obj.status = "done"
    except BaseException:
        import traceback

        run_obj.status = "crashed"
        run_obj.error = traceback.format_exc()
        raise
    finally:
        current.reset(token)
        ctx.close()
        checker = get_checker(family)
        if run_obj.status == "done" and checker is not None:
            run_obj.outcome = checker(sess.answer, run_obj.task_expected)
        run_obj.stats = ctx.stats()
        sess.trace = Trace(run=run_obj, steps=ctx.steps)
        (store or default_store()).save_trace(sess.trace)


def ensure_agent(ref: str) -> None:
    if ref not in _AGENTS:
        resolve_function_agent(ref)


# ---- async agents --------------------------------------------------------------
async def _arun_function(agent_fn, task: Task, *, store: Store | None, plan=None, monitor: Monitor | None = None,
                         parent_run_id: str | None = None, fork_step_idx: int | None = None, patch=None) -> Trace:
    """The async twin of run_task for a single async agent function."""
    import traceback

    from blackbox.agents.base import get_checker, machine_name

    run_obj = Run(run_id=uuid.uuid4().hex[:16], task_family=task.family, task_id=task.task_id,
                  task_input=task.input, task_expected=task.expected,
                  agent=f"{agent_fn.__module__}:{agent_fn.__qualname__}@afn", model_id="app",
                  parent_run_id=parent_run_id, fork_step_idx=fork_step_idx, patch=patch, machine=machine_name())
    ctx = RunContext(run_obj, {"input": task.input["input"]}, store=store, plan=plan, monitor=monitor)
    token = current.set(ctx)
    try:
        ctx.node = "main"
        answer = to_jsonable(await agent_fn(ctx.state["input"]))
        ctx.final(answer)
        ctx.close()
        checker = get_checker(task.family)
        run_obj.outcome = checker(answer, task.expected) if checker else None
        run_obj.status = "done"
    except Exception:  # noqa: BLE001 - a crash is recorded, never a task failure
        ctx.close(monitor_timeout=5.0)
        run_obj.status = "crashed"
        run_obj.error = traceback.format_exc()
    finally:
        current.reset(token)
    run_obj.stats = ctx.stats()
    trace = Trace(run=run_obj, steps=ctx.steps)
    if store is not None:
        store.save_trace(trace)
    return trace


async def arun(agent_fn, input: Any, *, family: str = "app", task_id: str | None = None, expected: Any = None,
               check: Checker | None = None, monitor: Monitor | None = None, store: Store | None = None,
               save: bool = True) -> Trace:
    """`await blackbox.arun(my_async_agent, input)`: the async version of run()."""
    if check is not None:
        register_checker(family, check)
    task = Task(family=family, task_id=task_id or uuid.uuid4().hex[:12],
                input={"input": to_jsonable(input)}, expected=to_jsonable(expected))
    return await _arun_function(agent_fn, task, store=(store or default_store()) if save else None, monitor=monitor)


async def afork(trace: Trace, agent_fn, step_idx: int, change=None, *, store: Store | None = None,
                reuse_after_fork: bool = True) -> Trace:
    """Fork a run recorded with arun(). Pass the same async agent function."""
    from blackbox.agents.base import task_from_run
    from blackbox.recorder.context import ReplayPlan

    plan = ReplayPlan(parent=trace, fork_idx=step_idx, change=change, reuse_after_fork=reuse_after_fork)
    child = await _arun_function(agent_fn, task_from_run(trace.run), store=store, plan=plan,
                                 parent_run_id=trace.run.run_id, fork_step_idx=step_idx, patch=change)
    child.run.stats["full_rerun_steps"] = len(trace.steps)
    if store is not None:
        store.save_trace(child)
    return child


async def areplay(trace: Trace, agent_fn) -> Trace:
    from blackbox.agents.base import task_from_run
    from blackbox.recorder.context import ReplayPlan

    return await _arun_function(agent_fn, task_from_run(trace.run), store=None, plan=ReplayPlan(parent=trace),
                                parent_run_id=trace.run.run_id)
