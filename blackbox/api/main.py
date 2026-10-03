"""HTTP API for the web app (SYSTEM.md §8). Skeleton: Aryan. Extra routes: Advay.

    py -3 -m uvicorn blackbox.api.main:app --port 8000 --reload
"""

from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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


def create_app(store: Store | None = None) -> FastAPI:
    app = FastAPI(title="Black Box", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=os.environ.get("BLACKBOX_CORS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.store = store

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

    @app.get("/api/compare")
    def compare(a: str, b: str) -> dict:
        return compare_traces(load(a), load(b))

    return app


app = create_app()
