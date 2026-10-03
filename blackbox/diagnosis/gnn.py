"""Diagnosis GNN (docs/DIAGNOSIS_GNN.md): which step of a failed run is the guilty one.

    py -3 -m blackbox.diagnosis.gnn train                 # train (5-seed ensemble) + evaluate
    py -3 -m blackbox.diagnosis.gnn train --ablations     # + the ablation table
    py -3 -m blackbox.diagnosis.gnn eval                  # evaluate the saved model

Writes data/models/gnn.pt and data/models/gnn_metrics.json. Every number in
the metrics file is computed from data/; nothing is typed by hand.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
import time
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np
import torch
from torch import nn

from blackbox.core.schema import Trace
from blackbox.core.store import DEFAULT_DIR, Store
from blackbox.diagnosis.graph_data import EmbeddingCache, GraphExample, build, feature_dim

MODEL_DIR = DEFAULT_DIR / "models"
MODEL_PATH = MODEL_DIR / "gnn.pt"
METRICS_PATH = MODEL_DIR / "gnn_metrics.json"
EMB_CACHE = MODEL_DIR / "emb_cache.npz"
EVAL_SPLITS = ("val", "test_known", "test_new_mistakes", "test_new_tasks", "test_natural", "external")


@dataclass
class Config:
    hidden: int = 128
    layers: int = 3
    dropout: float = 0.2
    use_text: bool = True
    text_dim: int = 64          # projection of the 384-d sentence embeddings
    graph_features: bool = True  # False zeroes the features computed from data-flow links (ablation)
    edge_types: tuple[int, ...] = (0, 1, 2, 3)  # () = no message passing (an MLP)
    aux_weight: float = 0.3
    lr: float = 2e-3
    weight_decay: float = 1e-4
    epochs: int = 150
    patience: int = 25
    batch: int = 32
    seeds: int = 5


# ---- model ------------------------------------------------------------------------------
class RelGNN(nn.Module):
    def __init__(self, cfg: Config):
        super().__init__()
        self.cfg = cfg
        text_in = 2 * cfg.text_dim + 1 if cfg.use_text else 0
        self.text = nn.Linear(384, cfg.text_dim) if cfg.use_text else None
        self.inp = nn.Sequential(nn.Linear(feature_dim() + text_in, cfg.hidden), nn.GELU(), nn.Dropout(cfg.dropout))
        self.rel = nn.ModuleList([nn.ModuleList([nn.Linear(cfg.hidden, cfg.hidden, bias=False)
                                                 for _ in cfg.edge_types]) for _ in range(cfg.layers)])
        self.gru = nn.ModuleList([nn.GRUCell(cfg.hidden, cfg.hidden) for _ in range(cfg.layers)])
        self.norm = nn.ModuleList([nn.LayerNorm(cfg.hidden) for _ in range(cfg.layers)])
        self.drop = nn.Dropout(cfg.dropout)
        self.root_head = nn.Sequential(nn.Linear(cfg.hidden, cfg.hidden), nn.GELU(), nn.Linear(cfg.hidden, 1))
        self.odd_head = nn.Sequential(nn.Linear(cfg.hidden, cfg.hidden // 2), nn.GELU(), nn.Linear(cfg.hidden // 2, 1))
        self.run_head = nn.Sequential(nn.Linear(2 * cfg.hidden, cfg.hidden), nn.GELU(), nn.Linear(cfg.hidden, 1))

    def forward(self, x, req, out, adj, mask):
        """x [B,N,F], req/out [B,N,384], adj [B,R,N,N] (row-normalised), mask [B,N] real nodes."""
        parts = [x]
        if self.text is not None:
            r, o = self.text(req), self.text(out)
            cos = torch.nn.functional.cosine_similarity(req, out, dim=-1).unsqueeze(-1)
            parts += [r, o, cos]
        h = self.inp(torch.cat(parts, -1))
        b, n, d = h.shape
        for layer in range(self.cfg.layers):
            if self.cfg.edge_types:
                msg = sum(torch.bmm(adj[:, k], lin(h)) for k, lin in enumerate(self.rel[layer]))
                h = self.gru[layer](msg.reshape(b * n, d), h.reshape(b * n, d)).reshape(b, n, d)
            h = self.drop(self.norm[layer](h))
        h = h * mask.unsqueeze(-1)
        root = self.root_head(h).squeeze(-1)
        odd = self.odd_head(h).squeeze(-1)
        mean = h.sum(1) / mask.sum(1, keepdim=True).clamp(min=1)
        mx = h.masked_fill(~mask.unsqueeze(-1).bool(), -1e4).max(1).values
        run = self.run_head(torch.cat([mean, mx], -1)).squeeze(-1)
        return root, odd, run


# ---- tensors ------------------------------------------------------------------------------
@dataclass
class Prepared:
    ex: GraphExample
    req: np.ndarray
    out: np.ndarray


def prepare(examples: list[GraphExample], cache: EmbeddingCache | None, save: bool = True) -> list[Prepared]:
    """cache=None: no text features (the model does not use them) -> zero vectors, no encoder, no disk."""
    texts = [t for e in examples for t in e.req_text + e.out_text]
    if cache is None:
        vecs = np.zeros((len(texts), 384), np.float32)
    else:
        vecs = cache.embed(texts) if texts else np.zeros((0, 384), np.float32)
        if save:
            cache.save()
    out, i = [], 0
    for e in examples:
        n = len(e.req_text)
        out.append(Prepared(e, vecs[i:i + n], vecs[i + n:i + 2 * n]))
        i += 2 * n
    return out


# Columns of graph_data.build()'s feature row that are computed from the data-flow
# graph: parent/child counts, depth, "the answer depends on it", and the two
# "facts from nowhere" features (checked against data-flow ancestors).
GRAPH_FEATURE_COLS = [23, 24, 25, 27, 31, 32]


def collate(items: list[Prepared], edge_types: tuple[int, ...], device, graph_features: bool = True) -> dict:
    n = max(len(p.ex.req_text) for p in items)
    b, f, r = len(items), feature_dim(), max(1, len(edge_types))
    x = np.zeros((b, n, f), np.float32)
    req = np.zeros((b, n, 384), np.float32)
    outv = np.zeros((b, n, 384), np.float32)
    adj = np.zeros((b, r, n, n), np.float32)
    mask = np.zeros((b, n), np.float32)
    cand = np.zeros((b, n), bool)
    odd = np.full((b, n), np.nan, np.float32)
    root = np.full(b, -1, np.int64)
    failed = np.full(b, np.nan, np.float32)
    for i, p in enumerate(items):
        k = len(p.ex.req_text)
        x[i, :k], req[i, :k], outv[i, :k] = p.ex.x, p.req, p.out
        mask[i, :k] = 1
        cand[i, :k] = p.ex.candidates
        odd[i, :k] = p.ex.odd
        if p.ex.root is not None:
            root[i] = p.ex.root
        if p.ex.failed is not None:
            failed[i] = p.ex.failed
        for et, src, dst in p.ex.edges:
            if et in edge_types:
                adj[i, edge_types.index(et), dst, src] = 1.0
    if not graph_features:
        x[:, :, GRAPH_FEATURE_COLS] = 0.0
    deg = adj.sum(-1, keepdims=True)
    adj = np.divide(adj, deg, out=np.zeros_like(adj), where=deg > 0)
    t = lambda a, dt=torch.float32: torch.as_tensor(a, dtype=dt, device=device)  # noqa: E731
    return {"x": t(x), "req": t(req), "out": t(outv), "adj": t(adj), "mask": t(mask),
            "cand": t(cand, torch.bool), "odd": t(odd), "root": t(root, torch.long), "failed": t(failed)}


def _root_logits(root, cand):
    return root.masked_fill(~cand, -1e9)


# ---- training -----------------------------------------------------------------------------
def _loss(model, batch, cfg: Config):
    root, odd, run = model(batch["x"], batch["req"], batch["out"], batch["adj"], batch["mask"])
    loss = torch.zeros((), device=root.device)
    has_root = batch["root"] >= 0
    if has_root.any():
        loss = loss + nn.functional.cross_entropy(_root_logits(root, batch["cand"])[has_root], batch["root"][has_root])
    if cfg.aux_weight:
        known = ~torch.isnan(batch["odd"]) & batch["cand"]
        if known.any():
            loss = loss + cfg.aux_weight * nn.functional.binary_cross_entropy_with_logits(odd[known], batch["odd"][known])
        rk = ~torch.isnan(batch["failed"])
        if rk.any():
            loss = loss + cfg.aux_weight * nn.functional.binary_cross_entropy_with_logits(run[rk], batch["failed"][rk])
    return loss


def predict_probs(models: list[RelGNN], items: list[Prepared], cfg: Config, device) -> list[np.ndarray]:
    out: list[np.ndarray] = []
    for m in models:
        m.eval()
    with torch.no_grad():
        for i in range(0, len(items), 64):
            chunk = items[i:i + 64]
            batch = collate(chunk, cfg.edge_types, device, cfg.graph_features)
            probs = 0
            for m in models:
                root, _, _ = m(batch["x"], batch["req"], batch["out"], batch["adj"], batch["mask"])
                probs = probs + torch.softmax(_root_logits(root, batch["cand"]), -1)
            probs = (probs / len(models)).cpu().numpy()
            out += [probs[j, : len(p.ex.req_text)] for j, p in enumerate(chunk)]
    return out


def _top1(models, items, cfg, device) -> float:
    lab = [p for p in items if p.ex.root is not None]
    if not lab:
        return 0.0
    probs = predict_probs(models, lab, cfg, device)
    return float(np.mean([int(np.argmax(pr)) == p.ex.root for pr, p in zip(probs, lab)]))


def train_one(train: list[Prepared], val: list[Prepared], cfg: Config, seed: int, device) -> RelGNN:
    torch.manual_seed(seed)
    rng = random.Random(seed)
    model = RelGNN(cfg).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=cfg.lr, weight_decay=cfg.weight_decay)
    best, best_state, bad = -1.0, None, 0
    for epoch in range(cfg.epochs):
        model.train()
        order = train[:]
        rng.shuffle(order)
        for i in range(0, len(order), cfg.batch):
            batch = collate(order[i:i + cfg.batch], cfg.edge_types, device, cfg.graph_features)
            loss = _loss(model, batch, cfg)
            if not loss.requires_grad:  # nothing labelled in this batch
                continue
            opt.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
        score = _top1([model], val, cfg, device) if val else -float(epoch)
        if score > best:
            best, best_state, bad = score, {k: v.detach().clone() for k, v in model.state_dict().items()}, 0
        else:
            bad += 1
            if bad >= cfg.patience:
                break
    if best_state is not None:
        model.load_state_dict(best_state)
    return model


# ---- evaluation -------------------------------------------------------------------------------
def _ranks(prob: np.ndarray, root: int) -> int:
    order = np.argsort(-prob, kind="stable")
    return int(np.where(order == root)[0][0]) + 1


def _bootstrap(values: list[float], reps: int = 2000, seed: int = 0) -> tuple[float, float]:
    if len(values) < 2:
        return (float("nan"), float("nan"))
    rng = np.random.default_rng(seed)
    arr = np.array(values)
    means = arr[rng.integers(0, len(arr), (reps, len(arr)))].mean(1)
    return float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))


def score_rankings(labelled: list[Prepared], probs: list[np.ndarray]) -> dict:
    ranks = [_ranks(pr, p.ex.root) for pr, p in zip(probs, labelled)]
    t1 = [float(r == 1) for r in ranks]
    t3 = [float(r <= 3) for r in ranks]
    pm1 = [float(abs(int(np.argmax(pr)) - p.ex.root) <= 1) for pr, p in zip(probs, labelled)]
    rr = [1.0 / r for r in ranks]
    return {"n": len(ranks), "top1": round(float(np.mean(t1)), 4), "top1_ci95": [round(v, 4) for v in _bootstrap(t1)],
            "top3": round(float(np.mean(t3)), 4), "top3_ci95": [round(v, 4) for v in _bootstrap(t3)],
            "pm1": round(float(np.mean(pm1)), 4),
            "mrr": round(float(np.mean(rr)), 4)}


def baseline_probs(p: Prepared, kind: str) -> np.ndarray:
    n = len(p.ex.req_text)
    cand = p.ex.candidates.astype(float)
    if kind == "random":
        return cand / cand.sum()
    pos = np.arange(n, dtype=float)
    llm = p.ex.x[:, 0] > 0  # kind one-hot: llm first
    if kind == "last_model_call":
        score = np.where(llm & p.ex.candidates, pos + 1000, pos)
    elif kind == "fallback_order":  # the API's fallback: errors first, then model calls latest-first
        err = p.ex.x[:, feature_dim() - 6] > 0
        score = np.where(err, 1e6, 0) + np.where(llm, 1e3, 0) + pos
    else:
        raise ValueError(kind)
    score = np.where(p.ex.candidates, score, -1e9)
    out = np.zeros(n)
    out[np.argsort(-score, kind="stable")] = np.linspace(1, 0.01, n)  # ranking only
    return out


def evaluate(models, items: list[Prepared], cfg: Config, device) -> dict:
    report: dict = {"splits": {}, "by_fault": {}, "baselines": {}}
    by_split: dict[str, list[Prepared]] = defaultdict(list)
    for p in items:
        if p.ex.root is not None:
            by_split[p.ex.split or "none"].append(p)
    for split in EVAL_SPLITS:
        lab = by_split.get(split, [])
        if not lab:
            continue
        probs = predict_probs(models, lab, cfg, device)
        report["splits"][split] = score_rankings(lab, probs)
        report["baselines"][split] = {
            kind: score_rankings(lab, [baseline_probs(p, kind) for p in lab])
            for kind in ("last_model_call", "fallback_order")
        }
        # Random is an expectation, not a draw: argmax of uniform scores is just "the first step".
        exp_t1 = [1.0 / max(1, int(p.ex.candidates.sum())) for p in lab]
        report["baselines"][split]["random"] = {"n": len(lab), "top1": round(float(np.mean(exp_t1)), 4),
                                                "top3": round(float(np.mean([min(1.0, 3 * v) for v in exp_t1])), 4)}
        if split == "test_known":
            groups: dict[str, list[int]] = defaultdict(list)
            for i, p in enumerate(lab):
                groups[p.ex.fault_type or "natural"].append(i)
            report["by_fault"] = {ft: score_rankings([lab[i] for i in ix], [probs[i] for i in ix])
                                  for ft, ix in sorted(groups.items())}
    return report


# ---- data -----------------------------------------------------------------------------------
def load_examples(store: Store) -> list[GraphExample]:
    out, offset = [], 0
    while True:
        batch = store.list_runs(limit=500, offset=offset)
        if not batch:
            break
        offset += len(batch)
        for run in batch:
            if run.status != "done" or run.outcome is None:
                continue
            out.append(build(store.load_trace(run.run_id)))
    return out


def _config_hash(cfg: Config) -> str:
    return hashlib.sha1(json.dumps(asdict(cfg), sort_keys=True).encode()).hexdigest()[:8]


def train_cmd(args) -> int:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    store = Store(args.data)
    t0 = time.time()
    examples = load_examples(store)
    prepared = prepare(examples, EmbeddingCache(EMB_CACHE))
    split_of = Counter((p.ex.split, p.ex.root is not None) for p in prepared)
    train = [p for p in prepared if p.ex.split == "train"]
    val = [p for p in prepared if p.ex.split == "val" and p.ex.root is not None]
    n_lab = sum(p.ex.root is not None for p in train)
    print(f"{len(prepared)} runs ({n_lab} labelled failures in train, {len(val)} in val) on {device}; "
          f"featurised in {time.time() - t0:.0f}s")
    if n_lab < 10:
        print("not enough labelled failures to train (need >= 10 in train)", file=sys.stderr)
        return 1

    def fit(cfg: Config) -> list[RelGNN]:
        return [train_one(train, val, cfg, seed, device) for seed in range(cfg.seeds)]

    cfg = Config(seeds=args.seeds, **VARIANTS[args.variant])
    models = fit(cfg)
    metrics = {"config": asdict(cfg), "variant": args.variant, "model": f"gnn@{_config_hash(cfg)}",
               "data": {f"{s}|{'labelled' if lab else 'unlabelled'}": n for (s, lab), n in sorted(split_of.items(), key=str)},
               "device": str(device), **evaluate(models, prepared, cfg, device)}
    if args.ablations:
        variants = {
            "no_message_passing": Config(seeds=args.seeds, edge_types=()),
            "order_edges_only": Config(seeds=args.seeds, edge_types=(2, 3)),
            "no_text": Config(seeds=args.seeds, use_text=False),
            "no_aux_heads": Config(seeds=args.seeds, aux_weight=0.0),
        }
        metrics["ablations"] = {}
        for name, vcfg in variants.items():
            rep = evaluate(fit(vcfg), prepared, vcfg, device)
            metrics["ablations"][name] = {s: {k: v[k] for k in ("n", "top1", "top1_ci95", "top3")}
                                          for s, v in rep["splits"].items()}
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    torch.save({"config": asdict(cfg), "states": [m.state_dict() for m in models], "model": metrics["model"]}, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    _print_report(metrics)
    print(f"\nsaved {MODEL_PATH} and {METRICS_PATH} ({time.time() - t0:.0f}s)")
    return 0


VARIANTS = {
    "full": {},
    "small_text": {"text_dim": 16},
    "no_text": {"use_text": False},
    "no_message_passing": {"edge_types": ()},
    "order_edges_only": {"edge_types": (2, 3)},
    "no_text_no_message_passing": {"use_text": False, "edge_types": ()},   # does the graph help? (pairs with no_text)
    "no_text_order_only": {"use_text": False, "edge_types": (2, 3)},       # does data flow help beyond order?
    "no_graph_at_all": {"use_text": False, "edge_types": (), "graph_features": False},  # is the graph worth anything?
}


def _fold(task_id: str, k: int) -> int:
    return int(hashlib.sha1(f"cv|{task_id}".encode()).hexdigest()[:8], 16) % k


def cv_cmd(args) -> int:
    """Grouped k-fold CV on train+val (folds by task id; test sets untouched).
    Picks the model variant; the test sets are then used once, by `train`."""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    prepared = prepare(load_examples(Store(args.data)), EmbeddingCache(EMB_CACHE))
    pool = [p for p in prepared if p.ex.split in ("train", "val")]
    names = args.variants.split(",") if args.variants else list(VARIANTS)
    results: dict[str, dict] = {}
    for name in names:
        cfg = Config(seeds=1, **VARIANTS[name])
        t1s, t3s, per_fold = [], [], []
        for k in range(args.folds):
            held = [p for p in pool if _fold(p.ex.task_id, args.folds) == k]
            rest = [p for p in pool if _fold(p.ex.task_id, args.folds) != k]
            # early stopping on a slice of the TRAINING tasks, never on the held-out fold
            inner = [p for p in rest if _fold(p.ex.task_id + "|inner", 10) == 0 and p.ex.root is not None]
            fit = [p for p in rest if not (_fold(p.ex.task_id + "|inner", 10) == 0)]
            model = train_one(fit, inner, cfg, seed=k, device=device)
            lab = [p for p in held if p.ex.root is not None]
            if not lab:
                continue
            r = score_rankings(lab, predict_probs([model], lab, cfg, device))
            per_fold.append({"n": r["n"], "top1": r["top1"], "top3": r["top3"]})
            t1s += [r["top1"]] * r["n"]
            t3s += [r["top3"]] * r["n"]
        results[name] = {"config": VARIANTS[name], "folds": per_fold,
                         "top1": round(float(np.mean(t1s)), 4), "top3": round(float(np.mean(t3s)), 4),
                         "n": len(t1s)}
        print(f"{name:20} top1 {results[name]['top1']:.3f}  top3 {results[name]['top3']:.3f}  "
              f"(n={len(t1s)}; per fold top1 {[f['top1'] for f in per_fold]})", flush=True)
    best = max(results, key=lambda n: (results[n]["top3"] + results[n]["top1"]))
    out = {"folds": args.folds, "pool": len(pool), "results": results, "chosen": best}
    (MODEL_DIR / "gnn_cv.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"\nchosen by CV (top1 + top3): {best}  -> train it with: train --variant {best}")
    return 0


def _print_report(m: dict) -> None:
    print(f"\n{'split':18} {'n':>4}  {'GNN top1 [95% CI]':24} {'top3':>6} {'MRR':>6}   baselines top1: random / last-model-call / fallback")
    for split, r in m["splits"].items():
        b = m["baselines"][split]
        ci = r["top1_ci95"]
        print(f"{split:18} {r['n']:>4}  {r['top1']:.3f} [{ci[0]:.2f}, {ci[1]:.2f}]{'':6} {r['top3']:>6.3f} {r['mrr']:>6.3f}"
              f"   {b['random']['top1']:.3f} / {b['last_model_call']['top1']:.3f} / {b['fallback_order']['top1']:.3f}")
    if m.get("by_fault"):
        print("test_known by mistake type: " + ", ".join(f"{k} {v['top1']:.2f} (n={v['n']})" for k, v in m["by_fault"].items()))
    for name, rep in (m.get("ablations") or {}).items():
        print(f"ablation {name:20} " + ", ".join(f"{s} {v['top1']:.3f}" for s, v in rep.items()))


# ---- runtime: rank(trace) ------------------------------------------------------------------------
@lru_cache(maxsize=1)
def _load(path: str):
    blob = torch.load(path, map_location="cpu", weights_only=False)
    cfg = Config(**{**blob["config"], "edge_types": tuple(blob["config"]["edge_types"])})
    models = []
    for state in blob["states"]:
        m = RelGNN(cfg)
        m.load_state_dict(state)
        m.eval()
        models.append(m)
    return cfg, models, blob["model"]


@lru_cache(maxsize=1)
def _runtime_cache() -> EmbeddingCache:
    """Loaded once per process; never rewritten on every diagnosis (it is large)."""
    return EmbeddingCache(EMB_CACHE)


def available(path: Path = MODEL_PATH) -> bool:
    return path.exists()


def rank(trace: Trace, path: Path = MODEL_PATH, top_k: int = 3) -> dict:
    """The diagnose() contract (ASSIGNMENTS.md #7) from the GNN."""
    cfg, models, name = _load(str(path))
    prepared = prepare([build(trace)], _runtime_cache() if cfg.use_text else None, save=False)
    probs = predict_probs(models, prepared, cfg, torch.device("cpu"))[0]
    order = [int(i) for i in np.argsort(-probs, kind="stable") if prepared[0].ex.candidates[i]]
    return {"suspects": order[:top_k], "model": name,
            "scores": [{"idx": i, "p": round(float(probs[i]), 4), "rank": r + 1} for r, i in enumerate(order)],
            "evidence": []}


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="blackbox.diagnosis.gnn")
    p.add_argument("--data", default=str(DEFAULT_DIR))
    sub = p.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("train")
    t.add_argument("--seeds", type=int, default=5)
    t.add_argument("--ablations", action="store_true")
    t.add_argument("--variant", default="full", choices=list(VARIANTS))
    c = sub.add_parser("cv", help="grouped k-fold CV on train+val to choose the variant")
    c.add_argument("--folds", type=int, default=5)
    c.add_argument("--variants", default="", help="comma-separated subset of " + ",".join(VARIANTS))
    sub.add_parser("eval")
    args = p.parse_args(argv)
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")
    if args.cmd == "train":
        return train_cmd(args)
    if args.cmd == "cv":
        return cv_cmd(args)
    if not available():
        print("no trained model: run `train` first", file=sys.stderr)
        return 1
    # Recompute on the current data with the saved model (ablations are kept from training).
    cfg, models, name = _load(str(MODEL_PATH))
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    models = [m.to(device) for m in models]
    prepared = prepare(load_examples(Store(args.data)), EmbeddingCache(EMB_CACHE))
    old = json.loads(METRICS_PATH.read_text(encoding="utf-8")) if METRICS_PATH.exists() else {}
    metrics = {**old, "model": name, **evaluate(models, prepared, cfg, device)}
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    _print_report(metrics)
    return 0


if __name__ == "__main__":
    sys.exit(main())
