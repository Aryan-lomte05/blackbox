"""The evaluation report (SYSTEM.md §7).

    py -3 -m blackbox.eval.report                         # baselines + any trained model found
    py -3 -m blackbox.eval.report --judge --judge-limit 40   # + LLM judge (needs the judge model's key)

Writes data/reports/latest.json and latest.md. Every number is computed here
from the runs in the store. A table we cannot compute is listed under
"absent" with the reason; it is never filled with a placeholder.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean
from typing import Iterator

from blackbox.core.schema import Trace, utc_now
from blackbox.core.store import DEFAULT_DIR, Store
from blackbox.data.farm import health
from blackbox.eval import llm_judge
from blackbox.eval.baselines import BASELINES, Predictor
from blackbox.eval.metrics import candidates, expected_random, guilty_step, score

TEST_SETS = ("test_known", "test_new_mistakes", "test_new_tasks", "test_natural", "test_outside")
SET_QUESTIONS = {
    "test_known": "does it work?",
    "test_new_mistakes": "does it handle new kinds of mistakes?",
    "test_new_tasks": "does it handle a new kind of task?",
    "test_natural": "does it work on real failures?",
    "test_outside": "does it work on other people's agents?",
}


def iter_traces(store: Store) -> Iterator[Trace]:
    offset = 0
    while True:
        batch = store.list_runs(limit=500, offset=offset)
        if not batch:
            return
        offset += len(batch)
        for run in batch:
            yield store.load_trace(run.run_id)


# ---- predictors that depend on what is installed and trained -------------------------------
def trained_predictors() -> tuple[dict[str, Predictor], dict[str, str]]:
    """Learned methods available on this machine, and why the others are not."""
    found: dict[str, Predictor] = {}
    missing: dict[str, str] = {}
    try:
        from blackbox.diagnosis.predict import diagnose  # type: ignore[import-not-found]

        found["ranker"] = lambda trace: _ranking_from(diagnose(trace))
    except ImportError:
        missing["ranker"] = "blackbox.diagnosis.predict is not in this checkout yet (Aditya)"
    try:
        from blackbox.diagnosis import gnn

        if gnn.available():
            found["gnn"] = lambda trace: _ranking_from(gnn.rank(trace, top_k=3))
        else:
            missing["gnn"] = f"no trained model at {gnn.MODEL_PATH} (run blackbox.diagnosis.gnn train)"
    except ImportError as exc:
        missing["gnn"] = f"cannot import the GNN ({exc.name} is not installed)"
    return found, missing


def _ranking_from(diagnosis: dict) -> list[int]:
    """Ranked step indices from a diagnose() result (ASSIGNMENTS.md hand-off 7)."""
    scores = diagnosis.get("scores") or []
    if scores and isinstance(scores[0], dict) and "idx" in scores[0]:
        key = "rank" if "rank" in scores[0] else None
        ordered = sorted(scores, key=lambda s: s[key]) if key else sorted(scores, key=lambda s: -s.get("p", 0))
        return [int(s["idx"]) for s in ordered]
    return [int(i) for i in diagnosis.get("suspects") or []]


# ---- tables ------------------------------------------------------------------------------------
def guilty_step_table(labelled: list[Trace], predictors: dict[str, Predictor],
                      limits: dict[str, int] | None = None) -> dict:
    """Per test set, per method: Top-1, Top-3, within one step, MRR."""
    limits = limits or {}
    table: dict = {}
    for test_set in TEST_SETS:
        runs = sorted((t for t in labelled if t.run.split == test_set), key=lambda t: t.run.run_id)
        if not runs:
            continue
        rows = {"random": expected_random(runs)}
        for name, predict in predictors.items():
            subset = runs[: limits[name]] if name in limits else runs
            rankings, roots = [], []
            for trace in subset:
                ranking = predict(trace)
                if ranking is None:
                    continue
                rankings.append([i for i in ranking if i in candidates(trace)])
                roots.append(guilty_step(trace))
            rows[name] = score(rankings, roots)
        table[test_set] = {"question": SET_QUESTIONS[test_set], "n_labelled": len(runs), "methods": rows}
    return table


def by_fault_table(labelled: list[Trace], predictors: dict[str, Predictor]) -> dict:
    """Top-1 per planted mistake type, over every labelled test run (not the training split)."""
    groups: dict[str, list[Trace]] = defaultdict(list)
    for t in labelled:
        if t.run.fault is not None and t.run.split in TEST_SETS:
            groups[t.run.fault.type].append(t)
    out = {}
    for fault in sorted(groups, key=lambda f: int(f[1:]) if f[1:].isdigit() else 99):
        runs = groups[fault]
        row = {"n": len(runs), "random": expected_random(runs)["top1"]}
        for name, predict in predictors.items():
            rankings = [predict(t) or [] for t in runs]
            row[name] = score(rankings, [guilty_step(t) for t in runs])["top1"]
        out[fault] = row
    return out


def data_summary(traces: list[Trace]) -> dict:
    done = [t for t in traces if t.run.status == "done"]
    labelled = [t for t in traces if guilty_step(t) is not None]
    return {
        "runs": len(traces),
        "crashed": sum(t.run.status == "crashed" for t in traces),
        "labelled_failures": len(labelled),
        "natural_failures_unlabelled": sum(
            t.run.fault is None and t.run.parent_run_id is None and t.run.label is None
            and t.run.outcome is not None and not t.run.outcome.success for t in done),
        "mistake_types": sorted({t.run.fault.type for t in traces if t.run.fault},
                                key=lambda f: int(f[1:]) if f[1:].isdigit() else 99),
        "by_family": dict(Counter(t.run.task_family for t in traces)),
        "by_split": dict(Counter(t.run.split or "none" for t in traces)),
        "labelled_by_split": dict(Counter(t.run.split or "none" for t in labelled)),
        "labelled_by_source": dict(Counter(t.run.label.source for t in labelled)),
        "machines": dict(Counter(t.run.machine or "unknown" for t in traces)),
    }


def health_by_family(traces: list[Trace]) -> dict:
    """The data health check, per task family: per mistake, how often a pass became a fail."""
    groups: dict[str, list[Trace]] = defaultdict(list)
    for t in traces:
        if t.run.task_family != "external":
            groups[t.run.task_family].append(t)
    return {family: health(runs) for family, runs in sorted(groups.items())}


def model_report_card(traces: list[Trace]) -> dict:
    """Which model fails how (USP X7): per agent model, pass rate, mistake mix, where the guilty step sits."""
    groups: dict[str, list[Trace]] = defaultdict(list)
    for t in traces:
        if t.run.task_family != "external":
            groups[t.run.model_id].append(t)
    card = {}
    for model_id, runs in sorted(groups.items()):
        clean = [t for t in runs if t.run.fault is None and t.run.parent_run_id is None
                 and t.run.status == "done" and t.run.outcome is not None]
        planted = [t for t in runs if t.run.fault is not None and t.run.status == "done" and t.run.outcome]
        labelled = [t for t in runs if guilty_step(t) is not None]
        thirds = Counter()
        for t in labelled:
            position = guilty_step(t) / max(1, len(candidates(t)) - 1)
            thirds["early" if position < 1 / 3 else "middle" if position < 2 / 3 else "late"] += 1
        tokens = [(t.run.stats.get("tokens_in") or 0) + (t.run.stats.get("tokens_out") or 0)
                  for t in clean if t.run.stats.get("tokens_in") is not None]
        card[model_id] = {
            "runs": len(runs),
            "clean_runs": len(clean),
            "clean_pass_rate": round(mean(t.run.outcome.success for t in clean), 4) if clean else None,
            "clean_pass_rate_by_family": {
                fam: round(mean(t.run.outcome.success for t in clean if t.run.task_family == fam), 4)
                for fam in sorted({t.run.task_family for t in clean})},
            "mean_steps": round(mean(len(t.steps) for t in clean), 1) if clean else None,
            "mean_tokens_per_clean_run": round(mean(tokens)) if tokens else None,  # provider-reported only
            "planted_runs": len(planted),
            "planted_fail_rate": round(mean(not t.run.outcome.success for t in planted), 4) if planted else None,
            "failures_by_mistake": dict(sorted(Counter(t.run.fault.type for t in labelled if t.run.fault).items(),
                                               key=lambda kv: int(kv[0][1:]) if kv[0][1:].isdigit() else 99)),
            "guilty_step_position": {k: thirds[k] for k in ("early", "middle", "late")},
        }
    return card


def suspect_list_table(labelled: list[Trace], predictors: dict[str, Predictor]) -> dict | None:
    """How often the first three suspects contain the guilty step, per test set (learned methods only)."""
    out: dict = {}
    for name, predict in predictors.items():
        for test_set in TEST_SETS:
            runs = [t for t in labelled if t.run.split == test_set]
            if not runs:
                continue
            lists = [(predict(t) or [])[:3] for t in runs]
            out.setdefault(name, {})[test_set] = {
                "n": len(runs),
                "hit_rate": round(mean(guilty_step(t) in lst for t, lst in zip(runs, lists)), 4),
                "mean_list_length": round(mean(len(lst) for lst in lists), 2),
            }
    return out or None


def build_report(traces: list[Trace], *, judge: llm_judge.Judge | None = None, judge_limit: int = 40,
                 judge_unavailable: str | None = None) -> dict:
    labelled = [t for t in traces if guilty_step(t) is not None]
    learned, missing = trained_predictors()
    predictors: dict[str, Predictor] = {**BASELINES, **learned}
    limits: dict[str, int] = {}
    absent = {name: reason for name, reason in missing.items()}
    if judge is not None:
        for method in llm_judge.METHODS:
            name = f"llm_judge_{method}"
            predictors[name] = lambda trace, m=method: judge.rank(trace, m)
            limits[name] = judge_limit
    else:
        absent["llm_judge"] = judge_unavailable or "not requested (run with --judge)"

    report = {
        "generated_at": utc_now(),
        "data": data_summary(traces),
        "health": health_by_family(traces),
        "model_report_card": model_report_card(traces),
        "guilty_step": guilty_step_table(labelled, predictors, limits),
        "guilty_step_top1_by_mistake": by_fault_table(labelled, {k: v for k, v in predictors.items()
                                                                  if k not in limits}),
        "methods": ["random", *predictors],
        "judge": None if judge is None else {"model_id": judge.model_id, "limit_per_test_set": judge_limit,
                                             "calls_this_run": judge.calls},
    }
    suspects = suspect_list_table(labelled, learned)
    if suspects:
        report["suspect_list_top3"] = suspects
    else:
        absent["suspect_list"] = "needs a trained method; none is available on this machine"
    for test_set in TEST_SETS:
        if test_set not in report["guilty_step"]:
            absent[f"guilty_step.{test_set}"] = {
                "test_natural": "no natural failure has a verified label yet (blackbox.replay.label_natural)",
                "test_outside": "Who&When is not imported (py -3 -m blackbox.data.importers.who_and_when)",
            }.get(test_set, "no labelled failure in this set yet")
    if not any(s.monitor for t in traces for s in t.steps):
        absent["live_warning"] = "no recorded run carries step-checker answers"
        absent["jev_vs_llm"] = "no recorded run carries step-checker answers"
    else:
        absent["live_warning"] = "computed by the monitor's owner (Aditya); not in this harness yet"
        absent["jev_vs_llm"] = "computed by the monitor's owner (Aditya); not in this harness yet"
    absent["verify"] = "needs verification results joined to suspect lists (Aryan + a trained method)"
    absent["repair"] = "needs repair results (Aryan)"
    absent["report_citations"] = "needs generated incident reports (Aditya)"
    report["absent"] = absent
    return report


# ---- markdown ---------------------------------------------------------------------------------
def _pct(value) -> str:
    return "–" if value is None else f"{100 * value:.1f}%"


def to_markdown(report: dict) -> str:
    d = report["data"]
    lines = [
        "# Black Box evaluation", "",
        f"Generated {report['generated_at']} from {d['runs']} runs "
        f"({d['labelled_failures']} labelled failures, {d['natural_failures_unlabelled']} unlabelled natural "
        f"failures, {d['crashed']} crashed).", "",
        "## Finding the guilty step", "",
    ]
    if report.get("judge"):
        j = report["judge"]
        lines += [f"LLM judge: model `{j['model_id']}`, on the first {j['limit_per_test_set']} labelled runs "
                  f"of each test set (its `n` is smaller than the other methods').", ""]
    for test_set, block in report["guilty_step"].items():
        lines += [f"### {test_set}: {block['question']} (n = {block['n_labelled']})", "",
                  "| method | n | Top-1 | 95% CI | Top-3 | within ±1 | MRR |", "|---|---|---|---|---|---|---|"]
        for name, m in block["methods"].items():
            if not m.get("n"):
                lines.append(f"| {name} | 0 | – | – | – | – | – |")
                continue
            ci = "–" if not m.get("top1_ci95") else f"{_pct(m['top1_ci95'][0])} to {_pct(m['top1_ci95'][1])}"
            lines.append(f"| {name} | {m['n']} | {_pct(m['top1'])} | {ci} | {_pct(m['top3'])} | "
                         f"{_pct(m['pm1'])} | {m['mrr']:.3f} |")
        lines.append("")
    if report["guilty_step_top1_by_mistake"]:
        methods = [m for m in report["methods"] if not m.startswith("llm_judge")]
        lines += ["## Top-1 by planted mistake (test sets only)", "",
                  "| mistake | n | " + " | ".join(methods) + " |", "|---|---|" + "---|" * len(methods)]
        for fault, row in report["guilty_step_top1_by_mistake"].items():
            lines.append(f"| {fault} | {row['n']} | " + " | ".join(_pct(row.get(m)) for m in methods) + " |")
        lines.append("")
    lines += ["## Data health: how often a planted mistake turns a pass into a fail", "",
              "| family | mistake | runs | pass→fail | recovered | crashed | rate |", "|---|---|---|---|---|---|---|"]
    for family, h in report["health"].items():
        for fault, row in h["faults"].items():
            rate = "–" if row["flip_pct"] is None else f"{row['flip_pct']:.1f}%"
            lines.append(f"| {family} | {fault} | {row['runs']} | {row['failed']} | {row['recovered']} | "
                         f"{row['crashed']} | {rate} |")
    lines += ["", "## Model report card", "",
              "| model | runs | clean pass rate | mean steps | planted runs that fail | guilty step early / middle / late |",
              "|---|---|---|---|---|---|"]
    for model_id, c in report["model_report_card"].items():
        pos = c["guilty_step_position"]
        lines.append(f"| {model_id} | {c['runs']} | {_pct(c['clean_pass_rate'])} | {c['mean_steps']} | "
                     f"{_pct(c['planted_fail_rate'])} | {pos['early']} / {pos['middle']} / {pos['late']} |")
    lines += ["", "## Not in this report", ""]
    lines += [f"- **{name}**: {reason}" for name, reason in report["absent"].items()]
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Write data/reports/latest.json and latest.md.")
    ap.add_argument("--data", default=str(DEFAULT_DIR), help="data directory holding blackbox.db")
    ap.add_argument("--out", default=None, help="report directory (default: <data>/reports)")
    ap.add_argument("--judge", action="store_true", help="also run the LLM-judge baseline")
    ap.add_argument("--judge-model", default="judge-large", help="registry id of the judge model")
    ap.add_argument("--judge-limit", type=int, default=40, help="labelled runs judged per test set")
    args = ap.parse_args(argv)

    out_dir = Path(args.out) if args.out else Path(args.data) / "reports"
    store = Store(args.data)
    try:
        traces = list(iter_traces(store))
    finally:
        store.close()

    judge, why_not = None, None
    if args.judge:
        why_not = llm_judge.available(args.judge_model)
        if why_not is None:
            judge = llm_judge.Judge(args.judge_model, out_dir / "judge_cache.json")
        else:
            print(f"LLM judge skipped: {why_not}", file=sys.stderr)
    try:
        report = build_report(traces, judge=judge, judge_limit=args.judge_limit, judge_unavailable=why_not)
    finally:
        if judge is not None:
            judge.save()  # keep what was paid for, even if a later call failed

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "latest.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (out_dir / "latest.md").write_text(to_markdown(report), encoding="utf-8")
    print(f"{report['data']['runs']} runs, {report['data']['labelled_failures']} labelled failures "
          f"-> {out_dir / 'latest.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
