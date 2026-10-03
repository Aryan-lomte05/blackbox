"""Diagnosis and Root Cause Ranking module. SYSTEM.md §6.1, ASSIGNMENTS.md row 3 & 7.

Owner: Aditya
Exports:
    diagnose: top-level diagnosis function
    extract_features: per-step feature extractor
    OddnessBank: text embedding novelty bank
"""
from __future__ import annotations

from blackbox.diagnosis.diagnose import diagnose
from blackbox.diagnosis.features import (
    FEATURE_NAMES_STRUCTURAL,
    FEATURE_NAMES_STRUCTURAL_ONLY,
    FEATURE_NAMES_WITH_MONITOR,
    extract_features,
)

__all__ = [
    "FEATURE_NAMES_STRUCTURAL",
    "FEATURE_NAMES_STRUCTURAL_ONLY",
    "FEATURE_NAMES_WITH_MONITOR",
    "diagnose",
    "extract_features",
]
