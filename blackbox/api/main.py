"""HTTP API for the web app (SYSTEM.md §8). Skeleton: Aryan. Extra routes: Advay.

    py -3 -m uvicorn blackbox.api.main:app --port 8000 --reload
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Any, Literal

from fastapi import Body, FastAPI, HTTPException, Query
from fastapi import Path as PathParam
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict

from blackbox.agents.base import Task, get_agent, run_task
from blackbox.api.jobs import Job, JobManager

from blackbox.core.schema import Change, Step, Trace
from blackbox.core.store import Store
from blackbox.recorder import providers
from blackbox.replay.diff import compare as compare_traces
from blackbox.replay.engine import fork as fork_trace
from blackbox.replay.engine import replay as replay_trace
from blackbox.replay.engine import savings


def _edges(steps: list[Step]) -> list[dict]:
    return [{"from": p, "to": s.idx} for s in steps for p in s.parents]


def _step_summary(s: Step) -> dict:
    """List view: everything except the save-point content (loaded on click)."""
    return s.model_dump(mode="json")


class ForkRequest(BaseModel):
    step_idx: int
    change: Change | None = None


class LiveRunRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    agent: str  # registered agent ref, e.g. "qa_agent@v1"
    task_family: str
    task_id: str
    task_input: dict
    expected: Any = None
    model_id: str = "agent-small"
    autopilot: bool = False
    notify: bool = False  # Guardian: a failed or crashed run raises an incident on the configured channels


class LabRequest(BaseModel):
    question: str = ""
    family: Literal["qa", "math", "ops"] | None = None
    mistake: Literal["auto", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10"] = "auto"
    repair: bool = False
    notify: bool = False  # send stage 13's incident to the configured channels (email, WhatsApp, Slack)


class Decision(BaseModel):
    approve: bool
    by: str = "owner"
    note: str = ""


class VerifyRequest(BaseModel):
    suspects: list[int] | None = None  # default: the diagnosis order
    repeats: int = 3


class FleetRequest(BaseModel):
    rule: str | None = None  # an instruction for every model call; None = GenAI writes one from this failure
    model: str | None = None  # or/and: swap the model (time machine A/B)
    n_fail: int = 4  # similar failures to test
    n_pass: int = 3  # passing runs to check for regressions


class TimeMachineRequest(BaseModel):
    family: Literal["qa", "math", "ops"] = "qa"
    rule: str | None = None
    model: str | None = None
    n_fail: int = 4
    n_pass: int = 4


class RepairRequest(BaseModel):
    step_idx: int
    rounds: int = 2
    evidence: str = ""


def _monitor_of(trace: Trace) -> list[dict]:
    return [{"idx": s.idx, "answers": s.monitor} for s in trace.steps if s.monitor]


def _diagnose_graph(trace: Trace) -> dict | None:
    try:
        from blackbox.diagnosis import gnn

        if gnn.available():
            return {**gnn.rank(trace), "source": "gnn", "monitor": _monitor_of(trace)}
    except ImportError:  # torch not installed: the [ml] extra is optional
        pass
    return None


def _diagnose_ranker(trace: Trace) -> dict | None:
    try:
        from blackbox.diagnosis.predict import diagnose as ranker  # Aditya's LightGBM ranker
    except ImportError:  # not trained here, or lightgbm missing
        return None
    return {**ranker(trace), "source": "ranker", "monitor": _monitor_of(trace)}


def _diagnose_fallback(trace: Trace) -> dict:
    from blackbox.replay.verify import suspects_by_position

    order = suspects_by_position(trace)
    return {"source": "fallback: errors first, then model calls latest-first (no trained model available)",
            "suspects": order[:3], "scores": [], "evidence": [], "monitor": _monitor_of(trace)}


DIAGNOSERS = {"graph": _diagnose_graph, "ranker": _diagnose_ranker}


def diagnose(trace: Trace, which: str | None = None) -> dict:
    """The diagnosis used everywhere (API, demo, Investigate, Lab, Guardian, Verify's suspects).

    Chosen explicitly, never by whichever model file happens to exist: `which` or $BLACKBOX_DIAGNOSER =
    "graph" (default: the graph-feature model, best measured, AUDIT.md entries 16/20) or "ranker"
    (Aditya's LightGBM). If the chosen one is unavailable, the other is tried, then an honest fallback;
    `source` always names the model that answered."""
    first = (which or os.environ.get("BLACKBOX_DIAGNOSER", "graph")).lower()
    order = [first] + [k for k in DIAGNOSERS if k != first] if first in DIAGNOSERS else list(DIAGNOSERS)
    for name in order:
        out = DIAGNOSERS[name](trace)
        if out is not None:
            return out
    return _diagnose_fallback(trace)


def _sse(job: Job) -> StreamingResponse:
    return StreamingResponse(job.stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


Family = Literal["qa", "math", "ops", "external"]
Split = Literal["train", "val", "calib", "test_known", "test_new_mistakes", "test_new_tasks", "test_natural",
                "test_outside"]
Cheaper = Literal["agent-local", "agent-local-7b"]
FaultType = Literal["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10"]
Outcome_ = Literal["pass", "fail"]

RepairModel = Literal["agent-local-7b", "agent-local", "agent-strong"]
CaseName = Literal["model_finds_it", "model_misses_it", "shop_new_task_type", "math_failure",
                   "real_failure_verified", "real_failure_unlabelled"]

DEMO_SCRIPT = (
    "## Demo script (click *Try it out*, pick a case from the **Examples** dropdown, press *Execute*)\n\n"
    "1. **List runs**: filter to failed runs with a known guilty step.\n"
    "2. **Open a run**: its steps, who-used-what links and the planted mistake.\n"
    "3. **Diagnose**: the trained model's top suspects. Compare with the run's `label.root_cause_step`.\n"
    "4. **Verify**: re-run with one suspect repaired at a time; returns a `job_id`.\n"
    "5. **Job result**: paste that `job_id` to see the verdict (the proven cause and its causal effect).\n"
    "6. **Fork**: undo a planted mistake (the run passes again) or plant one in a passing run. "
    "The response shows how many steps were re-run vs re-used.\n"
    "7. **Compare**: original vs the planted copy, first difference marked.\n"
    "8. **Replay**: re-run from the recording with zero model calls.\n"
    "9. **Repair**: GenAI fixes for the guilty step, each tested by a fork (uses the big model).\n"
    "10. **Cheaper-model advisor**: which model calls could use a smaller model.\n"
    "11. **Live run**: a fresh task on the local 7B model; stream its steps at `/api/runs/{run_id}/events`.\n\n"
)


def build_routes(app, db, load, jobs, run_jobs, cases):
    """All /api routes, with Swagger dropdown examples from real recorded runs (blackbox.api.showcase)."""
    from blackbox.api.showcase import body_examples, run_id_examples

    any_run = run_id_examples(cases)
    failed = run_id_examples(cases, ("model_finds_it", "model_misses_it", "shop_new_task_type", "math_failure",
                                     "real_failure_verified", "real_failure_unlabelled"))
    passing = run_id_examples(cases, ("passing_run",))
    fork_bodies = cases.get("fork_bodies", {})
    fork_run_ids = {k: {"summary": v["summary"], "description": "Use with the matching request body below.",
                        "value": v["run_id"]} for k, v in fork_bodies.items()}
    guilty_bodies = {k: {"summary": v["summary"], "description": v["description"],
                         "value": {"step_idx": v["guilty"], "rounds": 1, "evidence": ""}}
                     for k, v in cases.get("runs", {}).items() if v.get("guilty") is not None}
    verify_bodies = {
        "use_diagnosis": {"summary": "Test the diagnosis model's top 3 suspects (1 attempt each: fastest)",
                          "value": {"suspects": None, "repeats": 1}},
        "three_attempts": {"summary": "Same, 3 attempts per repair: tells bad luck from a real bug",
                           "value": {"suspects": None, "repeats": 3}},
    }
    compare = cases.get("compare", {})
    cmp_a = {k: {"summary": v["summary"], "description": v["description"], "value": v["a"]} for k, v in compare.items()}
    cmp_b = {k: {"summary": v["summary"], "description": v["description"], "value": v["b"]} for k, v in compare.items()}
    live = body_examples(cases.get("live", {}))


    @app.get("/api/health", tags=["Status"], summary="Health: database counts, models, providers")
    def health() -> dict[str, Any]:
        try:
            models = sorted(providers.load_registry())
        except FileNotFoundError:
            models = []
        configured = {name: bool(os.environ.get(spec.key_env)) or spec.key_optional
                      for name, spec in providers.PROVIDERS.items()}
        return {"ok": True, "db": db().counts(), "models": models, "providers_configured": configured}

    @app.get("/api/cases", tags=["Investigate"], summary="The demo cases (real recorded runs) for the Investigate picker")
    def cases() -> dict:
        """{case name: {run_id, summary, description, guilty}} for every case POST /api/investigate/{case} accepts."""
        from typing import get_args

        from blackbox.api.showcase import load_or_build

        runs = load_or_build(db()).get("runs", {})
        return {"cases": {name: runs[name] for name in get_args(CaseName) if name in runs}}

    @app.post("/api/investigate/{case}", tags=["Investigate"],
              summary="★ Investigate a case: diagnose → verify → compare (→ repair) in one call")
    def investigate(case: CaseName = PathParam(..., description="a real failed run picked from the recordings"),
                    repair: bool = Query(False, description="also ask GenAI for fixes and test each (uses the big model; slower)"),
                    repeats: int = Query(1, ge=1, le=3, description="attempts per repair (3 tells bad luck from a real bug)"),
                    repair_model: RepairModel = Query("agent-local-7b", description=(
                        "model Verify uses to re-ask a suspect decision: agent-local-7b = qwen2.5:7b on this laptop (fast, "
                        "default); agent-local = qwen2.5:3b (fastest); agent-strong = Nemotron 120B on free OpenRouter "
                        "(strongest, slow: network + rate limits)")),
                    run_id: str | None = Query(None, description="optional: investigate this run instead of the case")) -> dict:
        """Returns a case file: `story` (numbered plain-language lines), the case, the diagnosis, every verify
        attempt with steps re-run vs re-used, the comparison with the fixed run, and repairs if asked."""
        from blackbox.api.investigate import case_file

        if run_id is None:
            info = cases.get("runs", {}).get(case)
            if info is None:
                raise HTTPException(404, f"no recorded run for case {case!r} on this machine yet")
            run_id = info["run_id"]
        try:
            out = case_file(load(run_id), db(), diagnose, repeats=repeats, repair=repair, strong_model=repair_model)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from None
        if run_id == cases.get("runs", {}).get(case, {}).get("run_id"):
            out["case"]["why_this_case"] = cases["runs"][case]["summary"]
        return out

    @app.post("/api/lab", tags=["Investigate"],
              summary="★ Live Lab: type a question, plant a mistake live, stream the whole investigation")
    def lab(body: LabRequest = Body(..., openapi_examples={
            "math": {"summary": "Math word problem (any)", "value": {"question": "A bakery bakes 24 muffins per tray. It bakes 6 trays and sells 97 muffins. How many muffins are left?", "mistake": "auto", "repair": False}},
            "qa": {"summary": "General-knowledge question (Wikipedia is searched live)", "value": {"question": "Who directed the film Inception, and in what year was it released?", "mistake": "auto", "repair": False}},
            "shop": {"summary": "Shop request on a generated store (orders, stock, refunds)", "value": {"question": "", "family": "ops", "mistake": "auto", "repair": False}},
            "wrong_fact": {"summary": "Force a specific mistake: F6 wrong fact", "value": {"question": "A train travels 180 km in 3 hours, then 120 km in 2 hours. What is its average speed in km per hour?", "mistake": "F6", "repair": True}},
        })) -> dict:
        """Starts a job. Stream `GET /api/jobs/{job_id}/events`: `stage` events (n = 1..14, title, detail, data)
        and `step` events (the agent's steps as they happen), then `done` with the scorecard."""
        from blackbox.lab import run_lab

        if not body.question and body.family != "ops":
            raise HTTPException(400, "type a question (or family=ops)")
        job = jobs.start("lab", lambda j: run_lab(body.question, family=body.family, mistake=body.mistake,
                                                  repair=body.repair, store=db(), emit=j.emit, notify=body.notify))
        return {"job_id": job.job_id, "events": f"/api/jobs/{job.job_id}/events", "result": f"/api/jobs/{job.job_id}"}

    dataset_cache: dict = {}

    @app.get("/api/dataset", tags=["Dataset"], summary="0 · Dataset: everything recorded so far")
    def dataset() -> dict:
        """Totals, task families, test sets, label sources, planted-mistake health (how often each mistake
        broke a run), the agent model's report card, and storage. Computed from the database; cached until
        the number of runs changes."""
        from blackbox.api.showcase import FAULT_NAMES
        from blackbox.eval.report import data_summary, health_by_family, iter_traces, model_report_card

        counts = db().counts()
        if dataset_cache.get("runs") != counts["runs"]:
            traces = list(iter_traces(db()))
            dataset_cache.clear()
            dataset_cache.update({
                "runs": counts["runs"],
                "body": {
                    "summary": data_summary(traces),
                    "health_by_family": health_by_family(traces),
                    "model_report_card": model_report_card(traces),
                },
            })
        dedup = 1 - counts["unique_save_points"] / counts["save_points"] if counts["save_points"] else 0.0
        return {
            **dataset_cache["body"],
            "storage": {**counts, "save_point_dedup": round(dedup, 3)},
            "sources": {
                "qa": "HotpotQA distractor questions (downloaded); every run generated by our QA agent",
                "math": "GSM8K problems (downloaded); every run generated by our Math agent",
                "ops": "Shop tasks generated by script; never used for training (test_new_tasks)",
                "external": "Who&When failure logs (downloaded); outside test only",
            },
            "mistakes": FAULT_NAMES,
            "kept_out_of_training": ["F7", "F8", "F9", "F10", "all Shop (ops) tasks"],
        }

    @app.get("/api/runs", tags=["Runs"], summary="1 · List runs")
    def list_runs(
        outcome: Outcome_ | None = Query(None, description="pass or fail"),
        labelled: bool | None = Query(None, description="only runs whose guilty step is known"),
        family: Family | None = Query(None, description="qa, math, ops (Shop), external (Who&When)"),
        split: Split | None = Query(None, description="which test set"),
        fault: FaultType | None = Query(None),
        task_id: str | None = None,
        parent: str | None = Query(None, description="forks of this run"),
        limit: int = Query(20, le=500),
        offset: int = 0,
    ) -> dict:
        s = db()
        runs = s.list_runs(
            task_family=family, task_id=task_id, split=split, fault_type=fault, parent_run_id=parent,
            has_label=labelled, success=None if outcome is None else outcome == "pass", limit=limit, offset=offset,
        )
        total = s.count_runs(
            task_family=family, task_id=task_id, split=split, fault_type=fault, parent_run_id=parent,
            has_label=labelled, success=None if outcome is None else outcome == "pass",
        )
        return {"runs": [r.model_dump(mode="json") for r in runs], "total": total, "limit": limit, "offset": offset}

    @app.get("/api/runs/{run_id}", tags=["Runs"], summary="2 · Open a run (steps + who-used-what links)")
    def get_run(run_id: str = PathParam(..., openapi_examples=any_run or None)) -> dict:
        tr = load(run_id)
        return {"run": tr.run.model_dump(mode="json"), "steps": [_step_summary(s) for s in tr.steps],
                "edges": _edges(tr.steps)}

    @app.get("/api/runs/{run_id}/steps/{idx}", tags=["Runs"], summary="One step with its save-point")
    def get_step(run_id: str = PathParam(..., openapi_examples=any_run or None),
                 idx: int = PathParam(..., ge=0, examples=[0])) -> dict:
        tr = load(run_id)
        if not 0 <= idx < len(tr.steps):
            raise HTTPException(404, f"run {run_id} has no step {idx}")
        step = tr.steps[idx]
        state = None
        if step.state_hash_after and db().has_blob(step.state_hash_after):
            state = db().get_blob(step.state_hash_after)
        return {"step": step.model_dump(mode="json"), "state_after": state}

    @app.post("/api/import/{fmt}", tags=["Runs"],
              summary="★ Import traces your agent already exports (OpenTelemetry or Langfuse JSON), then diagnose them")
    def import_traces(fmt: Literal["otel", "langfuse"],
                      body: Any = Body(..., description="the export file's JSON: OTLP spans, or a Langfuse trace"),
                      failed: bool | None = Query(None, description="mark as failed when the export has no verdict")) -> dict:
        """No code change in the agent. Imported runs have no save-points, so they support diagnosis, fingerprints
        and the atlas, not replay."""
        from blackbox.data.importers.external import IMPORTERS

        traces = IMPORTERS[fmt](body, failed=failed)
        if not traces:
            raise HTTPException(400, "no agent steps found in this export")
        store = db()
        out = []
        for tr in traces:
            store.save_trace(tr)
            is_failed = tr.run.outcome is not None and not tr.run.outcome.success
            out.append({"run_id": tr.run.run_id, "agent": tr.run.agent, "steps": len(tr.steps),
                        "outcome": None if tr.run.outcome is None else ("pass" if tr.run.outcome.success else "fail"),
                        "suspects": diagnose(tr).get("suspects") if is_failed else None})
        return {"imported": out}

    @app.get("/api/runs/{run_id}/similar", tags=["Diagnosis"],
             summary="★ Seen this before? Failure fingerprint, look-alike past failures, novelty, known fixes")
    def get_similar(run_id: str = PathParam(..., openapi_examples=failed or None), k: int = Query(5, ge=1, le=50)) -> dict:
        """The failure's fingerprint (where the cause sits, what it looked like, how far it spread); the k most similar
        labelled failures; how many share the exact fingerprint and what caused them; `novel` when nothing in the
        library looks like it; rules the fleet firewall APPROVED for look-alike failures. Instant (cached library)."""
        from blackbox.diagnosis.fingerprint import similar

        trace = load(run_id)
        failed_run = trace.run.outcome is not None and not trace.run.outcome.success
        return similar(db(), trace, diagnose(trace) if failed_run and not trace.run.label else None, k=k)

    @app.get("/api/runs/{run_id}/diagnosis", tags=["Diagnosis"], summary="3 · Diagnose: rank the steps of a failed run")
    def get_diagnosis(run_id: str = PathParam(..., openapi_examples=failed or None),
                      model: Literal["graph", "ranker"] | None = Query(None, description=
                          "which diagnosis model (default: $BLACKBOX_DIAGNOSER or graph)")) -> dict:
        trace = load(run_id)
        out = diagnose(trace, model)
        if trace.run.label is not None and trace.run.label.root_cause_step is not None:
            g = trace.run.label.root_cause_step
            out["known_guilty_step"] = g
            out["guilty_in_top3"] = g in out.get("suspects", [])[:3]
        return out

    @app.post("/api/runs/{run_id}/verify", tags=["Experiments"],
              summary="4 · Verify: prove the cause by re-running with one suspect repaired")
    def start_verify(run_id: str = PathParam(..., openapi_examples=failed or None),
                     body: VerifyRequest = Body(..., openapi_examples=verify_bodies)) -> dict:
        from blackbox.replay.verify import verify

        trace = load(run_id)
        if trace.run.outcome is None or trace.run.outcome.success:
            raise HTTPException(400, "verify needs a finished, failed run")
        suspects = body.suspects or diagnose(trace)["suspects"]
        job = jobs.start("verify", lambda j: verify(trace, suspects, store=db(), repeats=body.repeats,
                                                     on_event=j.emit))
        return {"job_id": job.job_id, "suspects": suspects,
                "next": f"GET /api/jobs/{job.job_id} for the result, or /api/jobs/{job.job_id}/events to stream it"}

    @app.get("/api/jobs/{job_id}", tags=["Jobs"], summary="5 · Job result (paste the job_id from Verify / Repair / Advise)")
    def job_status(job_id: str) -> dict:
        job = jobs.get(job_id)
        if job is None:
            raise HTTPException(404, f"no job {job_id}")
        return {"job_id": job.job_id, "kind": job.kind, "finished": job.finished, "n_events": len(job.events),
                "events": job.events[-30:], "result": job.result}

    @app.post("/api/runs/{run_id}/fork", tags=["Experiments"],
              summary="6 · Fork: change one step and re-run only what it affects")
    def fork(run_id: str = PathParam(..., openapi_examples=fork_run_ids or any_run or None),
             body: ForkRequest = Body(..., openapi_examples=body_examples(fork_bodies) or None)) -> dict:
        parent = load(run_id)
        try:
            child = fork_trace(parent, body.step_idx, body.change, store=db())
        except IndexError as exc:
            raise HTTPException(400, str(exc)) from None
        except KeyError as exc:  # agent not importable in this process
            raise HTTPException(409, str(exc)) from None
        return {"run_id": child.run.run_id, "status": child.run.status, "error": child.run.error,
                "savings": savings(child),
                "outcome": child.run.outcome.model_dump(mode="json") if child.run.outcome else None}

    @app.get("/api/compare", tags=["Runs"], summary="7 · Compare two runs step by step")
    def compare(a: str = Query(..., openapi_examples=cmp_a or None),
                b: str = Query(..., openapi_examples=cmp_b or None)) -> dict:
        return compare_traces(load(a), load(b))

    @app.post("/api/runs/{run_id}/replay", tags=["Experiments"], summary="8 · Replay from the recording (0 model calls)")
    def replay(run_id: str = PathParam(..., openapi_examples=any_run or None)) -> dict:
        child = replay_trace(load(run_id))
        if child.run.status == "crashed":
            raise HTTPException(500, child.run.error)
        return {"run": child.run.model_dump(mode="json"), "savings": savings(child),
                "model_calls_made": child.run.stats.get("n_llm_calls")}

    @app.post("/api/runs/{run_id}/repair", tags=["Experiments"],
              summary="9 · Repair: GenAI fixes for a step, each tested by a fork")
    def start_repair(run_id: str = PathParam(..., openapi_examples=failed or None),
                     body: RepairRequest = Body(..., openapi_examples=guilty_bodies or None)) -> dict:
        from blackbox.replay.repair import repair

        trace = load(run_id)
        job = jobs.start("repair", lambda j: repair(trace, body.step_idx, store=db(), rounds=body.rounds,
                                                     evidence=body.evidence, on_event=j.emit))
        return {"job_id": job.job_id, "next": f"GET /api/jobs/{job.job_id}"}

    @app.post("/api/runs/{run_id}/causal", tags=["Experiments"],
              summary="★ Causal report: necessary vs sufficient, joint causes, every recovery path, blast radius")
    def start_causal(run_id: str = PathParam(..., openapi_examples=failed or None),
                     suspects: str = Query("", description="comma-separated; empty = the diagnosis' top 3")) -> dict:
        """NECESSARY: repairing the step alone makes the run pass. SUFFICIENT: its output alone breaks a passing
        run of the same task. If no single step is necessary, pairs are repaired together (joint cause).
        Stream `/api/jobs/{id}/events`; ~10-60 s."""
        from blackbox.replay.causal import causal_report

        trace = load(run_id)
        if trace.run.outcome is None or trace.run.outcome.success:
            raise HTTPException(400, "a causal report needs a finished, failed run")
        picked = [int(x) for x in suspects.split(",") if x.strip()] or list(diagnose(trace)["suspects"])[:3]
        job = jobs.start("causal", lambda j: causal_report(trace, db(), picked, on_event=j.emit))
        return {"job_id": job.job_id, "suspects": picked, "next": f"GET /api/jobs/{job.job_id}/events"}

    fleet_bodies = {
        "genai_rule": {"summary": "Let GenAI write one general rule from this failure, then test it on the fleet",
                       "value": {"n_fail": 3, "n_pass": 2}},
        "search_rule": {"summary": "Test a rule: re-check search results before answering",
                        "value": {"rule": "Never trust a single search result: if a paragraph does not clearly answer "
                                          "the question about the exact entity asked, search again with a more "
                                          "specific query before answering.", "n_fail": 3, "n_pass": 2}},
    }

    @app.post("/api/runs/{run_id}/fleet-fix", tags=["Experiments"],
              summary="★ One fix for many: turn this failure into ONE rule, test it on similar failures + passing runs")
    def start_fleet_fix(run_id: str = PathParam(..., openapi_examples=failed or None),
                        body: FleetRequest = Body(..., openapi_examples=fleet_bodies)) -> dict:
        """Regression firewall: the rule is APPROVED only if it fixes failures and breaks no passing run
        (BLOCK otherwise). Each run is re-run by fork (unchanged steps re-used); money tools never execute.
        About 40 s per run on the local 7B. Stream `/api/jobs/{id}/events`."""
        from blackbox.replay.fleet import fleet_test, one_fix_for_many, similar_runs

        trace = load(run_id)
        if body.model and not body.rule:
            ids = similar_runs(db(), trace, body.n_fail, body.n_pass)
            job = jobs.start("fleet", lambda j: fleet_test(db(), ids, model=body.model, on_event=j.emit))
        else:
            job = jobs.start("fleet", lambda j: one_fix_for_many(
                db(), run_id, rule=body.rule, n_fail=body.n_fail, n_pass=body.n_pass, diagnose=diagnose,
                on_event=j.emit))
        return {"job_id": job.job_id, "next": f"GET /api/jobs/{job.job_id}/events to stream it"}

    @app.post("/api/time-machine", tags=["Experiments"],
              summary="★ Time machine A/B: re-run recorded history under a new rule or model; fixed vs regressions")
    def start_time_machine(body: TimeMachineRequest = Body(..., openapi_examples={
            "model_swap": {"summary": "What if every QA run had used the 3B model?",
                           "value": {"family": "qa", "model": "agent-local", "n_fail": 3, "n_pass": 3}},
            "rule": {"summary": "What if every QA run had this rule?",
                     "value": {"family": "qa", "rule": "Answer with the shortest exact name or number; no explanation.",
                               "n_fail": 3, "n_pass": 3}}})) -> dict:
        from blackbox.replay.fleet import fleet_test, history_sample

        if not (body.rule or body.model):
            raise HTTPException(400, "give a rule and/or a model")
        store = db()
        ids = history_sample(store, body.family, body.n_fail, body.n_pass)
        job = jobs.start("time-machine", lambda j: fleet_test(store, ids, instruction=body.rule,
                                                              model=body.model, on_event=j.emit))
        return {"job_id": job.job_id, "runs": ids, "next": f"GET /api/jobs/{job.job_id}/events"}

    @app.post("/api/runs/{run_id}/crash-test", tags=["Experiments"],
              summary="★ Crash test (red team): plant every known mistake in a passing run; 1-5 star rating")
    def start_crash_test(run_id: str = PathParam(..., openapi_examples=passing or None),
                         per_fault: int = Query(1, ge=1, le=3)) -> dict:
        """Each applicable mistake (F1-F10) is planted at a step where it fits. Grades: robust, failed safely (said it
        did not know), failed silently (confident wrong answer), unsafe (tried a money-moving tool; never executed).
        Failed runs become new labelled failures in the dataset. Stream `/api/jobs/{id}/events`; ~5 s per mistake."""
        from blackbox.replay.chaos import crash_test

        trace = load(run_id)
        if trace.run.outcome is None or not trace.run.outcome.success:
            raise HTTPException(400, "a crash test starts from a passing run")
        job = jobs.start("crash-test", lambda j: crash_test(trace, db(), per_fault=per_fault, on_event=j.emit))
        return {"job_id": job.job_id, "next": f"GET /api/jobs/{job.job_id}/events"}

    @app.post("/api/runs/{run_id}/advise", tags=["Experiments"],
              summary="10 · Cheaper-model advisor (on a passing run)")
    def start_advise(run_id: str = PathParam(..., openapi_examples=passing or None),
                     cheaper_model: Cheaper = Query("agent-local")) -> dict:
        from blackbox.replay.advisor import advise

        trace = load(run_id)
        if trace.run.outcome is None or not trace.run.outcome.success:
            raise HTTPException(400, "the advisor needs a passing run")
        job = jobs.start("advise", lambda j: advise(trace, cheaper_model, store=db(), on_event=j.emit))
        return {"job_id": job.job_id, "next": f"GET /api/jobs/{job.job_id}"}

    @app.post("/api/runs", tags=["Experiments"], summary="11 · Live run: a fresh task, recorded as it happens")
    def start_run(body: LiveRunRequest = Body(..., openapi_examples=live or None)) -> dict:
        try:
            agent = get_agent(body.agent)
        except KeyError as exc:
            raise HTTPException(404, str(exc)) from None
        run_id = uuid.uuid4().hex[:16]
        task = Task(body.task_family, body.task_id, body.task_input, body.expected)

        def step_event(job: Job):
            return lambda st: job.emit({"type": "step", "run_id": st.run_id, "step": st.model_dump(mode="json")})

        def work(job: Job):
            job.emit({"type": "start", "run_id": run_id, "agent": body.agent, "model_id": body.model_id})
            pilot = None
            if body.autopilot:
                from blackbox.replay.autopilot import Autopilot

                try:
                    from blackbox.monitor.check import check_step  # type: ignore[import-not-found]
                except ImportError as exc:
                    raise RuntimeError("autopilot needs the step checker (blackbox.monitor.check)") from exc
                pilot = Autopilot(check=check_step)
            tr = run_task(agent, task, body.model_id, store=db(), run_id=run_id, autopilot=pilot,
                          on_step=[step_event(job)])
            incident = None
            if body.notify:
                from blackbox.guardian.service import Guardian

                inc = Guardian(owner="Live run", store=db()).handle(tr)  # None when the run passed
                if inc is not None:
                    incident = {"incident_id": inc.incident_id, "link": inc.link,
                                "notified": [n["channel"] for n in inc.notifications if n["status"] == "sent"]}
                    job.emit({"type": "incident", **incident})
            return {"run_id": tr.run.run_id, "status": tr.run.status, "error": tr.run.error,
                    "outcome": tr.run.outcome.model_dump(mode="json") if tr.run.outcome else None,
                    "autopilot_rescue": tr.run.stats.get("autopilot_rescue"), "incident": incident}

        job = jobs.start("run", work)
        run_jobs[run_id] = job.job_id
        return {"run_id": run_id, "job_id": job.job_id,
                "next": f"GET /api/jobs/{job.job_id} (or stream /api/runs/{run_id}/events), then open the run"}

    @app.get("/api/runs/{run_id}/events", tags=["Jobs"], summary="Stream a live run's steps (server-sent events)")
    def run_events(run_id: str):
        job = jobs.get(run_jobs.get(run_id, ""))
        if job is None:
            raise HTTPException(404, f"no live job for run {run_id}")
        return _sse(job)

    @app.get("/api/jobs/{job_id}/events", tags=["Jobs"], summary="Stream a job's events (server-sent events)")
    def job_events(job_id: str):
        job = jobs.get(job_id)
        if job is None:
            raise HTTPException(404, f"no job {job_id}")
        return _sse(job)

    @app.get("/api/status", tags=["Status"], summary="Live status: queue, jobs, GPU, data, model results")
    def status() -> dict:
        """Queue, running jobs, GPU/Ollama, logs, data totals, model metrics and the latest eval report."""
        from blackbox.status import as_json

        return as_json(db())

    @app.get("/api/incidents", tags=["Guardian"], summary="G1 · Incidents (failed / crashed / flagged runs, explained)")
    def incidents(limit: int = Query(20, le=200)) -> dict:
        from blackbox.guardian.service import list_incidents

        return {"incidents": [i.model_dump(mode="json") for i in list_incidents()[:limit]]}

    @app.get("/api/incidents/{incident_id}", tags=["Guardian"], summary="G2 · One incident: what, why, how to fix, who was told")
    def incident(incident_id: str) -> dict:
        from blackbox.guardian.service import get_incident

        inc = get_incident(incident_id)
        if inc is None:
            raise HTTPException(404, f"no incident {incident_id}")
        return inc.model_dump(mode="json")

    @app.post("/api/incidents/from-run/{run_id}", tags=["Guardian"],
              summary="G3 · Raise an incident for a run and notify the owner (email / WhatsApp / outbox)")
    def raise_incident(run_id: str = PathParam(..., openapi_examples=failed or None),
                       owner: str = Query("Aryan", description="name shown in the message"),
                       money_moving_tools: str = Query("place_order,refund_order,transfer",
                                                       description="comma-separated tools that move money: never auto-retried")) -> dict:
        from blackbox.guardian.service import Guardian

        g = Guardian(owner=owner, money_moving_tools=tuple(t.strip() for t in money_moving_tools.split(",") if t.strip()),
                     store=db(), dedupe_minutes=0)
        inc = g.handle(load(run_id))
        if inc is None:
            raise HTTPException(400, "this run passed: no incident")
        return inc.model_dump(mode="json")

    @app.post("/api/incidents/{incident_id}/decision", tags=["Guardian"],
              summary="G4 · Approve or reject the paused retry (money-moving agents)")
    def incident_decision(incident_id: str, body: Decision = Body(..., openapi_examples={
            "approve": {"summary": "Approve: the agent may retry", "value": {"approve": True, "by": "Aryan", "note": "price feed is back"}},
            "reject": {"summary": "Reject: keep the agent paused", "value": {"approve": False, "by": "Aryan", "note": "investigate first"}}})) -> dict:
        from blackbox.guardian.service import decide

        try:
            return decide(incident_id, body.approve, body.by, body.note).model_dump(mode="json")
        except KeyError:
            raise HTTPException(404, f"no incident {incident_id}") from None
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from None

    @app.get("/incident/{incident_id}", include_in_schema=False)
    def incident_page(incident_id: str):
        """The page the email / WhatsApp link opens: the report, then a link into the run inspector."""
        from fastapi.responses import HTMLResponse

        from blackbox.guardian import render
        from blackbox.guardian.service import get_incident

        inc = get_incident(incident_id)
        if inc is None:
            raise HTTPException(404, f"no incident {incident_id}")
        page = render.html_email(inc).replace(
            f'href="{inc.link}"', f'href="/#run-{inc.run_id}"').replace(
            "Open the incident in Black Box →", "Open the full run in the inspector →")
        sent = "".join(f"<li>{n['channel']}: {n['status']} ({n['detail']})</li>" for n in inc.notifications)
        if inc.needs_approval and inc.status == "open":
            sent = (f'<div id="decide" style="margin:0 0 14px"><b>Paused retry:</b> '
                    f'<button onclick="d(true)" style="background:#1f7a4d;color:#fff;border:0;padding:8px 14px;border-radius:6px;cursor:pointer">Approve retry</button> '
                    f'<button onclick="d(false)" style="background:#b42318;color:#fff;border:0;padding:8px 14px;border-radius:6px;cursor:pointer">Keep paused</button></div>'
                    f'<script>async function d(a){{const r=await fetch("/api/incidents/{inc.incident_id}/decision",'
                    f'{{method:"POST",headers:{{"Content-Type":"application/json"}},body:JSON.stringify({{approve:a,by:"owner"}})}});'
                    f'document.getElementById("decide").textContent=r.ok?(a?"Approved: the agent may retry.":"Rejected: the agent stays paused."):"Could not record the decision.";}}</script>') + sent
        elif inc.decision:
            sent = f"<p><b>Decision:</b> {inc.status} by {inc.decision['by']} at {inc.decision['at']}</p>" + sent
        page = page.replace("</body>", f'<div style="max-width:600px;margin:0 auto 30px;font:13px Segoe UI,Arial,sans-serif;'
                                        f'color:#5b6676"><b>Notifications</b><ul>{sent}</ul></div></body>')
        return HTMLResponse(page)

    @app.get("/", include_in_schema=False)
    def inspector():
        return FileResponse(Path(__file__).parent / "static" / "inspector.html", media_type="text/html")


def create_app(store: Store | None = None, examples: bool | None = None) -> FastAPI:
    app = FastAPI(
        title="Black Box",
        version="0.1.0",
        summary="A flight recorder for AI agents.",
        description=(
            "Record every step of an agent run with a save-point, name the steps most likely to have caused a "
            "failure, **prove** the cause by re-running with only that step repaired (re-running only what the "
            "repair affects), and test GenAI fixes the same way.\n\n"
            "* **Runs**: browse recorded runs and their steps (with save-points and who-used-what links).\n"
            "* **Diagnosis**: the trained model's ranking of a failed run's steps.\n"
            "* **Experiments**: replay, fork, verify, repair, cheaper-model advice (long jobs stream events).\n"
            "* **Status**: what is running on the recording machine right now.\n\n"
            "Inspector page: [/](/). Every number comes from recorded runs; nothing is filled in."
        ),
        openapi_tags=[
            {"name": "Investigate", "description": "The whole investigation of one failed run in one call."},
            {"name": "UI", "description": "Shaped for the dashboard: overview, React Flow run graph, failure atlas, "
                                          "case-file report, exported regression test."},
            {"name": "Dataset", "description": "Everything recorded: tasks, test sets, planted mistakes, health."},
            {"name": "Guardian", "description": "For people running agents unattended: incidents explained in plain "
                                                "language, sent by email / WhatsApp with a link to the incident page."},
            {"name": "Runs", "description": "Recorded runs, steps, save-points, comparison."},
            {"name": "Diagnosis", "description": "Which step most likely caused a failure."},
            {"name": "Experiments", "description": "Replay, fork, verify, repair, advice. Long ones run as jobs."},
            {"name": "Jobs", "description": "Server-sent event streams and results of background jobs."},
            {"name": "Status", "description": "Machine, queue, data and model state."},
        ],
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=os.environ.get("BLACKBOX_CORS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,"
                       "http://127.0.0.1:3000").split(","),
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.store = store
    jobs = JobManager()
    run_jobs: dict[str, str] = {}  # run_id -> job_id, for /api/runs/{id}/events

    def db() -> Store:
        if app.state.store is None:
            app.state.store = Store()
        return app.state.store

    def load(run_id: str) -> Trace:
        try:
            return db().load_trace(run_id)
        except KeyError:
            raise HTTPException(404, f"no run {run_id!r}") from None

    cases: dict = {}
    if examples if examples is not None else store is None:
        try:
            from blackbox.api.showcase import load_or_build

            cases = load_or_build(db())
        except Exception as exc:  # noqa: BLE001 - the API works without demo examples
            print(f"showcase examples unavailable: {type(exc).__name__}: {exc}")
    build_routes(app, db, load, jobs, run_jobs, cases)
    from blackbox.api import ui

    ui.register(app, db, load, diagnose)

    return app


app = create_app()
