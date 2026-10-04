"""Expensive totals are memoized per store revision; the live status is served from a background snapshot."""

from __future__ import annotations

import pytest

from blackbox.agents.base import run_task
from blackbox.api.snapshot import Snapshot
from blackbox.core.schema import Change, Label
from blackbox.recorder import providers
from blackbox.replay.engine import fork
from tests.test_core_replay import ToyAgent, _task, fake_model, store  # noqa: F401 (fixture)


@pytest.fixture(autouse=True)
def _fake():
    providers.register_fake("fake-model", fake_model)
    yield
    providers.clear_fakes()


def test_counts_follow_new_and_relabelled_runs(store):  # noqa: F811
    tr = run_task(ToyAgent(), _task(), "fake-model", store=store)
    first = store.counts()
    assert first["runs"] == 1 and store.counts() == first           # memoized: same revision, same answer
    child = fork(tr, 1, Change(kind="output", value={"docs": []}), store=store)
    assert store.counts()["runs"] == 2                                # a new run changes the revision
    before = store.counts()["labelled_failures"]
    child.run.label = Label(root_cause_step=1, source="injected")
    store.save_trace(child)                                          # re-label: same run count
    assert store.counts()["labelled_failures"] == before + 1


def test_snapshot_serves_the_latest_value_and_survives_a_failing_refresh():
    calls = {"n": 0}

    def compute():
        calls["n"] += 1
        if calls["n"] > 1:
            raise RuntimeError("probe down")
        return {"ok": True}

    snap = Snapshot(compute, every=0.05)
    first = snap.get()
    assert first["ok"] is True and "snapshot_age_s" in first
    import time

    time.sleep(0.3)
    later = snap.get()
    assert later["ok"] is True and "probe down" in later.get("snapshot_error", "")  # last good value kept
