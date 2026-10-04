"""Write real API responses for every dashboard screen into fixtures/ui/, plus docs/openapi.json.

    py -3 scripts/export_ui_fixtures.py

Uses the API in-process (no server needed) on this machine's recorded data, so the UI can be built
against real shapes and real values without a GPU. Nothing here is invented: every file is an actual
response. Re-run it whenever the API changes.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("TRANSFORMERS_NO_TF", "1")

from fastapi.testclient import TestClient  # noqa: E402

from blackbox.api.main import create_app  # noqa: E402

OUT = Path("fixtures/ui")


def save_job(name: str, http: TestClient, path: str, body: dict | None = None) -> None:
    """Start a job, wait for it, save {events, result}: what the UI receives over SSE, then from GET /api/jobs/{id}."""
    import time

    r = http.post(path, json=body or {})
    if r.status_code != 200:
        print(f"SKIP {name}: HTTP {r.status_code} {r.text[:120]}")
        return
    job_id = r.json()["job_id"]
    while not (job := http.get(f"/api/jobs/{job_id}").json()).get("finished"):
        time.sleep(3)
    target = OUT / f"{name}_job.json"
    target.write_text(json.dumps({"start": r.json(), "events": job.get("events"), "result": job.get("result")},
                                 indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    print(f"wrote {target}  ({path})")


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")
    app = create_app(examples=True)
    http = TestClient(app)
    from blackbox.api.showcase import load_or_build
    from blackbox.core.store import Store

    cases = load_or_build(Store())  # the same cases the API serves (built if missing)
    runs = cases["runs"]
    failed = runs["model_finds_it"]["run_id"]
    OUT.mkdir(parents=True, exist_ok=True)

    def save(name: str, path: str, method: str = "GET", body: dict | None = None, text: bool = False) -> None:
        r = http.request(method, path, json=body)
        if r.status_code != 200:
            print(f"SKIP {name}: HTTP {r.status_code} {r.text[:120]}")
            return
        data = r.text if text else r.json()
        target = OUT / (name + (".md" if text else ".json"))
        target.write_text(data if text else json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"wrote {target}  ({path})")

    save("overview", "/api/ui/overview")
    save("status", "/api/status")
    save("dataset", "/api/dataset")
    save("runs_failed_labelled", "/api/runs?outcome=fail&labelled=true&limit=10")
    save("run_detail", f"/api/runs/{failed}")
    save("run_step_0", f"/api/runs/{failed}/steps/0")
    save("run_graph", f"/api/runs/{failed}/graph")
    save("diagnosis", f"/api/runs/{failed}/diagnosis")
    save("atlas", "/api/atlas")
    save("report", f"/api/runs/{failed}/report", text=True)
    cmp = cases.get("compare", {}).get("planted_vs_original")
    if cmp:
        save("compare", f"/api/compare?a={cmp['a']}&b={cmp['b']}")
    save("incidents", "/api/incidents?limit=10")
    inc = http.get("/api/incidents?limit=1").json()["incidents"]
    if inc:
        save("incident_detail", f"/api/incidents/{inc[0]['incident_id']}")
    save("investigate_model_finds_it", "/api/investigate/model_finds_it", method="POST")
    save("similar", f"/api/runs/{failed}/similar")
    if "--with-jobs" in sys.argv:  # real job results (minutes: they re-run the agent)
        save_job("causal", http, f"/api/runs/{failed}/causal")
        save_job("fleet_fix", http, f"/api/runs/{failed}/fleet-fix", {
            "rule": "Never trust a single search result: if a paragraph does not clearly answer the question about "
                    "the exact entity asked, search again with a more specific query before answering.",
            "n_fail": 2, "n_pass": 1})
        if "passing_run" in runs:
            save_job("crash_test", http, f"/api/runs/{runs['passing_run']['run_id']}/crash-test")

    Path("docs").mkdir(exist_ok=True)
    Path("docs/openapi.json").write_text(json.dumps(app.openapi(), indent=2), encoding="utf-8")
    print("wrote docs/openapi.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
