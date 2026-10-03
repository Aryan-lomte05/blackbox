"""Crash test: plant every applicable mistake in a passing run and grade how the agent copes."""

from __future__ import annotations

import pytest

from blackbox.agents.base import run_task
from blackbox.core.schema import Step
from blackbox.recorder import providers
from blackbox.replay.chaos import classify, crash_test, format_report
from tests.test_core_replay import ToyAgent, _task, fake_model, store  # noqa: F401 (fixture)


@pytest.fixture(autouse=True)
def _fake():
    providers.register_fake("fake-model", fake_model)
    yield
    providers.clear_fakes()


def _with(trace, *, success, answer, status="done"):
    out = trace.model_copy(deep=True)
    out.run.status = status
    out.run.outcome.success, out.run.outcome.final_answer = success, answer
    return out


def test_classify_grades_how_the_agent_failed(store):  # noqa: F811
    good = run_task(ToyAgent(), _task(), "fake-model", store=store)
    assert classify(good, 1) == "robust"
    assert classify(_with(good, success=False, answer="Tokyo"), 1) == "failed silently"
    assert classify(_with(good, success=False, answer="unknown"), 1) == "failed safely"
    assert classify(_with(good, success=False, answer=""), 1) == "failed safely"
    unsafe = _with(good, success=False, answer="Tokyo")
    unsafe.steps.append(Step(run_id=unsafe.run.run_id, idx=len(unsafe.steps), kind="tool", name="refund_order",
                             node="answer", request={}, input_hash="h"))
    assert classify(unsafe, 1) == "unsafe"


def test_crash_test_plants_each_applicable_mistake_and_rates_the_agent(store):  # noqa: F811
    good = run_task(ToyAgent(), _task(), "fake-model", store=store)
    rep = crash_test(good, store)
    assert rep["tests"] >= 1 and sum(rep["counts"].values()) == rep["tests"]
    assert 1 <= rep["stars"] <= 5 and 0.0 <= rep["score"] <= 1.0
    failed = [r for r in rep["rows"] if r["verdict"] in ("failed silently", "failed safely")]
    assert rep["new_labelled_failures"] == sum(1 for r in failed if r.get("labelled"))
    for r in rep["rows"]:
        if r.get("run_id"):
            child = store.load_trace(r["run_id"])  # every planted run is saved, with what was planted
            assert child.run.fault.type == r["fault"] and child.run.parent_run_id == good.run.run_id
    assert "Crash test of toy_agent" in format_report(rep)


def test_a_failing_run_cannot_be_crash_tested(store):  # noqa: F811
    good = run_task(ToyAgent(), _task(), "fake-model", store=store)
    with pytest.raises(ValueError):
        crash_test(_with(good, success=False, answer="x"), store)
