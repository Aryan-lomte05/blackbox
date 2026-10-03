"""HTTP API for the web app (SYSTEM.md §8). Skeleton: Aryan. Extra routes: Advay.

    py -3 -m uvicorn blackbox.api.main:app --port 8000 --reload
"""

from __future__ import annotations

import os
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

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
    agent: str  # registered agent ref, e.g. "qa_agent@v1"
    task_family: str
    task_id: str
    task_input: dict
    expected: Any = None
    model_id: str = "agent-small"
    autopilot: bool = False


class VerifyRequest(BaseModel):
    suspects: list[int] | None = None  # default: the diagnosis order
    repeats: int = 3


class RepairRequest(BaseModel):
    step_idx: int
    rounds: int = 2
    evidence: str = ""


def diagnose(trace: Trace) -> dict:
    """Aditya's trained ranker when available; otherwise an honest, labelled fallback."""
    try:
        from blackbox.diagnosis.predict import diagnose as trained  # type: ignore[import-not-found]
    except ImportError:
        trained = None
    if trained is not None:
        return {**trained(trace), "source": "trained"}
    from blackbox.replay.verify import suspects_by_position

    order = suspects_by_position(trace)
    return {"source": "fallback: errors first, then model calls latest-first (ranker not installed)",
            "suspects": order[:3], "scores": [], "evidence": [],
            "monitor": [{"idx": s.idx, "answers": s.monitor} for s in trace.steps if s.monitor]}


def _sse(job: Job) -> StreamingResponse:
    return StreamingResponse(job.stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


def create_app(store: Store | None = None) -> FastAPI:
    app = FastAPI(title="Black Box", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=os.environ.get("BLACKBOX_CORS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
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

    @app.get("/api/health")
    def health() -> dict[str, Any]:
        try:
            models = sorted(providers.load_registry())
        except FileNotFoundError:
            models = []
        configured = {name: bool(os.environ.get(spec.key_env)) or spec.key_optional
                      for name, spec in providers.PROVIDERS.items()}
        return {"ok": True, "db": db().counts(), "models": models, "providers_configured": configured}

    @app.get("/api/runs")
    def list_runs(
        family: str | None = None,
        task_id: str | None = None,
        outcome: str | None = Query(None, pattern="^(pass|fail)$"),
        split: str | None = None,
        fault: str | None = None,
        parent: str | None = None,
        limit: int = Query(50, le=500),
        offset: int = 0,
    ) -> dict:
        runs = db().list_runs(
            task_family=family, task_id=task_id, split=split, fault_type=fault, parent_run_id=parent,
            success=None if outcome is None else outcome == "pass", limit=limit, offset=offset,
        )
        return {"runs": [r.model_dump(mode="json") for r in runs], "limit": limit, "offset": offset}

    @app.get("/api/runs/{run_id}")
    def get_run(run_id: str) -> dict:
        tr = load(run_id)
        return {"run": tr.run.model_dump(mode="json"), "steps": [_step_summary(s) for s in tr.steps],
                "edges": _edges(tr.steps)}

    @app.get("/api/runs/{run_id}/steps/{idx}")
    def get_step(run_id: str, idx: int) -> dict:
        tr = load(run_id)
        if not 0 <= idx < len(tr.steps):
            raise HTTPException(404, f"run {run_id} has no step {idx}")
        step = tr.steps[idx]
        state = None
        if step.state_hash_after and db().has_blob(step.state_hash_after):
            state = db().get_blob(step.state_hash_after)
        return {"step": step.model_dump(mode="json"), "state_after": state}

    @app.post("/api/runs/{run_id}/replay")
    def replay(run_id: str) -> dict:
        child = replay_trace(load(run_id))
        if child.run.status == "crashed":
            raise HTTPException(500, child.run.error)
        return {"run": child.run.model_dump(mode="json"), "savings": savings(child)}

    @app.post("/api/runs/{run_id}/fork")
    def fork(run_id: str, body: ForkRequest) -> dict:
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

    @app.get("/api/runs/{run_id}/diagnosis")
    def get_diagnosis(run_id: str) -> dict:
        return diagnose(load(run_id))

    @app.post("/api/runs")
    def start_run(body: LiveRunRequest) -> dict:
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
            return {"run_id": tr.run.run_id, "status": tr.run.status, "error": tr.run.error,
                    "outcome": tr.run.outcome.model_dump(mode="json") if tr.run.outcome else None,
                    "autopilot_rescue": tr.run.stats.get("autopilot_rescue")}

        job = jobs.start("run", work)
        run_jobs[run_id] = job.job_id
        return {"run_id": run_id, "job_id": job.job_id}

    @app.get("/api/runs/{run_id}/events")
    def run_events(run_id: str):
        job = jobs.get(run_jobs.get(run_id, ""))
        if job is None:
            raise HTTPException(404, f"no live job for run {run_id}")
        return _sse(job)

    @app.post("/api/runs/{run_id}/verify")
    def start_verify(run_id: str, body: VerifyRequest) -> dict:
        from blackbox.replay.verify import verify

        trace = load(run_id)
        if trace.run.outcome is None or trace.run.outcome.success:
            raise HTTPException(400, "verify needs a finished, failed run")
        suspects = body.suspects or diagnose(trace)["suspects"]
        job = jobs.start("verify", lambda j: verify(trace, suspects, store=db(), repeats=body.repeats,
                                                     on_event=j.emit))
        return {"job_id": job.job_id, "suspects": suspects}

    @app.post("/api/runs/{run_id}/repair")
    def start_repair(run_id: str, body: RepairRequest) -> dict:
        from blackbox.replay.repair import repair

        trace = load(run_id)
        job = jobs.start("repair", lambda j: repair(trace, body.step_idx, store=db(), rounds=body.rounds,
                                                     evidence=body.evidence, on_event=j.emit))
        return {"job_id": job.job_id}

    @app.get("/api/jobs/{job_id}/events")
    def job_events(job_id: str):
        job = jobs.get(job_id)
        if job is None:
            raise HTTPException(404, f"no job {job_id}")
        return _sse(job)

    @app.get("/api/jobs/{job_id}")
    def job_status(job_id: str) -> dict:
        job = jobs.get(job_id)
        if job is None:
            raise HTTPException(404, f"no job {job_id}")
        return {"job_id": job.job_id, "kind": job.kind, "finished": job.finished, "n_events": len(job.events),
                "result": job.result}

    @app.get("/api/compare")
    def compare(a: str, b: str) -> dict:
        return compare_traces(load(a), load(b))

    return app


app = create_app()
