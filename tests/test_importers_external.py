"""Importing OpenTelemetry and Langfuse traces: steps, kinds, errors, inferred data flow, diagnosis-ready."""

from __future__ import annotations

import json
from pathlib import Path

from blackbox.data.importers.external import from_langfuse, from_otel

EXAMPLES = Path(__file__).resolve().parents[1] / "examples" / "traces"


def _load(name: str):
    return json.loads((EXAMPLES / name).read_text(encoding="utf-8"))


def test_otel_genai_spans_become_steps_with_errors_and_data_flow():
    [tr] = from_otel(_load("otel_refund_agent.json"))
    assert [(s.kind, s.name) for s in tr.steps] == [("llm", "gpt-4o-mini"), ("tool", "get_order"),
                                                   ("llm", "gpt-4o-mini"), ("tool", "refund_order")]
    assert tr.steps[3].error == "refund 15200 exceeds order total 1520.0"
    assert tr.steps[1].request["args"] == {"order_id": "O-77812"}
    assert 1 in tr.steps[2].parents  # the second model call read the order the tool returned
    assert tr.run.outcome is not None and tr.run.outcome.success is False  # the root span failed
    assert tr.run.task_family == "external" and tr.run.split == "imported"


def test_langfuse_observations_become_steps():
    [tr] = from_langfuse(_load("langfuse_support_agent.json"), failed=True)
    assert [s.kind for s in tr.steps] == ["llm", "retrieval", "llm"]  # the feedback EVENT is not a step
    assert tr.steps[1].output["docs"][0]["id"] == "kb-19"
    assert 1 in tr.steps[2].parents  # the answer used the retrieved paragraph
    assert tr.run.outcome.final_answer == "The X200 has a 6 month warranty."


def test_a_plain_span_list_and_a_trace_with_no_verdict():
    spans = [{"traceId": "a", "spanId": "1", "startTimeUnixNano": 1, "name": "chat",
              "attributes": {"gen_ai.operation.name": "chat", "gen_ai.request.model": "m", "gen_ai.completion": "hi"}}]
    [tr] = from_otel(spans)
    assert tr.steps[0].output == {"text": "hi"} and tr.run.outcome is None


def test_import_api_saves_and_diagnoses(tmp_path):
    from fastapi.testclient import TestClient

    from blackbox.api.main import create_app
    from blackbox.core.store import Store

    store = Store(tmp_path)
    http = TestClient(create_app(store))
    r = http.post("/api/import/otel", json=_load("otel_refund_agent.json"))
    assert r.status_code == 200, r.text
    [run] = r.json()["imported"]
    assert run["steps"] == 4 and run["outcome"] == "fail" and len(run["suspects"]) >= 1
    assert store.load_trace(run["run_id"]).run.task_family == "external"
    assert http.post("/api/import/langfuse", json={"observations": []}).status_code == 400


def test_imported_runs_can_be_stored_and_diagnosed(tmp_path):
    from blackbox.core.store import Store
    from blackbox.diagnosis.fingerprint import fingerprint

    store = Store(tmp_path)
    [tr] = from_otel(_load("otel_refund_agent.json"))
    store.save_trace(tr)
    again = store.load_trace(tr.run.run_id)
    assert len(again.steps) == 4
    assert "signal:error" in fingerprint(again, 3)["tokens"]
