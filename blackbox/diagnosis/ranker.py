"""Train two LightGBM lambdarank variants and evaluate. SYSTEM.md §6.1.

Run as a script:
    python -m blackbox.diagnosis.ranker --data /path/to/blackbox-3k --out models/

Trains:
    Variant A: structural features only
    Variant B: structural + monitor checker features

Saves: models/ranker_A.pkl, models/ranker_B.pkl, models/oddness_bank.pkl, models/k.txt
Prints: Top-1, Top-3 for each variant on test_known and test_new_tasks.
"""
from __future__ import annotations

import argparse
import json
import pickle
from pathlib import Path

import lightgbm as lgb
import numpy as np

from blackbox.diagnosis.conformal import calibrate, evaluate_coverage
from blackbox.diagnosis.dataset import build_arrays, load_traces
from blackbox.diagnosis.embeddings import OddnessBank
from blackbox.diagnosis.features import (
    FEATURE_NAMES_STRUCTURAL_ONLY,
    FEATURE_NAMES_WITH_MONITOR,
)

# ── metrics ───────────────────────────────────────────────────────────────────


def top_k_accuracy(
    X: np.ndarray,
    y: np.ndarray,
    groups: list[int],
    model: lgb.Booster,
    k: int,
) -> float:
    """Fraction of runs where the guilty step is in the top-k ranked steps."""
    if len(groups) == 0 or len(y) == 0:
        return 0.0

    scores = model.predict(X)
    correct = total = 0
    offset = 0

    for g in groups:
        y_g = y[offset : offset + g]
        s_g = scores[offset : offset + g]
        guilty_indices = np.where(y_g == 1)[0]
        if len(guilty_indices) == 0:
            offset += g
            continue
        ranked = np.argsort(s_g)[::-1]
        top_k_set = set(ranked[:k].tolist())
        if any(gi in top_k_set for gi in guilty_indices):
            correct += 1
        total += 1
        offset += g

    return correct / max(1, total)


# ── training ──────────────────────────────────────────────────────────────────

LGBM_PARAMS = {
    "objective": "lambdarank",
    "metric": "ndcg",
    "ndcg_eval_at": [1, 3, 5],
    "learning_rate": 0.05,
    "num_leaves": 31,
    "min_child_samples": 5,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "n_estimators": 500,
    "early_stopping_rounds": 30,
    "verbose": -1,
    "n_jobs": -1,
    "random_state": 42,
}


def train_variant(
    X_tr: np.ndarray,
    y_tr: np.ndarray,
    groups_tr: list[int],
    X_val: np.ndarray,
    y_val: np.ndarray,
    groups_val: list[int],
    feature_names: list[str],
    variant: str,
) -> lgb.Booster:
    print(f"\n=== Training Variant {variant} ===")
    print(f"  Train: {len(groups_tr)} runs, {X_tr.shape[0]} steps")
    print(f"  Val:   {len(groups_val)} runs, {X_val.shape[0]} steps")

    dtrain = lgb.Dataset(
        X_tr,
        label=y_tr,
        group=groups_tr,
        feature_name=feature_names,
        free_raw_data=False,
    )
    dval = lgb.Dataset(
        X_val,
        label=y_val,
        group=groups_val,
        feature_name=feature_names,
        reference=dtrain,
        free_raw_data=False,
    )

    train_params = {
        k: v
        for k, v in LGBM_PARAMS.items()
        if k not in ("n_estimators", "early_stopping_rounds", "n_jobs", "random_state")
    }

    model = lgb.train(
        train_params,
        dtrain,
        num_boost_round=LGBM_PARAMS["n_estimators"],
        valid_sets=[dval],
        callbacks=[
            lgb.early_stopping(LGBM_PARAMS["early_stopping_rounds"], verbose=False),
            lgb.log_evaluation(50),
        ],
    )
    return model


# ── position-only baseline (trap check from SYSTEM.md §6.1 notes) ─────────────


def train_position_only_baseline(
    X_tr: np.ndarray,
    y_tr: np.ndarray,
    groups_tr: list[int],
    X_val: np.ndarray,
    y_val: np.ndarray,
    groups_val: list[int],
) -> lgb.Booster:
    """Train on step_idx alone. If this is close to Variant A, mistakes are
    badly spread (tell Radhesh). See ADITYA.md trap note.
    """
    X_pos_tr = X_tr[:, :1]  # only step_idx
    X_pos_val = X_val[:, :1]
    return train_variant(
        X_pos_tr,
        y_tr,
        groups_tr,
        X_pos_val,
        y_val,
        groups_val,
        ["step_idx"],
        variant="position_only_BASELINE",
    )


