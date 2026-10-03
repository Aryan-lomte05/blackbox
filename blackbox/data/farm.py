"""Generate recorded runs (SYSTEM.md §3.1).

For each task: one clean run. If it passes, fork it a few times with a
planted mistake (blackbox.faults) at a step chosen evenly across positions.

    fork fails      -> Label(root_cause_step=k, source="injected")
    fork recovers   -> kept as a passing run with `fault` set, no label
    anything crashes -> saved with status "crashed", counted, never labelled

    py -3 -m blackbox.data.farm --family qa --n 50 --model agent-small
    py -3 -m blackbox.data.farm --family math --n 200 --offset 200 --model agent-local --workers 2

Every run goes to the local store (data/blackbox.db) and to one shard file,
data/shards/<machine>_<time>.jsonl.gz, with one Trace per line.
"""

from __future__ import annotations

import argparse
import gzip
import random
import sys
import threading
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import blackbox.agents.builtin  # noqa: F401 - registers agents and checkers
from blackbox.agents.base import Task, get_agent, machine_name, run_task
from blackbox.core.hashing import fingerprint
from blackbox.core.schema import FaultSpec, Label, Trace
from blackbox.core.store import DEFAULT_DIR, Store
from blackbox.data.splits import split_for
from blackbox.data.tasks import load_tasks
from blackbox.faults.catalog import TRAIN_FAULTS, make_change
from blackbox.replay.engine import fork

AGENTS = {"qa": "qa_agent@v1", "math": "math_agent@v1"}
SHARD_DIR = DEFAULT_DIR / "shards"


def pick_faults(trace: Trace, fault_types: tuple[str, ...], n: int, rng: random.Random) -> list[tuple[str, int]]:
    """Up to n (fault type, step) pairs on distinct steps.

    Each pick draws a step kind (model / tool / search) evenly, then a step of
    that kind evenly, then one of the mistakes that fit it. Kinds are
    interleaved through a run, so planted steps stay spread over positions
    (the ranker must not learn "blame the last steps"), and model steps, which
    outnumber the others, do not crowd out the tool and search mistakes.
    """
    by_step: dict[int, list[str]] = defaultdict(list)
    for step in trace.steps:
        for ft in fault_types:
            if make_change(trace, ft, step.idx, random.Random(0)) is not None:
                by_step[step.idx].append(ft)
    by_kind: dict[str, list[int]] = defaultdict(list)
    for idx in sorted(by_step):
        by_kind[trace.steps[idx].kind].append(idx)
    picks: list[tuple[str, int]] = []
    while len(picks) < n and by_kind:
        kind = rng.choice(sorted(by_kind))
        idx = by_kind[kind].pop(rng.randrange(len(by_kind[kind])))
        if not by_kind[kind]:
            del by_kind[kind]
        picks.append((rng.choice(by_step[idx]), idx))
    return picks


def plant(trace: Trace, fault_type: str, step_idx: int, rng: random.Random, store: Store | None = None) -> Trace:
    """Fork `trace` with `fault_type` planted at `step_idx`, and label the result."""
    change = make_change(trace, fault_type, step_idx, rng)
    if change is None:
        raise ValueError(f"{fault_type} cannot be planted at step {step_idx} of run {trace.run.run_id}")
    child = fork(trace, step_idx, change, store=None)
    child.run.fault = FaultSpec(type=fault_type, step_idx=step_idx,
                                params={"change_kind": change.kind, "note": change.note})
    if child.run.status == "done" and child.run.outcome is not None and not child.run.outcome.success:
        child.run.label = Label(root_cause_step=step_idx, source="injected", notes=change.note)
    if store is not None:
        store.save_trace(child)
    return child


def farm_task(task: Task, model_id: str, *, store: Store | None, n_forks: int,
              fault_types: tuple[str, ...], seed: int) -> list[Trace]:
    """The clean run for one task, plus its planted-mistake forks if it passed."""
    split = split_for(task.task_id, task.family)
    clean = run_task(get_agent(AGENTS[task.family]), task, model_id, store=store, split=split)
    traces = [clean]
    if clean.run.status != "done" or clean.run.outcome is None or not clean.run.outcome.success:
        return traces  # a natural failure or a crash: nothing to plant on
    rng = random.Random(int(fingerprint([task.task_id, model_id, seed])[:12], 16))
    for fault_type, step_idx in pick_faults(clean, fault_types, n_forks, rng):
        traces.append(plant(clean, fault_type, step_idx, rng, store=store))
    return traces


def write_shard(traces: list[Trace], shard_dir: Path = SHARD_DIR) -> Path:
    shard_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = shard_dir / f"{machine_name()}_{stamp}.jsonl.gz"
    tmp = path.with_suffix(".tmp")
    with gzip.open(tmp, "wt", encoding="utf-8") as f:
        for trace in traces:
            f.write(trace.model_dump_json() + "\n")
    tmp.replace(path)
    return path


def read_shard(path: Path) -> list[Trace]:
    with gzip.open(path, "rt", encoding="utf-8") as f:
        return [Trace.model_validate_json(line) for line in f if line.strip()]


