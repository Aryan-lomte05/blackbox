"""Mistakes kept back from training (F7-F10), the wrong-id form of F1, and
how the farm keeps them out of the training split."""

from __future__ import annotations

import random

import pytest

from blackbox.agents.base import run_task
from blackbox.agents.math_agent import MathAgent
from blackbox.agents.qa import QAAgent
from blackbox.agents.shop import ShopAgent
from blackbox.core.store import Store
from blackbox.data.farm import farm_task, health, parse_faults, plant
from blackbox.data.splits import split_for
from blackbox.data.tasks.ops_tasks import make_task
from blackbox.faults.catalog import (
    FAULTS, TRAIN_FAULTS, UNSEEN_FAULTS, allowed_steps, first_step_to_notice, make_change, memory_after,
)
from blackbox.recorder import providers
from blackbox.replay.engine import fork
from tests.test_agents import fake_math, fake_qa, math_task, qa_task
from tests.test_shop import scripted


@pytest.fixture(autouse=True)
def _fakes():
    providers.register_fake("fake-qa", fake_qa)
    providers.register_fake("fake-math", fake_math)
    yield
    providers.clear_fakes()


@pytest.fixture
def store(tmp_path):
    s = Store(tmp_path)
    yield s
    s.close()


def shop_trace(store, index: int = 1):
    task = make_task(index)  # 1 = cancel + refund
    providers.register_fake("fake-shop", scripted([tuple(a) for a in task.meta["actions"]]))
    return run_task(ShopAgent(), task, "fake-shop", store=store)


@pytest.fixture
def traces(store):
    out = {"qa": run_task(QAAgent(), qa_task(), "fake-qa", store=store),
           "math": run_task(MathAgent(), math_task(), "fake-math", store=store),
           "ops": shop_trace(store)}
    assert all(t.run.outcome.success for t in out.values())
    return out


def test_catalog_has_ten_mistakes_and_four_are_kept_back():
    assert list(FAULTS) == [f"F{i}" for i in range(1, 11)]
    assert UNSEEN_FAULTS == ("F7", "F8", "F9", "F10") and not set(UNSEEN_FAULTS) & set(TRAIN_FAULTS)


@pytest.mark.parametrize("fault_type", UNSEEN_FAULTS)
def test_step_types(fault_type, traces):
    for trace in traces.values():
        for idx in allowed_steps(trace, fault_type):
            step = trace.steps[idx]
            assert step.kind != "final"
            if fault_type != "F8":
                assert step.kind == "llm"


@pytest.mark.parametrize("fault_type,family", [
    ("F7", "ops"), ("F8", "qa"), ("F8", "math"), ("F8", "ops"),
    ("F9", "qa"), ("F9", "math"), ("F9", "ops"), ("F10", "qa"), ("F10", "math"), ("F10", "ops"),
])
def test_ten_sampled_changes_appear_in_the_forked_step(fault_type, family, traces, store):
    trace = traces[family]
    steps = allowed_steps(trace, fault_type)
    assert steps, f"{fault_type} cannot be planted on a {family} run"
    for seed in range(10):
        rng = random.Random(seed)
        idx = rng.choice(steps)
        change = make_change(trace, fault_type, idx, rng)
        assert change.note.startswith(fault_type + ":")
        child = fork(trace, idx, change, store=store)
        assert child.run.status == "done", child.run.error  # a planted mistake must never crash the agent
        planted, original = child.steps[idx], trace.steps[idx]
        assert child.run.patch == change and child.run.fork_step_idx == idx
        if change.kind == "output":
            assert planted.output == change.value and planted.output != original.output
        elif change.kind == "messages":
            assert planted.request["messages"] == change.value != original.request["messages"]
        else:  # state: the first step that reads the wiped value can no longer be served from the recording
            (key, empty), = change.value.items()
            assert empty in ("", [])
            reader = first_step_to_notice(trace, idx, key)
            assert reader >= idx + 2 and key in child.steps[reader].reads
            assert not child.steps[reader].cached and all(s.cached for s in child.steps[:idx + 1])


