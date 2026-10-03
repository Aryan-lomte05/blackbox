"""Tools that re-run recorded history: replay, what-if forks, GenAI repairs, fleet tests, the Live Lab.

Every re-run is a fork: unchanged steps are served from the recording, and money-moving tools never execute.
"""

from __future__ import annotations

import json

from blackbox.mcp.registry import RUN_ID, clip, report_progress, store, tool


def _agents() -> None:
    import blackbox.agents.builtin  # noqa: F401 - registers the built-in agents so their runs can be re-run


@tool("replay", "Replay a recorded run from its recording (0 model calls); says whether the outcome is the same.",
      category="experiments", properties=RUN_ID, required=("run_id",))
def replay(run_id: str) -> str:
    _agents()
    from blackbox.replay.engine import replay as replay_run, savings

    tr = store().load_trace(run_id)
    again = replay_run(tr)
    same = bool(again.run.outcome and tr.run.outcome and again.run.outcome.success == tr.run.outcome.success)
    return (f"Replayed {run_id}: {again.run.stats.get('n_llm_calls')} model calls, "
            f"{savings(again)['steps_reused']} steps served from the recording; same outcome: {same}.")


@tool("fork", "What-if: replace one step's output and re-run only the steps that change. Returns the new answer "
      "and the savings.", category="experiments",
      properties={**RUN_ID, "step_idx": {"type": "integer"},
                  "new_output_json": {"type": "string", "description": 'the new output as JSON, e.g. {"result": 42}'}},
      required=("run_id", "step_idx", "new_output_json"))
def fork(run_id: str, step_idx: int, new_output_json: str) -> str:
    _agents()
    from blackbox.core.schema import Change
    from blackbox.replay.engine import fork as fork_run, savings

    s = store()
    child = fork_run(s.load_trace(run_id), int(step_idx),
                     Change(kind="output", value=json.loads(new_output_json), note="what-if from the IDE"), store=s)
    sv = savings(child)
    ok = child.run.outcome.success if child.run.outcome else None
    answer = child.run.outcome.final_answer if child.run.outcome else None
    verdict = "PASS" if ok else ("FAIL" if ok is False else child.run.status)
    return (f"New run {child.run.run_id}: {verdict}, answer {clip(answer, 120)}. Re-ran {sv['steps_executed']} of "
            f"{sv['steps_total']} steps, re-used {sv['steps_reused']}, saved {sv['tokens_saved']} tokens.")


@tool("repair", "Ask the big model for fixes to one step and test each by replay. Slow (minutes).",
      category="experiments", properties={**RUN_ID, "step_idx": {"type": "integer"}}, required=("run_id", "step_idx"))
def repair(run_id: str, step_idx: int) -> str:
    _agents()
    from blackbox.replay.repair import repair as repair_step

    s = store()
    out = repair_step(s.load_trace(run_id), int(step_idx), store=s, rounds=1)
    rows = [f"{'PASS' if c['passed'] else 'fail'}  {c['change']['kind']}: {clip(c['change'].get('note') or '', 140)}"
            for c in out["cards"]]
    return f"{len(out['cards'])} fixes tried, each tested by replay:\n" + "\n".join(rows)


def _fleet_progress(e: dict) -> None:
    if e.get("type") == "rule":
        report_progress(f"rule: {e['rule']}")
    elif e.get("type") == "run":
        report_progress(f"{e['n']}/{e['of']} {e['run_id']}: {e['verdict']}")


@tool("fleet_fix", "One fix for many: turn this failure into ONE general rule (or test yours), re-run similar "
      "failures and passing runs with it, and APPROVE or BLOCK it (regression firewall). About 40 s per run.",
      category="experiments", properties={**RUN_ID, "rule": {"type": "string"},
                                          "n_fail": {"type": "integer", "default": 3},
                                          "n_pass": {"type": "integer", "default": 2}}, required=("run_id",))
def fleet_fix(run_id: str, rule: str | None = None, n_fail: int = 3, n_pass: int = 2) -> str:
    _agents()
    from blackbox.api.main import diagnose
    from blackbox.replay.fleet import format_report, one_fix_for_many

    return format_report(one_fix_for_many(store(), run_id, rule=rule, n_fail=int(n_fail), n_pass=int(n_pass),
                                          diagnose=diagnose, on_event=_fleet_progress))


@tool("time_machine", "Re-run recorded history under a new rule or model: which failures it fixes, which passing "
      "runs it breaks.", category="experiments",
      properties={"family": {"type": "string", "enum": ["qa", "math", "ops"], "default": "qa"},
                  "rule": {"type": "string"}, "model": {"type": "string"},
                  "n_fail": {"type": "integer", "default": 3}, "n_pass": {"type": "integer", "default": 3}})
def time_machine(family: str = "qa", rule: str | None = None, model: str | None = None,
                 n_fail: int = 3, n_pass: int = 3) -> str:
    _agents()
    from blackbox.replay.fleet import fleet_test, format_report, history_sample

    s = store()
    ids = history_sample(s, family, int(n_fail), int(n_pass))
    return format_report(fleet_test(s, ids, instruction=rule, model=model, on_event=_fleet_progress))


@tool("cheaper_model", "For a passing run: try each model call on a cheaper model by replay and report which steps "
      "could be downgraded without breaking the answer.", category="experiments",
      properties={**RUN_ID, "cheaper_model": {"type": "string", "default": "agent-local"}}, required=("run_id",))
def cheaper_model(run_id: str, cheaper_model: str = "agent-local") -> str:
    _agents()
    from blackbox.replay.advisor import advise

    s = store()
    res = advise(s.load_trace(run_id), cheaper_model, store=s)
    rows = [f"  step {r['step']} {r['from_model']} -> {r['to_model']}: "
            f"{'still passes' if r['still_passes'] else 'breaks the answer'} ({r['tokens']} tokens)" for r in res["rows"]]
    return (f"{len(res['safe_to_downgrade'])} of {res['steps_checked']} model calls can use {cheaper_model}: "
            f"steps {res['safe_to_downgrade']} ({res['tokens_movable']} tokens). {res['note']}.\n" + "\n".join(rows))


@tool("live_lab", "Type any question: an agent answers live, Black Box plants a mistake and investigates it "
      "(14 stages, 1-5 min).", category="experiments",
      properties={"question": {"type": "string"}, "mistake": {"type": "string", "default": "auto"}},
      required=("question",))
def live_lab(question: str, mistake: str = "auto") -> str:
    from blackbox.lab import run_lab

    lines: list[str] = []

    def keep(e: dict) -> None:
        if e["type"] == "stage":
            lines.append(f"[{e['n']:>2}/14] {e['title']}: {e['detail']}")
            report_progress(lines[-1])

    run_lab(question, mistake=mistake, store=store(), emit=keep)
    return "\n".join(lines)
