"""The MCP server speaks JSON-RPC over stdio like an IDE client expects."""

from __future__ import annotations

import json
import os
import subprocess
import sys

from blackbox import mcp_server


def test_handshake_list_and_call_in_process(tmp_path, monkeypatch):
    from blackbox.agents.base import run_task
    from blackbox.core.store import Store
    from blackbox.recorder import providers
    from tests.test_core_replay import ToyAgent, _task, fake_model

    providers.register_fake("fake-model", fake_model)
    try:
        store = Store(tmp_path)
        tr = run_task(ToyAgent(), _task(), "fake-model", store=store)
        monkeypatch.setattr(mcp_server, "_store", lambda: store)
        init = mcp_server.handle({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18"}})
        assert init["result"]["serverInfo"]["name"] == "blackbox" and "tools" in init["result"]["capabilities"]
        assert mcp_server.handle({"jsonrpc": "2.0", "method": "notifications/initialized"}) is None
        names = [t["name"] for t in mcp_server.handle({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})["result"]["tools"]]
        assert {"list_failures", "diagnose", "investigate", "run_steps"} <= set(names)
        out = mcp_server.handle({"jsonrpc": "2.0", "id": 3, "method": "tools/call",
                                 "params": {"name": "run_steps", "arguments": {"run_id": tr.run.run_id}}})
        assert not out["result"]["isError"] and f"Run {tr.run.run_id}" in out["result"]["content"][0]["text"]
        missing = mcp_server.handle({"jsonrpc": "2.0", "id": 4, "method": "tools/call",
                                     "params": {"name": "run_steps", "arguments": {"run_id": "nope"}}})
        assert missing["result"]["isError"]
        assert mcp_server.handle({"jsonrpc": "2.0", "id": 5, "method": "nope"})["error"]["code"] == -32601
    finally:
        providers.clear_fakes()


def test_stdio_transport():
    msgs = [{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
            {"jsonrpc": "2.0", "method": "notifications/initialized"},
            {"jsonrpc": "2.0", "id": 2, "method": "tools/list"}]
    proc = subprocess.run([sys.executable, "-m", "blackbox.mcp_server"], input="\n".join(json.dumps(m) for m in msgs) + "\n",
                          capture_output=True, text=True, timeout=120, env={**os.environ, "PYTHONIOENCODING": "utf-8"})
    replies = [json.loads(line) for line in proc.stdout.splitlines() if line.strip()]
    assert [r["id"] for r in replies] == [1, 2]  # the notification gets no reply
    assert len(replies[1]["result"]["tools"]) >= 6


def test_beyond_logs_tools_resources_prompts_and_completion(tmp_path, monkeypatch):
    from blackbox import mcp_crazy, mcp_extras
    from blackbox.agents.base import run_task
    from blackbox.core.store import Store
    from blackbox.recorder import providers
    from tests.test_core_replay import ToyAgent, _task, fake_model

    providers.register_fake("fake-model", fake_model)
    try:
        store = Store(tmp_path)
        a = run_task(ToyAgent(), _task(), "fake-model", store=store)
        b = run_task(ToyAgent(), _task(), "fake-model", store=store)
        for mod in (mcp_server, mcp_extras, mcp_crazy):
            monkeypatch.setattr(mod, "_store", lambda: store)

        def call(name, **args):
            out = mcp_server.handle({"jsonrpc": "2.0", "id": 9, "method": "tools/call",
                                     "params": {"name": name, "arguments": args}})["result"]
            assert not out["isError"], out
            return out["content"][0]["text"]

        names = {t["name"] for t in mcp_server.handle({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})["result"]["tools"]}
        assert {"time_travel", "blame_map", "fork", "verify", "live_lab", "decide_incident", "instrument_my_agent"} <= names
        assert "step 1 of" in call("time_travel", run_id=a.run.run_id, step_idx=1)
        assert "```mermaid" in call("blame_map", run_id=a.run.run_id)
        assert "Outcome flipped: False" in call("compare_runs", run_a=a.run.run_id, run_b=b.run.run_id)
        assert "EXPECT_PASS" in call("export_test", run_id=a.run.run_id)
        assert "model calls" in call("replay", run_id=a.run.run_id)

        comp = mcp_server.handle({"jsonrpc": "2.0", "id": 2, "method": "completion/complete",
                                  "params": {"argument": {"name": "run_id", "value": a.run.run_id[:3]}}})["result"]["completion"]
        assert a.run.run_id in comp["values"]
        res = mcp_server.handle({"jsonrpc": "2.0", "id": 3, "method": "resources/read",
                                 "params": {"uri": f"blackbox://run/{a.run.run_id}"}})["result"]["contents"][0]["text"]
        assert a.run.run_id in res
        assert mcp_server.handle({"jsonrpc": "2.0", "id": 4, "method": "resources/read",
                                  "params": {"uri": "blackbox://nope/1"}})["error"]["code"] == -32002
        msgs = mcp_server.handle({"jsonrpc": "2.0", "id": 5, "method": "prompts/get",
                                  "params": {"name": "explain_run_for_non_coder", "arguments": {"run_id": "r1"}}})
        assert "r1" in msgs["result"]["messages"][0]["content"]["text"]
    finally:
        providers.clear_fakes()


def test_instrument_finds_client_tools_and_entry_point():
    from blackbox.mcp_crazy import instrument

    src = ("from openai import OpenAI\nclient = OpenAI()\n\ndef lookup(city):\n    return 1\n\n"
           "def answer(q):\n    return client.chat.completions.create(model='m', messages=[], tools=[lookup])\n")
    found = instrument(src)
    assert found["clients"] == [{"line": 2, "client": "OpenAI"}]
    assert [t["name"] for t in found["tools"]] == ["lookup"]
    assert [e["name"] for e in found["entries"]] == ["answer"]


def test_progress_notifications_are_sent_while_a_tool_runs(monkeypatch):
    from blackbox import mcp_extras

    sent = []
    monkeypatch.setattr(mcp_server, "send", sent.append)
    monkeypatch.setitem(mcp_extras.HANDLERS, "status", lambda: (mcp_extras._progress("halfway"), "done")[1])
    out = mcp_server.handle({"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                             "params": {"name": "status", "arguments": {}, "_meta": {"progressToken": "t1"}}})
    assert out["result"]["content"][0]["text"] == "done"
    assert sent == [{"jsonrpc": "2.0", "method": "notifications/progress",
                     "params": {"progressToken": "t1", "progress": 1, "message": "halfway"}}]
    assert mcp_extras.PROGRESS is None
