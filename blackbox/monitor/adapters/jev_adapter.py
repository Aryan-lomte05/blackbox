"""Jev adapter — TypeSafe AI. Only used when TYPESAFE_API_KEY is set. SYSTEM.md §5."""
from __future__ import annotations

import os
import time
from functools import lru_cache

from blackbox.monitor.questions import QUESTION_TEXT, _build_jev_questions


@lru_cache(maxsize=1)
def _client():
    try:
        from typesafe_sdk import TypeSafeClient
    except ImportError as e:
        raise ImportError("pip install typesafe-sdk") from e
    key = os.environ.get("TYPESAFE_API_KEY", "")
    if not key:
        raise RuntimeError("TYPESAFE_API_KEY not set")
    return TypeSafeClient(api_key=key)


@lru_cache(maxsize=1)
def _questions():
    return _build_jev_questions()


def is_available() -> bool:
    return bool(os.environ.get("TYPESAFE_API_KEY", ""))


def ask(state: str) -> dict:
    """Return canonical monitor dict with tier='jev'. Raises on failure."""
    cl = _client()
    qs = _questions()

    t0 = time.perf_counter()
    res = cl.system_one(state=state, questions=qs)
    latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    answers = getattr(res, "answers", res)
    if isinstance(answers, dict) and "answers" in answers:
        answers = answers["answers"]

    out: dict = {"tier": "jev", "latency_ms": latency_ms}

    # Consistent
    ans_c = answers.get("consistent") if isinstance(answers, dict) else getattr(answers, "consistent", None)
    prob_c = float(getattr(ans_c, "noul", None) or (ans_c.get("noul") if isinstance(ans_c, dict) else 0.5))
    conf_c = float(getattr(ans_c, "confidence", None) or (ans_c.get("confidence") if isinstance(ans_c, dict) else 0.5))
    out["consistent"] = {"prob": prob_c, "noul": prob_c, "confidence": conf_c}

    # On track
    ans_o = answers.get("on_track") if isinstance(answers, dict) else getattr(answers, "on_track", None)
    prob_o = float(getattr(ans_o, "noul", None) or (ans_o.get("noul") if isinstance(ans_o, dict) else 0.5))
    conf_o = float(getattr(ans_o, "confidence", None) or (ans_o.get("confidence") if isinstance(ans_o, dict) else 0.5))
    out["on_track"] = {"prob": prob_o, "noul": prob_o, "confidence": conf_o}

    # Mistake type
    ans_m = answers.get("mistake_type") if isinstance(answers, dict) else getattr(answers, "mistake_type", None)
    m_probs = getattr(ans_m, "probabilities", None) or (ans_m.get("probabilities") if isinstance(ans_m, dict) else {})
    m_conf = float(getattr(ans_m, "confidence", None) or (ans_m.get("confidence") if isinstance(ans_m, dict) else 0.5))
    out["mistake_type"] = {str(k): float(v) for k, v in m_probs.items()}
    out["mistake_type_confidence"] = m_conf

    # Severity
    ans_s = answers.get("severity") if isinstance(answers, dict) else getattr(answers, "severity", None)
    s_probs = getattr(ans_s, "probabilities", None) or (ans_s.get("probabilities") if isinstance(ans_s, dict) else {})
    s_conf = float(getattr(ans_s, "confidence", None) or (ans_s.get("confidence") if isinstance(ans_s, dict) else 0.5))
    legend = getattr(ans_s, "legend", None) or (ans_s.get("legend") if isinstance(ans_s, dict) else {})

    severity_names = QUESTION_TEXT["severity"][2]
    sev_map: dict[str, float] = {}
    for k, v in s_probs.items():
        if str(k) in legend:
            label = str(legend[str(k)])
        elif isinstance(k, int) and 0 <= k < len(severity_names):
            label = severity_names[k]
        else:
            label = str(k)
        sev_map[label] = float(v)

    out["severity"] = sev_map if sev_map else {str(k): float(v) for k, v in s_probs.items()}
    out["severity_confidence"] = s_conf

    return out


def overall_confidence(result: dict) -> float:
    from blackbox.monitor.adapters.laya_adapter import overall_confidence as _oc

    return _oc(result)
