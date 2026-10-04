"""Tool registry for the MCP server.

Each tool is a plain function registered with `@tool(...)`: a name, a description the assistant reads,
a JSON Schema for its arguments, and a category (for docs and listing order). Tools return text.

Shared services for tools:
  store()            the Black Box store (injectable: `configure(store_factory=...)`, used by tests)
  report_progress()  sends an MCP progress notification while a long tool runs, when the client asked
  clip()             one-line, length-limited rendering of any value
"""

from __future__ import annotations

import contextvars
import json
from dataclasses import dataclass
from typing import Any, Callable

Handler = Callable[..., str]
ProgressSink = Callable[[str], None]

CATEGORIES = ("runs", "diagnosis", "experiments", "guardian", "developer")


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    input_schema: dict
    handler: Handler
    category: str

    def spec(self) -> dict:
        """The tools/list entry."""
        return {"name": self.name, "description": self.description, "inputSchema": self.input_schema}


_TOOLS: dict[str, Tool] = {}


def tool(name: str, description: str, *, category: str, properties: dict | None = None,
         required: tuple[str, ...] = ()) -> Callable[[Handler], Handler]:
    if category not in CATEGORIES:
        raise ValueError(f"unknown tool category {category!r}")

    def register(fn: Handler) -> Handler:
        if name in _TOOLS:
            raise ValueError(f"tool {name!r} registered twice")
        schema: dict = {"type": "object", "properties": properties or {}}
        if required:
            schema["required"] = list(required)
        _TOOLS[name] = Tool(name, description, schema, fn, category)
        return fn

    return register


def all_tools() -> list[Tool]:
    return sorted(_TOOLS.values(), key=lambda t: (CATEGORIES.index(t.category), t.name))


def get(name: str) -> Tool | None:
    return _TOOLS.get(name)


# ---- shared services ---------------------------------------------------------------------
def _default_store():
    from blackbox.core.store import Store

    return Store()


_store_factory: Callable[[], Any] = _default_store


def configure(*, store_factory: Callable[[], Any] | None = None) -> None:
    global _store_factory
    _store_factory = store_factory or _default_store


def store():
    return _store_factory()


_progress: contextvars.ContextVar[ProgressSink | None] = contextvars.ContextVar("mcp_progress", default=None)


def report_progress(message: str) -> None:
    sink = _progress.get()
    if sink is not None:
        sink(message)


def progress_scope(sink: ProgressSink | None) -> contextvars.Token:
    return _progress.set(sink)


def end_progress_scope(token: contextvars.Token) -> None:
    _progress.reset(token)


def clip(value: Any, n: int = 160) -> str:
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, default=str)
    text = " ".join(text.split())
    return text if len(text) <= n else text[: n - 1] + "…"


# common argument schemas
RUN_ID = {"run_id": {"type": "string", "description": "a recorded run id (autocomplete is available)"}}
