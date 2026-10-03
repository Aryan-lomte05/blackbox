"""Fleet replay: test ONE change against MANY recorded runs (U17 "one fix for many", time machine A/B,
repair regression firewall).

A change is a policy on every model call from the fork point on: "add this instruction" or "use this
model". Each run is re-run by fork, so steps whose inputs did not change are re-used, never re-asked:
  - a planted failure: the original passing run is forked at the planted step with the SAME planted
    mistake, under the policy. Question: does the agent now recover from that mistake?
  - a real failure / a passing run: forked from step 0 under the policy.
Failures that now pass are FIXED; passing runs that now fail are REGRESSIONS. The firewall approves a
change only if it fixes something and breaks nothing. Money-moving tools never execute (dry run).
"""

from __future__ import annotations

import json
from typing import Any, Callable

from blackbox.core.schema import Change, Trace
from blackbox.core.store import Store
from blackbox.recorder.context import dry_run_tools, llm_policy
from blackbox.replay.engine import fork, savings

MONEY_TOOLS = frozenset({"place_order", "refund_order", "transfer", "pay", "send_money"})
Event = Callable[[dict], None]


def make_policy(instruction: str | None = None, model: str | None = None) -> Callable[[dict], dict]:
    """The fleet change as a request -> request function for every model call."""
    def policy(req: dict) -> dict:
        req = dict(req)
        if model:
            req["model_id"] = model
        if instruction:
            msgs = [dict(m) for m in req.get("messages") or []]
            if msgs and msgs[0].get("role") == "system":
                msgs[0]["content"] = f"{msgs[0].get('content', '')}\n\nRule: {instruction}"
            else:
                msgs.insert(0, {"role": "system", "content": f"Rule: {instruction}"})
            req["messages"] = msgs
        return req
    return policy


def _ok(tr: Trace) -> bool | None:
    if tr.run.status != "done" or tr.run.outcome is None:
        return None
    return bool(tr.run.outcome.success)


def rerun_under(trace: Trace, store: Store, policy: Callable[[dict], dict]) -> Trace:
    """Re-run one recorded run with the policy applied (see module docstring)."""
    r = trace.run
    tok_p, tok_d = llm_policy.set(policy), dry_run_tools.set(MONEY_TOOLS | dry_run_tools.get())
    try:
        if r.parent_run_id and r.patch is not None and r.fork_step_idx is not None:
            base = store.load_trace(r.parent_run_id)
            patch = r.patch if isinstance(r.patch, Change) else Change.model_validate(r.patch)
            return fork(base, r.fork_step_idx, patch, store=store)
        return fork(trace, 0, None, store=store)
    finally:
        llm_policy.reset(tok_p)
        dry_run_tools.reset(tok_d)


def fleet_test(store: Store, run_ids: list[str], *, instruction: str | None = None, model: str | None = None,
               on_event: Event | None = None) -> dict[str, Any]:
    if not (instruction or model):
        raise ValueError("give an instruction and/or a model to test")
    emit = on_event or (lambda e: None)
    policy = make_policy(instruction, model)
    rows = []
    for n, rid in enumerate(run_ids, 1):
        tr = store.load_trace(rid)
        before = _ok(tr)
        try:
            child = rerun_under(tr, store, policy)
            after, child_id, sv = _ok(child), child.run.run_id, savings(child)
            answer = child.run.outcome.final_answer if child.run.outcome else None
        except Exception as exc:  # noqa: BLE001 - one bad run must not sink the fleet report
            after, child_id, sv, answer = None, None, None, f"{type(exc).__name__}: {exc}"
        verdict = ("crashed" if after is None else "fixed" if (before is False and after) else
                   "regression" if (before and not after) else "still failing" if before is False else "held")
        row = {"run_id": rid, "family": tr.run.task_family, "before": before, "after": after, "verdict": verdict,
               "new_run": child_id, "answer": answer, "savings": sv}
        rows.append(row)
        emit({"type": "run", "n": n, "of": len(run_ids), **{k: row[k] for k in ("run_id", "verdict", "new_run")}})
    count = {v: sum(r["verdict"] == v for r in rows) for v in ("fixed", "still failing", "regression", "held", "crashed")}
    failing = [r for r in rows if r["before"] is False]
    passing = [r for r in rows if r["before"]]
    if count["regression"]:
        decision = "BLOCK"
        why = f"it breaks {count['regression']} run(s) that used to pass"
    elif count["fixed"]:
        decision = "APPROVE"
        why = f"it fixes {count['fixed']} of {len(failing)} failures and breaks none of {len(passing)} passing runs"
    else:
        decision = "NO EFFECT"
        why = "it fixes none of the failures"
    fail_before = len(failing) / len(rows) if rows else 0.0
    fail_after = sum(r["after"] is False for r in rows) / len(rows) if rows else 0.0
    report = {"change": {"instruction": instruction, "model": model}, "runs": len(rows), "counts": count,
              "failures_tested": len(failing), "passes_tested": len(passing),
              "fix_rate": round(count["fixed"] / len(failing), 3) if failing else None,
              "failure_rate_before": round(fail_before, 3), "failure_rate_after": round(fail_after, 3),
              "decision": decision, "why": why, "rows": rows}
    emit({"type": "done", **{k: report[k] for k in ("counts", "decision", "why")}})
    return report


