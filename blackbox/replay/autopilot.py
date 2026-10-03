"""Autopilot (USP X1): stop a run that is going wrong and retry the bad decision
before the agent gives its answer.

    pilot = Autopilot(check=check_step)                 # check_step: Aditya's step checker
    trace = run_task(agent, task, "agent-small", autopilot=pilot, store=store)
    trace.run.stats.get("autopilot_rescue")              # set when the autopilot took over

The checker is called synchronously after each step (the background monitor
keeps running separately). Its answer shape follows Laya/Jev's `answers`:

    {"answers": {"on_track":     {"type": "noul", "noul": 0.12, "confidence": 0.81},
                 "mistake_type": {"type": "choice", "choice": "wrong_fact", "confidence": 0.7, ...}},
     "tier": "laya"}

Alarm rule: P(on track) below `alarm_below` with confidence at least
`min_confidence`. The retry targets the *decision* behind the flagged step:
the step itself if it is a model call, otherwise its nearest model-call
ancestor in the who-used-what graph, re-asked with a stronger model.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from blackbox.core.schema import Change, Run, Step
from blackbox.recorder.context import AutopilotRewind

StepCheck = Callable[[Step, Run, list[Step]], dict | None]


def _answer(answers: dict | None, key: str) -> dict:
    if not answers or "error" in answers:
        return {}
    got = (answers.get("answers") or answers).get(key)
    return got if isinstance(got, dict) else {}


def on_track(answers: dict | None) -> tuple[float | None, float | None]:
    a = _answer(answers, "on_track")
    return a.get("noul", a.get("p")), a.get("confidence")


def decision_step(steps: list[Step], idx: int) -> int:
    """The model call that led to step idx (itself if it is one)."""
    seen, frontier = set(), [idx]
    while frontier:
        i = frontier.pop(0)
        if i in seen:
            continue
        seen.add(i)
        if steps[i].kind == "llm":
            return i
        frontier.extend(sorted(steps[i].parents, reverse=True))
    for i in range(idx, -1, -1):  # no data-flow link: the latest model call before it
        if steps[i].kind == "llm":
            return i
    return idx


@dataclass
class Autopilot:
    check: StepCheck
    strong_model: str = "agent-strong"
    alarm_below: float = 0.3
    min_confidence: float = 0.6
    max_rewinds: int = 2
    log: list[dict[str, Any]] = field(default_factory=list)

    def inspect(self, step: Step, run: Run, steps: list[Step]) -> AutopilotRewind | None:
        if len(self.log) >= self.max_rewinds:
            return None
        answers = self.check(step, run, steps[: step.idx])
        p, conf = on_track(answers)
        if p is None or conf is None or p >= self.alarm_below or conf < self.min_confidence:
            return None
        target = decision_step(steps, step.idx)
        model_now = steps[target].request.get("model_id") if steps[target].kind == "llm" else None
        if model_now == self.strong_model:
            return None  # already the strongest option: report, don't loop
        change = Change(kind="model", value=self.strong_model, note=f"autopilot: step {step.idx} off track "
                        f"(p={p:.2f}, confidence={conf:.2f})") if steps[target].kind == "llm" else None
        self.log.append({"run_id": run.run_id, "flagged_step": step.idx, "target": target, "p_on_track": p,
                         "confidence": conf})
        return AutopilotRewind(step.idx, target, change, answers)
