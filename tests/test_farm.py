"""The farm: clean run -> planted-mistake forks -> labels, splits, shard, health check."""

from __future__ import annotations

import random
from collections import Counter

import pytest

from blackbox.agents.base import Task
from blackbox.core.schema import FaultSpec
from blackbox.core.store import Store
from blackbox.data.farm import (
    farm_task, format_health, health, pick_faults, plant, read_shard, run_farm, write_shard,
)
from blackbox.data.splits import bucket, split_for
from blackbox.data.tasks import gsm8k, hotpot
from blackbox.faults.catalog import TRAIN_FAULTS, allowed_steps
from blackbox.recorder import providers
from tests.test_agents import _reply, fake_math, fake_qa, math_task, qa_task


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


def test_farm_task_labels_failed_forks_and_keeps_recovered_ones(store):
    traces = farm_task(math_task(), "fake-math", store=store, n_forks=3, fault_types=TRAIN_FAULTS, seed=0)
    clean, forks = traces[0], traces[1:]
    assert clean.run.outcome.success and clean.run.fault is None and clean.run.label is None
    assert len(forks) == 3 and len({(f.run.fault.type, f.run.fault.step_idx) for f in forks}) == 3
    for f in forks:
        assert f.run.status == "done", f.run.error
        assert f.run.parent_run_id == clean.run.run_id and f.run.split == clean.run.split
        assert f.run.fault.step_idx == f.run.fork_step_idx
        if f.run.outcome.success:
            assert f.run.label is None  # recovered: odd but harmless
        else:
            assert f.run.label.root_cause_step == f.run.fault.step_idx and f.run.label.source == "injected"
        assert store.load_trace(f.run.run_id).run.fault == f.run.fault  # saved with its fault and label
    assert any(f.run.label for f in forks)
    assert store.counts()["runs"] == 4


def test_a_failed_clean_run_gets_no_forks(store):
    providers.register_fake("fake-math", lambda m, t, p: _reply("FINAL: 5"))
    traces = farm_task(math_task(), "fake-math", store=store, n_forks=3, fault_types=TRAIN_FAULTS, seed=0)
    assert len(traces) == 1 and traces[0].run.outcome.success is False and traces[0].run.label is None


def test_a_crash_is_counted_and_never_labelled(store):
    def boom(messages, tools, params):
        raise RuntimeError("provider exploded")

    providers.register_fake("fake-math", boom)
    traces = farm_task(math_task(), "fake-math", store=store, n_forks=3, fault_types=TRAIN_FAULTS, seed=0)
    assert len(traces) == 1 and traces[0].run.status == "crashed" and traces[0].run.label is None
    h = health(traces)
    assert h["crashed"] == 1 and h["labelled"] == 0 and h["clean_failed"] == 0


def test_a_fork_that_crashes_is_not_a_labelled_failure(store):
    clean = farm_task(math_task(), "fake-math", store=None, n_forks=0, fault_types=TRAIN_FAULTS, seed=0)[0]

    def boom(messages, tools, params):
        raise RuntimeError("provider exploded")

    providers.register_fake("fake-math", boom)
    child = plant(clean, "F2", 2, random.Random(0), store=store)
    assert child.run.status == "crashed" and child.run.fault.type == "F2" and child.run.label is None
    assert health([clean, child])["faults"]["F2"] == {
        "runs": 1, "failed": 0, "recovered": 0, "crashed": 1, "flip_pct": None}


def test_planted_steps_are_spread_over_positions():
    clean = farm_task(math_task(), "fake-math", store=None, n_forks=0, fault_types=TRAIN_FAULTS, seed=0)[0]
    seen = Counter()
    for seed in range(300):
        for _, idx in pick_faults(clean, TRAIN_FAULTS, 1, random.Random(seed)):
            seen[idx] += 1
    plantable = sorted({i for ft in TRAIN_FAULTS for i in allowed_steps(clean, ft)})
    assert len(plantable) >= 4 and sorted(seen) == plantable
    assert max(seen.values()) < 2.5 * min(seen.values())  # spread out, not piled on one step
    kinds = Counter(clean.steps[i].kind for i in seen.elements())
    assert 0.35 < kinds["tool"] / 300 < 0.65  # model steps do not crowd out tool mistakes