def health(traces: list[Trace]) -> dict:
    """The data health check: per mistake type, how many runs, how many turned
    a pass into a fail, how many crashed. Crashes are our bug, never a label."""
    clean = [t for t in traces if t.run.fault is None]
    clean_done = [t for t in clean if t.run.status == "done" and t.run.outcome is not None]
    by_fault: dict[str, Counter] = defaultdict(Counter)
    for t in traces:
        if t.run.fault is None:
            continue
        c = by_fault[t.run.fault.type]
        c["runs"] += 1
        if t.run.status != "done" or t.run.outcome is None:
            c["crashed"] += 1
        elif t.run.outcome.success:
            c["recovered"] += 1
        else:
            c["failed"] += 1
    faults = {}
    for ft in sorted(by_fault, key=lambda f: int(f[1:]) if f[1:].isdigit() else 99):
        c = by_fault[ft]
        finished = c["failed"] + c["recovered"]
        faults[ft] = {
            "runs": c["runs"], "failed": c["failed"], "recovered": c["recovered"], "crashed": c["crashed"],
            "flip_pct": round(100 * c["failed"] / finished, 1) if finished else None,
        }
    return {
        "runs": len(traces),
        "clean": len(clean),
        "clean_passed": sum(t.run.outcome.success for t in clean_done),
        "clean_failed": sum(not t.run.outcome.success for t in clean_done),
        "crashed": sum(t.run.status != "done" for t in traces),
        "labelled": sum(t.run.label is not None and t.run.label.root_cause_step is not None for t in traces),
        "steps_mean": round(sum(len(t.steps) for t in traces) / len(traces), 1) if traces else None,
        "faults": faults,
    }


def format_health(h: dict) -> str:
    lines = [
        f"runs {h['runs']}  |  clean {h['clean']} (passed {h['clean_passed']}, failed {h['clean_failed']})"
        f"  |  labelled failures {h['labelled']}  |  crashed {h['crashed']}  |  mean steps {h['steps_mean']}",
        f"{'mistake':8} {'runs':>5} {'pass->fail':>10} {'recovered':>9} {'crashed':>7} {'flip %':>7}",
    ]
    for ft, row in h["faults"].items():
        flip = "-" if row["flip_pct"] is None else f"{row['flip_pct']:.1f}"
        flag = "" if row["flip_pct"] is None or 30 <= row["flip_pct"] <= 90 else "  <- outside 30-90%: tune strength"
        lines.append(f"{ft:8} {row['runs']:>5} {row['failed']:>10} {row['recovered']:>9} {row['crashed']:>7} "
                     f"{flip:>7}{flag}")
    return "\n".join(lines)


def run_farm(tasks: list[Task], model_id: str, *, store: Store | None, n_forks: int = 3,
             fault_types: tuple[str, ...] = TRAIN_FAULTS, workers: int = 2, seed: int = 0,
             log=print) -> list[Trace]:
    traces: list[Trace] = []
    lock = threading.Lock()
    done = 0

    def one(task: Task) -> list[Trace]:
        return farm_task(task, model_id, store=store, n_forks=n_forks, fault_types=fault_types, seed=seed)

    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futures = {pool.submit(one, t): t for t in tasks}
        for fut in as_completed(futures):
            task = futures[fut]
            got = fut.result()  # run_task records crashes itself; anything raised here is a farm bug
            with lock:
                traces.extend(got)
                done += 1
                clean = got[0].run
                if clean.status != "done":
                    verdict = "CRASHED " + (clean.error or "").strip().splitlines()[-1][:120]
                else:
                    verdict = "pass" if clean.outcome and clean.outcome.success else "fail"
                planted = ", ".join(
                    f"{t.run.fault.type}@{t.run.fault.step_idx}:"
                    + ("crash" if t.run.status != "done" else "fail" if t.run.label else "recovered")
                    for t in got[1:]
                )
                log(f"[{done}/{len(tasks)}] {task.task_id} {verdict}" + (f"  |  {planted}" if planted else ""))
    return traces


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Generate clean and planted-mistake runs, and write a shard.")
    ap.add_argument("--family", required=True, choices=sorted(AGENTS))
    ap.add_argument("--n", type=int, default=50, help="number of tasks")
    ap.add_argument("--offset", type=int, default=0, help="skip this many tasks (give each machine its own range)")
    ap.add_argument("--model", default="agent-small", help="registry id from models.yaml")
    ap.add_argument("--forks", type=int, default=3, help="planted-mistake forks per passing run")
    ap.add_argument("--faults", default=",".join(TRAIN_FAULTS), help="comma-separated mistake types")
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args(argv)

    for stream in (sys.stdout, sys.stderr):  # Windows consoles choke on non-cp1252 answers
        stream.reconfigure(errors="replace")

    tasks = load_tasks(args.family, args.n, args.offset)
    store = Store()
    try:
        traces = run_farm(tasks, args.model, store=store, n_forks=args.forks,
                          fault_types=tuple(f.strip() for f in args.faults.split(",") if f.strip()),
                          workers=args.workers, seed=args.seed)
    finally:
        store.close()
    if not traces:
        print("no runs produced")
        return 1
    shard = write_shard(traces)
    print()
    print(format_health(health(traces)))
    print(f"\nshard: {shard}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
