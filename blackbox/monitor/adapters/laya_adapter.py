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

    # Consistent — omit field if Laya didn't return it, never fabricate 0.5
    ans_c = answers.get("consistent")
    if ans_c is not None:
        prob_c = ans_c.get("noul") if ans_c.get("noul") is not None else ans_c.get("prob")
        conf_c = ans_c.get("confidence") if ans_c.get("confidence") is not None else ans_c.get("answer_confidence")
        entry: dict = {}
        if prob_c is not None:
            entry["prob"] = float(prob_c)
        if conf_c is not None:
            entry["confidence"] = float(conf_c)
        if entry:
            out["consistent"] = entry

    # On track
    ans_o = answers.get("on_track")
    if ans_o is not None:
        prob_o = ans_o.get("noul") if ans_o.get("noul") is not None else ans_o.get("prob")
        conf_o = ans_o.get("confidence") if ans_o.get("confidence") is not None else ans_o.get("answer_confidence")
        entry = {}
        if prob_o is not None:
            entry["prob"] = float(prob_o)
        if conf_o is not None:
            entry["confidence"] = float(conf_o)
        if entry:
            out["on_track"] = entry

    # Mistake type
    ans_m = answers.get("mistake_type")
    if ans_m is not None:
        m_probs = ans_m.get("probabilities") or ans_m.get("probs") or {}
        if m_probs:
            out["mistake_type"] = {str(k): float(v) for k, v in m_probs.items()}
        conf_m = ans_m.get("confidence")
        if conf_m is not None:
            out["mistake_type_confidence"] = float(conf_m)

    # Severity
    ans_s = answers.get("severity")
    if ans_s is not None:
        s_probs = ans_s.get("probabilities") or ans_s.get("probs") or {}
        legend = ans_s.get("legend", {})
        sev_map: dict[str, float] = {}
        for k, v in s_probs.items():
            label = legend.get(str(k), k)
            sev_map[str(label)] = float(v)
        if sev_map:
            out["severity"] = sev_map
        conf_s = ans_s.get("confidence")
        if conf_s is not None:
            out["severity_confidence"] = float(conf_s)

    return out


def overall_confidence(result: dict) -> float:
    return min(
        result["consistent"]["confidence"],
        result["on_track"]["confidence"],
        result.get("mistake_type_confidence", 1.0),
        result.get("severity_confidence", 1.0),
    )
