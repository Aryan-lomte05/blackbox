"""MCP prompts: ready-made debugging workflows the user can pick in their IDE."""

from __future__ import annotations

from typing import Callable

_Builder = Callable[[dict], str]

PROMPTS: dict[str, tuple[dict, _Builder]] = {
    "investigate_latest_failure": (
        {"description": "Find the newest failed run, diagnose it, prove the cause, suggest a fix.", "arguments": []},
        lambda a: ("Use the Black Box tools: list_failures (limit 5), take the newest, diagnose it, then "
                   "causal_report it. Report the proven cause in plain words with its evidence and the blast radius, "
                   "and propose a fix. If nothing is proven, say so.")),
    "explain_run_for_non_coder": (
        {"description": "Explain what went wrong in a run to someone who does not code.",
         "arguments": [{"name": "run_id", "description": "the run", "required": True}]},
        lambda a: (f"Call run_steps and diagnose for run {a.get('run_id')}. Then explain, for someone who does not "
                   "code, what the agent was asked, what it answered, which step went wrong and why: five short "
                   "sentences, no jargon.")),
    "what_if": (
        {"description": "Try a change at one step and report what would have happened.",
         "arguments": [{"name": "run_id", "required": True}, {"name": "step_idx", "required": True},
                       {"name": "change", "description": "what to change, in words", "required": True}]},
        lambda a: (f"For run {a.get('run_id')}, step {a.get('step_idx')}: write the step's new output for this "
                   f"change: '{a.get('change')}'. Call fork with it, then explain how the answer changed and how "
                   "much work was re-used.")),
    "fix_this_class_of_failure": (
        {"description": "Turn one failure into a rule, test it on similar failures, and only keep it if nothing breaks.",
         "arguments": [{"name": "run_id", "required": True}]},
        lambda a: (f"Call causal_report for run {a.get('run_id')} and explain the cause. Then call fleet_fix on it. "
                   "Report the firewall decision (APPROVE or BLOCK), how many failures the rule fixed and whether it "
                   "broke any passing run. Only recommend the rule if it was approved.")),
}


def list_prompts() -> list[dict]:
    return [{"name": name, **meta} for name, (meta, _) in PROMPTS.items()]


def get(name: str, arguments: dict) -> list[dict]:
    """The prompt's messages. KeyError if unknown; ValueError naming the required arguments that are missing."""
    meta, build = PROMPTS[name]
    missing = [a["name"] for a in meta["arguments"] if a.get("required") and not str(arguments.get(a["name"], "")).strip()]
    if missing:
        raise ValueError(f"/{name} needs: {', '.join(missing)} "
                         f"(e.g. /blackbox:{name} " + " ".join(f"<{m}>" for m in missing) + ")")
    return [{"role": "user", "content": {"type": "text", "text": build(arguments)}}]
