"""The tool registry: how an agent discovers and calls a tool by name.

Ported from 26117's backend/tools/registry.py without its approval gate.

    @tool("calculator", "Evaluate an arithmetic expression.", category="math")
    def calculator(expression: str) -> float: ...

    get_tool_schemas("math")                 -> what the agent passes to ctx.llm(tools=...)
    call_tool("calculator", {"expression": "2+3"})

Schemas are derived from the function's type hints and its `Args:` docstring
section, so a renamed parameter cannot drift from what the model is told.
An unknown tool name or an argument the tool does not take raises: through
`ctx.tool` that becomes a recorded step error the agent can see, which is how
a hallucinated call shows up in the trace.
"""

from __future__ import annotations

import inspect
import typing
from dataclasses import dataclass, field
from typing import Any, Callable

# Anything not listed is described as a string: a model can always send a
# string, and the tool's own validation rejects a bad value better than a
# schema that guesses wrong.
_JSON_TYPES: dict[Any, str] = {
    str: "string",
    int: "integer",
    float: "number",
    bool: "boolean",
    list: "array",
    dict: "object",
}


@dataclass
class ToolSpec:
    name: str
    description: str
    category: str
    func: Callable
    parameters: dict = field(default_factory=dict)

    def to_schema(self) -> dict:
        """OpenAI-style function-calling schema for this tool."""
        return {
            "type": "function",
            "function": {"name": self.name, "description": self.description, "parameters": self.parameters},
        }


_REGISTRY: dict[str, ToolSpec] = {}


def _json_schema_for(annotation: Any) -> dict:
    if annotation is inspect.Parameter.empty:
        return {"type": "string"}

    origin = typing.get_origin(annotation)
    if origin is not None:
        args = [a for a in typing.get_args(annotation) if a is not type(None)]
        # Containers are checked BEFORE the Optional unwrap: list[float] has
        # exactly one type argument, so an Optional-first check would emit
        # {"type": "number"} and the model would send 5 where the tool takes [5].
        if origin in (list, set, tuple, frozenset):
            return {"type": "array", "items": _json_schema_for(args[0] if args else str)}
        if origin is dict:
            return {"type": "object"}
        if origin is typing.Literal:
            return {"type": "string", "enum": list(typing.get_args(annotation))}
        # Optional[X] / X | None -> schema for X; absence is "not required".
        if len(args) == 1:
            return _json_schema_for(args[0])
        return {"type": "string"}

    return {"type": _JSON_TYPES.get(annotation, "string")}


def _describe_parameters(func: Callable) -> dict:
    """JSON-Schema object from the signature, with per-argument text from `Args:`."""
    # eval_str resolves hints: under `from __future__ import annotations` every
    # annotation is a string, and a string is neither list[float] nor a Literal.
    signature = inspect.signature(func, eval_str=True)
    doc = inspect.getdoc(func) or ""
    arg_docs: dict[str, str] = {}

    if "Args:" in doc:
        section = doc.split("Args:", 1)[1]
        for stop in ("Returns:", "Raises:", "Example:"):
            section = section.split(stop, 1)[0]
        current = None
        for raw in section.splitlines():
            line = raw.strip()
            if not line:
                continue
            if ":" in line and len(line.split(":", 1)[0].split()) == 1:
                current, _, rest = line.partition(":")
                current = current.strip()
                arg_docs[current] = rest.strip()
            elif current:
                arg_docs[current] += " " + line

    properties: dict[str, dict] = {}
    required: list[str] = []
    for name, param in signature.parameters.items():
        if param.kind in (inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD):
            continue
        schema = _json_schema_for(param.annotation)
        if name in arg_docs:
            schema["description"] = arg_docs[name]
        properties[name] = schema
        if param.default is inspect.Parameter.empty:
            required.append(name)

    return {"type": "object", "properties": properties, "required": required}


def tool(name: str, description: str, category: str):
    """Register a function as an agent-callable tool.

    The function is returned unchanged, so it stays directly importable and
    unit-testable without the registry.
    """

    def decorator(func: Callable) -> Callable:
        if name in _REGISTRY:
            raise ValueError(
                f"Tool {name!r} is already registered by {_REGISTRY[name].func.__module__}. "
                f"Names are how the model addresses a tool, so duplicates are ambiguous."
            )
        _REGISTRY[name] = ToolSpec(name, description, category, func, _describe_parameters(func))
        return func

    return decorator


def get_tool(name: str) -> ToolSpec | None:
    return _REGISTRY.get(name)


def all_tools() -> list[ToolSpec]:
    return sorted(_REGISTRY.values(), key=lambda t: (t.category, t.name))


def get_tool_schemas(category: str | None = None) -> list[dict]:
    """Schemas to hand a model, optionally narrowed to one category, so an
    agent is only offered the tools in its remit."""
    return [spec.to_schema() for spec in all_tools() if category is None or spec.category == category]


def call_tool(name: str, arguments: dict | None = None) -> Any:
    """Dispatch a tool call by name.

    Raises:
        KeyError: unknown tool (a model can hallucinate a plausible name).
        TypeError: arguments that do not fit the signature.
    """
    spec = _REGISTRY.get(name)
    if spec is None:
        raise KeyError(f"No tool named {name!r}. Available: {', '.join(sorted(_REGISTRY))}")

    arguments = arguments or {}
    signature = inspect.signature(spec.func)
    unexpected = set(arguments) - set(signature.parameters)
    if unexpected:
        # Reported, not dropped: an argument the tool does not take usually
        # means the model has the wrong tool, and saying so is how it recovers.
        raise TypeError(f"{name} does not take {sorted(unexpected)}. It takes: {sorted(signature.parameters)}")
    missing = [
        p.name for p in signature.parameters.values()
        if p.default is inspect.Parameter.empty and p.name not in arguments
        and p.kind not in (inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD)
    ]
    if missing:
        raise TypeError(f"{name} is missing required argument(s) {missing}")

    return spec.func(**arguments)
