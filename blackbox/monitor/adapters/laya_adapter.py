"""Laya adapter — local open-source model. SYSTEM.md §5, X3."""
from __future__ import annotations

import time
from functools import lru_cache

from blackbox.monitor.questions import _build_laya_questions

LAYA_MODEL = "convaiinnovations/laya"


@lru_cache(maxsize=1)
def _client():
    try:
        import laya
    except ImportError as e:
        raise ImportError("pip install laya") from e
    return laya.load(LAYA_MODEL)


@lru_cache(maxsize=1)
def _questions() -> dict[str, dict]:
    return _build_laya_questions()


def ask(state: str) -> dict:
    """Return canonical monitor dict with tier='laya'. Raises on failure."""
    cl = _client()
    qs = _questions()

    t0 = time.perf_counter()
    res = cl.predict(state, qs)
    latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    answers = res.get("answers", res)
    out: dict = {"tier": "laya", "latency_ms": latency_ms}

    # Consistent
    ans_c = answers.get("consistent", {})
    prob_c = float(ans_c.get("noul", ans_c.get("prob", 0.5)))
    conf_c = float(ans_c.get("confidence", ans_c.get("answer_confidence", 0.5)))
    out["consistent"] = {"prob": prob_c, "noul": prob_c, "confidence": conf_c}

    # On track
    ans_o = answers.get("on_track", {})
    prob_o = float(ans_o.get("noul", ans_o.get("prob", 0.5)))
    conf_o = float(ans_o.get("confidence", ans_o.get("answer_confidence", 0.5)))
    out["on_track"] = {"prob": prob_o, "noul": prob_o, "confidence": conf_o}

    # Mistake type
    ans_m = answers.get("mistake_type", {})
    m_probs = ans_m.get("probabilities", ans_m.get("probs", {}))
    out["mistake_type"] = {str(k): float(v) for k, v in m_probs.items()}
    out["mistake_type_confidence"] = float(ans_m.get("confidence", 0.5))

    # Severity
    ans_s = answers.get("severity", {})
    s_probs = ans_s.get("probabilities", ans_s.get("probs", {}))
    legend = ans_s.get("legend", {})
    # Map index-based keys ("0", "1", ...) to criterion labels if legend present
    sev_map: dict[str, float] = {}
    for k, v in s_probs.items():
        label = legend.get(str(k), k)
        sev_map[str(label)] = float(v)
    out["severity"] = sev_map if sev_map else {str(k): float(v) for k, v in s_probs.items()}
    out["severity_confidence"] = float(ans_s.get("confidence", 0.5))

    return out


def overall_confidence(result: dict) -> float:
    return min(
        result["consistent"]["confidence"],
        result["on_track"]["confidence"],
        result.get("mistake_type_confidence", 1.0),
        result.get("severity_confidence", 1.0),
    )
