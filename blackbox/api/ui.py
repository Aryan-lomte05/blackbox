"""Endpoints shaped for the dashboard (docs/API_FOR_UI.md). Each one returns exactly what a screen needs,
so the UI renders without stitching several calls together. Read-only: nothing here runs a model.
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from typing import Any, Callable

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import PlainTextResponse

from blackbox.core.schema import Trace
from blackbox.core.store import DEFAULT_DIR, Store

FAULT_NAMES = {"F1": "wrong tool argument", "F2": "wrong tool result", "F3": "tool returned nothing",
               "F4": "misleading paragraph", "F5": "missing paragraph", "F6": "wrong fact", "F7": "wrong tool",
               "F8": "lost memory", "F9": "dropped instruction", "F10": "answered too early"}
FAMILY = {"qa": "QA", "math": "Math", "ops": "Shop", "external": "Who&When"}
X_GAP, Y_GAP = 300, 130


def _short(v: Any, n: int = 140) -> str:
    t = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False, default=str)
    t = " ".join(str(t).split())
    return t if len(t) <= n else t[: n - 1] + "…"


def _outcome(run) -> str:
    if run.status != "done":
        return run.status
    return "no verdict" if run.outcome is None else ("pass" if run.outcome.success else "fail")


def _run_card(run) -> dict:
    return {"run_id": run.run_id, "family": run.task_family, "family_label": FAMILY.get(run.task_family, run.task_family),
            "task_id": run.task_id, "agent": run.agent, "model": run.model_id, "outcome": _outcome(run),
            "planted": run.fault.type if run.fault else None, "guilty_step": run.label.root_cause_step if run.label else None,
            "label_source": run.label.source if run.label else None, "steps": run.stats.get("n_steps"),
            "split": run.split, "created_at": run.created_at, "parent_run_id": run.parent_run_id}


def _step_text(s) -> str:
    if s.error:
        return "ERROR " + s.error
    o = s.output or {}
    if "text" in o:
        return o["text"]
    if "docs" in o:
        return " | ".join(str(d.get("title", d.get("id"))) for d in o["docs"] if isinstance(d, dict))
    if "answer" in o:
        return json.dumps(o["answer"], ensure_ascii=False, default=str)
    return json.dumps(o.get("result", o), ensure_ascii=False, default=str)


def run_graph(trace: Trace, diagnosis: dict | None) -> dict:
    """React Flow shape: {nodes:[{id, type, position, data}], edges:[{id, source, target, type, data}]}.
    Layout: x by data-flow depth, y by order within a depth (left to right = time and dependency)."""
    from blackbox.diagnosis.graph_data import dataflow_parents

    parents = dataflow_parents(trace)
    depth: dict[int, int] = {}
    for s in trace.steps:
        depth[s.idx] = 1 + max((depth.get(p, 0) for p in parents[s.idx] if p < s.idx), default=-1)
    lanes: dict[int, int] = defaultdict(int)
    suspects = (diagnosis or {}).get("suspects", [])
    p_by_idx = {x["idx"]: x["p"] for x in (diagnosis or {}).get("scores", [])}
    guilty = trace.run.label.root_cause_step if trace.run.label else None
    planted = trace.run.fault.step_idx if trace.run.fault else None
    nodes = []
    for s in trace.steps:
        d = depth[s.idx]
        y = lanes[d]
        lanes[d] += 1
        mon = s.monitor if isinstance(s.monitor, dict) else None
        nodes.append({
            "id": str(s.idx), "type": s.kind, "position": {"x": d * X_GAP, "y": y * Y_GAP},
            "data": {
                "idx": s.idx, "kind": s.kind, "name": s.name, "node": s.node,
                "label": f"#{s.idx} {s.kind}:{s.name}", "preview": _short(_step_text(s), 160),
                "error": s.error, "reused": s.cached, "latency_ms": s.latency_ms,
                "tokens": (s.tokens_in or 0) + (s.tokens_out or 0) or None,
                "suspect_rank": suspects.index(s.idx) + 1 if s.idx in suspects else None,
                "suspect_p": p_by_idx.get(s.idx), "is_guilty": s.idx == guilty, "is_planted": s.idx == planted,
                "checker": None if not mon else {
                    "on_track": (mon.get("on_track") or {}).get("prob"), "consistent": (mon.get("consistent") or {}).get("prob"),
                    "alarm": mon.get("alarm"), "tier": mon.get("tier")},
            }})
    edges = [{"id": f"d{p}-{i}", "source": str(p), "target": str(i), "type": "dataflow", "animated": i == guilty,
              "data": {"kind": "used the output of"}} for i, ps in enumerate(parents) for p in ps if 0 <= p < len(parents)]
    linked = {(e["source"], e["target"]) for e in edges}
    edges += [{"id": f"o{i}-{i + 1}", "source": str(i), "target": str(i + 1), "type": "order",
               "data": {"kind": "then"}} for i in range(len(trace.steps) - 1) if (str(i), str(i + 1)) not in linked]
    return {"run": _run_card(trace.run), "nodes": nodes, "edges": edges,
            "legend": {"dataflow": "this step used that step's output", "order": "next step in time",
                       "suspect_rank": "diagnosis rank (1 = most likely)", "is_guilty": "known guilty step"}}


def atlas(store: Store) -> dict:
    """Top failure patterns (U22): labelled failures grouped by family, mistake and step kind."""
    groups: dict[tuple, dict] = {}
    offset, total = 0, 0
    while True:
        batch = store.list_runs(success=False, has_label=True, limit=1000, offset=offset)
        if not batch:
            break
        offset += len(batch)
        for r in batch:
            tr = store.load_trace(r.run_id)
            g = r.label.root_cause_step
            if g is None or g >= len(tr.steps):
                continue
            total += 1
            st = tr.steps[g]
            mistake = r.fault.type if (r.fault and r.label.source == "injected") else "real failure"
            key = (r.task_family, mistake, st.kind, st.node)
            e = groups.setdefault(key, {"family": FAMILY.get(r.task_family, r.task_family), "mistake": mistake,
                                        "mistake_name": FAULT_NAMES.get(mistake, "failure nobody planted"),
                                        "step_kind": st.kind, "agent_node": st.node, "count": 0, "examples": []})
            e["count"] += 1
            if len(e["examples"]) < 3:
                e["examples"].append(r.run_id)
    patterns = sorted(groups.values(), key=lambda e: -e["count"])
    for e in patterns:
        e["share"] = round(e["count"] / total, 3) if total else 0.0
        e["title"] = (f"{e['family']}: {e['mistake_name']} at a {e['step_kind']} step ({e['agent_node']})")
    return {"total_failures": total, "patterns": patterns}


def export_test(trace: Trace) -> str:
    """Every crash becomes a test (U23): a pytest file that replays this recorded run and pins its outcome.
    Replay serves recorded answers, so the test runs offline in milliseconds and fails if the agent's
    code changes the steps it takes (or once the fix lands and you flip the expected outcome)."""
    r = trace.run
    ok = None if r.outcome is None else r.outcome.success
    return f'''"""Regression test exported by Black Box from run {r.run_id} ({r.task_family}, {r.agent}).

