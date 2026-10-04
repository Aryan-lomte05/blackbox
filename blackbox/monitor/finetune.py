"""Fine-tune the step checker's decision layer on our labelled steps.

Laya answers typed questions about every step (is it consistent with its inputs, is the run on track, which kind
of mistake does it look like). Out of the box the alarm is one hand-set rule on one of those answers
(`on_track` probability < 0.35 with confidence > 0.75). This learns how to combine *all* of Laya's answers into a
calibrated probability that a step is the one that broke the run, from the failures whose guilty step we know
(planted mistakes and replay-verified real failures; never from the diagnosis model).

    py -3 -m blackbox.monitor.finetune          # train, compare with the hand-set rule, save if it wins

Splits are the dataset's (by task, SYSTEM.md): weights on `train`, regularisation on `val`, the alarm threshold
on `calib`, and the comparison is reported once on `test_known` (unseen questions) and `test_new_tasks` (a task
type never trained on). Features are Laya's answers and the step kind only: no timing, tokens or fault metadata.
The head is saved as plain JSON (data/models/checker_head.json) and used only if it beats the rule on both
test sets.
"""

from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from blackbox.core.store import DEFAULT_DIR, Store

HEAD_PATH = DEFAULT_DIR / "models" / "checker_head.json"
MISTAKES = ("none", "wrong_tool_argument", "wrong_tool_result", "empty_result", "misleading_search", "missed_info",
            "wrong_fact", "wrong_tool", "lost_memory", "ignored_instructions", "answered_early")
KINDS = ("llm", "tool", "retrieval", "final")
RULE_ALARM, RULE_CONFIDENCE = 0.35, 0.75  # the hand-set rule in monitor/cascade.py (defaults)


def feature_names() -> list[str]:
    return (["consistent_p", "consistent_conf", "on_track_p", "on_track_conf"]
            + [f"mistake_{m}" for m in MISTAKES] + [f"kind_{k}" for k in KINDS])


def features(monitor: dict, kind: str) -> list[float] | None:
    """One step's checker answers as a vector; None when Laya gave no consistent / on-track answer."""
    c, o = monitor.get("consistent") or {}, monitor.get("on_track") or {}
    if "prob" not in c or "prob" not in o:
        return None
    mt = monitor.get("mistake_type") or {}
    return ([float(c["prob"]), float(c.get("confidence", c["prob"])), float(o["prob"]), float(o.get("confidence", o["prob"]))]
            + [float(mt.get(m, 0.0)) for m in MISTAKES] + [1.0 if kind == k else 0.0 for k in KINDS])


def rule_alarm(x: list[float]) -> bool:
    return x[2] < RULE_ALARM and x[3] > RULE_CONFIDENCE


def rule_score(x: list[float]) -> float:
    return 1.0 - x[2]  # what the rule ranks by: how off-track the step looks


def load_rows(store: Store) -> list[dict]:
    rows = []
    for r in store.list_runs(success=False, has_label=True, limit=1_000_000):
        guilty = r.label.root_cause_step if r.label else None
        if guilty is None:
            continue
        for st in store.load_trace(r.run_id).steps:
            x = features(st.monitor or {}, st.kind) if st.monitor else None
            if x is not None:
                rows.append({"run": r.run_id, "split": r.split or "none", "idx": st.idx, "x": x, "y": int(st.idx == guilty)})
    return rows


def _auc(scores: list[float], labels: list[int]) -> float | None:
    pos = [s for s, y in zip(scores, labels) if y]
    neg = [s for s, y in zip(scores, labels) if not y]
    if not pos or not neg:
        return None
    wins = sum((p > n) + 0.5 * (p == n) for p in pos for n in neg)
    return round(wins / (len(pos) * len(neg)), 4)


def _top1(rows: list[dict], scores: list[float]) -> float | None:
    """Per run: does the highest-scoring step equal the guilty step?"""
    best: dict[str, tuple[float, int]] = {}
    for row, s in zip(rows, scores):
        if row["run"] not in best or s > best[row["run"]][0]:
            best[row["run"]] = (s, row["y"])
    return round(sum(y for _, y in best.values()) / len(best), 4) if best else None


def _alarm_stats(flags: list[bool], labels: list[int]) -> dict:
    tp = sum(f and y for f, y in zip(flags, labels))
    fp = sum(f and not y for f, y in zip(flags, labels))
    fn = sum((not f) and y for f, y in zip(flags, labels))
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    return {"precision": round(prec, 4), "recall": round(rec, 4), "f1": round(f1, 4), "alarms": tp + fp}


def evaluate(rows: list[dict], head: dict | None) -> dict:
    labels = [r["y"] for r in rows]
    rule = {"auroc": _auc([rule_score(r["x"]) for r in rows], labels),
            "top1": _top1(rows, [rule_score(r["x"]) for r in rows]),
            "alarm": _alarm_stats([rule_alarm(r["x"]) for r in rows], labels)}
    out = {"n_steps": len(rows), "n_runs": len({r["run"] for r in rows}), "rule": rule}
    if head is not None:
        p = [predict(head, r["x"]) for r in rows]
        out["head"] = {"auroc": _auc(p, labels), "top1": _top1(rows, p),
                       "alarm": _alarm_stats([q >= head["threshold"] for q in p], labels)}
    return out


