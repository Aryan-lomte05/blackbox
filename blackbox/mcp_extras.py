"""More MCP capabilities for Black Box: action tools, resources and prompts (used by blackbox.mcp_server)."""

from __future__ import annotations

import json
from typing import Any, Callable


def _short(v: Any, n: int = 160) -> str:
    t = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False, default=str)
    t = " ".join(t.split())
    return t if len(t) <= n else t[: n - 1] + "…"


def _store():
    from blackbox.core.store import Store

    return Store()


def _obj(props: dict, required: list[str] | None = None) -> dict:
    out: dict = {"type": "object", "properties": props}
    if required:
        out["required"] = required
    return out


RUN = {"run_id": {"type": "string"}}

# Set by the server while a tool runs when the client asked for progress (MCP progressToken).
PROGRESS: Callable[[str], None] | None = None


def _progress(message: str) -> None:
    if PROGRESS is not None:
        PROGRESS(message)

TOOLS: list[dict] = [
    {"name": "replay", "description": "Replay a recorded run from its recording (0 model calls); says whether the outcome is the same.",
     "inputSchema": _obj(RUN, ["run_id"])},
    {"name": "fork", "description": "What-if: replace one step's output and re-run only the steps that change. Returns the new answer and the savings.",
     "inputSchema": _obj({**RUN, "step_idx": {"type": "integer"},
                          "new_output_json": {"type": "string", "description": 'the new output as JSON, e.g. {"result": 42}'}},
                         ["run_id", "step_idx", "new_output_json"])},
    {"name": "verify", "description": "Prove which suspect step caused a failure by re-running with one step repaired at a time.",
     "inputSchema": _obj(RUN, ["run_id"])},
    {"name": "repair", "description": "Ask the big model for fixes to one step and test each by replay. Slow (minutes).",
     "inputSchema": _obj({**RUN, "step_idx": {"type": "integer"}}, ["run_id", "step_idx"])},
    {"name": "live_lab", "description": "Type any question: an agent answers live, Black Box plants a mistake and investigates it (14 stages, 1-5 min).",
     "inputSchema": _obj({"question": {"type": "string"}, "mistake": {"type": "string", "default": "auto"}}, ["question"])},
    {"name": "list_incidents", "description": "Guardian incidents: failed / crashed / flagged runs explained for their owner.",
     "inputSchema": _obj({"limit": {"type": "integer", "default": 10}})},
    {"name": "incident", "description": "One incident: what happened, why, how to fix it, who was notified.",
     "inputSchema": _obj({"incident_id": {"type": "string"}}, ["incident_id"])},
    {"name": "decide_incident", "description": "Approve, or keep paused, the retry of a money-moving agent. Final.",
     "inputSchema": _obj({"incident_id": {"type": "string"}, "approve": {"type": "boolean"}, "note": {"type": "string"}},
                         ["incident_id", "approve"])},
    {"name": "status", "description": "What Black Box is doing on this machine now: job queue, GPU, data totals, model results.",
     "inputSchema": _obj({})},
]


def t_replay(run_id: str) -> str:
    import blackbox.agents.builtin  # noqa: F401
    from blackbox.replay.engine import replay, savings

    tr = _store().load_trace(run_id)
    again = replay(tr)
    same = bool(again.run.outcome and tr.run.outcome and again.run.outcome.success == tr.run.outcome.success)
    return (f"Replayed {run_id}: {again.run.stats.get('n_llm_calls')} model calls, "
            f"{savings(again)['steps_reused']} steps served from the recording; same outcome: {same}.")


def t_fork(run_id: str, step_idx: int, new_output_json: str) -> str:
    import blackbox.agents.builtin  # noqa: F401
    from blackbox.core.schema import Change
    from blackbox.replay.engine import fork, savings

    s = _store()
    child = fork(s.load_trace(run_id), int(step_idx),
                 Change(kind="output", value=json.loads(new_output_json), note="what-if from the IDE"), store=s)
    sv = savings(child)
    ok = child.run.outcome.success if child.run.outcome else None
    ans = child.run.outcome.final_answer if child.run.outcome else None
    verdict = "PASS" if ok else ("FAIL" if ok is False else child.run.status)
    return (f"New run {child.run.run_id}: {verdict}, answer {_short(ans, 120)}. Re-ran {sv['steps_executed']} of "
            f"{sv['steps_total']} steps, re-used {sv['steps_reused']}, saved {sv['tokens_saved']} tokens.")


def t_verify(run_id: str) -> str:
    import blackbox.agents.builtin  # noqa: F401
    from blackbox.api.main import diagnose
    from blackbox.replay.verify import verify

    s = _store()
    tr = s.load_trace(run_id)
    suspects = list(diagnose(tr).get("suspects", []))[:3]
    _progress(f"suspects {suspects}: repairing one at a time")

    def on_event(e: dict) -> None:
        if e.get("type") == "verdict":
            _progress(f"step {e['step']}: {e['verdict']}")

    rep = verify(tr, suspects, store=s, repeats=1, strong_model="agent-local-7b", on_event=on_event)
    head = (f"Proven cause: step {rep['verified_step']}." if rep["verified_step"] is not None
            else "No single suspect's repair fixed the run.")
    return head + "\n" + "\n".join(f"step {x['step']}: {x['verdict']} (causal effect {x['causal_effect']})"
                                   for x in rep["suspects"])


def t_repair(run_id: str, step_idx: int) -> str:
    import blackbox.agents.builtin  # noqa: F401
    from blackbox.replay.repair import repair

    s = _store()
    out = repair(s.load_trace(run_id), int(step_idx), store=s, rounds=1)
    rows = [f"{'PASS' if c['passed'] else 'fail'}  {c['change']['kind']}: {_short(c['change'].get('note') or '', 140)}"
            for c in out["cards"]]
    return f"{len(out['cards'])} fixes tried, each tested by replay:\n" + "\n".join(rows)