Recorded outcome: {_outcome(r)}.{f" Guilty step: {r.label.root_cause_step}." if r.label else ""}
Run with: pytest {f"test_run_{r.run_id}.py"}   (needs the Black Box data folder that holds this run)
After fixing the bug, change EXPECT_PASS to True: the test then guards the fix.
"""

import blackbox.agents.builtin  # noqa: F401  (registers the agents so the run can be replayed)
from blackbox.core.store import Store
from blackbox.replay.engine import replay

RUN_ID = "{r.run_id}"
EXPECT_PASS = {ok}


def test_run_{r.run_id}_replays_with_the_recorded_outcome():
    original = Store().load_trace(RUN_ID)
    again = replay(original)
    assert again.run.status == "done", again.run.error
    assert again.run.stats["n_llm_calls"] == 0  # served from the recording
    assert again.run.outcome.success is EXPECT_PASS
'''


def report_md(trace: Trace, diagnosis: dict | None) -> str:
    """A case file in Markdown (U21), built only from the recording and the diagnosis (no re-runs)."""
    r = trace.run
    lines = [f"# Black Box case file: run {r.run_id}", "",
             f"- **Agent:** {r.agent} on {r.model_id} · **Task:** {FAMILY.get(r.task_family, r.task_family)} `{r.task_id}`",
             f"- **Outcome:** {_outcome(r)}"]
    if r.outcome:
        lines += [f"- **Answer:** {_short(r.outcome.final_answer, 200)}", f"- **Expected:** {_short(r.outcome.expected, 200)}"]
    if r.fault:
        lines.append(f"- **Planted mistake:** {r.fault.type} ({FAULT_NAMES.get(r.fault.type, '')}) at step {r.fault.step_idx}")
    if r.label:
        lines.append(f"- **Known guilty step:** {r.label.root_cause_step} ({r.label.source})")
    if diagnosis:
        lines += ["", "## Diagnosis", f"Top suspects: {diagnosis.get('suspects')} ({diagnosis.get('source')})."]
        for sc in diagnosis.get("scores", [])[:5]:
            lines.append(f"- step {sc['idx']}: p = {sc['p']}")
    lines += ["", "## Timeline", "", "| step | kind | name | used | output |", "|---|---|---|---|---|"]
    for s in trace.steps:
        flag = " **← guilty**" if r.label and s.idx == r.label.root_cause_step else ""
        lines.append(f"| {s.idx}{flag} | {s.kind} | {s.name} | {s.parents} | {_short(_step_text(s), 120).replace('|', '/')} |")
    lines += ["", f"_Generated by Black Box from the recording; every value above is recorded, nothing is inferred._"]
    return "\n".join(lines) + "\n"


def register(app: FastAPI, db: Callable[[], Store], load: Callable[[str], Trace], diagnose: Callable) -> None:

    @app.get("/api/ui/overview", tags=["UI"], summary="Dashboard home in one call")
    def overview() -> dict:
        from blackbox.guardian.service import list_incidents

        s = db()
        c = s.counts()
        recent = [_run_card(r) for r in s.list_runs(limit=12)]
        failures = [_run_card(r) for r in s.list_runs(success=False, has_label=True, limit=8)]
        incidents = list_incidents()
        metrics_p = DEFAULT_DIR / "models" / "gnn_metrics.json"
        m = json.loads(metrics_p.read_text(encoding="utf-8")) if metrics_p.exists() else None
        headline = None
        if m:
            headline = {k: {"n": v["n"], "top1": v["top1"], "top1_ci95": v.get("top1_ci95"), "top3": v["top3"]}
                        for k, v in m.get("splits", {}).items() if k != "val"}
        queue_p = DEFAULT_DIR / "status" / "queue.json"
        return {
            "kpis": {"runs": c["runs"], "steps": c["steps"], "labelled_failures": c["labelled_failures"],
                     "save_point_dedup": round(1 - c["unique_save_points"] / c["save_points"], 3) if c["save_points"] else 0,
                     "open_incidents": sum(i.status == "open" for i in incidents),
                     "critical_incidents": sum(i.severity == "critical" and i.status == "open" for i in incidents),
                     "passed": c.get("passed", 0), "failed": c.get("failed", 0), "crashed": c.get("crashed", 0),
                     "blob_mb": c.get("blob_mb", 0.0)},
            "model": {"name": (m or {}).get("model"), "variant": (m or {}).get("variant"), "results": headline,
                      "policy": (m or {}).get("policy_model_plus_first_decision")},
            "recent_runs": recent, "recent_failures": failures,
            "incidents": [{"incident_id": i.incident_id, "severity": i.severity, "title": i.title, "status": i.status,
                           "created_at": i.created_at, "run_id": i.run_id, "needs_approval": i.needs_approval,
                           "repeats": i.repeats} for i in incidents[:8]],
            "queue": json.loads(queue_p.read_text(encoding="utf-8")) if queue_p.exists() else [],
        }

    @app.get("/api/runs/{run_id}/graph", tags=["UI"], summary="Run as a React Flow graph (nodes, edges, positions)")
    def graph(run_id: str, with_diagnosis: bool = Query(True, description="add suspect ranks (fast, read-only)")) -> dict:
        tr = load(run_id)
        d = None
        if with_diagnosis and tr.run.outcome is not None and not tr.run.outcome.success:
            try:
                d = diagnose(tr)
            except Exception:  # noqa: BLE001 - the graph still renders without ranks
                d = None
        return run_graph(tr, d)

    @app.get("/api/atlas", tags=["UI"], summary="Top failure patterns across all recorded runs")
    def get_atlas() -> dict:
        return atlas(db())

    @app.get("/api/runs/{run_id}/export-test", tags=["UI"], summary="Every crash becomes a test: pytest file for this run",
             response_class=PlainTextResponse)
    def get_export_test(run_id: str) -> str:
        return export_test(load(run_id))

    @app.get("/api/runs/{run_id}/report", tags=["UI"], summary="Case file in Markdown (recording + diagnosis)",
             response_class=PlainTextResponse)
    def get_report(run_id: str) -> str:
        tr = load(run_id)
        d = None
        if tr.run.outcome is not None and not tr.run.outcome.success:
            try:
                d = diagnose(tr)
            except Exception:  # noqa: BLE001
                d = None
        return report_md(tr, d)

    @app.get("/api/ui/families", tags=["UI"], summary="Task families with counts (filter chips)")
    def families() -> dict:
        from blackbox.eval.report import iter_traces  # noqa: F401  (keeps import cost off startup)

        c = Counter(r.task_family for r in db().list_runs(limit=100000))
        return {"families": [{"id": k, "label": FAMILY.get(k, k), "runs": v} for k, v in c.most_common()]}

    _ = HTTPException  # re-exported for route modules that add errors
