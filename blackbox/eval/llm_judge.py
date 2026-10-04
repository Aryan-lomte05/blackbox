"""LLM-judge baseline: ask a large model which step caused the failure.

Two prompts, after the Who&When paper:

    all_at_once    the whole run in one prompt; the model names the step
    step_by_step   the run is revealed one step at a time; the model says
                   yes/no "is the decisive mistake in this step?"; the first
                   yes wins

The judge sees the task and the steps, and is told the run failed. It is not
shown the expected answer, the planted mistake, or which steps were re-used.

Every answer is cached in data/reports/judge_cache.json (key: method, model,
run), so re-running the report costs nothing for runs already judged.
"""

from __future__ import annotations

import json
import re
import threading
from pathlib import Path
from typing import Any

from blackbox.core.schema import Step, Trace
from blackbox.eval.metrics import candidates
from blackbox.recorder import providers

STEP_CHARS = 420
RUN_CHARS = 12000  # budget for the steps of one run in one prompt
STEP_BY_STEP_MAX_STEPS = 20  # one call per step, each showing the run so far: quadratic in run length
STEP_BY_STEP_WINDOW = 8  # steps shown in full; earlier ones are cut to one line
METHODS = ("all_at_once", "step_by_step")

ALL_AT_ONCE_SYSTEM = (
    "You are debugging a failed run of an AI agent. The run is a numbered list of steps. "
    "Find the decisive mistake: the earliest step whose error caused the final failure. "
    "Give up to three step numbers, most likely first.\n"
    "Reply in exactly this format:\nSTEPS: <n>, <n>, <n>\nREASON: <one sentence>"
)
STEP_BY_STEP_SYSTEM = (
    "You are debugging a failed run of an AI agent, one step at a time. You see the task and the "
    "steps so far. Decide whether the LAST step shown contains the decisive mistake that makes the "
    "run fail. Reply with exactly one word: YES or NO."
)

_lock = threading.Lock()


def _short(value: Any, limit: int = STEP_CHARS) -> str:
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, default=str)
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 3] + "..."


def render_step(step: Step, limit: int = STEP_CHARS) -> str:
    """One step as the judge sees it: what was asked and what came back."""
    if step.kind == "llm":
        messages = step.request.get("messages") or []
        asked = messages[-1].get("content", "") if messages else f"(turn by {step.name})"
        got = (step.output or {}).get("text", "")
    elif step.kind in ("tool", "retrieval"):
        args = {k: v for k, v in (step.request.get("args") or {}).items() if not isinstance(v, dict)}
        asked = f"{step.name}({_short(args, 160)})"
        out = step.output or {}
        got = out.get("docs", out.get("result"))
        if isinstance(got, dict):
            got = {k: v for k, v in got.items() if k != "db"}
    else:
        asked, got = step.request, step.output
    line = (f"Step {step.idx} [{step.kind}:{step.node or step.name}]\n"
            f"  asked: {_short(asked, limit)}\n  got: {_short(got, limit)}")
    return line + (f"\n  error: {_short(step.error, 160)}" if step.error else "")


def step_limit(n_steps: int) -> int:
    """Characters per field so a whole run fits one prompt: long runs get shorter steps."""
    return max(100, min(STEP_CHARS, RUN_CHARS // max(1, 2 * n_steps)))


def render_task(trace: Trace) -> str:
    task = trace.run.task_input
    return _short(task.get("question") or task.get("request") or task, 600)


def available(model_id: str) -> str | None:
    """None if the judge model can be called, else the reason it cannot."""
    try:
        cfg = providers.model_config(model_id)
        if model_id not in providers._fakes:  # noqa: SLF001 - same module family
            providers._keys_for(cfg.provider)  # noqa: SLF001
    except (KeyError, RuntimeError) as exc:
        return str(exc)
    return None


class Judge:
    def __init__(self, model_id: str = "judge-large", cache_path: Path | None = None):
        self.model_id = model_id
        self.cache_path = cache_path
        self.cache: dict[str, list[int]] = {}
        self.calls = 0
        if cache_path is not None and cache_path.exists():
            self.cache = json.loads(cache_path.read_text(encoding="utf-8"))

    def save(self) -> None:
        if self.cache_path is not None:
            self.cache_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.cache_path.with_suffix(".tmp")
            tmp.write_text(json.dumps(self.cache), encoding="utf-8")
            tmp.replace(self.cache_path)

    def _ask(self, system: str, user: str, max_tokens: int) -> str:
        with _lock:
            self.calls += 1
        return providers.chat(self.model_id, [{"role": "system", "content": system},
                                              {"role": "user", "content": user}], max_tokens=max_tokens).text

    def rank(self, trace: Trace, method: str) -> list[int] | None:
        """The judge's ranking, or None when this method does not take on this run
        (step_by_step on a run longer than STEP_BY_STEP_MAX_STEPS)."""
        if method == "step_by_step" and len(candidates(trace)) > STEP_BY_STEP_MAX_STEPS:
            return None
        key = f"{method}:{self.model_id}:{trace.run.run_id}"
        if key not in self.cache:
            fn = {"all_at_once": self._all_at_once, "step_by_step": self._step_by_step}[method]
            self.cache[key] = fn(trace)
        return self.cache[key]

    def _all_at_once(self, trace: Trace) -> list[int]:
        cand = candidates(trace)
        limit = step_limit(len(cand))
        steps = "\n".join(render_step(trace.steps[i], limit) for i in cand)
        text = self._ask(ALL_AT_ONCE_SYSTEM, f"Task: {render_task(trace)}\n\nThe run FAILED. Steps:\n{steps}", 120)
        return parse_steps(text, cand)

    def _step_by_step(self, trace: Trace) -> list[int]:
        cand = candidates(trace)
        for n, i in enumerate(cand):
            old, recent = cand[: max(0, n + 1 - STEP_BY_STEP_WINDOW)], cand[max(0, n + 1 - STEP_BY_STEP_WINDOW): n + 1]
            shown = [render_step(trace.steps[j], 100) for j in old] + [render_step(trace.steps[j]) for j in recent]
            text = self._ask(STEP_BY_STEP_SYSTEM,
                             f"Task: {render_task(trace)}\n\nThe run will FAIL. Steps so far:\n" + "\n".join(shown), 8)
            if re.search(r"\byes\b", text, re.IGNORECASE):
                return [i]
        return []  # the judge blamed no step: scored as a miss, not replaced by a guess


def parse_steps(text: str, cand: list[int]) -> list[int]:
    """Step numbers from the judge's reply, in its order, without repeats or steps that do not exist."""
    match = re.search(r"STEPS?\s*[:=]\s*(.*)", text or "", re.IGNORECASE)
    numbers = re.findall(r"\d+", match.group(1) if match else (text or ""))
    out: list[int] = []
    for n in numbers:
        if int(n) in cand and int(n) not in out:
            out.append(int(n))
    return out[:3]
