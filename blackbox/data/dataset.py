"""BlackBox-3K: package the recorded runs as a dataset others can load (USP X8).

    py -3 -m blackbox.data.dataset export --out data/dataset/blackbox-3k
    py -3 -m blackbox.data.dataset stats  data/dataset/blackbox-3k

    from blackbox.data.dataset import load
    for trace in load("data/dataset/blackbox-3k", split="test_known", labelled_only=True):
        trace.run.label.root_cause_step

The export writes one gzip'd JSON-lines file per split (the team shard
format: each line holds a run, its steps and its save-points), `stats.json`,
and a dataset card `README.md` whose every number is computed from the runs.

Left out on purpose: crashed runs (a crash is our bug, not agent behaviour)
and imported runs (Who&When is someone else's dataset, not ours to republish).
"""

from __future__ import annotations

import argparse
import gzip
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Iterator

from blackbox.core.schema import SCHEMA_VERSION, Trace, utc_now
from blackbox.core.store import DEFAULT_DIR, Store
from blackbox.data import shards
from blackbox.eval.metrics import guilty_step
from blackbox.eval.report import data_summary, health_by_family, iter_traces, model_report_card
from blackbox.faults.catalog import FAULTS, UNSEEN_FAULTS

NAME = "BlackBox-3K"
SPLIT_NOTES = {
    "train": "70% of QA and Math tasks; mistakes F1–F6 only",
    "val": "10% of QA and Math tasks; mistakes F1–F6",
    "calib": "10% of QA and Math tasks; mistakes F1–F6 (for calibrating suspect lists)",
    "test_known": "10% of QA and Math tasks; mistakes F1–F6",
    "test_new_mistakes": "QA and Math tasks outside train; mistakes F7–F10, never trained on",
    "test_new_tasks": "every Shop run: a task family never trained on",
    "test_natural": "failures no one planted, labelled by replay experiments",
}


def included(trace: Trace) -> bool:
    return trace.run.status == "done" and trace.run.task_family != "external"