def test_memory_loss_is_recorded_as_a_write_of_the_planted_step(traces):
    trace = traces["math"]
    idx = allowed_steps(trace, "F8")[0]
    change = make_change(trace, "F8", idx, random.Random(0))
    (key, empty), = change.value.items()
    planted = fork(trace, idx, change).steps[idx]
    assert key in planted.writes and planted.state_diff[key]["after"] == empty


# ---- F7 -------------------------------------------------------------------------------
def test_wrong_tool_swaps_to_a_tool_with_the_same_arguments_and_fails_the_task(traces):
    trace = traces["ops"]
    assert allowed_steps(traces["qa"], "F7") == [] and allowed_steps(traces["math"], "F7") == []
    idx = next(s.idx for s in trace.steps if s.kind == "llm" and "ACTION: cancel_order" in s.output["text"])
    for seed in range(10):
        change = make_change(trace, "F7", idx, random.Random(seed))
        assert change.value["text"].splitlines()[0] in ("ACTION: get_order", "ACTION: ship_order")
        assert change.value["text"].splitlines()[1] == trace.steps[idx].output["text"].splitlines()[1]  # same ARGS
    child = fork(trace, idx, make_change(trace, "F7", idx, random.Random(0)))
    assert child.run.status == "done" and child.run.outcome.success is False
    assert child.steps[idx + 1].name != "cancel_order"


# ---- F8 -------------------------------------------------------------------------------
def test_memory_loss_never_crashes_any_agent_at_any_step(traces):
    planted = 0
    for trace in traces.values():
        for idx in allowed_steps(trace, "F8"):
            for seed in range(4):
                child = fork(trace, idx, make_change(trace, "F8", idx, random.Random(seed)))
                assert child.run.status == "done", (trace.run.agent, idx, child.run.error)
                planted += 1
    assert planted >= 30


def test_memory_loss_wipes_only_text_and_lists_that_a_later_step_reads(traces):
    for trace in traces.values():
        for idx in allowed_steps(trace, "F8"):
            (key, empty), = make_change(trace, "F8", idx, random.Random(idx)).value.items()
            before = memory_after(trace, idx)[key]
            assert before and isinstance(before, (str, list)) and type(empty) is type(before)
            assert first_step_to_notice(trace, idx, key) >= idx + 2
            assert key not in trace.steps[idx + 1].writes  # else the next step would put the value back
    last_two = [len(traces["math"].steps) - 2, len(traces["math"].steps) - 1]
    assert not set(last_two) & set(allowed_steps(traces["math"], "F8"))  # nothing left to read it


def test_losing_the_results_fails_the_math_task(traces):
    trace = traces["math"]
    idx = next(s.idx for s in trace.steps if s.kind == "tool")  # after the first calculation
    child = fork(trace, idx, make_change(trace, "F8", idx, _only("results")))
    assert child.run.status == "done" and child.run.outcome.success is False


class _only(random.Random):
    """An rng whose choice() returns the named key when it is on offer."""

    def __init__(self, key: str):
        super().__init__(0)
        self.key = key

    def choice(self, seq):
        return self.key if self.key in seq else super().choice(seq)


# ---- F9 -------------------------------------------------------------------------------
def test_dropped_instruction_removes_one_sentence_but_never_the_first(traces):
    for trace in traces.values():
        for idx in allowed_steps(trace, "F9"):
            original = trace.steps[idx].request["messages"]
            for seed in range(5):
                new = make_change(trace, "F9", idx, random.Random(seed)).value
                assert [m["role"] for m in new] == [m["role"] for m in original]
                assert new[1:] == original[1:]  # only the system prompt changes
                old_sys, new_sys = original[0]["content"], new[0]["content"]
                assert len(new_sys) < len(old_sys) and new_sys.split(".")[0] == old_sys.split(".")[0]
    assert original[0]["content"] == trace.steps[idx].request["messages"][0]["content"]  # recording untouched


