"""Fleet replay: one change tested on many recorded runs, with a regression firewall."""

from __future__ import annotations

import pytest

from blackbox.agents.base import run_task
from blackbox.core.schema import Change
from blackbox.recorder import providers
from blackbox.recorder.providers import LLMResult
from blackbox.replay.engine import fork
from blackbox.replay.fleet import fleet_test, make_policy
from tests.test_core_replay import DOCS, ToyAgent, _task, fake_model, store  # noqa: F401 (fixture)


@pytest.fixture(autouse=True)
def _fake():
    providers.register_fake("fake-model", fake_model)
    yield
    providers.clear_fakes()


def _answering(word):
    def model(messages, tools, params):
        if messages[-1]["content"].startswith("ANSWER FROM:"):
            return LLMResult(word, [], "stop", 10, 5, "fake", "fake-1")
        return fake_model(messages, tools, params)
    return model


def _runs(store):  # noqa: F811
    good = run_task(ToyAgent(), _task(), "fake-model", store=store)
    planted = fork(good, 1, Change(kind="output", value={"docs": DOCS["japan"]}), store=store)
    assert not planted.run.outcome.success
    return good, planted


def test_a_change_that_fixes_the_failure_and_breaks_nothing_is_approved(store):  # noqa: F811
    providers.register_fake("sure-model", _answering("Paris"))
    good, planted = _runs(store)
    rep = fleet_test(store, [planted.run.run_id, good.run.run_id], model="sure-model")
    assert [r["verdict"] for r in rep["rows"]] == ["fixed", "held"]
    assert rep["decision"] == "APPROVE" and rep["fix_rate"] == 1.0
    # the planted mistake was planted again (the fix had to recover from it), not silently removed
    child = store.load_trace(rep["rows"][0]["new_run"])
    assert child.steps[1].output == {"docs": DOCS["japan"]}


def test_a_change_that_breaks_a_passing_run_is_blocked(store):  # noqa: F811
    providers.register_fake("wrong-model", _answering("Rome"))
    good, planted = _runs(store)
    rep = fleet_test(store, [planted.run.run_id, good.run.run_id], model="wrong-model")
    assert rep["counts"]["regression"] == 1 and rep["decision"] == "BLOCK"


def test_a_rule_reaches_every_model_call_after_the_fork_point():
    req = {"model_id": "m", "messages": [{"role": "system", "content": "You are an agent."},
                                         {"role": "user", "content": "q"}]}
    out = make_policy(instruction="Check your sources.", model="m2")(req)
    assert out["model_id"] == "m2" and out["messages"][0]["content"].endswith("Rule: Check your sources.")
    assert req["messages"][0]["content"] == "You are an agent."  # the recorded request is untouched
    bare = make_policy(instruction="Be brief.")({"messages": [{"role": "user", "content": "q"}]})
    assert bare["messages"][0] == {"role": "system", "content": "Rule: Be brief."}
