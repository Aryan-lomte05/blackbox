"""Diagnosis entry point for blackbox.api.main and replay.verify.

SYSTEM.md §6.1, ASSIGNMENTS.md row 7 (Hand-off #7 to Aryan).
"""
from __future__ import annotations

from pathlib import Path

MODEL_DIR = Path("models")

# Guard import: if ranker_A.pkl is not trained yet, raise ImportError
# so that blackbox.api.main falls back honestly as designed until trained.
if not (MODEL_DIR / "ranker_A.pkl").exists():
    raise ImportError(
        f"Ranker model not found at {MODEL_DIR / 'ranker_A.pkl'}. "
        "Run `python -m blackbox.diagnosis.ranker` to train it."
    )

from blackbox.diagnosis.diagnose import diagnose

__all__ = ["diagnose"]
