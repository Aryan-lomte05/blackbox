"""Causal report: necessary vs sufficient, recovery paths, blast radius."""

from __future__ import annotations

import pytest

from blackbox.agents.base import run_task
from blackbox.core.schema import Change
from blackbox.recorder import providers
from blackbox.replay.causal import blast_radius, causal_report
from blackbox.replay.engine import fork
from tests.test_core_replay import DOCS, ToyAgent, _task, fake_model, store  # noqa: F401 (fixture)


@pytest.fixture(autouse=True)
def _fake():
    providers.register_fake("fake-model", fake_model)
    yield
    providers.clear_fakes()


def test_planted_search_mistake_is_the_necessary_and_sufficient_root_cause(store):  # noqa: F811
    good = run_task(ToyAgent(), _task(), "fake-model", store=store)
    broken = fork(good, 1, Change(kind="output", value={"docs": DOCS["japan"]}), store=store)
    rep = causal_report(broken, store, [1, 3], strong_model="fake-model")
    by = {s["step"]: s for s in rep["steps"]}
    assert rep["cause"] == 1
    assert by[1]["necessary"] and by[1]["sufficient"] and by[1]["verdict"].startswith("root cause")
    assert not by[3]["necessary"]  # the answer step only repeated what the search said
    assert any(p["step"] == 1 for p in rep["recovery_paths"])
    br = rep["blast_radius"]
    assert 3 in br["contaminated"] and br["reaches_answer"] and br["money_moving_steps"] == []
    assert "root cause" in rep["summary"]


def test_blast_radius_flags_money_moving_tools(store):  # noqa: F811
    good = run_task(ToyAgent(), _task(), "fake-model", store=store)
    good.steps[2].name = "refund_order"  # pretend the independent tool step moves money
    good.steps[2].parents = [0]
    br = blast_radius(good, 0)
    assert br["severity"] in ("high", "critical")
