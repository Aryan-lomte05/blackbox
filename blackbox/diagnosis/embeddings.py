"""Embedding-based oddness score: how different is this step from passing runs?

SYSTEM.md §6.1: 'nearest-neighbour distance on text embeddings from passing training runs'.
Model: BAAI/bge-small-en-v1.5 (384-dim, fast on CPU).
LEAK RULE: the 'bank' of passing steps is built on TRAIN split only.
"""
from __future__ import annotations

import json
import pickle
from pathlib import Path

import numpy as np

from blackbox.core.schema import Step

MODEL_ID = "BAAI/bge-small-en-v1.5"
_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(MODEL_ID)
    return _model


def embed_step(step: Step) -> np.ndarray:
    """Embed a step's text into a 384-dim vector."""
    text = f"[{step.kind}] {step.name}: {json.dumps(step.request, ensure_ascii=False)[:300]}"
    if step.output:
        text += f" -> {json.dumps(step.output, ensure_ascii=False)[:300]}"
    model = _get_model()
    return model.encode(text, normalize_embeddings=True)


class OddnessBank:
    """Stores per-kind embedding banks from PASSING training runs.
    Fit once on train, then score any step by its cosine distance to the
    nearest same-kind neighbour.
    """

    def __init__(self):
        # kind -> list of (384,) embeddings from passing training steps
        self.banks: dict[str, list[np.ndarray]] = {}

    def fit(self, passing_steps: list[Step]) -> None:
        """Call once with all steps from passing training runs."""
        from collections import defaultdict

        by_kind: dict[str, list[Step]] = defaultdict(list)
        for s in passing_steps:
            if s.kind != "final":
                by_kind[s.kind].append(s)

        for kind, steps in by_kind.items():
            print(f"  Embedding {len(steps)} passing {kind} steps…")
            self.banks[kind] = [embed_step(s) for s in steps]

    def score(self, step: Step) -> float:
        """Return cosine distance [0, 2] to nearest same-kind passing step.
        Higher = more unusual. Returns 1.0 (neutral) if no bank for this kind.
        """
        bank = self.banks.get(step.kind)
        if not bank or step.kind == "final":
            return 1.0
        q = embed_step(step)
        sims = [float(np.dot(q, b)) for b in bank]
        nearest_sim = max(sims)  # cosine similarity in [-1, 1]
        return 1.0 - nearest_sim  # distance in [0, 2]

    def save(self, path: Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(self.banks, f)

    @classmethod
    def load(cls, path: Path) -> OddnessBank:
        obj = cls()
        with open(path, "rb") as f:
            obj.banks = pickle.load(f)
        return obj
