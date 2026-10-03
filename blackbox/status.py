"""`blackbox status`: what is happening on this machine right now.

    blackbox status            one snapshot
    blackbox status --watch 5  refresh every 5 s (Ctrl+C to stop)

Shows: the job queue (data/status/queue.json), running Black Box processes,
GPU and Ollama load, the last line of every job log, and data totals.
Everything is read live; nothing is cached or assumed.

Queue file format (edited by whoever starts jobs):
    [{"name": "...", "state": "done|running|queued|failed", "cmd": "...", "log": "data/logs/x.log", "note": "..."}]
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from collections import Counter
from datetime import datetime
from pathlib import Path

from blackbox.core.store import DEFAULT_DIR, Store

QUEUE = DEFAULT_DIR / "status" / "queue.json"
LOG_DIR = DEFAULT_DIR / "logs"
NOISE = re.compile(r"warn|Warning|oneDNN|absl|tensorflow|Redirects|np\.object|^\s*$|^\s*warnings\.warn")
ICON = {"done": "✅", "running": "🔄", "queued": "⏳", "failed": "❌"}


def _age(ts: float) -> str:
    s = int(time.time() - ts)
    return f"{s}s ago" if s < 120 else f"{s // 60}m ago" if s < 7200 else f"{s // 3600}h ago"


def queue_section() -> list[str]:
    if not QUEUE.exists():
        return ["  (no queue file: data/status/queue.json)"]
    out = []
    for i, job in enumerate(json.loads(QUEUE.read_text(encoding="utf-8")), 1):
        out.append(f"  {i}. {ICON.get(job.get('state'), '•')} {job.get('state', '?'):8} {job['name']}")
        if job.get("note"):
            out.append(f"       {job['note']}")
    return out


def processes_section() -> list[str]:
    try:
        import psutil
    except ImportError:
        return ["  (install psutil to see processes)"]
    seen: dict[str, tuple[float, str]] = {}
    for p in psutil.process_iter(["pid", "cmdline", "create_time"]):
        cmd = p.info.get("cmdline") or []
        mod = next((c for c in cmd if c.startswith("blackbox.")), None)
        if not mod or "blackbox.status" in mod or "blackbox.cli" in mod and "status" in cmd:
            continue
        args = " ".join(cmd[cmd.index(mod) + 1:])[:90]
        try:
            cpu = p.cpu_percent(interval=0.1)
            mem = p.memory_info().rss / 1e9
        except psutil.Error:
            cpu, mem = 0.0, 0.0
        mins = (time.time() - p.info["create_time"]) / 60
        line = f"  pid {p.info['pid']:>6}  {mins:5.0f} min  cpu {cpu:5.1f}%  ram {mem:4.1f} GB  {mod} {args}"
        key = f"{mod} {args}"  # Windows: the py launcher and its python child share a command line
        if key not in seen or mem > seen[key][0]:
            seen[key] = (mem, line)
    return [line for _, line in seen.values()] or ["  (no Black Box jobs running)"]


def gpu_section() -> list[str]:
    out = []
    try:
        q = subprocess.run(["nvidia-smi", "--query-gpu=name,utilization.gpu,memory.used,memory.total",
                            "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=5)
        for line in q.stdout.strip().splitlines():
            name, util, used, total = [x.strip() for x in line.split(",")]
            out.append(f"  GPU {name}: {util}% busy, {int(used) / 1024:.1f}/{int(total) / 1024:.1f} GB")
    except (OSError, subprocess.SubprocessError, ValueError):
        out.append("  GPU: nvidia-smi not available")
    try:
        with urllib.request.urlopen("http://localhost:11434/api/ps", timeout=2) as r:
            models = json.load(r).get("models", [])
        loaded = ", ".join(f"{m['name']} ({m.get('size_vram', 0) / 1e9:.1f} GB on GPU)" for m in models) or "none"
        out.append(f"  Ollama loaded: {loaded}")
    except OSError:
        out.append("  Ollama: not running")
    return out


def logs_section() -> list[str]:
    if not LOG_DIR.exists():
        return ["  (no logs)"]
    out = []
    for f in sorted(LOG_DIR.glob("*.log"), key=lambda p: p.stat().st_mtime, reverse=True):
        lines = [l for l in f.read_text(encoding="utf-8", errors="replace").splitlines() if not NOISE.search(l)]
        last = lines[-1].strip() if lines else "(empty: output may be buffered)"
        out.append(f"  {f.name:28} {_age(f.stat().st_mtime):>8}  {last[:95]}")
    return out


def data_section(store: Store) -> list[str]:
    c = store.counts()
    runs, offset = [], 0
    while True:
        batch = store.list_runs(limit=1000, offset=offset)
        if not batch:
            break
        runs += batch
        offset += len(batch)
    fam = Counter(r.task_family for r in runs)
    lab = Counter((r.label.source, r.split) for r in runs if r.label and r.label.root_cause_step is not None)
    by_source = Counter(src for (src, _), n in lab.items() for _ in range(n))
    dedup = 100 * (1 - c["unique_save_points"] / c["save_points"]) if c["save_points"] else 0
    return [
        f"  runs {c['runs']}  ({', '.join(f'{k} {v}' for k, v in sorted(fam.items()))})   steps {c['steps']}",
        f"  labelled failures {c['labelled_failures']}  (by source: {dict(by_source)})",
        f"  labelled by split: {dict(sorted(Counter(s for (_, s), n in lab.items() for _ in range(n)).items(), key=str))}",
        f"  save-points {c['save_points']} stored as {c['unique_save_points']} files ({dedup:.0f}% de-duplicated)",
    ]


def model_section() -> list[str]:
    out = []
    m = DEFAULT_DIR / "models" / "gnn_metrics.json"
    if m.exists():
        d = json.loads(m.read_text(encoding="utf-8"))
        for split, r in d.get("splits", {}).items():
            out.append(f"  GNN {d.get('variant', 'full')} {split:16} n={r['n']:<4} top1 {r['top1']:.3f}  top3 {r['top3']:.3f}"
                       f"   ({_age(m.stat().st_mtime)})")
    cv = DEFAULT_DIR / "models" / "gnn_cv.json"
    if cv.exists():
        d = json.loads(cv.read_text(encoding="utf-8"))
        out.append(f"  CV chose: {d['chosen']}  " + ", ".join(f"{k} t1 {v['top1']:.2f}/t3 {v['top3']:.2f}" for k, v in d["results"].items()))
    return out or ["  (no trained model yet)"]


def snapshot(store: Store) -> str:
    sections = [
        ("QUEUE", queue_section()),
        ("RUNNING NOW", processes_section()),
        ("MACHINE", gpu_section()),
        ("LOGS (newest first)", logs_section()),
        ("DATA", data_section(store)),
        ("MODEL", model_section()),
    ]
    head = f"BLACK BOX STATUS  ·  {datetime.now():%H:%M:%S}  ·  {os.environ.get('BLACKBOX_MACHINE', '')}"
    body = [head, "=" * len(head)]
    for title, lines in sections:
        body += ["", title] + lines
    return "\n".join(body)


def main(argv: list[str] | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(prog="blackbox status")
    p.add_argument("--watch", type=float, default=0, help="refresh every N seconds")
    args = p.parse_args(argv)
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")
    store = Store()
    while True:
        text = snapshot(store)
        if args.watch:
            os.system("cls" if os.name == "nt" else "clear")
        print(text, flush=True)
        if not args.watch:
            return 0
        time.sleep(args.watch)


if __name__ == "__main__":
    sys.exit(main())
