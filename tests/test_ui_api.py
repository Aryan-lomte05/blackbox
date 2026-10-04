"""Endpoints shaped for the dashboard."""
from __future__ import annotations

import pytest

pytest.importorskip("fastapi")
from fastapi.testclient import TestClient  # noqa: E402

from blackbox.agents.base import run_task  # noqa: E402
from blackbox.core.schema import Change, Label  # noqa: E402
from blackbox.core.store import Store  # noqa: E402
from blackbox.recorder import providers  # noqa: E402
from blackbox.replay.engine import fork  # noqa: E402
from tests.test_core_replay import DOCS, ToyAgent, _task, fake_model  # noqa: E402


@pytest.fixture
def client(tmp_path, monkeypatch):
    providers.register_fake("fake-model", fake_model)
    try:
        from blackbox.diagnosis import gnn

        monkeypatch.setattr(gnn, "available", lambda *a, **k: False)
    except ImportError:
        pass
    import sys

    monkeypatch.setitem(sys.modules, "blackbox.diagnosis.predict", None)  # hide a locally trained ranker
    store = Store(tmp_path)
    good = run_task(ToyAgent(), _task(), "fake-model", store=store)
    bad = fork(good, 1, Change(kind="output", value={"docs": DOCS["japan"]}), store=store)
    bad.run.label = Label(root_cause_step=1, source="injected")
    store.save_trace(bad)
    from blackbox.api.main import create_app

    yield TestClient(create_app(store)), good, bad
    providers.clear_fakes()


def test_overview_graph_atlas_report_export(client):
    http, good, bad = client
    o = http.get("/api/ui/overview").json()
    assert o["kpis"]["runs"] == 2 and o["kpis"]["labelled_failures"] == 1 and len(o["recent_runs"]) == 2
    g = http.get(f"/api/runs/{bad.run.run_id}/graph").json()
    assert len(g["nodes"]) == 5 and all({"id", "type", "position", "data"} <= set(n) for n in g["nodes"])
    assert g["nodes"][1]["data"]["is_guilty"] and {"source": "1", "target": "3"} in [
        {"source": e["source"], "target": e["target"]} for e in g["edges"] if e["type"] == "dataflow"]
    a = http.get("/api/atlas").json()
    assert a["total_failures"] == 1 and a["patterns"][0]["step_kind"] == "retrieval"
    rep = http.get(f"/api/runs/{bad.run.run_id}/report").text
    assert "← guilty" in rep and bad.run.run_id in rep
    test_src = http.get(f"/api/runs/{bad.run.run_id}/export-test").text
    compile(test_src, "exported.py", "exec")
    assert f'RUN_ID = "{bad.run.run_id}"' in test_src and "EXPECT_PASS = False" in test_src