def predict(head: dict, x: list[float]) -> float:
    z = head["intercept"] + sum(w * (v - m) / s for w, v, m, s in zip(head["coef"], x, head["mean"], head["scale"]))
    return 1.0 / (1.0 + math.exp(-max(-40.0, min(40.0, z))))


def train(rows: list[dict]) -> dict:
    import numpy as np
    from sklearn.linear_model import LogisticRegression

    by = {sp: [r for r in rows if r["split"] == sp] for sp in ("train", "val", "calib")}
    X = np.array([r["x"] for r in by["train"]]); y = np.array([r["y"] for r in by["train"]])
    mean, scale = X.mean(axis=0), X.std(axis=0)
    scale[scale == 0] = 1.0

    def fit(c: float) -> dict:
        m = LogisticRegression(C=c, class_weight="balanced", max_iter=2000).fit((X - mean) / scale, y)
        return {"coef": m.coef_[0].tolist(), "intercept": float(m.intercept_[0]), "mean": mean.tolist(),
                "scale": scale.tolist(), "C": c, "threshold": 0.5}

    # regularisation chosen on val by run-level top-1 (what an investigator sees first), AUROC as tie-break
    candidates = [fit(c) for c in (0.01, 0.03, 0.1, 0.3, 1.0, 3.0)]
    val = by["val"]

    def val_score(h: dict) -> tuple:
        p = [predict(h, r["x"]) for r in val]
        return (_top1(val, p) or 0.0, _auc(p, [r["y"] for r in val]) or 0.0)

    head = max(candidates, key=val_score)
    # alarm threshold chosen on calib: best F1 over a grid of the head's own probabilities
    cal = by["calib"]
    probs = [predict(head, r["x"]) for r in cal]
    labels = [r["y"] for r in cal]
    grid = sorted(set(round(p, 3) for p in probs))
    head["threshold"] = max(grid, key=lambda t: _alarm_stats([p >= t for p in probs], labels)["f1"]) if grid else 0.5
    head["features"] = feature_names()
    head["trained_on"] = {"train_steps": len(by["train"]), "val_steps": len(val), "calib_steps": len(cal)}
    return head


def beats_rule(report: dict) -> bool:
    """Used only if it is better than the hand-set rule on BOTH test sets, on ranking and on alarms."""
    for sp in ("test_known", "test_new_tasks"):
        r = report.get(sp) or {}
        h, b = r.get("head") or {}, r.get("rule") or {}
        if not h or (h.get("auroc") or 0) <= (b.get("auroc") or 0) or h["alarm"]["f1"] <= b["alarm"]["f1"]:
            return False
    return True


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")
    store = Store()
    rows = load_rows(store)
    print(f"{len(rows)} labelled steps with checker answers from {len({r['run'] for r in rows})} failed runs")
    head = train(rows)
    report = {sp: evaluate([r for r in rows if r["split"] == sp], head) for sp in ("val", "calib", "test_known", "test_new_tasks")}
    head.update(report=report, beats_rule=beats_rule(report), trained_at=datetime.now(timezone.utc).isoformat(timespec="seconds"))
    for sp, rep in report.items():
        h, b = rep.get("head", {}), rep["rule"]
        print(f"{sp:15} n={rep['n_runs']:>3} runs  AUROC rule {b['auroc']} -> head {h.get('auroc')}  |  top-1 rule {b['top1']} -> head "
              f"{h.get('top1')}  |  alarm F1 rule {b['alarm']['f1']} (p {b['alarm']['precision']}, r {b['alarm']['recall']}) -> head "
              f"{h['alarm']['f1']} (p {h['alarm']['precision']}, r {h['alarm']['recall']})")
    HEAD_PATH.parent.mkdir(parents=True, exist_ok=True)
    HEAD_PATH.write_text(json.dumps(head, indent=1), encoding="utf-8")
    print(f"saved {HEAD_PATH} (C={head['C']}, alarm threshold {head['threshold']}); "
          f"{'USED: beats the hand-set rule on both test sets' if head['beats_rule'] else 'NOT used: does not beat the rule on both test sets'}")
    return 0


def load_head(path: Path = HEAD_PATH) -> dict[str, Any] | None:
    """The trained head, only if it beat the hand-set rule (and BLACKBOX_CHECKER_HEAD is not '0')."""
    import os

    if os.environ.get("BLACKBOX_CHECKER_HEAD") == "0" or not path.exists():
        return None
    head = json.loads(path.read_text(encoding="utf-8"))
    return head if head.get("beats_rule") else None


if __name__ == "__main__":
    sys.exit(main())
