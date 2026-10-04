"""The MCP server: protocol, tool registry, tools, resources, prompts, progress, stdio transport."""

from __future__ import annotations

import json
import os
import subprocess
import sys

import pytest

from blackbox.mcp import handle, registry
from blackbox.mcp.registry import CATEGORIES


@pytest.fixture
def recorded(tmp_path):
    """Two passing toy runs in a throwaway store, injected into the MCP tools."""
    from blackbox.agents.base import run_task
    from blackbox.core.store import Store
    from blackbox.recorder import providers
    from tests.test_core_replay import ToyAgent, _task, fake_model

    providers.register_fake("fake-model", fake_model)
    store = Store(tmp_path)
    registry.configure(store_factory=lambda: store)
    try:
        yield [run_task(ToyAgent(), _task(), "fake-model", store=store) for _ in range(2)]
    finally:
        registry.configure()
        providers.clear_fakes()


def rpc(method: str, params: dict | None = None, mid: int = 1) -> dict:
    return handle({"jsonrpc": "2.0", "id": mid, "method": method, "params": params or {}})


def call(name: str, **arguments) -> str:
    out = rpc("tools/call", {"name": name, "arguments": arguments})["result"]
    assert not out["isError"], out
    return out["content"][0]["text"]


# ---- protocol --------------------------------------------------------------------------------
def test_initialize_advertises_every_capability():
    init = rpc("initialize", {"protocolVersion": "2025-06-18"})["result"]
    assert init["serverInfo"]["name"] == "blackbox"
    assert set(init["capabilities"]) == {"tools", "resources", "prompts", "completions"}


def test_notifications_get_no_reply_and_unknown_methods_an_error():
    assert handle({"jsonrpc": "2.0", "method": "notifications/initialized"}) is None
    assert rpc("nope")["error"]["code"] == -32601
    assert rpc("tools/call", {"name": "nope"})["error"]["code"] == -32602


# ---- registry --------------------------------------------------------------------------------
def test_every_tool_has_a_category_a_description_and_an_object_schema():
    tools = registry.all_tools()
    assert len(tools) >= 28
    for t in tools:
        assert t.category in CATEGORIES and len(t.description) > 20
        assert t.input_schema["type"] == "object"
        assert set(t.input_schema.get("required", [])) <= set(t.input_schema["properties"])
    listed = [t["name"] for t in rpc("tools/list")["result"]["tools"]]
    assert listed == [t.name for t in tools] and len(set(listed)) == len(listed)


def test_registering_a_name_twice_is_refused():
    with pytest.raises(ValueError):
        registry.tool("replay", "duplicate", category="experiments")(lambda: "")


# ---- tools -----------------------------------------------------------------------------------
def test_read_tools(recorded):
    a, b = recorded
    assert f"Run {a.run.run_id}" in call("run_steps", run_id=a.run.run_id)
    assert "Outcome flipped: False" in call("compare_runs", run_a=a.run.run_id, run_b=b.run.run_id)
    assert "step 1 of" in call("time_travel", run_id=a.run.run_id, step_idx=1)
    assert "```mermaid" in call("blame_map", run_id=a.run.run_id)
    assert "EXPECT_PASS" in call("export_test", run_id=a.run.run_id)
    assert call("similar_failures", run_id=a.run.run_id).startswith("Fingerprint FP-")


def test_experiment_tools(recorded):
    a, _ = recorded
    assert "0 model calls" in call("replay", run_id=a.run.run_id)
    out = call("fork", run_id=a.run.run_id, step_idx=3, new_output_json='{"text": "Tokyo"}')
    assert out.startswith("New run") and "FAIL" in out
    assert "Crash test of toy_agent" in call("crash_test", run_id=a.run.run_id)


def test_a_missing_run_is_a_tool_error_not_a_crash(recorded):
    out = rpc("tools/call", {"name": "run_steps", "arguments": {"run_id": "nope"}})["result"]
    assert out["isError"] and "Not found" in out["content"][0]["text"]


def test_instrument_agent_plans_the_three_hooks(tmp_path):
    src = tmp_path / "agent.py"
    src.write_text("from openai import OpenAI\nclient = OpenAI()\n\ndef lookup(city):\n    return 1\n\n"
                   "def answer(q):\n    return client.chat.completions.create(model='m', messages=[], tools=[lookup])\n",
                   encoding="utf-8")
    out = call("instrument_agent", file_path=str(src))
    assert "Line 2" in out and "def lookup" in out and "blackbox.run(answer" in out


# ---- resources, prompts, completion ----------------------------------------------------------
def test_resources_templates_and_completion(recorded):
    a, _ = recorded
    text = rpc("resources/read", {"uri": f"blackbox://run/{a.run.run_id}"})["result"]["contents"][0]["text"]
    assert a.run.run_id in text
    assert rpc("resources/read", {"uri": "blackbox://nope/1"})["error"]["code"] == -32002
    assert rpc("resources/templates/list")["result"]["resourceTemplates"][0]["uriTemplate"] == "blackbox://run/{run_id}"
    done = rpc("completion/complete", {"argument": {"name": "run_id", "value": a.run.run_id[:4]}})["result"]
    assert a.run.run_id in done["completion"]["values"]


def test_prompts():
    names = {p["name"] for p in rpc("prompts/list")["result"]["prompts"]}
    assert {"investigate_latest_failure", "explain_run_for_non_coder", "what_if", "fix_this_class_of_failure"} <= names
    msg = rpc("prompts/get", {"name": "explain_run_for_non_coder", "arguments": {"run_id": "r1"}})["result"]
    assert "r1" in msg["messages"][0]["content"]["text"]
    assert rpc("prompts/get", {"name": "nope"})["error"]["code"] == -32602


# ---- progress --------------------------------------------------------------------------------
def test_progress_notifications_while_a_tool_runs(monkeypatch):
    from blackbox.mcp import server

    sent = []
    monkeypatch.setattr(server, "send", sent.append)
    def slow_status() -> str:
        registry.report_progress("halfway")
        return "done"

    tool = registry.get("status")
    monkeypatch.setitem(registry._TOOLS, "status",
                        registry.Tool("status", tool.description, tool.input_schema, slow_status, tool.category))
    out = rpc("tools/call", {"name": "status", "arguments": {}, "_meta": {"progressToken": "t1"}})["result"]
    assert out["content"][0]["text"] == "done"
    assert sent == [{"jsonrpc": "2.0", "method": "notifications/progress",
                     "params": {"progressToken": "t1", "progress": 1, "message": "halfway"}}]


# ---- transport -------------------------------------------------------------------------------
def test_stdio_transport():
    msgs = [{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
            {"jsonrpc": "2.0", "method": "notifications/initialized"},
            {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
            "not json"]
    lines = "\n".join(m if isinstance(m, str) else json.dumps(m) for m in msgs) + "\n"
    proc = subprocess.run([sys.executable, "-m", "blackbox.mcp"], input=lines, capture_output=True, text=True,
                          timeout=120, check=False, env={**os.environ, "PYTHONIOENCODING": "utf-8"})
    replies = [json.loads(line) for line in proc.stdout.splitlines() if line.strip()]
    assert [r.get("id") for r in replies] == [1, 2, None]  # the notification gets no reply
    assert len(replies[1]["result"]["tools"]) >= 28 and replies[2]["error"]["code"] == -32700


def test_a_prompt_called_without_its_required_arguments_says_which_are_missing():
    err = rpc("prompts/get", {"name": "what_if", "arguments": {"run_id": "r1"}})["error"]
    assert err["code"] == -32602 and "step_idx, change" in err["message"]
