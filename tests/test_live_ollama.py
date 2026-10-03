"""Live: real model calls through local Ollama (CLAUDE.md review rule 7).

Skipped when Ollama is not running. Run with: py -3 -m pytest -m live -q
"""

from __future__ import annotations

import pytest
import requests

import blackbox
from blackbox import Change
from blackbox.agents.base import run_task
from blackbox.core.store import Store
from blackbox.recorder.providers import verify

pytestmark = pytest.mark.live


def _ollama_up() -> bool:
    try:
        return requests.get("http://localhost:11434/api/tags", timeout=2).ok
    except requests.RequestException:
        return False


needs_ollama = pytest.mark.skipif(not _ollama_up(), reason="Ollama not running")


@needs_ollama
def test_models_yaml_local_tags_exist():
    rows = {mid: status for mid, status, _ in verify()}
    assert rows["agent-local"] == "OK", rows


@needs_ollama
def test_registry_path_records_real_tokens(tmp_path):
    from tests.test_verify_autopilot_repair import TASK, CapitalAgent

    tr = run_task(CapitalAgent(), TASK, "agent-local", store=Store(tmp_path))
    assert tr.run.status == "done", tr.run.error
    llm = tr.steps[0]
    assert llm.meta["provider"] == "ollama" and llm.tokens_in and llm.tokens_out  # measured, not estimated


@needs_ollama
def test_wrapped_client_on_a_real_model(tmp_path):
    from openai import OpenAI

    blackbox.configure(tmp_path)
    client = blackbox.wrap(OpenAI(base_url="http://localhost:11434/v1", api_key="ollama"))

    @blackbox.tool
    def population(city: str) -> int:
        return {"pune": 7_000_000}.get(city.lower(), 0)

    def agent(city: str) -> str:
        n = population(city)
        r = client.chat.completions.create(model="qwen2.5:3b", temperature=0, messages=[
            {"role": "user", "content": f"Reply with only the number {n}, nothing else."}])
        return r.choices[0].message.content.strip()

    tr = blackbox.run(agent, "Pune")
    assert tr.run.status == "done", tr.run.error
    assert [s.kind for s in tr.steps] == ["tool", "llm", "final"]
    child = blackbox.fork(tr, 0, Change(kind="output", value={"result": 42}))
    assert child.run.outcome is None  # no checker registered for 'app': no invented verdict
    assert "42" in child.steps[-1].output["answer"]
    assert child.steps[1].cached is False  # the model call depended on the changed tool output
