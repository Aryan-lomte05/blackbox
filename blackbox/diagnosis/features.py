"""Per-step feature extraction for the LightGBM ranker. SYSTEM.md §6.1.

LEAK RULES (CLAUDE.md):
- No latency_ms, tokens_in, tokens_out, cached — they correlate with position by design.
- No step.monitor (checker answers) in Variant A — those go in Variant B only.
- Everything fitted (scalers, embedding banks) is fit on TRAIN only, then applied to all splits.
"""
from __future__ import annotations

import re
from collections import defaultdict

from blackbox.core.schema import Run, Step

# ── helpers ───────────────────────────────────────────────────────────────────

_NUMBER_RE = re.compile(r"\b\d+(?:\.\d+)?\b")
_NAME_RE = re.compile(r"\b[A-Z][a-z]{2,}\b")  # proper-noun detector


def _text(step: Step) -> str:
    """Flatten request + output to one string for text analysis."""
    parts = [str(step.request)]
    if step.output:
        parts.append(str(step.output))
    return " ".join(parts)


def _input_text(step: Step) -> str:
    return str(step.request) if step.request else ""


def _output_text(step: Step) -> str:
    return str(step.output) if step.output else ""


def unsupported_facts(step: Step) -> int:
    """Count numbers/names in output that appear in NONE of step's inputs.

    SYSTEM.md §6.1: 'numbers or names in the output found in none of its inputs'.
    A fact is 'supported' if it appears verbatim in the request text.
    """
    out = _output_text(step)
    inp = _input_text(step)
    numbers = _NUMBER_RE.findall(out)
    names = _NAME_RE.findall(out)
    unsupported = sum(1 for tok in (numbers + names) if tok not in inp)
    return unsupported


def build_downstream_map(steps: list[Step]) -> dict[int, list[int]]:
    """For each step idx, which later steps list it in .parents?"""
    ds: dict[int, list[int]] = defaultdict(list)
    for s in steps:
        for p in s.parents:
            ds[p].append(s.idx)
    return ds


def answer_depends_on(step: Step, steps: list[Step]) -> bool:
    """Does the final-answer step (kind='final') have this step in its ancestry?"""
    final = next((s for s in steps if s.kind == "final"), None)
    if final is None:
        return False
    # BFS backwards through parents
    visited = set()
    frontier = set(final.parents)
    while frontier:
        if step.idx in frontier:
            return True
        visited |= frontier
        next_frontier: set[int] = set()
        for idx in frontier:
            if idx < len(steps):
                next_frontier |= set(steps[idx].parents) - visited
        frontier = next_frontier
    return False


# ── main feature builder ───────────────────────────────────────────────────────

FEATURE_NAMES_STRUCTURAL = [
    # position
    "step_idx",
    "step_position_frac",      # idx / (n_steps - 1)
    "steps_remaining",         # n_steps - 1 - idx (excluding final)
    # step type (one-hot: llm, tool, retrieval, state)
    "kind_llm",
    "kind_tool",
    "kind_retrieval",
    "kind_state",
    # error / output quality
    "has_error",
    "output_empty",
    "unsupported_facts",       # numbers/names in output not in input
    # data-flow
    "n_downstream_steps",      # how many later steps used this step's output
    # FIX: replaced binary answer_depends_on_step (collapses to 1.0 for all steps in
    # ops/shop runs, causing model to rank guilty last → Top-1 0.042 on shop).
    # fraction_downstream stays discriminative across all task families.
    "fraction_downstream",     # n_downstream / max(1, steps_remaining)
    "n_parents",               # how many parent steps fed into this one
    # memory
    "memory_changed",          # len(step.writes) > 0 or state_diff present
    "n_keys_written",
    # monitor features (Variant B only — -1.0 if not available)
    "monitor_consistent_prob",
    "monitor_on_track_prob",
    "monitor_on_track_drop",   # on_track[i] - on_track[i-1] (negative = drop)
    "monitor_mistake_type_none_prob",
    "monitor_severity_will_derail",
    "monitor_confidence",
]

FEATURE_NAMES_STRUCTURAL_ONLY = FEATURE_NAMES_STRUCTURAL[:15]  # first 15, no monitor
FEATURE_NAMES_WITH_MONITOR = FEATURE_NAMES_STRUCTURAL          # all 21


