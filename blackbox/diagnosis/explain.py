"""SHAP evidence sentences for each suspect. SYSTEM.md §6.1, USP U12.

Top 3 reasons per suspect written as plain English sentences.
"""
from __future__ import annotations

import lightgbm as lgb
import numpy as np
import shap

from blackbox.core.schema import Run, Step
from blackbox.diagnosis.features import extract_features

SENTENCE_TEMPLATES = {
    "has_error": "The step raised an error.",
    "output_empty": "The step produced no output.",
    "unsupported_facts": "The output contains {value:.0f} number(s) or name(s) that appear in none of its inputs.",
    "n_downstream_steps": "The output of this step was used by {value:.0f} later steps.",
    "answer_depends_on_step": "The final answer traces back through this step.",
    "memory_changed": "This step wrote to agent memory.",
    "monitor_on_track_drop": "The on-track probability dropped by {drop:.2f} at this step.",
    "monitor_consistent_prob": "The checker rated this step as {pct:.0f}% consistent with its inputs.",
    "monitor_severity_will_derail": "The checker estimates {pct:.0f}% chance this will derail the run.",
}


def shap_sentences(
    model: lgb.Booster,
    step: Step,
    run: Run,
    all_steps: list[Step],
    feature_names: list[str],
    include_monitor: bool = False,
    top_n: int = 3,
) -> list[str]:
    """Return top_n SHAP-driven plain-language sentences explaining why this step is ranked as suspect."""
    row = extract_features(step, run, all_steps, include_monitor=include_monitor)
    X = np.array([row], dtype=np.float32)

    try:
        explainer = shap.TreeExplainer(model)
        raw_shap = explainer.shap_values(X)
        shap_vals = raw_shap[0]
        if hasattr(shap_vals, "ndim") and shap_vals.ndim > 1:
            shap_vals = shap_vals[0]
        top_idxs = np.argsort(np.abs(shap_vals))[::-1][:top_n]
    except Exception:  # noqa: BLE001
        # Fallback if tree explainer fails
        top_idxs = np.arange(min(top_n, len(feature_names)))
        shap_vals = np.zeros(len(feature_names))

    sentences: list[str] = []
    for i in top_idxs:
        fname = feature_names[i]
        fval = row[i]
        tmpl = SENTENCE_TEMPLATES.get(fname)
        if tmpl:
            try:
                sentences.append(
                    tmpl.format(
                        value=fval,
                        pct=fval * 100,
                        drop=-fval if fval < 0 else fval,
                        state=fval,
                    )
                )
            except Exception:  # noqa: BLE001
                sentences.append(f"{fname} = {fval:.3f} (SHAP: {shap_vals[i]:+.3f})")
        else:
            sentences.append(f"{fname} = {fval:.3f} (SHAP: {shap_vals[i]:+.3f})")

    return sentences
