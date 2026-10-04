"""diagnose(trace) -> {scores, suspects, evidence}. SYSTEM.md §6.1.
Hand-off #7 to Aryan for the API (blackbox.api.main).
"""
from __future__ import annotations

from collections import defaultdict, deque
from pathlib import Path

import lightgbm as lgb
import numpy as np

from blackbox.core.schema import Trace
from blackbox.diagnosis.embeddings import OddnessBank
from blackbox.diagnosis.explain import shap_sentences
from blackbox.diagnosis.features import FEATURE_NAMES_STRUCTURAL_ONLY, extract_features

from blackbox.core.store import DEFAULT_DIR

MODEL_DIR = DEFAULT_DIR / "models"  # data/models (gitignored); weights come from the GitHub release

_model_A: lgb.Booster | None = None
_bank: OddnessBank | None = None
_k: int | None = None


def _load():
    global _model_A, _bank, _k
    if _model_A is None:
        model_file = MODEL_DIR / "ranker_A.pkl"
        if not model_file.exists():
            return False
        # ranker.py saves the Booster with pickle; LightGBM's own text format is accepted too.
        # (Loading it only as text failed on every real machine: "Unknown model format".)
        try:
            _model_A = lgb.Booster(model_file=str(model_file))
        except lgb.basic.LightGBMError:
            import pickle

            with open(model_file, "rb") as fh:  # our own trained file, from data/models
                _model_A = pickle.load(fh)
        bank_file = MODEL_DIR / "oddness_bank.pkl"
        if bank_file.exists():
            try:
                _bank = OddnessBank.load(bank_file)
            except Exception:  # noqa: BLE001
                _bank = None
        else:
            _bank = None
        kf = MODEL_DIR / "k.txt"
        _k = int(kf.read_text().strip()) if kf.exists() else 3
    return True


def diagnose(trace: Trace) -> dict:
    """Score all steps of a failed run and return ranked suspects with evidence.

    Returns:
        {
          "scores": [{"step_idx": int, "score": float, "idx": int, "p": float, "rank": int}, ...],
          "suspects": [int, ...],          # top-k step indices (conformal list)
          "evidence": {                    # per suspect
              step_idx: {
                "shap_sentences": [str, ...],
                "checker_summary": str,    # brief from monitor dict
                "trail_to_answer": [int, ...],  # step indices from suspect to final
              }
          },
          "coverage": 0.9,
        }
    """
    has_model = _load()
    steps = [s for s in trace.steps if s.kind != "final"]
    if not steps:
        return {"scores": [], "suspects": [], "evidence": {}, "coverage": 0.9}

    if not has_model or _model_A is None:
        # Fallback to positional heuristic if models haven't been trained yet
        from blackbox.replay.verify import suspects_by_position

        order = suspects_by_position(trace)
        top = order[:3]
        return {
            "scores": [{"step_idx": idx, "score": 1.0 / (i + 1), "idx": idx, "p": 1.0 / (i + 1), "rank": i + 1} for i, idx in enumerate(order)],
            "suspects": top,
            "evidence": {idx: {"shap_sentences": ["Ranked by fallback order: errors first, then model calls latest-first."], "checker_summary": "no checker data", "trail_to_answer": _trail_to_answer(idx, trace.steps)} for idx in top},
            "coverage": 0.9,
        }

    k_val = _k if _k is not None else 3
    rows = [
        extract_features(
            s,
            trace.run,
            trace.steps,
            include_monitor=False,
            oddness_score=_bank.score(s) if _bank else 1.0,
        )
        for s in steps
    ]
    X = np.array(rows, dtype=np.float32)
    raw_scores = _model_A.predict(X)

    scored = sorted(
        zip([s.idx for s in steps], raw_scores),
        key=lambda x: x[1],
        reverse=True,
    )
    suspects = [idx for idx, _ in scored[:k_val]]

    evidence = {}
    for sidx in suspects:
        s = trace.steps[sidx]
        sents = shap_sentences(
            _model_A,
            s,
            trace.run,
            trace.steps,
            FEATURE_NAMES_STRUCTURAL_ONLY,
            include_monitor=False,
        )
        # Trail: BFS from suspect to final answer step
        trail = _trail_to_answer(sidx, trace.steps)
        # Checker summary
        m = s.monitor or {}
        answers = m.get("answers", m) if isinstance(m, dict) else {}
        o_dict = answers.get("on_track", {}) if isinstance(answers, dict) else {}
        otp = o_dict.get("prob", o_dict.get("noul")) if isinstance(o_dict, dict) else None
        checker_sum = f"on_track={otp:.2f}" if otp is not None else "no checker data"

        evidence[sidx] = {
            "shap_sentences": sents,
            "checker_summary": checker_sum,
            "trail_to_answer": trail,
        }

    return {
        "scores": [
            {
                "step_idx": idx,
                "score": float(sc),
                "idx": idx,
                "p": float(sc),
                "rank": r,
            }
            for r, (idx, sc) in enumerate(scored, 1)
        ],
        "suspects": suspects,
        "evidence": evidence,
        "coverage": 0.9,
    }


def _trail_to_answer(start_idx: int, steps: list) -> list[int]:
    """BFS forward from start_idx to final step through data-flow."""
    final_idx = next((s.idx for s in steps if s.kind == "final"), None)
    if final_idx is None:
        return [start_idx]

    ds: dict[int, list[int]] = defaultdict(list)
    for s in steps:
        for p in s.parents:
            ds[p].append(s.idx)

    visited = {start_idx}
    q: deque[list[int]] = deque([[start_idx]])
    while q:
        p = q.popleft()
        cur = p[-1]
        if cur == final_idx:
            return p
        for nxt in ds.get(cur, []):
            if nxt not in visited:
                visited.add(nxt)
                q.append(p + [nxt])

    return [start_idx]
