"""BlackBox-3K export: files per split, save-points travel, the card's numbers are computed."""

from __future__ import annotations

import json

import pytest

from blackbox.core.store import Store
from blackbox.data import dataset
from blackbox.data.farm import farm_task
from blackbox.data.importers.who_and_when import to_trace
from blackbox.faults.catalog import FAULTS
from blackbox.recorder import providers
from blackbox.replay.engine import replay
from tests.test_agents import fake_math, fake_qa, math_task, qa_task
from tests.test_eval import WW_ROW


@pytest.fixture
def exported(tmp_path):
    providers.register_fake("fake-qa", fake_qa)
    providers.register_fake("fake-math", fake_math)
    store = Store(tmp_path / "store")
    traces = farm_task(math_task(), "fake-math", store=store, n_forks=4, fault_types=tuple(FAULTS), seed=0)
    traces += farm_task(qa_task(), "fake-qa", store=store, n_forks=3, fault_types=tuple(FAULTS), seed=0)
    store.save_trace(to_trace(WW_ROW, "Hand-Crafted"))  # imported: must not be re-published
    crashed = traces[0].model_copy(deep=True)
    crashed.run.run_id, crashed.run.status, crashed.run.outcome = "crashed0", "crashed", None
    store.save_trace(crashed)
    out = tmp_path / "blackbox-3k"
    stats = dataset.export(store, out)
    yield out, stats, traces, store
    store.close()
    providers.clear_fakes()


def test_export_writes_one_file_per_split_and_leaves_out_crashes_and_imports(exported):
    out, stats, traces, _ = exported
    assert stats["data"]["runs"] == len(traces)
    assert stats["left_out"] == {"crashed": 1, "imported": 1, "unfinished": 0}
    splits = {t.run.split for t in traces}
    assert set(stats["files"]) == splits == {p.name.split(".")[0] for p in (out / "data").glob("*.jsonl.gz")}
    assert json.loads((out / "stats.json").read_text(encoding="utf-8"))["data"] == stats["data"]
    assert stats["steps"] == sum(len(t.steps) for t in traces) and stats["save_points"] > 0


def test_load_filters_and_returns_the_same_runs(exported):
    out, _, traces, _ = exported
    loaded = list(dataset.load(out))
    assert {t.run.run_id for t in loaded} == {t.run.run_id for t in traces}
    by_id = {t.run.run_id: t for t in traces}
    assert all(t.steps == by_id[t.run.run_id].steps for t in loaded)
    assert {t.run.task_family for t in dataset.load(out, family="qa")} == {"qa"}
    labelled = list(dataset.load(out, labelled_only=True))
    assert labelled and all(t.run.label.root_cause_step is not None for t in labelled)
    one_split = traces[0].run.split
    assert {t.run.split for t in dataset.load(out, split=one_split)} == {one_split}
    with pytest.raises(FileNotFoundError, match="Splits here"):
        list(dataset.load(out, split="no_such_split"))


def test_runs_loaded_into_a_fresh_store_bring_their_save_points_and_replay(exported, tmp_path):
    out, _, traces, _ = exported
    fresh = Store(tmp_path / "fresh")
    try:
        assert dataset.load_into_store(out, fresh)["added"] == len(traces)
        clean = fresh.load_trace(traces[0].run.run_id)
        assert all(fresh.has_blob(s.state_hash_after) for s in clean.steps)
        again = replay(clean)
        assert again.run.status == "done" and again.run.outcome.final_answer == clean.run.outcome.final_answer
    finally:
        fresh.close()


def test_card_numbers_come_from_the_runs(exported):
    out, stats, traces, _ = exported
    card = (out / "README.md").read_text(encoding="utf-8")
    d = stats["data"]
    assert f"{d['runs']} recorded runs of three LLM agents, {stats['steps']} steps" in card
    assert f"{d['labelled_failures']} runs are failures whose guilty step is known" in card
    for fid, fault in FAULTS.items():
        assert f"| {fid} | {fault.name} |" in card
    assert "| F7 | model picks the wrong tool | llm | no |" in card and "| F1 | wrong tool argument | tool | yes |" in card
    for split in stats["files"]:
        assert f"| {split} | {d['by_split'][split]} | {d['labelled_by_split'].get(split, 0)} |" in card
    assert "Left out of this export: 1 crashed runs, 1 imported runs, 0 unfinished runs." in card
    assert "fake-math" in card and "from blackbox.data.dataset import load" in card


def test_cli_export_and_stats(exported, tmp_path, capsys):
    out, stats, _, store = exported
    target = tmp_path / "again"
    assert dataset.main(["export", "--data", str(store.root), "--out", str(target)]) == 0
    assert (target / "README.md").exists()
    capsys.readouterr()
    assert dataset.main(["stats", str(target)]) == 0
    assert json.loads(capsys.readouterr().out)["data"]["runs"] == stats["data"]["runs"]
