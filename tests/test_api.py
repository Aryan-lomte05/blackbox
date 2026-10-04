from __future__ import annotations

import pytest

pytest.importorskip("fastapi")
from fastapi.testclient import TestClient  # noqa: E402

from blackbox.agents.base import run_task  # noqa: E402
from blackbox.core.store import Store  # noqa: E402
from blackbox.recorder import providers  # noqa: E402
from tests.test_core_replay import DOCS, ToyAgent, _task, fake_model  # noqa: E402


@pytest.fixture
def client(tmp_path, monkeypatch):
    providers.register_fake("fake-model", fake_model)
    try:  # hermetic: a model trained on this machine must not change what the API test sees
        from blackbox.diagnosis import gnn

        monkeypatch.setattr(gnn, "available", lambda *a, **k: False)
    except ImportError:
        pass
    import sys

    monkeypatch.setitem(sys.modules, "blackbox.diagnosis.predict", None)  # hide a locally trained ranker
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


def _events(http, url):
    import json

    with http.stream("GET", url) as r:
        body = "".join(r.iter_text())
    return [json.loads(line[6:]) for line in body.splitlines() if line.startswith("data: ")]


def test_a_failed_live_run_with_notify_raises_an_incident(client, tmp_path, monkeypatch):
    """Guardian on the live-run path. The real channels configured on this machine are replaced by an
    outbox in a temporary folder: a test must never page anyone."""
    from blackbox.guardian import service
    from blackbox.guardian.channels import Outbox

    monkeypatch.setattr(service, "default_channels", lambda: [Outbox(tmp_path / "outbox")])
    monkeypatch.setattr(service, "INCIDENTS", tmp_path / "incidents")
    monkeypatch.setenv("BLACKBOX_DASHBOARD_URL", "https://dash.example")
    http, _ = client
    started = http.post("/api/runs", json={"agent": "toy_agent@v1", "task_family": "toy", "task_id": "t-fr",
                                            "task_input": {"country": "france", "other": "x"},
                                            "expected": "Tokyo", "model_id": "fake-model", "notify": True}).json()
    events = _events(http, f"/api/runs/{started['run_id']}/events")
    incident = events[-1]["result"]["incident"]
    assert "incident" in [e["type"] for e in events]
    assert incident["notified"] == ["outbox"] and incident["link"].startswith("https://dash.example/incident/")
    assert (tmp_path / "incidents" / f"{incident['incident_id']}.json").exists()


def test_live_run_streams_steps_then_verify_job(client):
    http, store = client
    started = http.post("/api/runs", json={"agent": "toy_agent@v1", "task_family": "toy", "task_id": "t-fr",
                                            "task_input": {"country": "france", "other": "x"},
                                            "expected": "Tokyo", "model_id": "fake-model"}).json()
    events = _events(http, f"/api/runs/{started['run_id']}/events")
    types = [e["type"] for e in events]
    assert types[0] == "start" and types.count("step") == 5 and types[-1] == "done"
    assert events[-1]["result"]["outcome"]["success"] is False  # expected Tokyo, agent says Paris

    diag = http.get(f"/api/runs/{started['run_id']}/diagnosis").json()
    assert diag["source"].startswith("fallback") and diag["suspects"]

    job = http.post(f"/api/runs/{started['run_id']}/verify", json={"suspects": [1], "repeats": 1}).json()
    vevents = _events(http, f"/api/jobs/{job['job_id']}/events")
    assert {"attempt", "result", "verdict", "done"} <= {e["type"] for e in vevents}
    assert http.get(f"/api/jobs/{job['job_id']}").json()["finished"] is True


def test_cases_lists_only_cases_the_investigate_route_accepts(client):
    http, _ = client
    cases = http.get("/api/cases").json()["cases"]
    from typing import get_args

    from blackbox.api.main import CaseName

    assert set(cases) <= set(get_args(CaseName))


def test_the_showcase_cache_belongs_to_its_store(client, tmp_path):
    """Regression (4 Oct): building cases for a temporary test store overwrote data/status/showcase.json, emptying
    the demo's case list. The cache now lives inside the store it describes."""
    from blackbox.api.showcase import cache_path

    http, store = client
    http.get("/api/cases")
    assert cache_path(store) == tmp_path / "status" / "showcase.json" and cache_path(store).exists()
