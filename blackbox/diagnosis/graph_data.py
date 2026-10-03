"""Turn a recorded run into a graph for the diagnosis GNN (docs/DIAGNOSIS_GNN.md §2–3).

Nodes are steps; edges are data flow (who used whose output) and step order,
each in both directions: 4 edge types.

LEAK GUARD: features come only from what a step asked, what came back, its
error and the graph shape. Never `cached`, `latency_ms`, tokens, `meta`, the
run's fault or patch: those differ between a step that ran live and the same
step replayed, and in a planted-mistake fork they point straight at the
planted step. `tests/test_gnn.py` checks that a replayed run has exactly the
same features as the original.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np

from blackbox.core.schema import Step, Trace

KINDS = ("llm", "tool", "retrieval", "state", "final")
NODE_BUCKETS = 16
EDGE_TYPES = 4  # dataflow fwd, dataflow bwd, order fwd, order bwd
EMB_DIM = 384
TEXT_CHARS = 1200

_NUM = re.compile(r"(?<![\w.])-?\d+(?:[.,]\d+)?")
_NAME = re.compile(r"\b[A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+)*")
_WORD = re.compile(r"[a-z0-9]+")
_STOP = frozenset("the a an of in on at to for and or is was are were be by with from as that this it "
                  "answer note next search calc final done".split())


@dataclass
class GraphExample:
    run_id: str
    x: np.ndarray            # [n, F] hand features
    req_text: list[str]      # what each step asked (embedded later)
    out_text: list[str]      # what came back
    edges: list[tuple[int, int, int]]  # (type, src, dst)
    candidates: np.ndarray   # [n] bool: may be blamed (not the final step)
    root: int | None         # guilty step, if labelled
    odd: np.ndarray          # [n] float: auxiliary "looks wrong" target (nan = unknown)
    failed: float | None     # run outcome target
    split: str | None
    family: str
    fault_type: str | None
    task_id: str = ""


def _clip(text: str, n: int = TEXT_CHARS) -> str:
    text = " ".join(str(text).split())
    return text[:n]


def request_text(step: Step) -> str:
    req = step.request or {}
    if step.kind == "llm":
        msgs = req.get("messages") or []
        last = next((m.get("content", "") for m in reversed(msgs) if m.get("role") == "user"), "")
        return _clip(f"[{step.node}] {last}")
    if step.kind == "final":
        return "final answer"
    return _clip(f"[{step.kind}:{step.name}] {json.dumps(req.get('args', req), ensure_ascii=False, default=str)}")


def output_text(step: Step) -> str:
    if step.error:
        return _clip(f"ERROR {step.error}")
    out = step.output or {}
    if "text" in out:
        return _clip(out["text"])
    if "docs" in out:
        return _clip(" | ".join(f"{d.get('title', '')}: {d.get('text', '')}" for d in out["docs"] if isinstance(d, dict)))
    if "answer" in out:
        return _clip(str(out["answer"]))
    return _clip(json.dumps(out, ensure_ascii=False, default=str))


def _facts(text: str) -> set[str]:
    nums = {n.replace(",", "") for n in _NUM.findall(text)}
    names = {n.lower() for n in _NAME.findall(text) if n.lower() not in _STOP and len(n) > 2}
    return nums | names


def _words(text: str) -> set[str]:
    return {w for w in _WORD.findall(text.lower()) if w not in _STOP}


def _bucket(name: str) -> int:
    return int(hashlib.md5(name.encode()).hexdigest(), 16) % NODE_BUCKETS


def dataflow_parents(trace: Trace) -> list[list[int]]:
    """Recorded parents; the final step depends on the step right before it."""
    out = [list(s.parents) for s in trace.steps]
    for s in trace.steps:
        if s.kind == "final" and not s.parents and s.idx > 0:
            out[s.idx] = [s.idx - 1]
    return out


def build(trace: Trace) -> GraphExample:
    steps = trace.steps
    n = len(steps)
    parents = dataflow_parents(trace)
    children: list[list[int]] = [[] for _ in range(n)]
    for i, ps in enumerate(parents):
        for p in ps:
            if 0 <= p < n:
                children[p].append(i)

    ancestors: list[set[int]] = []
    for i in range(n):
        acc: set[int] = set()
        stack = list(parents[i])
        while stack:
            p = stack.pop()
            if p not in acc and 0 <= p < n:
                acc.add(p)
                stack.extend(parents[p])
        ancestors.append(acc)
    final_idx = next((s.idx for s in reversed(steps) if s.kind == "final"), n - 1)
    answer_deps = ancestors[final_idx] if n else set()
    depth = [0] * n
    for i in range(n):
        depth[i] = 1 + max((depth[p] for p in parents[i] if 0 <= p < i), default=-1)

    req = [request_text(s) for s in steps]
    out = [output_text(s) for s in steps]
    task_text = json.dumps(trace.run.task_input, ensure_ascii=False, default=str)
    task_facts = _facts(task_text)
    final_words = _words(out[final_idx]) if n else set()

    rows = []
    for i, s in enumerate(steps):
        kind = np.zeros(len(KINDS), np.float32)
        kind[KINDS.index(s.kind) if s.kind in KINDS else 0] = 1
        bucket = np.zeros(NODE_BUCKETS, np.float32)
        bucket[_bucket(s.node or s.name)] = 1
        known = set(task_facts)
        for a in ancestors[i]:
            known |= _facts(out[a])
        produced = _facts(out[i]) if s.kind in ("llm", "tool") else set()
        unsupported = produced - known - _facts(req[i])
        ow = _words(out[i])
        rows.append(np.concatenate([kind, bucket, np.array([
            i / max(1, n - 1),                                   # relative position
            min(i, 40) / 40,                                     # absolute position (clipped)
            math.log1p(len(parents[i])), math.log1p(len(children[i])),
            min(depth[i], 20) / 20,
            (final_idx - i) / max(1, n - 1),                     # distance to the answer
            float(i in answer_deps),                             # the answer depends on it
            float(s.error is not None),
            float(not out[i].strip() or out[i] in ("{}", "[]", "null", '{"result": null}')),
            math.log1p(len(out[i])) / 8,
            len(unsupported) / max(1, len(produced)),            # share of facts from nowhere
            math.log1p(len(unsupported)),
            len(ow & final_words) / max(1, len(ow | final_words)),  # overlap with the final answer
        ], np.float32)]))

    edges = []
    for i, ps in enumerate(parents):
        for p in ps:
            if 0 <= p < n:
                edges += [(0, p, i), (1, i, p)]
    for i in range(n - 1):
        edges += [(2, i, i + 1), (3, i + 1, i)]

    candidates = np.array([s.kind != "final" for s in steps])
    root = None
    if trace.run.label is not None and trace.run.label.root_cause_step is not None:
        root = trace.run.label.root_cause_step if root_ok(trace.run.label.root_cause_step, candidates) else None
    odd = np.full(n, np.nan, np.float32)
    failed = None
    if trace.run.outcome is not None and trace.run.status == "done":
        failed = float(not trace.run.outcome.success)
        if trace.run.outcome.success:
            odd[:] = 0.0
            if trace.run.fault is not None and trace.run.fault.step_idx < n:  # recovered: odd, not causal
                odd[trace.run.fault.step_idx] = 1.0
        elif root is not None:
            odd[root] = 1.0
    return GraphExample(
        run_id=trace.run.run_id, x=np.stack(rows) if rows else np.zeros((0, feature_dim()), np.float32),
        req_text=req, out_text=out, edges=edges, candidates=candidates, root=root, odd=odd, failed=failed,
        split=trace.run.split, family=trace.run.task_family,
        fault_type=trace.run.fault.type if trace.run.fault else None,
        task_id=trace.run.task_id,
    )


def root_ok(idx: int, candidates: np.ndarray) -> bool:
    return 0 <= idx < len(candidates) and bool(candidates[idx])


def feature_dim() -> int:
    return len(KINDS) + NODE_BUCKETS + 13


# ---- text embeddings (cached on disk by fingerprint) ------------------------------------
@lru_cache(maxsize=1)
def _encoder():
    os.environ.setdefault("USE_TF", "0")
    os.environ.setdefault("TRANSFORMERS_NO_TF", "1")
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")


class EmbeddingCache:
    def __init__(self, path: Path):
        self.path = path
        self._mem: dict[str, np.ndarray] = {}
        if path.exists():
            data = np.load(path)
            self._mem = {k: data[k] for k in data.files}
        self._dirty = False

    def embed(self, texts: list[str]) -> np.ndarray:
        keys = [hashlib.sha1(t.encode("utf-8")).hexdigest() for t in texts]
        todo = sorted({k: t for k, t in zip(keys, texts) if k not in self._mem}.items())
        if todo:
            vecs = _encoder().encode([t for _, t in todo], batch_size=64, normalize_embeddings=True,
                                     show_progress_bar=False)
            for (k, _), v in zip(todo, vecs):
                self._mem[k] = v.astype(np.float16)
            self._dirty = True
        return np.stack([self._mem[k].astype(np.float32) for k in keys]) if keys else np.zeros((0, EMB_DIM), np.float32)

    def save(self) -> None:
        if self._dirty:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_suffix(".tmp.npz")
            np.savez(tmp, **self._mem)
            os.replace(tmp, self.path)
            self._dirty = False