def t_live_lab(question: str, mistake: str = "auto") -> str:
    from blackbox.lab import run_lab

    lines: list[str] = []

    def keep(e: dict) -> None:
        if e["type"] == "stage":
            lines.append(f"[{e['n']:>2}/14] {e['title']}: {e['detail']}")
            _progress(lines[-1])

    run_lab(question, mistake=mistake, store=_store(), emit=keep)
    return "\n".join(lines)


def t_list_incidents(limit: int = 10) -> str:
    from blackbox.guardian.service import list_incidents

    incs = list_incidents()[: int(limit)]
    if not incs:
        return "No incidents yet: they appear when a watched run fails, crashes or is flagged."
    return "\n".join(f"{i.incident_id} [{i.severity}] {i.status:8} {i.title} (run {i.run_id})" for i in incs)


def t_incident(incident_id: str) -> str:
    from blackbox.guardian import render
    from blackbox.guardian.service import get_incident

    inc = get_incident(incident_id)
    if inc is None:
        raise KeyError(incident_id)
    sent = "; ".join(f"{n['channel']}: {n['status']}" for n in inc.notifications)
    return render.text_email(inc) + f"\n\nNotifications: {sent}\nStatus: {inc.status}"


def t_decide_incident(incident_id: str, approve: bool, note: str = "") -> str:
    from blackbox.guardian.service import decide

    inc = decide(incident_id, bool(approve), "IDE assistant", note)
    return f"Incident {inc.incident_id} is now {inc.status} (by {inc.decision['by']} at {inc.decision['at']})."


def t_status() -> str:
    from blackbox.status import snapshot

    return snapshot(_store())


HANDLERS: dict[str, Callable[..., str]] = {
    "replay": t_replay, "fork": t_fork, "verify": t_verify, "repair": t_repair, "live_lab": t_live_lab,
    "list_incidents": t_list_incidents, "incident": t_incident, "decide_incident": t_decide_incident,
    "status": t_status,
}


# ---- resources: recent failures and incidents the assistant can open ---------------------
def list_resources() -> list[dict]:
    out = []
    for r in _store().list_runs(success=False, has_label=True, limit=15):
        out.append({"uri": f"blackbox://run/{r.run_id}", "name": f"Failed run {r.run_id} ({r.task_family})",
                    "description": f"guilty step {r.label.root_cause_step}" + (f", planted {r.fault.type}" if r.fault else ""),
                    "mimeType": "text/markdown"})
    from blackbox.guardian.service import list_incidents

    for i in list_incidents()[:10]:
        out.append({"uri": f"blackbox://incident/{i.incident_id}", "name": f"Incident {i.incident_id}: {i.title}",
                    "description": f"{i.severity}, {i.status}", "mimeType": "text/plain"})
    return out


def read_resource(uri: str) -> str:
    kind, _, ident = uri.removeprefix("blackbox://").partition("/")
    if kind == "run":
        from blackbox.api.main import diagnose
        from blackbox.api.ui import report_md

        tr = _store().load_trace(ident)
        d = diagnose(tr) if tr.run.outcome and not tr.run.outcome.success else None
        return report_md(tr, d)
    if kind == "incident":
        return t_incident(ident)
    raise KeyError(uri)


RESOURCE_TEMPLATES = [
    {"uriTemplate": "blackbox://run/{run_id}", "name": "Any recorded run as a case file", "mimeType": "text/markdown"},
    {"uriTemplate": "blackbox://incident/{incident_id}", "name": "A Guardian incident", "mimeType": "text/plain"},
]


def complete(argument: str, prefix: str) -> list[str]:
    """Autocomplete for run_id / run_a / run_b / incident_id arguments: newest first, matching the prefix."""
    if argument == "incident_id":
        from blackbox.guardian.service import list_incidents

        ids = [i.incident_id for i in list_incidents()]
    elif argument in ("run_id", "run_a", "run_b"):
        ids = [r.run_id for r in _store().list_runs(limit=300)]
    else:
        return []
    return [i for i in ids if i.startswith(prefix)]


# ---- prompts: ready-made workflows -----------------------------------------------------------
PROMPTS = [
    {"name": "investigate_latest_failure", "description": "Find the newest failed run, diagnose it, prove the cause, suggest a fix.",
     "arguments": []},
    {"name": "explain_run_for_non_coder", "description": "Explain what went wrong in a run to someone who does not code.",
     "arguments": [{"name": "run_id", "description": "the run", "required": True}]},
    {"name": "what_if", "description": "Try a change at one step and report what would have happened.",
     "arguments": [{"name": "run_id", "required": True}, {"name": "step_idx", "required": True},
                   {"name": "change", "description": "what to change, in words", "required": True}]},
]


def get_prompt(name: str, args: dict) -> list[dict]:
    if name == "investigate_latest_failure":
        text = ("Use the Black Box tools: list_failures (limit 5), take the newest, diagnose it, then verify it. Report "
                "the proven cause in plain words with its evidence, and propose a fix. If verify proves nothing, say so.")
    elif name == "explain_run_for_non_coder":
        text = (f"Call run_steps and diagnose for run {args.get('run_id')}. Then explain, for someone who does not code, "
                "what the agent was asked, what it answered, which step went wrong and why: five short sentences, no jargon.")
    elif name == "what_if":
        text = (f"For run {args.get('run_id')}, step {args.get('step_idx')}: write the step's new output for this change: "
                f"'{args.get('change')}'. Call fork with it, then explain how the answer changed and how much work was re-used.")
    else:
        raise KeyError(name)
    return [{"role": "user", "content": {"type": "text", "text": text}}]
