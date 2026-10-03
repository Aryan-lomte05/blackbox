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
