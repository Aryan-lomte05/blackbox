"""Each planted mistake applies only to its step type, and 10 sampled changes
per type actually appear in the forked step."""

from __future__ import annotations

import random

import pytest

from blackbox.agents.base import run_task
from blackbox.agents.math_agent import MathAgent
from blackbox.agents.qa import QAAgent
from blackbox.faults.catalog import FAULTS, allowed_steps, make_change, perturb_number, perturb_number_in_text
from blackbox.recorder import providers
from blackbox.replay.engine import fork
from tests.test_agents import fake_math, fake_qa, math_task, qa_task

STEP_KIND = {"F1": "tool", "F2": "tool", "F3": "tool", "F4": "retrieval", "F5": "retrieval", "F6": "llm"}


@pytest.fixture(autouse=True)
def _fakes():
    providers.register_fake("fake-qa", fake_qa)
    providers.register_fake("fake-math", fake_math)
    yield
    providers.clear_fakes()


@pytest.fixture
def traces():
    qa = run_task(QAAgent(), qa_task(), "fake-qa")
    math = run_task(MathAgent(), math_task(), "fake-math")
    assert qa.run.outcome.success and math.run.outcome.success
    return {"qa": qa, "math": math}


def _trace_for(fault_type, traces):
    return traces["qa"] if fault_type in ("F4", "F5") else traces["math"]


@pytest.mark.parametrize("fault_type", sorted(STEP_KIND))
def test_fault_only_applies_to_its_step_type(fault_type, traces):
    assert FAULTS[fault_type].step_kind == STEP_KIND[fault_type]
    for trace in traces.values():
        for idx in allowed_steps(trace, fault_type):
            assert trace.steps[idx].kind == STEP_KIND[fault_type]
    assert allowed_steps(_trace_for(fault_type, traces), fault_type), "no step to plant it on"


@pytest.mark.parametrize("fault_type", sorted(STEP_KIND))
def test_ten_sampled_changes_appear_in_the_forked_step(fault_type, traces):
    trace = _trace_for(fault_type, traces)
    steps = allowed_steps(trace, fault_type)
    for seed in range(10):
        rng = random.Random(seed)
        idx = rng.choice(steps)
        change = make_change(trace, fault_type, idx, rng)
        assert change is not None and change.note.startswith(fault_type)
        child = fork(trace, idx, change)
        assert child.run.status == "done", child.run.error
        planted, original = child.steps[idx], trace.steps[idx]
        assert planted.meta["fork_change"]["kind"] == change.kind
        if change.kind == "args":
            assert planted.request["args"] != original.request["args"]
            assert planted.request["args"] == {**original.request["args"], **change.value}
        else:
            assert planted.output == change.value and planted.output != original.output
        assert all(s.cached for s in child.steps[:idx])  # the prefix came from the recording


def test_search_faults_remove_the_right_paragraph(traces):
    trace, gold = traces["qa"], {"Ed Wood", "Scott Derrickson"}
    for fault_type in ("F4", "F5"):
        for idx in allowed_steps(trace, fault_type):
            before = trace.steps[idx].output["docs"]
            after = make_change(trace, fault_type, idx, random.Random(1)).value["docs"]
            assert not {d["title"] for d in after} & gold
            if fault_type == "F4":
                assert len(after) == len(before)  # replaced by a distractor, not removed
            else:
                assert len(after) < len(before)


def test_f4_prefers_the_distractor_that_looks_like_the_right_paragraph(traces):
    trace = traces["qa"]
    idx = next(i for i in allowed_steps(trace, "F4")
               if any(d["title"] == "Ed Wood" for d in trace.steps[i].output["docs"]))
    change = make_change(trace, "F4", idx, random.Random(0))
    assert "Ed Wood (film)" in {d["title"] for d in change.value["docs"]}


def test_wrong_fact_on_a_qa_step_swaps_an_entity_or_flips_yes_no(traces):
    trace = traces["qa"]
    answer_idx = max(s.idx for s in trace.steps if s.kind == "llm")
    change = make_change(trace, "F6", answer_idx, random.Random(0))
    assert change.value["text"] == "ANSWER: no"
    child = fork(trace, answer_idx, change)
    assert child.run.outcome.success is False


def test_faults_skip_steps_they_cannot_change(traces):
    math = traces["math"]
    final_idx = len(math.steps) - 1
    assert all(make_change(math, f, final_idx, random.Random(0)) is None for f in FAULTS)
    assert allowed_steps(math, "F4") == [] and allowed_steps(traces["qa"], "F1") == []
    with pytest.raises(KeyError):
        make_change(math, "F99", 0, random.Random(0))


def test_number_edits_always_change_the_value_and_spare_list_markers():
    rng = random.Random(3)
    for value in (0, 1, 9, 10, 2.5, 100):
        assert perturb_number(value, rng) != value
    for _ in range(20):
        new, before, after = perturb_number_in_text("1. add 16 eggs\n2) sell at 2.50", rng)
        assert before in ("16", "2.50") and before != after
        assert new.startswith("1. ") and "\n2) " in new
    assert perturb_number_in_text("no digits here", rng) is None


# ---- F6 goes for the fact the answer rests on -------------------------------------------
def _with_text(trace, idx, text, answer):
    step = trace.steps[idx]
    step.output = {**step.output, "text": text}
    trace.run.outcome.final_answer = answer
    return idx


def test_wrong_fact_changes_the_number_the_answer_rests_on_not_a_bystander(traces):
    trace = traces["math"]
    idx = _with_text(trace, 1, "NOTE: founded in 1966, the total is 18 dollars", "18")
    for seed in range(10):
        text = make_change(trace, "F6", idx, random.Random(seed)).value["text"]
        assert "1966" in text and " 18 " not in text


def test_wrong_fact_swaps_the_answer_entity_or_flips_the_answer(traces):
    trace = traces["qa"]
    idx = _with_text(trace, 2, "NOTE: Ed Wood (1924-1978) was an American filmmaker", "Ed Wood")
    for seed in range(10):
        change = make_change(trace, "F6", idx, random.Random(seed))
        assert "1924-1978" in change.value["text"] and not change.value["text"].startswith("NOTE: Ed Wood (")
        assert change.note.startswith("F6: Ed Wood -> ")
    idx = _with_text(trace, 2, "NOTE: both were born in 1966, so yes they match", "yes")
    assert make_change(trace, "F6", idx, random.Random(0)).value["text"] == \
        "NOTE: both were born in 1966, so no they match"


def test_wrong_fact_falls_back_when_the_step_does_not_state_the_answer(traces):
    trace = traces["math"]
    idx = _with_text(trace, 1, "CALC: 16 - 3 - 4", "18")
    change = make_change(trace, "F6", idx, random.Random(0))
    assert change is not None and change.value["text"] != "CALC: 16 - 3 - 4"
