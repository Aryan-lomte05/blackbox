"""The MCP tools that go past "read the logs": time travel, blame maps, cross-run search,
failures turned into tests, and Black Box instrumenting the user's own agent code.
"""

from __future__ import annotations

import ast
import json
from pathlib import Path
from typing import Any, Callable

from blackbox.mcp_extras import _obj, _short, _store

RUN = {"run_id": {"type": "string"}}

TOOLS: list[dict] = [
    {"name": "time_travel", "description": "Stand inside a run at step k: what the agent had seen, what it remembered "
     "(its state before and after), what it did, and which later steps this step went on to affect.",
     "inputSchema": _obj({**RUN, "step_idx": {"type": "integer"}}, ["run_id", "step_idx"])},
    {"name": "blame_map", "description": "A Mermaid diagram of how information flowed through a run: guilty step red, "
     "the steps it contaminated orange, other suspects yellow. Render it for the user.",
     "inputSchema": _obj(RUN, ["run_id"])},
    {"name": "compare_runs", "description": "Line two runs up step by step: where they first diverged and whether the outcome flipped.",
     "inputSchema": _obj({"run_a": {"type": "string"}, "run_b": {"type": "string"}}, ["run_a", "run_b"])},
    {"name": "search_steps", "description": "Search every recorded step (outputs, errors, tool names) across recent runs, "
     "e.g. 'no results', 'timeout', 'rate limit'.",
     "inputSchema": _obj({"query": {"type": "string"}, "only_failed": {"type": "boolean", "default": False},
                          "limit": {"type": "integer", "default": 15}}, ["query"])},
    {"name": "export_test", "description": "Turn a recorded run into a pytest regression test (replays from the recording, "
     "0 model calls). Optionally writes it to a file.",
     "inputSchema": _obj({**RUN, "write_to": {"type": "string", "description": "optional path, e.g. tests/test_bug_42.py"}},
                         ["run_id"])},
    {"name": "instrument_my_agent", "description": "Read a Python file of the user's agent and say exactly which lines to "
     "change so Black Box records it (wrap the model client, mark the tools, run under the recorder).",
     "inputSchema": _obj({"file_path": {"type": "string"}}, ["file_path"])},
    {"name": "cheaper_model", "description": "For a passing run: try each model call on a cheaper model by replay and "
     "report which steps could be downgraded without breaking the answer.",
     "inputSchema": _obj({**RUN, "cheaper_model": {"type": "string", "default": "agent-local"}}, ["run_id"])},
]


def _blob(store, digest: str | None) -> Any:
    if not digest or not store.has_blob(digest):
        return None
    return store.get_blob(digest)


def t_time_travel(run_id: str, step_idx: int) -> str:
    from blackbox.diagnosis.evidence import trail

    s = _store()
    tr = s.load_trace(run_id)
    k = int(step_idx)
    if not 0 <= k < len(tr.steps):
        raise KeyError(f"step {k} (run has {len(tr.steps)} steps)")
    step = tr.steps[k]
    before = next((_blob(s, p.state_hash_after) for p in reversed(tr.steps[:k]) if p.state_hash_after), None)
    after = _blob(s, step.state_hash_after)
    changed = {}
    if isinstance(before, dict) and isinstance(after, dict):
        changed = {key: after.get(key) for key in after if before.get(key) != after.get(key)}
    later = trail(tr, k)
    out = [f"Run {run_id}, step {k} of {len(tr.steps) - 1}: {step.kind} `{step.name}`",
           f"It used the results of steps {step.parents or 'none (it started from the task)'}."]
    for p in step.parents:
        out.append(f"  saw from step {p} ({tr.steps[p].name}): {_short(tr.steps[p].error or tr.steps[p].output, 140)}")
    out.append(f"Asked: {_short(step.request, 300)}")
    out.append(f"Did: {_short(step.error or step.output, 300)}" + ("  [ERROR]" if step.error else ""))
    out.append(f"Memory before: {_short(before, 300) if before is not None else '(empty)'}")
    out.append(f"Memory changes here: {_short(changed, 300) if changed else 'none'}")
    out.append(f"Later steps that used this, directly or indirectly: {later or 'none'}" +
               (f" ({len(later)} of {len(tr.steps) - k - 1} later steps)" if later else ""))
    if tr.run.label and tr.run.label.root_cause_step == k:
        out.append("This is the known guilty step.")
    out.append(f"To change history here: call fork(run_id={run_id!r}, step_idx={k}, new_output_json=...).")
    return "\n".join(out)


