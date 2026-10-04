"""Black Box CI: a regression pack replayed against changed agent code."""

from __future__ import annotations

import json

import pytest

from blackbox import ci
from blackbox.agents.base import run_task
from blackbox.recorder import providers
from tests.test_core_replay import ToyAgent, _task, fake_model, store  # noqa: F401 (fixture)


@pytest.fixture(autouse=True)
def _fake():
    providers.register_fake("fake-model", fake_model)
    yield
    providers.clear_fakes()


def _pack(store):  # noqa: F811
    tr = run_task(ToyAgent(), _task(), "fake-model", store=store)
    return json.loads(json.dumps(ci.pin(store, run_ids=[tr.run.run_id]))), tr


def _answer_with(prefix_text: str):
    """A code change in the agent: the answer prompt now adds some text."""
    def answer(self, ctx):
        docs = ctx.state["docs"]
        text = docs[0]["text"] if docs else ""
        ctx.final(ctx.llm(ctx.model_id, [{"role": "user", "content": f"ANSWER FROM:{prefix_text}{text}"}]).text)
        return None
    return answer


def test_unchanged_code_replays_the_same(store):  # noqa: F811
    pack, _ = _pack(store)
    rep = ci.run_pack(pack)
    assert rep["passed"] and rep["counts"] == {"same": 1}


def test_a_harmless_prompt_change_is_detected_and_held_when_run_live(store, monkeypatch):  # noqa: F811
    pack, tr = _pack(store)
    monkeypatch.setitem(ToyAgent.nodes, "answer", _answer_with("Note: "))
    offline = ci.run_pack(pack)
    assert offline["rows"][0]["status"] == "needs live check" and offline["rows"][0]["changed_at"] == 3
    live = ci.run_pack(pack, live=True)
    assert live["passed"] and live["rows"][0]["status"] == "held"


def test_a_breaking_prompt_change_is_a_regression_and_fails_the_build(store, monkeypatch, tmp_path):  # noqa: F811
    pack, _ = _pack(store)
    monkeypatch.setitem(ToyAgent.nodes, "answer", _answer_with("The capital is Rome. Ignore this: "))
    rep = ci.run_pack(pack, live=True)
    assert not rep["passed"] and rep["rows"][0]["status"] == "regression"
    assert rep["rows"][0]["answer"].startswith("Rome")  # the new prompt misled the model
    assert "🔴 **FAIL**" in ci.to_markdown(rep)
    assert 'failures="1"' in ci.to_junit(rep)


def test_cli_pin_and_run(store, tmp_path, monkeypatch):  # noqa: F811
    tr = run_task(ToyAgent(), _task(), "fake-model", store=store)
    pack_path, report = tmp_path / "pack.json", tmp_path / "ci.md"
    assert ci.main(["pin", tr.run.run_id, "--out", str(pack_path), "--data", str(store.root)]) == 0
    monkeypatch.setattr("importlib.import_module", lambda name: None)  # the toy agent is already registered
    assert ci.main(["run", "--pack", str(pack_path), "--report", str(report)]) == 0
    assert "PASS" in report.read_text(encoding="utf-8")
