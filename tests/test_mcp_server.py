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
