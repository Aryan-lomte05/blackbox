"""LLM fallback — Groq via providers.chat(). SYSTEM.md §5."""
from __future__ import annotations

import json
import os
import time

from blackbox.monitor.questions import QUESTION_TEXT

_MISTAKE_KEYS = list(QUESTION_TEXT["mistake_type"][2].keys())
_SEVERITY_KEYS = QUESTION_TEXT["severity"][2]

_SYSTEM = (
    "You are a step-checker for AI agent runs. Given the task description and a single step, "
    "answer in JSON with this exact schema:\n"
    '{"consistent": <float 0-1>, "on_track": <float 0-1>, '
    '"mistake_type": <one of: ' + "|".join(_MISTAKE_KEYS) + ">, "
    '"severity": <one of: ' + "|".join(_SEVERITY_KEYS) + ">}\n"
    "Reply ONLY with valid JSON. No explanation."
)


def ask(state: str) -> dict:
    from blackbox.recorder import providers

    model_id = os.environ.get("BLACKBOX_MONITOR_LLM_MODEL", "monitor-llm")
    if model_id not in providers.registry():
        model_id = "agent-small" if "agent-small" in providers.registry() else model_id

    messages = [{"role": "system", "content": _SYSTEM}, {"role": "user", "content": state}]

    t0 = time.perf_counter()
    res = providers.chat(model_id, messages)
    latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    raw = res.text.strip()
    if raw.startswith("```"):
        raw = "\n".join(raw.split("\n")[1:]).rstrip("`").strip()

    parsed = json.loads(raw)  # raises on bad JSON -> caller handles
    consistent_p = float(parsed.get("consistent", 0.5))
    on_track_p = float(parsed.get("on_track", 0.5))
    mt = str(parsed.get("mistake_type", "none"))
    sev = str(parsed.get("severity", "harmless"))

    n = max(1, len(_MISTAKE_KEYS) - 1)
    mt_probs = {k: (0.85 if k == mt else 0.15 / n) for k in _MISTAKE_KEYS}
    sev_probs = {k: (0.85 if k == sev else 0.05) for k in _SEVERITY_KEYS}

    return {
        "consistent": {"prob": consistent_p, "noul": consistent_p, "confidence": 0.70},
        "on_track": {"prob": on_track_p, "noul": on_track_p, "confidence": 0.70},
        "mistake_type": mt_probs,
        "mistake_type_confidence": 0.70,
        "severity": sev_probs,
        "severity_confidence": 0.70,
        "tier": "llm",
        "latency_ms": latency_ms,
    }


def overall_confidence(result: dict) -> float:
    from blackbox.monitor.adapters.laya_adapter import overall_confidence as _oc

    return _oc(result)