def test_a_run_with_one_tool_step_still_gets_half_tool_mistakes():
    def one_calc(messages, tools, params):
        system, user = messages[0]["content"], messages[-1]["content"]
        if system.startswith("You plan how"):
            return _reply("find the eggs left after eating and baking")
        if system.startswith("You solve"):
            return _reply("CALC: 16 - 3 - 4" if "(none yet)" in user else "DONE")
        return _reply("FINAL: 9")

    providers.register_fake("fake-math", one_calc)
    task = math_task()
    task.expected = "9"
    clean = farm_task(task, "fake-math", store=None, n_forks=0, fault_types=TRAIN_FAULTS, seed=0)[0]
    assert clean.run.outcome.success and sum(s.kind == "tool" for s in clean.steps) == 1
    types = Counter()
    for seed in range(300):
        picks = pick_faults(clean, TRAIN_FAULTS, 3, random.Random(seed))
        assert len(set(picks)) == 3  # distinct (mistake, step) pairs; the one tool step may repeat
        types.update(ft for ft, _ in picks)
    # distinct steps would cap this run at one tool mistake in three (F6 >= 67%)
    assert 0.40 < types["F6"] / 900 < 0.60
    assert all(types[ft] > 100 for ft in ("F1", "F2", "F3"))


def test_run_farm_shard_roundtrip_and_health(store, tmp_path):
    lines: list[str] = []
    traces = run_farm([math_task()], "fake-math", store=store, n_forks=2, workers=2, log=lines.append)
    traces += run_farm([qa_task()], "fake-qa", store=store, n_forks=2, workers=1, log=lines.append)
    assert len(lines) == 2 and "pass" in lines[0]

    path = write_shard(traces, tmp_path / "shards")
    assert path.name.endswith(".jsonl.gz")
    assert read_shard(path) == traces

    h = health(traces)
    assert h["runs"] == 6 and h["clean"] == 2 and h["clean_passed"] == 2 and h["crashed"] == 0
    assert sum(row["runs"] for row in h["faults"].values()) == 4
    assert h["labelled"] == sum(row["failed"] for row in h["faults"].values())
    text = format_health(h)
    assert "flip %" in text and "labelled failures" in text


def test_health_flags_a_mistake_that_never_flips():
    clean = farm_task(math_task(), "fake-math", store=None, n_forks=0, fault_types=TRAIN_FAULTS, seed=0)[0]
    harmless = clean.model_copy(deep=True)
    harmless.run.fault = FaultSpec(type="F3", step_idx=2)
    h = health([clean, harmless])
    assert h["faults"]["F3"]["flip_pct"] == 0.0
    assert "outside 30-90%" in format_health(h)


def test_splits_are_stable_by_task_and_roughly_70_10_10_10():
    assert bucket("qa-5a8b57f25542995d1e6f1371") == bucket("qa-5a8b57f25542995d1e6f1371")
    assert split_for("anything", "ops") == "test_new_tasks"
    counts = Counter(split_for(f"math-{i}", "math") for i in range(4000))
    assert set(counts) == {"train", "val", "calib", "test_known"}
    assert 0.66 < counts["train"] / 4000 < 0.74
    for name in ("val", "calib", "test_known"):
        assert 0.07 < counts[name] / 4000 < 0.13


def test_task_loaders(tmp_path):
    hp = tmp_path / "hotpot.jsonl"
    hp.write_text('{"id": "abc", "question": "Q?", "answer": "yes", "type": "comparison", "level": "hard", '
                  '"supporting_titles": ["A"], "paragraphs": [{"title": "A", "text": "t"}]}\n', encoding="utf-8")
    task = hotpot.load(path=hp)[0]
    assert task.task_id == "qa-abc" and task.family == "qa"
    assert set(task.input) == {"question", "paragraphs"}  # the agent never sees the answer
    assert task.expected == {"answer": "yes", "supporting_titles": ["A"]}

    gs = tmp_path / "gsm8k.jsonl"
    gs.write_text('{"id": 0, "question": "Q?", "answer": "9 * 2 = <<9*2=18>>18\\n#### 1,800"}\n'
                  '{"id": 1, "question": "Q2?", "answer": "#### 3"}\n', encoding="utf-8")
    tasks = gsm8k.load(path=gs)
    assert [t.task_id for t in tasks] == ["math-0", "math-1"] and tasks[0].expected == "1800"
    assert [t.task_id for t in gsm8k.load(n=1, offset=1, path=gs)] == ["math-1"]
    with pytest.raises(FileNotFoundError, match="blackbox.data.download"):
        gsm8k.load(path=tmp_path / "missing.jsonl")
    assert isinstance(task, Task)
