from __future__ import annotations

import pytest

pytest.importorskip("fastapi")
from fastapi.testclient import TestClient  # noqa: E402

from blackbox.agents.base import run_task  # noqa: E402
from blackbox.core.store import Store  # noqa: E402
from blackbox.recorder import providers  # noqa: E402
from tests.test_core_replay import DOCS, ToyAgent, _task, fake_model  # noqa: E402


@pytest.fixture
def client(tmp_path):
    providers.register_fake("fake-model", fake_model)
    store = Store(tmp_path)
    from blackbox.api.main import create_app

    yield TestClient(create_app(store)), store
    providers.clear_fakes()
    store.close()


def test_runs_steps_fork_compare(client):
    http, store = client
    tr = run_task(ToyAgent(), _task(), "fake-model", store=store)
    rid = tr.run.run_id

    assert http.get("/api/health").json()["db"]["runs"] == 1
    assert [r["run_id"] for r in http.get("/api/runs?outcome=pass").json()["runs"]] == [rid]

    detail = http.get(f"/api/runs/{rid}").json()
    assert len(detail["steps"]) == 5 and {"from": 1, "to": 3} in detail["edges"]

    step = http.get(f"/api/runs/{rid}/steps/1").json()
    assert step["state_after"]["docs"] == DOCS["france"]
    assert http.get(f"/api/runs/{rid}/steps/99").status_code == 404

    forked = http.post(f"/api/runs/{rid}/fork",
                       json={"step_idx": 1, "change": {"kind": "output", "value": {"docs": DOCS["japan"]}}}).json()
    assert forked["outcome"]["success"] is False and forked["savings"]["steps_reused"] == 2

    cmp = http.get(f"/api/compare?a={rid}&b={forked['run_id']}").json()
    assert cmp["outcome"]["flipped"] is True
    assert cmp["pairs"][cmp["first_divergence"]]["a"] == 1  # diverges exactly at the forked step
