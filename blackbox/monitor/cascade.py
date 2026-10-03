"""Three-tier cascade: Laya → Jev → LLM. SYSTEM.md §5, X3."""
from __future__ import annotations

import os

from blackbox.core.schema import Run, Step
from blackbox.monitor.state_builder import build_state

ALARM_THRESHOLD = float(os.environ.get("BLACKBOX_ALARM_THRESHOLD", "0.35"))
CONFIDENCE_THRESHOLD = float(os.environ.get("BLACKBOX_CONFIDENCE_THRESHOLD", "0.75"))
ESCALATE_THRESHOLD = float(os.environ.get("BLACKBOX_ESCALATE_THRESHOLD", "0.60"))


def check_step(step: Step, run: Run, prior: list[Step]) -> dict | None:
    """The monitor function for RunContext(monitor=check_step).
    Returns canonical dict or None. Never raises. CLAUDE.md rule 9.
    """
    if step.kind == "final":
        return None

    state = build_state(step, run, prior)
    result = _cascade(state)

    if result is None:
        return None

    on_p = result["on_track"]["prob"]
    on_c = result["on_track"]["confidence"]
    result["alarm"] = (on_p < ALARM_THRESHOLD) and (on_c > CONFIDENCE_THRESHOLD)
    result["alarm_lead_step"] = step.idx
    return result


def _cascade(state: str) -> dict | None:
    # ── Tier 1: Laya ──────────────────────────────────────────────────────────
    laya_result = None
    try:
        from blackbox.monitor.adapters import laya_adapter

        laya_result = laya_adapter.ask(state)
        if laya_adapter.overall_confidence(laya_result) >= ESCALATE_THRESHOLD:
            return laya_result
    except Exception:  # noqa: BLE001, S110
        pass

    # ── Tier 2: Jev (only if key is set) ─────────────────────────────────────
    try:
        from blackbox.monitor.adapters import jev_adapter

        if jev_adapter.is_available():
            jev_result = jev_adapter.ask(state)
            if jev_adapter.overall_confidence(jev_result) >= ESCALATE_THRESHOLD:
                return jev_result
            laya_result = jev_result  # use Jev result if LLM also fails
    except Exception:  # noqa: BLE001, S110
        pass

    # ── Tier 3: LLM fallback ──────────────────────────────────────────────────
    try:
        from blackbox.monitor.adapters import llm_adapter

        return llm_adapter.ask(state)
    except Exception:  # noqa: BLE001, S110
        pass

    return laya_result  # best we have (possibly None)