# ---- F10 ------------------------------------------------------------------------------
def test_answering_too_early_stops_each_agent_its_own_way(traces):
    math = traces["math"]
    idx = next(s.idx for s in math.steps if s.node == "step")
    change = make_change(math, "F10", idx, random.Random(0))
    assert change.value["text"] == "DONE"
    child = fork(math, idx, change)
    assert child.run.outcome.success is False and not any(s.kind == "tool" for s in child.steps)

    ops = traces["ops"]
    idx = next(s.idx for s in ops.steps if s.node == "act")
    child = fork(ops, idx, make_change(ops, "F10", idx, random.Random(0)))
    assert child.run.outcome.success is False and child.steps[idx + 1].kind == "final"

    qa = traces["qa"]
    idx = next(s.idx for s in qa.steps if s.node == "read")
    text = make_change(qa, "F10", idx, random.Random(0)).value["text"]
    assert text.splitlines()[-1] == "NEXT: ANSWER" and text.splitlines()[0].startswith("NOTE:")
    answer_idx = max(s.idx for s in qa.steps if s.kind == "llm")
    assert make_change(qa, "F10", answer_idx, random.Random(0)) is None  # already answering


# ---- F1: wrong id -----------------------------------------------------------------------
def test_wrong_argument_can_be_another_existing_order_id(traces):
    trace = traces["ops"]
    idx = next(s.idx for s in trace.steps if s.name == "cancel_order")
    right = trace.steps[idx].request["args"]["order_id"]
    orders = set(trace.run.task_input["db"]["orders"])
    for seed in range(10):
        change = make_change(trace, "F1", idx, random.Random(seed))
        assert change.kind == "args" and set(change.value) == {"order_id"}
        assert change.value["order_id"] in orders - {right}
    child = fork(trace, idx, make_change(trace, "F1", idx, random.Random(0)))
    assert child.run.status == "done" and child.run.outcome.success is False


# ---- farm: keeping the kept-back mistakes out of training -------------------------------
def _math_task_in(split: str):
    task = math_task()
    task.task_id = next(f"math-t{i}" for i in range(500) if split_for(f"math-t{i}", "math") == split)
    return task


def test_kept_back_mistakes_are_never_planted_on_a_training_task():
    traces = farm_task(_math_task_in("train"), "fake-math", store=None, n_forks=6,
                       fault_types=tuple(FAULTS), seed=0)
    assert len(traces) > 1 and {t.run.split for t in traces} == {"train"}
    assert {t.run.fault.type for t in traces[1:]} <= set(TRAIN_FAULTS)


def test_kept_back_mistakes_on_other_tasks_form_the_new_mistakes_set():
    traces = farm_task(_math_task_in("test_known"), "fake-math", store=None, n_forks=8,
                       fault_types=tuple(FAULTS), seed=0)
    clean, forks = traces[0], traces[1:]
    assert clean.run.split == "test_known"
    kinds = {f.run.fault.type for f in forks}
    assert kinds & set(UNSEEN_FAULTS) and kinds & set(TRAIN_FAULTS)
    for f in forks:
        expected = "test_new_mistakes" if f.run.fault.type in UNSEEN_FAULTS else "test_known"
        assert f.run.split == expected
        assert f.run.status == "done", f.run.error
    rows = health(traces)["faults"]
    assert list(rows) == sorted(rows, key=lambda f: int(f[1:]))  # F10 sorts after F9, not after F1


def test_shop_runs_stay_in_the_new_tasks_set_whatever_the_mistake(traces):
    trace = traces["ops"]
    trace.run.split = "test_new_tasks"
    idx = allowed_steps(trace, "F10")[0]
    assert plant(trace, "F10", idx, random.Random(0)).run.split == "test_new_tasks"


def test_parse_faults():
    assert parse_faults("all") == tuple(FAULTS)
    assert parse_faults("f1, F10") == ("F1", "F10")
    with pytest.raises(SystemExit, match="unknown mistake"):
        parse_faults("F1,F11")
