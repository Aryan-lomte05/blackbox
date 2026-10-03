from __future__ import annotations

from blackbox.agents.base import run_task
from blackbox.core.store import Store
from blackbox.data.shards import export, merge
from blackbox.recorder import providers
from tests.test_core_replay import ToyAgent, _task, fake_model


def test_export_then_merge_is_complete_and_idempotent(tmp_path, monkeypatch):
    monkeypatch.setenv("BLACKBOX_MACHINE", "radhesh-3050")
    providers.register_fake("fake-model", fake_model)
    try:
        a = Store(tmp_path / "a")
        tr = run_task(ToyAgent(), _task(), "fake-model", store=a)
        shard = export(a, tmp_path / "shards")
        assert shard.name.startswith("radhesh-3050_")

        central = Store(tmp_path / "central")
        assert merge(central, [tmp_path / "shards"])["added"] == 1
        got = central.load_trace(tr.run.run_id)
        assert got.steps == tr.steps
        assert all(central.has_blob(s.state_hash_after) for s in got.steps)
        assert merge(central, [tmp_path / "shards"]) == {"files": 1, "added": 0, "already_present": 1,
                                                         "unreadable": 0}
    finally:
        providers.clear_fakes()


def test_farm_shard_carries_savepoints_and_old_format_still_merges(tmp_path):
    import gzip

    from blackbox.data.farm import read_shard, write_shard

    providers.register_fake("fake-model", fake_model)
    try:
        a = Store(tmp_path / "a")
        tr = run_task(ToyAgent(), _task(), "fake-model", store=a)
        shard = write_shard([tr], tmp_path / "s1", store=a)
        assert read_shard(shard) == [tr]
        central = Store(tmp_path / "c")
        assert merge(central, [shard])["added"] == 1
        assert all(central.has_blob(s.state_hash_after) for s in tr.steps)

        legacy = tmp_path / "s2" / "old.jsonl.gz"  # early farm format: bare Trace per line
        legacy.parent.mkdir()
        tr2 = run_task(ToyAgent(), _task(), "fake-model")
        with gzip.open(legacy, "wt", encoding="utf-8") as fh:
            fh.write(tr2.model_dump_json() + "\n")
        assert merge(central, [legacy])["added"] == 1
    finally:
        providers.clear_fakes()
