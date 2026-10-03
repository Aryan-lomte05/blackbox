"""Developer workflow tools: regression tests from failures, instrumenting an agent, live system status."""

from __future__ import annotations

from pathlib import Path

from blackbox.mcp.registry import RUN_ID, store, tool


@tool("export_test", "Turn a recorded run into a pytest regression test (replays from the recording, 0 model "
      "calls). Optionally writes it to a file.", category="developer",
      properties={**RUN_ID, "write_to": {"type": "string", "description": "optional path, e.g. tests/test_bug_42.py"}},
      required=("run_id",))
def export_test(run_id: str, write_to: str | None = None) -> str:
    from blackbox.api.ui import export_test as render_test

    code = render_test(store().load_trace(run_id))
    if write_to:
        path = Path(write_to)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(code, encoding="utf-8")
        return f"Wrote {path} ({len(code.splitlines())} lines). Run it with: pytest {path}"
    return "```python\n" + code + "\n```"


@tool("instrument_agent", "Read a Python file of the user's agent and say exactly which lines to change so Black "
      "Box records it (wrap the model client, mark the tools, run under the recorder).", category="developer",
      properties={"file_path": {"type": "string"}}, required=("file_path",))
def instrument_agent(file_path: str) -> str:
    from blackbox.instrument import plan_for_file

    return plan_for_file(Path(file_path))


@tool("status", "What Black Box is doing on this machine now: job queue, GPU, data totals, model results.",
      category="developer")
def status() -> str:
    from blackbox.status import snapshot

    return snapshot(store())
