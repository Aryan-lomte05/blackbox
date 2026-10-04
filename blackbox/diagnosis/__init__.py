"""Diagnosis: which step caused a failure.

Two learned models live here: the graph-feature model (gnn.py, graph_data.py, evidence.py; Aryan) and the
LightGBM ranker (ranker.py, features.py, diagnose.py, conformal.py; Aditya). Exports are lazy so that
importing one model never requires the other's dependencies (e.g. lightgbm).
"""
from __future__ import annotations

__all__ = ["diagnose", "extract_features", "FEATURE_NAMES_STRUCTURAL", "FEATURE_NAMES_STRUCTURAL_ONLY",
           "FEATURE_NAMES_WITH_MONITOR"]


def __getattr__(name: str):
    if name == "diagnose":
        from blackbox.diagnosis.diagnose import diagnose

        return diagnose
    if name in __all__:
        from blackbox.diagnosis import features

        return getattr(features, name)
    raise AttributeError(name)