# ── main ──────────────────────────────────────────────────────────────────────


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description="Train LightGBM lambdarank for Black Box diagnosis")
    default_data = (
        Path("/Users/aditya4/Downloads/blackbox-3k")
        if Path("/Users/aditya4/Downloads/blackbox-3k").exists()
        else Path("data/dataset/blackbox-3k")
    )
    p.add_argument("--data", default=str(default_data), help="path to blackbox-3k directory")
    p.add_argument("--out", default="models", help="directory to save models")
    p.add_argument(
        "--no-monitor",
        action="store_true",
        help="skip Variant B (if monitor data is absent)",
    )
    p.add_argument(
        "--skip-embeddings",
        action="store_true",
        help="skip text embeddings oddness bank to speed up training",
    )
    args = p.parse_args(argv)

    data = Path(args.data)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    # ── load splits ──────────────────────────────────────────────────────────
    data_dir = data / "data" if (data / "data").exists() else data
    print(f"Loading splits from {data_dir}…")
    tr_traces = load_traces(data_dir / "train.jsonl.gz")
    val_traces = load_traces(data_dir / "val.jsonl.gz")
    cal_traces = load_traces(data_dir / "calib.jsonl.gz")
    tst_traces = load_traces(data_dir / "test_known.jsonl.gz")
    shop_traces = load_traces(data_dir / "test_new_tasks.jsonl.gz")
    print(
        f"  train={len(tr_traces)} val={len(val_traces)} calib={len(cal_traces)}"
        f" test_known={len(tst_traces)} shop={len(shop_traces)}"
    )

    # ── build embedding bank (TRAIN passing runs only) ───────────────────────
    bank: OddnessBank | None = None
    bank_path = out / "oddness_bank.pkl"
    if not args.skip_embeddings:
        if bank_path.exists():
            print(f"\nLoading existing oddness bank from {bank_path}…")
            try:
                bank = OddnessBank.load(bank_path)
            except Exception as e:  # noqa: BLE001
                print(f"  Could not load bank ({e}), rebuilding…")
                bank = None

        if bank is None:
            print("\nBuilding oddness bank from passing training runs…")
            all_train = load_traces(data_dir / "train.jsonl.gz", labelled_only=False)
            passing_steps = [
                s
                for tr in all_train
                if tr.run.outcome and tr.run.outcome.success
                for s in tr.steps
                if s.kind != "final"
            ]
            bank = OddnessBank()
            bank.fit(passing_steps)
            bank.save(bank_path)
            print(f"  Bank built: {sum(len(v) for v in bank.banks.values())} passing steps")
    else:
        print("\nSkipping oddness bank (--skip-embeddings)")

    # ── VARIANT A: structural features only ──────────────────────────────────
    X_tr_A, y_tr_A, g_tr_A = build_arrays(tr_traces, include_monitor=False, bank=bank)
    X_val_A, y_val_A, g_val_A = build_arrays(val_traces, include_monitor=False, bank=bank)
    X_tst_A, y_tst_A, g_tst_A = build_arrays(tst_traces, include_monitor=False, bank=bank)
    X_shp_A, y_shp_A, g_shp_A = build_arrays(shop_traces, include_monitor=False, bank=bank)
    X_cal_A, y_cal_A, g_cal_A = build_arrays(cal_traces, include_monitor=False, bank=bank)

    model_A = train_variant(
        X_tr_A,
        y_tr_A,
        g_tr_A,
        X_val_A,
        y_val_A,
        g_val_A,
        FEATURE_NAMES_STRUCTURAL_ONLY,
        "A (structural)",
    )

    # Position-only trap check
    model_pos = train_position_only_baseline(
        X_tr_A, y_tr_A, g_tr_A, X_val_A, y_val_A, g_val_A
    )
    pos_top1 = top_k_accuracy(X_tst_A[:, :1], y_tst_A, g_tst_A, model_pos, 1)
    a_top1 = top_k_accuracy(X_tst_A, y_tst_A, g_tst_A, model_A, 1)
    print(f"\n[TRAP CHECK] Position-only Top-1: {pos_top1:.3f} vs Variant A: {a_top1:.3f}")
    if abs(a_top1 - pos_top1) < 0.05:
        print(
            "  WARNING: Variant A is barely better than position-only."
            " Mistake positions may be skewed — flag to Radhesh."
        )

    # Conformal calibration on calib split
    k_A = calibrate(model_A, X_cal_A, y_cal_A, g_cal_A, target_coverage=0.90)
    (out / "k.txt").write_text(str(k_A))
    print(f"Saved conformal k={k_A} to {out}/k.txt")

    # ── VARIANT B: structural + monitor features ──────────────────────────────
    model_B = None
    if not args.no_monitor:
        # Check how many steps actually have monitor data
        monitor_present = sum(
            1 for tr in tr_traces for s in tr.steps if s.monitor is not None
        )
        total_steps = sum(len(tr.steps) for tr in tr_traces)
        pct = 100 * monitor_present / max(1, total_steps)
        print(f"\nMonitor coverage in train: {monitor_present}/{total_steps} ({pct:.1f}%)")
        if pct < 10:
            print(
                "  NOTICE: <10% monitor coverage in train runs — Variant B will train with available signals."
            )

        X_tr_B, y_tr_B, g_tr_B = build_arrays(tr_traces, include_monitor=True, bank=bank)
        X_val_B, y_val_B, g_val_B = build_arrays(val_traces, include_monitor=True, bank=bank)
        X_tst_B, y_tst_B, g_tst_B = build_arrays(tst_traces, include_monitor=True, bank=bank)
        X_shp_B, y_shp_B, g_shp_B = build_arrays(shop_traces, include_monitor=True, bank=bank)
        X_cal_B, y_cal_B, g_cal_B = build_arrays(cal_traces, include_monitor=True, bank=bank)

        model_B = train_variant(
            X_tr_B,
            y_tr_B,
            g_tr_B,
            X_val_B,
            y_val_B,
            g_val_B,
            FEATURE_NAMES_WITH_MONITOR,
            "B (structural+monitor)",
        )

    # ── EVAL TABLE ────────────────────────────────────────────────────────────
    print("\n=== EVALUATION ===")
    print(
        f"{'Variant':<22} {'test_known Top-1':>18} {'test_known Top-3':>18}"
        f" {'Shop Top-1':>12} {'Shop Top-3':>12}"
    )
    print("-" * 86)

    print(f"{'GNN baseline':22} {0.607:>18.3f} {0.929:>18.3f} {0.626:>12.3f} {'?':>12}")

    eval_pairs = [
        ("A (structural)", model_A, X_tst_A, y_tst_A, g_tst_A, X_shp_A, y_shp_A, g_shp_A),
    ]
    if model_B is not None:
        eval_pairs.append(
            ("B (struct+monitor)", model_B, X_tst_B, y_tst_B, g_tst_B, X_shp_B, y_shp_B, g_shp_B)
        )

    for name, m_obj, X_t, y_t, g_t, X_s, y_s, g_s in eval_pairs:
        t1 = top_k_accuracy(X_t, y_t, g_t, m_obj, 1)
        t3 = top_k_accuracy(X_t, y_t, g_t, m_obj, 3)
        s1 = top_k_accuracy(X_s, y_s, g_s, m_obj, 1)
        s3 = top_k_accuracy(X_s, y_s, g_s, m_obj, 3)
        beat1 = "✅" if t1 > 0.607 else "❌"
        beats = "✅" if s1 > 0.626 else "❌"
        print(f"  {name:<20} {t1:>17.3f}{beat1} {t3:>17.3f}  {s1:>11.3f}{beats} {s3:>12.3f}")

    # ── Coverage Evaluation at Conformal k ────────────────────────────────────
    print(f"\n=== CONFORMAL COVERAGE (k={k_A}) ===")
    evaluate_coverage(model_A, X_tst_A, y_tst_A, g_tst_A, k_A, "test_known")
    evaluate_coverage(model_A, X_shp_A, y_shp_A, g_shp_A, k_A, "test_new_tasks (Shop)")

    # ── SAVE ─────────────────────────────────────────────────────────────────
    with open(out / "ranker_A.pkl", "wb") as f:
        pickle.dump(model_A, f)
    print(f"\nSaved ranker_A -> {out}/ranker_A.pkl")

    if model_B is not None:
        with open(out / "ranker_B.pkl", "wb") as f:
            pickle.dump(model_B, f)
        print(f"Saved ranker_B -> {out}/ranker_B.pkl")

    # Save calibration data
    cal_data = {
        "A": {"X": X_cal_A.tolist(), "y": y_cal_A.tolist(), "groups": g_cal_A},
    }
    if model_B is not None:
        cal_data["B"] = {
            "X": X_cal_B.tolist(),
            "y": y_cal_B.tolist(),
            "groups": g_cal_B,
        }
    with open(out / "calib_data.json", "w") as f:
        json.dump(cal_data, f)
    print(f"Saved calib_data -> {out}/calib_data.json")


if __name__ == "__main__":
    main()