def export(store: Store, out_dir: Path) -> dict:
    """Write the dataset folder and return its stats."""
    by_split: dict[str, list[Trace]] = defaultdict(list)
    left_out = {"crashed": 0, "imported": 0, "unfinished": 0}
    for trace in iter_traces(store):
        if included(trace):
            by_split[trace.run.split or "unsplit"].append(trace)
        elif trace.run.task_family == "external":
            left_out["imported"] += 1
        elif trace.run.status == "crashed":
            left_out["crashed"] += 1
        else:
            left_out["unfinished"] += 1

    data_dir = out_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    save_points = 0
    for split, traces in sorted(by_split.items()):
        traces.sort(key=lambda t: t.run.run_id)
        with gzip.open(data_dir / f"{split}.jsonl.gz", "wt", encoding="utf-8") as fh:
            for trace in traces:
                line = shards._line(trace, store)  # noqa: SLF001 - the one shard line format
                save_points += len(json.loads(line)["blobs"])
                fh.write(line)

    everything = [t for traces in by_split.values() for t in traces]
    stats = {
        "name": NAME, "schema_version": SCHEMA_VERSION, "generated_at": utc_now(),
        "data": data_summary(everything),
        "steps": sum(len(t.steps) for t in everything),
        "save_points": save_points,
        "left_out": left_out,
        "files": {split: f"data/{split}.jsonl.gz" for split in sorted(by_split)},
        "health": health_by_family(everything),
        "model_report_card": model_report_card(everything),
    }
    (out_dir / "stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    (out_dir / "README.md").write_text(dataset_card(stats), encoding="utf-8")
    return stats


def load(path: str | Path, *, split: str | None = None, family: str | None = None,
         labelled_only: bool = False) -> Iterator[Trace]:
    """Runs from a dataset folder. `labelled_only` keeps failures with a known guilty step."""
    data_dir = Path(path) / "data"
    files = [data_dir / f"{split}.jsonl.gz"] if split else sorted(data_dir.glob("*.jsonl.gz"))
    for file in files:
        if not file.exists():
            raise FileNotFoundError(f"{file} is missing. Splits here: "
                                    f"{sorted(p.name.split('.')[0] for p in data_dir.glob('*.jsonl.gz'))}")
        for trace in shards.read_traces(file):
            if family and trace.run.task_family != family:
                continue
            if labelled_only and guilty_step(trace) is None:
                continue
            yield trace


def load_into_store(path: str | Path, store: Store) -> dict:
    """Merge a dataset folder into a store, save-points included, so its runs can be replayed and forked."""
    return shards.merge(store, [Path(path) / "data"])


def dataset_card(stats: dict) -> str:
    d = stats["data"]
    families = ", ".join(f"{fam} {n}" for fam, n in sorted(d["by_family"].items()))
    lines = [
        f"# {stats['name']}: agent runs you can rewind, with the guilty step marked", "",
        f"{d['runs']} recorded runs of three LLM agents, {stats['steps']} steps, {stats['save_points']} "
        f"save-points. {d['labelled_failures']} runs are failures whose guilty step is known. "
        f"Generated {stats['generated_at'][:10]}; schema version {stats['schema_version']}.", "",
        "## What a run is", "",
        "A run is one agent working on one task, recorded step by step (`blackbox.core.schema`):", "",
        "- **Steps**: every model call, tool call, search and the final answer, with what was asked "
        "(`request`), what came back (`output` or `error`), and which memory keys it read and wrote.",
        "- **Data flow**: `parents` lists the earlier steps whose output this step used.",
        "- **Save-points**: the agent's full memory after every step (`state_hash_after`), stored once per "
        "distinct state. A run can be replayed from any of them, or forked with one step changed.",
        "- **Outcome**: pass or fail, decided by a code checker (word-overlap F1 for QA, exact number for "
        "Math, final database state for Shop). No model judges an answer.",
        "- **Label**: for a failure, `label.root_cause_step` is the guilty step and `label.source` says how "
        "we know.", "",
        "## Where the failures come from", "",
        "| kind | how it is made | guilty step |", "|---|---|---|",
        "| clean run | the agent does the task | none (it passed), or unknown (a natural failure) |",
        "| planted mistake | a passing run is forked at step k with one mistake put in; steps before k "
        "come from the recording | step k, if the fork fails (`source = injected`) |",
        "| recovered | the same, but the agent still got it right | none: kept as a pass with `fault` set |",
        "| natural failure, verified | a failure nobody planted; steps are repaired one at a time until "
        "the outcome flips | the earliest step whose repair flips it (`source = verified`) |", "",
        f"Counts: {d['labelled_failures']} labelled failures "
        f"({', '.join(f'{k} {v}' for k, v in sorted(d['labelled_by_source'].items())) or 'none'}), "
        f"{d['natural_failures_unlabelled']} natural failures without a label.", "",
        "## The ten planted mistakes", "", "| id | mistake | step type | in training? |", "|---|---|---|---|",
    ]
    for fid, fault in FAULTS.items():
        lines.append(f"| {fid} | {fault.name} | {fault.step_kind} | {'no' if fid in UNSEEN_FAULTS else 'yes'} |")
    lines += ["", "## Splits", "",
              "Splits are by task: a question and every run made from it share one split, so no question is "
              "in both training and test.", "",
              "| split | runs | labelled failures | what it is | file |", "|---|---|---|---|---|"]
    for split, file in stats["files"].items():
        lines.append(f"| {split} | {d['by_split'].get(split, 0)} | {d['labelled_by_split'].get(split, 0)} | "
                     f"{SPLIT_NOTES.get(split, '')} | `{file}` |")
    lines += ["", "## Task families and models", "",
              f"Runs per family: {families}.", "",
              "| agent model | runs | clean pass rate | mean steps | planted runs that fail |", "|---|---|---|---|---|"]
    for model_id, c in stats["model_report_card"].items():
        rate = "–" if c["clean_pass_rate"] is None else f"{100 * c['clean_pass_rate']:.1f}%"
        fail = "–" if c["planted_fail_rate"] is None else f"{100 * c['planted_fail_rate']:.1f}%"
        lines.append(f"| {model_id} | {c['runs']} | {rate} | {c['mean_steps']} | {fail} |")
    lines += ["", "## How often a planted mistake breaks the run", "",
              "| family | mistake | runs | pass→fail | rate |", "|---|---|---|---|---|"]
    for family, h in stats["health"].items():
        for fid, row in h["faults"].items():
            rate = "–" if row["flip_pct"] is None else f"{row['flip_pct']:.1f}%"
            lines.append(f"| {family} | {fid} | {row['runs']} | {row['failed']} | {rate} |")
    out = stats["left_out"]
    lines += [
        "", "## Loading", "", "```python", "from blackbox.data.dataset import load, load_into_store", "",
        'for trace in load("blackbox-3k", split="test_known", labelled_only=True):',
        "    guilty = trace.run.label.root_cause_step",
        "    steps = trace.steps", "",
        "# to replay or fork runs, put them (and their save-points) into a store first",
        "from blackbox.core.store import Store",
        'load_into_store("blackbox-3k", Store("data"))', "```", "",
        "## Sources", "",
        "- QA tasks: HotpotQA, distractor setting, validation split (CC BY-SA 4.0). Each run's `task_input` "
        "holds the question and its ten paragraphs.",
        "- Math tasks: GSM8K, main config, test split (MIT).",
        "- Shop tasks: generated by `blackbox.data.tasks.ops_tasks`.", "",
        "## Limits", "",
        "- A planted mistake is a mechanical edit of one recorded step. It is a known cause, not a sample "
        "of how agents fail on their own; the natural failures are that sample.",
        "- When a planted fork fails, the planted step is labelled guilty. A fork can also fail for a second "
        "reason of its own after that step.",
        "- Rates in the tables above depend on the agent model: a stronger model recovers from more "
        "planted mistakes.",
        f"- Left out of this export: {out['crashed']} crashed runs, {out['imported']} imported runs, "
        f"{out['unfinished']} unfinished runs.", "",
    ]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="blackbox.data.dataset")
    sub = ap.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("export", help="write the dataset folder from the local store")
    e.add_argument("--data", default=str(DEFAULT_DIR))
    e.add_argument("--out", default=str(DEFAULT_DIR / "dataset" / "blackbox-3k"))
    s = sub.add_parser("stats", help="print a dataset folder's stats")
    s.add_argument("path")
    args = ap.parse_args(argv)
    if args.cmd == "stats":
        print((Path(args.path) / "stats.json").read_text(encoding="utf-8"))
        return 0
    store = Store(args.data)
    try:
        stats = export(store, Path(args.out))
    finally:
        store.close()
    print(f"{stats['data']['runs']} runs, {stats['data']['labelled_failures']} labelled failures, "
          f"{stats['save_points']} save-points -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
