"""Tools that read recorded runs and the dataset. No re-runs, no model calls."""

from __future__ import annotations

import json

from blackbox.mcp.registry import RUN_ID, clip, store, tool


@tool("list_failures", "Recent failed agent runs (newest first), with the known guilty step when there is one.",
      category="runs", properties={"limit": {"type": "integer", "default": 10},
                                   "family": {"type": "string", "enum": ["qa", "math", "ops", "external"]}})
def list_failures(limit: int = 10, family: str | None = None) -> str:
    runs = store().list_runs(success=False, task_family=family, limit=int(limit))
    if not runs:
        return "No failed runs recorded."
    lines = [f"{r.run_id}  {r.task_family:5} {r.task_id:28} guilty step {r.label.root_cause_step if r.label else '?'}"
             f"{'  (planted ' + r.fault.type + ')' if r.fault else ''}" for r in runs]
    return "Failed runs (newest first):\n" + "\n".join(lines)


@tool("run_steps", "One run step by step: kind, name, which earlier steps it used, a short output.",
      category="runs", properties=RUN_ID, required=("run_id",))
def run_steps(run_id: str) -> str:
    tr = store().load_trace(run_id)
    r = tr.run
    head = (f"Run {r.run_id} ({r.agent}, {r.model_id}): {'PASS' if r.outcome and r.outcome.success else 'FAIL'}"
            f"; answer {clip(r.outcome.final_answer if r.outcome else None, 80)}")
    rows = [f"#{s.idx} {s.kind}:{s.name} used {s.parents} -> {clip(s.error or s.output, 120)}" for s in tr.steps]
    return head + "\n" + "\n".join(rows)


@tool("search_steps", "Search every recorded step (outputs, errors, tool names) across recent runs, "
      "e.g. 'no results', 'timeout', 'rate limit'.", category="runs",
      properties={"query": {"type": "string"}, "only_failed": {"type": "boolean", "default": False},
                  "limit": {"type": "integer", "default": 15}}, required=("query",))
def search_steps(query: str, only_failed: bool = False, limit: int = 15) -> str:
    s = store()
    q = query.lower()
    hits, scanned = [], 0
    for r in s.list_runs(success=False if only_failed else None, limit=400):
        scanned += 1
        tr = s.load_trace(r.run_id)
        for st in tr.steps:
            text = f"{st.name} {json.dumps(st.output, default=str, ensure_ascii=False)} {st.error or ''}"
            if q in text.lower():
                ok = "PASS" if tr.run.outcome and tr.run.outcome.success else "FAIL"
                hits.append(f"{r.run_id} #{st.idx} {st.kind}:{st.name} [{ok}] {clip(st.error or st.output, 110)}")
                break
        if len(hits) >= int(limit):
            break
    if not hits:
        return f"No step mentions {query!r} in the {scanned} most recent runs."
    return f"{len(hits)} runs with a step mentioning {query!r} (searched {scanned} recent runs):\n" + "\n".join(hits)


@tool("compare_runs", "Line two runs up step by step: where they first diverged and whether the outcome flipped.",
      category="runs", properties={"run_a": {"type": "string"}, "run_b": {"type": "string"}},
      required=("run_a", "run_b"))
def compare_runs(run_a: str, run_b: str) -> str:
    from blackbox.replay.diff import compare

    s = store()
    c = compare(s.load_trace(run_a), s.load_trace(run_b))
    rows = [f"  {p['status']:7} a#{p['a']} b#{p['b']}"
            + (f" memory diff {clip(p['state_diff'], 120)}" if p.get("state_diff") else "")
            for p in c["pairs"] if p["status"] != "same"]
    o = c["outcome"]

    def answer(x: dict | None) -> str | None:
        return clip(x["final_answer"], 60) if x else None

    return (f"{c['n_changed']} of {len(c['pairs'])} aligned steps differ; first divergence at position "
            f"{c['first_divergence']}. Outcome flipped: {o['flipped']} (a: {answer(o['a'])}, b: {answer(o['b'])}).\n"
            + "\n".join(rows[:30]))


@tool("dataset_summary", "What Black Box has recorded: runs, families, test sets, labelled failures.", category="runs")
def dataset_summary() -> str:
    from blackbox.eval.report import data_summary, iter_traces

    d = data_summary(list(iter_traces(store())))
    return (f"{d['runs']} runs; {d['labelled_failures']} failures with a known guilty step "
            f"(sources {d['labelled_by_source']}); families {d['by_family']}; test sets {d['by_split']}.")


@tool("failure_patterns", "Top failure patterns across all recorded runs.", category="runs",
      properties={"top": {"type": "integer", "default": 8}})
def failure_patterns(top: int = 8) -> str:
    from blackbox.api.ui import atlas

    a = atlas(store())
    lines = [f"{p['count']:>4} ({p['share'] * 100:.0f}%)  {p['title']}" for p in a["patterns"][: int(top)]]
    return f"{a['total_failures']} labelled failures. Top patterns:\n" + "\n".join(lines)
