"""Black Box as an MCP server (USP X5): ask your IDE's assistant "why did run X fail?".

    claude mcp add blackbox -- py -3 -m blackbox.mcp_server        (Claude Code)
    blackbox mcp                                                    (same thing via the CLI)

Speaks the Model Context Protocol over stdio (newline-delimited JSON-RPC 2.0) with no extra
dependencies. Tools read the local Black Box data folder; only `investigate` re-runs anything, and it
never executes tools that move money (the recorder's dry-run rule).
"""

from __future__ import annotations

import json
import os
import sys
import traceback
from typing import Any, Callable

PROTOCOL = "2025-06-18"

TOOLS: list[dict] = [
    {"name": "list_failures", "description": "Recent failed agent runs (newest first), with the known guilty step when there is one.",
     "inputSchema": {"type": "object", "properties": {"limit": {"type": "integer", "default": 10},
                                                       "family": {"type": "string", "enum": ["qa", "math", "ops", "external"]}}}},
    {"name": "run_steps", "description": "One run step by step: kind, name, which earlier steps it used, a short output.",
     "inputSchema": {"type": "object", "properties": {"run_id": {"type": "string"}}, "required": ["run_id"]}},
    {"name": "diagnose", "description": "Which steps most likely caused this failed run, with plain-language reasons.",
     "inputSchema": {"type": "object", "properties": {"run_id": {"type": "string"}}, "required": ["run_id"]}},
    {"name": "investigate", "description": "Full investigation of a failed run: diagnose, prove the cause by replay, compare. Takes 10-60 s.",
     "inputSchema": {"type": "object", "properties": {"run_id": {"type": "string"}}, "required": ["run_id"]}},
    {"name": "dataset_summary", "description": "What Black Box has recorded: runs, families, test sets, labelled failures.",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "failure_patterns", "description": "Top failure patterns across all recorded runs.",
     "inputSchema": {"type": "object", "properties": {"top": {"type": "integer", "default": 8}}}},
]


def _short(v: Any, n: int = 160) -> str:
    t = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False, default=str)
    t = " ".join(t.split())
    return t if len(t) <= n else t[: n - 1] + "…"


def _store():
    from blackbox.core.store import Store

    return Store()


def t_list_failures(limit: int = 10, family: str | None = None) -> str:
    runs = _store().list_runs(success=False, task_family=family, limit=int(limit))
    if not runs:
        return "No failed runs recorded."
    lines = [f"{r.run_id}  {r.task_family:5} {r.task_id:28} guilty step {r.label.root_cause_step if r.label else '?'}"
             f"{'  (planted ' + r.fault.type + ')' if r.fault else ''}" for r in runs]
    return "Failed runs (newest first):\n" + "\n".join(lines)


def t_run_steps(run_id: str) -> str:
    tr = _store().load_trace(run_id)
    r = tr.run
    head = (f"Run {r.run_id} ({r.agent}, {r.model_id}): {'PASS' if r.outcome and r.outcome.success else 'FAIL'}"
            f"; answer {_short(r.outcome.final_answer if r.outcome else None, 80)}")
    rows = [f"#{s.idx} {s.kind}:{s.name} used {s.parents} -> {_short(s.error or s.output, 120)}" for s in tr.steps]
    return head + "\n" + "\n".join(rows)


def t_diagnose(run_id: str) -> str:
    from blackbox.api.main import diagnose

    tr = _store().load_trace(run_id)
    d = diagnose(tr)
    out = [f"Top suspects for {run_id}: {d.get('suspects')} (model: {d.get('source')})"]
    for ev in d.get("evidence", []) or []:
        out.append(f"- step {ev['idx']}: " + " ".join(ev.get("sentences", [])))
    if tr.run.label and tr.run.label.root_cause_step is not None:
        out.append(f"Known guilty step: {tr.run.label.root_cause_step} ({tr.run.label.source}).")
    return "\n".join(out)


def t_investigate(run_id: str) -> str:
    from blackbox.api.investigate import case_file
    from blackbox.api.main import diagnose

    import blackbox.agents.builtin  # noqa: F401 - our agents must be registered to re-run them

    s = _store()
    out = case_file(s.load_trace(run_id), s, diagnose, repeats=1, strong_model="agent-local-7b")
    return "\n".join(out["story"])


def t_dataset_summary() -> str:
    from blackbox.eval.report import data_summary, iter_traces

    d = data_summary(list(iter_traces(_store())))
    return (f"{d['runs']} runs; {d['labelled_failures']} failures with a known guilty step "
            f"(sources {d['labelled_by_source']}); families {d['by_family']}; test sets {d['by_split']}.")


def t_failure_patterns(top: int = 8) -> str:
    from blackbox.api.ui import atlas

    a = atlas(_store())
    lines = [f"{p['count']:>4} ({p['share'] * 100:.0f}%)  {p['title']}" for p in a["patterns"][: int(top)]]
    return f"{a['total_failures']} labelled failures. Top patterns:\n" + "\n".join(lines)


HANDLERS: dict[str, Callable[..., str]] = {
    "list_failures": t_list_failures, "run_steps": t_run_steps, "diagnose": t_diagnose,
    "investigate": t_investigate, "dataset_summary": t_dataset_summary, "failure_patterns": t_failure_patterns,
}


def handle(msg: dict) -> dict | None:
    method, mid = msg.get("method"), msg.get("id")
    if mid is None:  # a notification (e.g. notifications/initialized): no reply
        return None
    if method == "initialize":
        result = {"protocolVersion": msg.get("params", {}).get("protocolVersion", PROTOCOL),
                  "capabilities": {"tools": {}}, "serverInfo": {"name": "blackbox", "version": "0.1.0"}}
    elif method == "ping":
        result = {}
    elif method == "tools/list":
        result = {"tools": TOOLS}
    elif method == "tools/call":
        params = msg.get("params", {})
        name, args = params.get("name"), params.get("arguments") or {}
        if name not in HANDLERS:
            return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32602, "message": f"unknown tool {name!r}"}}
        try:
            text, is_error = HANDLERS[name](**args), False
        except KeyError as exc:
            text, is_error = f"Not found: {exc}", True
        except Exception as exc:  # noqa: BLE001 - reported to the assistant, never crashes the server
            text, is_error = f"{type(exc).__name__}: {exc}", True
            traceback.print_exc(file=sys.stderr)
        result = {"content": [{"type": "text", "text": text}], "isError": is_error}
    else:
        return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": f"method not found: {method}"}}
    return {"jsonrpc": "2.0", "id": mid, "result": result}


def main() -> int:
    os.environ.setdefault("USE_TF", "0")
    os.environ.setdefault("TRANSFORMERS_NO_TF", "1")
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            reply = handle(json.loads(line))
        except json.JSONDecodeError as exc:
            reply = {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": f"parse error: {exc}"}}
        if reply is not None:
            sys.stdout.write(json.dumps(reply, ensure_ascii=False) + "\n")
            sys.stdout.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