def extract_features(
    step: Step,
    run: Run,
    all_steps: list[Step],
    *,
    include_monitor: bool = False,
    oddness_score: float | None = None,
) -> list[float]:
    """Extract one feature row for a single step.

    Args:
        step: the step to featurise
        run: the run it belongs to
        all_steps: all steps of the run (needed for data-flow features)
        include_monitor: if True, include checker answer features (Variant B)
        oddness_score: pre-computed embedding distance from passing runs (optional)

    Returns:
        list[float] — length 14 (FEATURE_NAMES_STRUCTURAL_ONLY)
        or 20 (FEATURE_NAMES_WITH_MONITOR) depending on include_monitor.
        Missing monitor values -> -1.0 (LightGBM handles natively as missing).
    """
    n = len(all_steps)
    ds_map = build_downstream_map(all_steps)

    kind = step.kind
    n_downstream = len(ds_map.get(step.idx, []))
    steps_remaining = max(1, n - 1 - step.idx)
    row: list[float] = [
        # position
        float(step.idx),
        float(step.idx) / max(1, n - 1),
        float(max(0, n - 1 - step.idx)),
        # step type
        1.0 if kind == "llm" else 0.0,
        1.0 if kind == "tool" else 0.0,
        1.0 if kind in ("retrieval", "search") else 0.0,
        1.0 if kind in ("state", "memory") else 0.0,
        # error / output quality
        1.0 if step.error else 0.0,
        1.0 if not step.output else 0.0,
        float(unsupported_facts(step)),
        # data-flow — fraction_downstream replaces binary answer_depends_on_step
        # (binary collapses to 1.0 for all steps in ops/shop, causing model to rank guilty last)
        float(n_downstream),
        float(n_downstream) / float(steps_remaining),  # fraction_downstream
        float(len(step.parents)),                       # n_parents
        # memory
        1.0 if (step.writes or getattr(step, "state_diff", None)) else 0.0,
        float(len(step.writes)) if step.writes else 0.0,
    ]

    if include_monitor:
        m = step.monitor or {}
        answers = m.get("answers", m) if isinstance(m, dict) else {}

        # consistent
        c_item = answers.get("consistent", {}) if isinstance(answers, dict) else {}
        con_p = c_item.get("prob", c_item.get("noul", -1.0)) if isinstance(c_item, dict) else -1.0

        # on_track
        o_item = answers.get("on_track", {}) if isinstance(answers, dict) else {}
        otp = o_item.get("prob", o_item.get("noul", -1.0)) if isinstance(o_item, dict) else -1.0

        # on_track drop from previous step
        prev = all_steps[step.idx - 1] if step.idx > 0 else None
        prev_m = (prev.monitor or {}) if prev else {}
        prev_answers = prev_m.get("answers", prev_m) if isinstance(prev_m, dict) else {}
        prev_o = prev_answers.get("on_track", {}) if isinstance(prev_answers, dict) else {}
        prev_otp = prev_o.get("prob", prev_o.get("noul", -1.0)) if isinstance(prev_o, dict) else -1.0

        otp_drop = (otp - prev_otp) if (otp >= 0 and prev_otp >= 0) else 0.0

        # mistake_type
        mt = answers.get("mistake_type", {}) if isinstance(answers, dict) else {}
        mt_probs = mt.get("probabilities", mt) if isinstance(mt, dict) else {}
        none_p = mt_probs.get("none", -1.0) if isinstance(mt_probs, dict) else -1.0

        # severity
        sev = answers.get("severity", {}) if isinstance(answers, dict) else {}
        sev_probs = sev.get("probabilities", sev) if isinstance(sev, dict) else {}
        will_derail_p = sev_probs.get("will_derail", -1.0) if isinstance(sev_probs, dict) else -1.0

        # confidence
        conf = m.get("mistake_type_confidence", -1.0) if isinstance(m, dict) else -1.0
        if conf < 0 and isinstance(o_item, dict):
            conf = o_item.get("confidence", -1.0)

        row += [
            float(con_p),
            float(otp),
            float(otp_drop),
            float(none_p),
            float(will_derail_p),
            float(conf),
        ]

    return row