def t_blame_map(run_id: str) -> str:
    from blackbox.api.main import diagnose
    from blackbox.diagnosis.evidence import trail
    from blackbox.diagnosis.graph_data import dataflow_parents

    tr = _store().load_trace(run_id)
    failed = bool(tr.run.outcome and not tr.run.outcome.success)
    suspects = list(diagnose(tr).get("suspects", [])) if failed else []
    guilty = tr.run.label.root_cause_step if tr.run.label else (suspects[0] if suspects else None)
    hit = set(trail(tr, guilty)) if guilty is not None else set()
    lines = ["flowchart TD"]
    for st in tr.steps:
        label = f"#{st.idx} {st.kind}: {st.name}<br/>{_short(st.error or st.output, 40)}"
        lines.append(f'  s{st.idx}["{label.replace(chr(34), chr(39)).replace("[", "(").replace("]", ")")}"]')
    for i, ps in enumerate(dataflow_parents(tr)):
        lines += [f"  s{p} --> s{i}" for p in ps]
    lines += ["  classDef guilty fill:#fee2e2,stroke:#dc2626,stroke-width:3px",
              "  classDef hit fill:#ffedd5,stroke:#ea580c", "  classDef suspect fill:#fef9c3,stroke:#ca8a04"]
    if guilty is not None:
        lines.append(f"  class s{guilty} guilty")
    if hit:
        lines.append(f"  class {','.join(f's{i}' for i in sorted(hit))} hit")
    others = [i for i in suspects if i != guilty and i not in hit]
    if others:
        lines.append(f"  class {','.join(f's{i}' for i in others)} suspect")
    verdict = "PASS" if not failed else "FAIL"
    head = (f"Run {run_id} ({verdict}). Guilty step: {guilty}; it contaminated {sorted(hit) or 'nothing'}; "
            f"model suspects {suspects}.")
    return head + "\n\n```mermaid\n" + "\n".join(lines) + "\n```"


def t_compare_runs(run_a: str, run_b: str) -> str:
    from blackbox.replay.diff import compare

    s = _store()
    c = compare(s.load_trace(run_a), s.load_trace(run_b))
    rows = []
    for p in c["pairs"]:
        if p["status"] != "same":
            extra = f" memory diff {_short(p['state_diff'], 120)}" if p.get("state_diff") else ""
            rows.append(f"  {p['status']:7} a#{p['a']} b#{p['b']}{extra}")
    o = c["outcome"]
    ans = lambda x: _short(x["final_answer"], 60) if x else None  # noqa: E731
    return (f"{c['n_changed']} of {len(c['pairs'])} aligned steps differ; first divergence at position "
            f"{c['first_divergence']}. Outcome flipped: {o['flipped']} (a: {ans(o['a'])}, b: {ans(o['b'])}).\n" + "\n".join(rows[:30]))


def t_search_steps(query: str, only_failed: bool = False, limit: int = 15) -> str:
    s = _store()
    q = query.lower()
    hits, scanned = [], 0
    for r in s.list_runs(success=False if only_failed else None, limit=400):
        scanned += 1
        tr = s.load_trace(r.run_id)
        for st in tr.steps:
            text = f"{st.name} {json.dumps(st.output, default=str, ensure_ascii=False)} {st.error or ''}"
            if q in text.lower():
                ok = "PASS" if tr.run.outcome and tr.run.outcome.success else "FAIL"
                hits.append(f"{r.run_id} #{st.idx} {st.kind}:{st.name} [{ok}] {_short(st.error or st.output, 110)}")
                break
        if len(hits) >= int(limit):
            break
    if not hits:
        return f"No step mentions {query!r} in the {scanned} most recent runs."
    return f"{len(hits)} runs with a step mentioning {query!r} (searched {scanned} recent runs):\n" + "\n".join(hits)


def t_export_test(run_id: str, write_to: str | None = None) -> str:
    from blackbox.api.ui import export_test

    code = export_test(_store().load_trace(run_id))
    if write_to:
        p = Path(write_to)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(code, encoding="utf-8")
        return f"Wrote {p} ({len(code.splitlines())} lines). Run it with: pytest {p}"
    return "```python\n" + code + "\n```"