def format_report(rep: dict) -> str:
    """The fleet report as plain text (CLI, MCP)."""
    c = rep["counts"]
    head = (f"{rep['decision']}: {rep['why']}.\nChange: {rep['change']}\nFixed {c['fixed']}, still failing "
            f"{c['still failing']}, regressions {c['regression']}, held {c['held']}, crashed {c['crashed']}. "
            f"Failure rate {rep['failure_rate_before']:.0%} -> {rep['failure_rate_after']:.0%}.")
    rows = [f"  {r['run_id']} ({r['family']}): {r['verdict']} -> new run {r['new_run']}" for r in rep["rows"]]
    return head + "\n" + "\n".join(rows)


def _rerunnable(run) -> bool:
    from blackbox.agents.base import get_agent

    try:
        get_agent(run.agent)
        return True
    except (KeyError, AttributeError, ImportError, ValueError):
        return False


def history_sample(store: Store, family: str, n_fail: int, n_pass: int) -> list[str]:
    """Recorded history to test a change on: labelled failures and original passing runs of one family."""
    fails = [r.run_id for r in store.list_runs(success=False, task_family=family, has_label=True, limit=400)
             if _rerunnable(r)][:n_fail]
    passes = [r.run_id for r in store.list_runs(success=True, task_family=family, limit=300)
              if r.fault is None and r.parent_run_id is None and r.status == "done" and _rerunnable(r)][:n_pass]
    return fails + passes


def similar_runs(store: Store, trace: Trace, n_fail: int = 6, n_pass: int = 4) -> list[str]:
    """Failures like this one (same planted mistake type, else same task family) plus passing runs
    of the same family as a regression check."""
    r = trace.run
    ftype = r.fault.type if r.fault else None
    fails = []
    for cand in store.list_runs(success=False, task_family=r.task_family, has_label=True, limit=600):
        if cand.run_id == r.run_id or not _rerunnable(cand):
            continue
        if (cand.fault.type if cand.fault else None) == ftype:
            fails.append(cand.run_id)
        if len(fails) >= n_fail:
            break
    passes = [c.run_id for c in store.list_runs(success=True, task_family=r.task_family, limit=300)
              if c.fault is None and c.parent_run_id is None and c.status == "done" and _rerunnable(c)][:n_pass]
    return [r.run_id, *fails, *passes]


def propose_rule(trace: Trace, diagnosis: dict | None = None, model: str = "judge-large") -> str:
    """GenAI: turn one diagnosed failure into ONE general rule for the agent (not a patch for this run).
    The model never sees the expected answer."""
    from blackbox.recorder import providers

    r = trace.run
    guilty = r.label.root_cause_step if r.label else ((diagnosis or {}).get("suspects") or [None])[0]
    lines = [f"#{s.idx} {s.kind}:{s.name} -> {json.dumps(s.error or s.output, ensure_ascii=False, default=str)[:220]}"
             for s in trace.steps]
    ev = " ".join(sum(((e.get("sentences") or []) for e in (diagnosis or {}).get("evidence", []) or []), []))[:600]
    prompt = (
        "An AI agent failed. Below is its run, step by step. The step that went wrong is "
        f"#{guilty}. {('Evidence: ' + ev) if ev else ''}\n\n" + "\n".join(lines) +
        "\n\nWrite ONE short general rule (max 30 words) to add to this agent's instructions so it avoids this "
        "KIND of mistake on any question, not just this one. Do not mention this question's answer. "
        "Reply with the rule only.")
    res = providers.chat(model, [{"role": "user", "content": prompt}], None, temperature=0.2, max_tokens=80)
    rule = (res.as_output().get("text") or "").strip().strip('"').splitlines()[0] if res else ""
    return rule or "Before answering, check that every fact you use appears in a search result; if a result looks wrong or irrelevant, search again."


def one_fix_for_many(store: Store, run_id: str, *, rule: str | None = None, n_fail: int = 6, n_pass: int = 4,
                     diagnose: Callable[[Trace], dict] | None = None, on_event: Event | None = None) -> dict:
    emit = on_event or (lambda e: None)
    tr = store.load_trace(run_id)
    if rule is None:
        emit({"type": "proposing"})
        rule = propose_rule(tr, diagnose(tr) if diagnose else None)
    emit({"type": "rule", "rule": rule})
    ids = similar_runs(store, tr, n_fail, n_pass)
    emit({"type": "fleet", "runs": len(ids)})
    out = fleet_test(store, ids, instruction=rule, on_event=on_event)
    out["source_run"] = run_id
    return out
