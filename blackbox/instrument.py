"""Static analysis of an agent's source: where to hook Black Box in.

Finds OpenAI-compatible model clients (to wrap), tool functions (to decorate) and entry points (to run
under the recorder), and turns them into a line-by-line plan. Used by the MCP `instrument_agent` tool.
"""

from __future__ import annotations

import ast
from pathlib import Path

CLIENT_CLASSES = ("OpenAI", "AsyncOpenAI", "AzureOpenAI", "Groq", "AsyncGroq")
ENTRY_NAMES = ("run", "ask", "answer", "agent", "solve", "chat")


def _call_name(node: ast.Call) -> str:
    fn = node.func
    return fn.attr if isinstance(fn, ast.Attribute) else fn.id if isinstance(fn, ast.Name) else ""


def analyze(source: str) -> dict:
    """{clients: [{line, client}], tools: [{line, name}], entries: [{line, name, is_async}], already_instrumented}"""
    tree = ast.parse(source)
    clients, tools, entries = [], [], []
    tool_names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            if _call_name(node) in CLIENT_CLASSES:
                clients.append({"line": node.lineno, "client": _call_name(node)})
            for kw in node.keywords:
                if kw.arg == "tools" and isinstance(kw.value, (ast.List, ast.Tuple)):
                    tool_names |= {e.id for e in kw.value.elts if isinstance(e, ast.Name)}
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        decorators = [ast.unparse(d) for d in node.decorator_list]
        if any("blackbox.tool" in d for d in decorators):
            continue
        if node.name in tool_names or any(d.split("(")[0].split(".")[-1] == "tool" for d in decorators):
            tools.append({"line": node.lineno, "name": node.name})
        elif node.col_offset == 0 and not node.name.startswith("_") and (
                "completions.create" in ast.unparse(node) or node.name in ENTRY_NAMES
                or any(isinstance(n, ast.Call) and getattr(n.func, "attr", "") == "run" for n in ast.walk(node))):
            entries.append({"line": node.lineno, "name": node.name,
                            "is_async": isinstance(node, ast.AsyncFunctionDef)})
    return {"clients": clients, "tools": tools, "entries": entries, "already_instrumented": "blackbox" in source}


def plan(found: dict, filename: str) -> str:
    out = [f"Black Box plan for {filename}:"]
    if found["already_instrumented"]:
        out.append("(this file already mentions blackbox; only the missing pieces are listed)")
    out.append("1. Add `import blackbox` at the top.")
    for c in found["clients"]:
        out.append(f"2. Line {c['line']}: wrap the client so every model call is recorded: "
                   f"`client = blackbox.wrap({c['client']}(...))`.")
    if not found["clients"]:
        out.append("2. No OpenAI-style client found: if the model is called another way, record it with ctx.llm "
                   "(see README, 'Any agent').")
    for t in found["tools"]:
        out.append(f"3. Line {t['line']}: put `@blackbox.tool` directly above `def {t['name']}` (under any framework "
                   "decorator) so each call is recorded and replayable. List money-moving tools in "
                   "money_moving_tools so re-runs never execute them.")
    for e in found["entries"][:3]:
        fn = "arun" if e["is_async"] else "run"
        out.append(f"4. Call the agent through the recorder: `trace = {'await ' if e['is_async'] else ''}"
                   f"blackbox.{fn}({e['name']}, question, expected=...)` (entry point `{e['name']}`, line {e['line']}).")
    out.append("Then: `blackbox runs --fail`, `blackbox show <run>`, or ask the assistant to diagnose the run.")
    return "\n".join(out)


def plan_for_file(path: Path) -> str:
    return plan(analyze(path.read_text(encoding="utf-8")), path.name)