_CLIENTS = ("OpenAI", "AsyncOpenAI", "AzureOpenAI", "Groq", "AsyncGroq")


def instrument(source: str) -> dict:
    """Find what Black Box should hook in an agent's source: model clients, tools, entry points."""
    tree = ast.parse(source)
    clients, tools, entries = [], [], []
    tool_names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            fn = node.func
            name = fn.attr if isinstance(fn, ast.Attribute) else fn.id if isinstance(fn, ast.Name) else ""
            if name in _CLIENTS:
                clients.append({"line": node.lineno, "client": name})
            for kw in node.keywords:
                if kw.arg == "tools" and isinstance(kw.value, (ast.List, ast.Tuple)):
                    tool_names |= {e.id for e in kw.value.elts if isinstance(e, ast.Name)}
    already = "blackbox" in source
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        decos = [ast.unparse(d) for d in node.decorator_list]
        if any("blackbox.tool" in d for d in decos):
            continue
        if node.name in tool_names or any(d.split("(")[0].split(".")[-1] == "tool" for d in decos):
            tools.append({"line": node.lineno, "name": node.name})
        elif node.col_offset == 0 and not node.name.startswith("_") and (
                "completions.create" in ast.unparse(node) or node.name in ("run", "ask", "answer", "agent", "solve", "chat")
                or any(isinstance(n, ast.Call) and getattr(n.func, "attr", "") == "run" for n in ast.walk(node))):
            entries.append({"line": node.lineno, "name": node.name, "is_async": isinstance(node, ast.AsyncFunctionDef)})
    return {"clients": clients, "tools": tools, "entries": entries, "already_instrumented": already}


def t_instrument_my_agent(file_path: str) -> str:
    p = Path(file_path)
    found = instrument(p.read_text(encoding="utf-8"))
    out = [f"Black Box plan for {p.name}:"]
    if found["already_instrumented"]:
        out.append("(this file already mentions blackbox; only the missing pieces are listed)")
    out.append("1. Add `import blackbox` at the top.")
    for c in found["clients"]:
        out.append(f"2. Line {c['line']}: wrap the client so every model call is recorded: "
                   f"`client = blackbox.wrap({c['client']}(...))`.")
    if not found["clients"]:
        out.append("2. No OpenAI-style client found: if the model is called another way, record it with ctx.llm "
                   "(see README 'Any agent').")
    for t in found["tools"]:
        out.append(f"3. Line {t['line']}: put `@blackbox.tool` directly above `def {t['name']}` (under any framework "
                   "decorator) so each call is recorded and replayable. Mark money-moving tools in "
                   "money_moving_tools so re-runs never execute them.")
    for e in found["entries"][:3]:
        fn = "arun" if e["is_async"] else "run"
        out.append(f"4. Call the agent through the recorder instead of directly: "
                   f"`trace = {'await ' if e['is_async'] else ''}blackbox.{fn}({e['name']}, question, expected=...)` "
                   f"(entry point `{e['name']}`, line {e['line']}).")
    out.append("Then: `blackbox runs --fail`, `blackbox show <run>`, or ask me to diagnose / time_travel / blame_map it.")
    return "\n".join(out)


def t_cheaper_model(run_id: str, cheaper_model: str = "agent-local") -> str:
    import blackbox.agents.builtin  # noqa: F401
    from blackbox.replay.advisor import advise

    s = _store()
    res = advise(s.load_trace(run_id), cheaper_model, store=s)
    rows = [f"  step {r['step']} {r['from_model']} -> {r['to_model']}: "
            f"{'still passes' if r['still_passes'] else 'breaks the answer'} ({r['tokens']} tokens)"
            for r in res.get("rows", [])]
    summary = {k: v for k, v in res.items() if k != "rows"}
    return f"Cheaper-model check for {run_id}: {_short(summary, 300)}\n" + "\n".join(rows)


HANDLERS: dict[str, Callable[..., str]] = {
    "time_travel": t_time_travel, "blame_map": t_blame_map, "compare_runs": t_compare_runs,
    "search_steps": t_search_steps, "export_test": t_export_test, "instrument_my_agent": t_instrument_my_agent,
    "cheaper_model": t_cheaper_model,
}
