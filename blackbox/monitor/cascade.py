"""Three-tier cascade: Laya → Jev → LLM. SYSTEM.md §5, X3."""
from __future__ import annotations

import json
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
    head = _checker_head()
    if head is not None:  # the fine-tuned decision layer (monitor/finetune.py), opt-in
        from blackbox.monitor.finetune import features, predict

        x = features(result, step.kind)
        if x is not None:
            result["risk"] = round(predict(head, x), 4)
            result["alarm"] = result["risk"] >= head["threshold"]
            result["alarm_source"] = "fine-tuned head"

    # Canonical nested 'answers' dict for Laya/Jev/Autopilot compatibility
    m_choice = "none"
    if result.get("mistake_type"):
        m_choice = max(result["mistake_type"], key=result["mistake_type"].get)
    s_score = "harmless"
    if result.get("severity"):
        s_score = max(result["severity"], key=result["severity"].get)

    result["answers"] = {
        "consistent": {
            "type": "noul",
            "noul": result["consistent"]["prob"],
            "prob": result["consistent"]["prob"],
            "confidence": result["consistent"]["confidence"],
        },
        "on_track": {
            "type": "noul",
            "noul": result["on_track"]["prob"],
            "prob": result["on_track"]["prob"],
            "confidence": result["on_track"]["confidence"],
        },
        "mistake_type": {
            "type": "choice",
            "choice": m_choice,
            "probabilities": result["mistake_type"],
            "confidence": result.get("mistake_type_confidence", 0.5),
        },
        "severity": {
            "type": "score",
            "score": s_score,
            "probabilities": result["severity"],
            "confidence": result.get("severity_confidence", 0.5),
        },
    }
    return result


def _cascade(state: str) -> dict | None:
    tier_errors: dict[str, str] = {}

    # ── Tier 1: Laya ──────────────────────────────────────────────────────────
    laya_result = None
    try:
        from blackbox.monitor.adapters import laya_adapter

        laya_result = laya_adapter.ask(state)
        if laya_adapter.overall_confidence(laya_result) >= ESCALATE_THRESHOLD:
            return laya_result
        # Low confidence — escalate but keep result as fallback
    except Exception as exc:  # noqa: BLE001
        tier_errors["laya"] = f"{type(exc).__name__}: {exc}"

    # ── Tier 2: Jev (only if key is set) ─────────────────────────────────────
    try:
        from blackbox.monitor.adapters import jev_adapter

        if jev_adapter.is_available():
            jev_result = jev_adapter.ask(state)
            if jev_adapter.overall_confidence(jev_result) >= ESCALATE_THRESHOLD:
                return jev_result
            laya_result = jev_result  # keep as best-so-far even if low-confidence
        else:
            tier_errors["jev"] = "TYPESAFE_API_KEY not set"
    except Exception as exc:  # noqa: BLE001
        tier_errors["jev"] = f"{type(exc).__name__}: {exc}"

    # ── Tier 3: LLM fallback (Ollama first, then Groq) ────────────────────────
    # Ollama is always available locally; Groq needs keys.
    for llm_model in ("agent-local", "monitor-llm"):
        try:
            from blackbox.monitor.adapters import llm_adapter

            result = llm_adapter.ask(state, model_id=llm_model)
            if tier_errors:
                import sys
                print(
                    f"[monitor] tier_errors={tier_errors}; answered by llm/{llm_model}",
                    file=sys.stderr,
                )
            return result
        except Exception as exc:  # noqa: BLE001
            tier_errors[f"llm/{llm_model}"] = f"{type(exc).__name__}: {exc}"

    # All tiers failed
    import sys
    print(f"[monitor] all tiers failed: {tier_errors}", file=sys.stderr)

    if laya_result is not None:
        laya_result["tier_errors"] = tier_errors
        return laya_result  # best we have (low-confidence Laya)

    return None


def _checker_head() -> dict | None:
    """The fine-tuned decision layer when BLACKBOX_CHECKER_HEAD=1 and data/models/checker_head.json exists.
    Off by default: on the held-out Shop tasks it ranks worse than the hand-set rule (see monitor/finetune.py)."""
    if os.environ.get("BLACKBOX_CHECKER_HEAD") != "1":
        return None
    from blackbox.monitor.finetune import HEAD_PATH

    try:
        return json.loads(HEAD_PATH.read_text(encoding="utf-8")) if HEAD_PATH.exists() else None
    except (OSError, ValueError):
        return None
