"""Build the text context fed to Laya/Jev/LLM for each step. SYSTEM.md §5."""
from __future__ import annotations

import json

from blackbox.core.schema import Run, Step

_MAX_OUTPUT_CHARS = 800
_MAX_PRIOR_STEPS = 4


def build_state(step: Step, run: Run, prior: list[Step]) -> str:
    lines: list[str] = []

    lines.append(f"TASK: {_format_task(run)}")

    parent_steps = [p for p in prior if p.idx in step.parents][-_MAX_PRIOR_STEPS:]
    if parent_steps:
        lines.append("\nRELEVANT PRIOR STEPS:")
        for p in parent_steps:
            lines.append(_format_step_summary(p))

    lines.append(f"\nCURRENT STEP (step {step.idx}, kind={step.kind}, name={step.name}):")
    lines.append(f"  REQUEST: {_trunc(json.dumps(step.request, ensure_ascii=False))}")
    if step.output is not None:
        lines.append(f"  OUTPUT:  {_trunc(json.dumps(step.output, ensure_ascii=False))}")
    if step.error:
        lines.append(f"  ERROR:   {step.error}")

    return "\n".join(lines)


def _format_task(run: Run) -> str:
    inp = run.task_input
    for key in ("question", "problem", "task", "description"):
        if key in inp:
            return str(inp[key])[:400]
    return _trunc(json.dumps(inp, ensure_ascii=False), 400)


def _format_step_summary(step: Step) -> str:
    out = _trunc(json.dumps(step.output, ensure_ascii=False)) if step.output else ""
    return f"  [step {step.idx}] {step.kind}/{step.name}: {out}"


def _trunc(text: str, limit: int = _MAX_OUTPUT_CHARS) -> str:
    return text if len(text) <= limit else text[:limit] + "…"
