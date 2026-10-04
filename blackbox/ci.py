"""Black Box CI: a regression firewall for agent code, on every pull request.

    blackbox ci pin  --fail 5 --pass 5 [--family qa]     # choose recorded runs -> .blackbox/pack.json (commit it)
    blackbox ci run  [--live] [--report ci.md] [--junit ci.xml] [--import my_agents]

A *regression pack* embeds whole recorded runs in one JSON file, so CI needs no data folder. `ci run` replays
each pinned run against the code being tested:
  - same       the code asks exactly what it asked when the run was recorded (no behaviour change)
  - changed    the code now asks something different at step k (a prompt edit, a new tool call, ...)
With --live, every changed run is re-run from step k with the new code (earlier steps still come from the
recording) and its new outcome is compared with the recorded one:
  - fixed       failed before, passes now
  - regression  passed before, fails now   -> the build fails
  - held        same outcome
Without --live (no model access in CI), a changed run is reported as needing a live check.
Money-moving tools never execute. Exit code 1 on any regression, or on an unreadable / crashed run.
"""

from __future__ import annotations

import argparse
import importlib
import json
import re
import sys
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape, quoteattr

from blackbox.core.schema import Trace
from blackbox.core.store import DEFAULT_DIR, Store

PACK_PATH = Path(".blackbox/pack.json")
_DIVERGED = re.compile(r"step (\d+) \(")


def _passed(tr: Trace) -> bool | None:
    if tr.run.status != "done" or tr.run.outcome is None:
        return None
    return bool(tr.run.outcome.success)


# ---- pin -----------------------------------------------------------------------------------------------
def pin(store: Store, *, run_ids: list[str] | None = None, n_fail: int = 5, n_pass: int = 5,
        family: str | None = None) -> dict:
    """A regression pack: recorded runs (original runs, not forks) with their recorded outcome."""
    if not run_ids:
        def originals(success: bool) -> list[str]:
            return [r.run_id for r in store.list_runs(success=success, task_family=family, limit=500)
                    if r.parent_run_id is None and r.fault is None and r.status == "done"]
        run_ids = originals(False)[:n_fail] + originals(True)[:n_pass]
    traces = [store.load_trace(rid) for rid in run_ids]
    return {"format": "blackbox-pack/1", "runs": [json.loads(t.model_dump_json()) for t in traces]}


# ---- run -----------------------------------------------------------------------------------------------
def check_run(trace: Trace, *, live: bool, store: Store | None = None) -> dict:
    from blackbox.recorder.context import dry_run_tools
    from blackbox.replay.engine import fork, replay
    from blackbox.replay.fleet import MONEY_TOOLS

    before = _passed(trace)
    row: dict[str, Any] = {"run_id": trace.run.run_id, "agent": trace.run.agent, "task": trace.run.task_id,
                           "before": before}
    token = dry_run_tools.set(MONEY_TOOLS | dry_run_tools.get())
    try:
        again = replay(trace)
        diverged = _DIVERGED.search(again.run.error or "") if again.run.status == "crashed" else None
        if diverged is None and again.run.status == "crashed":
            return {**row, "status": "error", "detail": again.run.error}
        if diverged is None:
            return {**row, "status": "same", "detail": "asks exactly what it asked when recorded"}
        k = int(diverged.group(1))
        row.update(changed_at=k, detail=f"behaviour changed at step {k} ({trace.steps[k].kind}:{trace.steps[k].name})"
                   if k < len(trace.steps) else f"behaviour changed at step {k} (a new step)")
        if not live:
            return {**row, "status": "needs live check"}
        child = fork(trace, min(k, len(trace.steps) - 1), None, store=store)
        after = _passed(child)
        row.update(after=after, new_run=child.run.run_id,
                   answer=child.run.outcome.final_answer if child.run.outcome else None)
        if after is None:
            return {**row, "status": "error", "detail": row["detail"] + f"; the new run crashed: {child.run.error}"}
        status = "fixed" if (before is False and after) else "regression" if (before and not after) else "held"
        return {**row, "status": status}
    except Exception as exc:  # noqa: BLE001 - one unreadable run is a CI error, not a crash of the check
        return {**row, "status": "error", "detail": f"{type(exc).__name__}: {exc}"}
    finally:
        dry_run_tools.reset(token)


FAILING = ("regression", "error")


def run_pack(pack: dict, *, live: bool = False, store: Store | None = None) -> dict:
    traces = [Trace.model_validate(t) for t in pack.get("runs", [])]
    rows = [check_run(t, live=live, store=store) for t in traces]
    counts: dict[str, int] = {}
    for r in rows:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    ok = not any(r["status"] in FAILING for r in rows)
    return {"passed": ok, "live": live, "runs": len(rows), "counts": counts, "rows": rows}


# ---- reports -------------------------------------------------------------------------------------------
ICON = {"same": "✅", "held": "✅", "fixed": "🟢", "regression": "🔴", "needs live check": "🟡", "error": "⛔"}


def to_markdown(rep: dict) -> str:
    verdict = "✅ **PASS**: no regressions" if rep["passed"] else "🔴 **FAIL**: regressions or errors found"
    lines = [f"## Black Box CI: {verdict}", "",
             f"{rep['runs']} recorded runs replayed against this code"
             + (" (changed runs re-run live from the first changed step)." if rep["live"] else "."),
             "", " · ".join(f"{ICON.get(k, '')} {k}: {v}" for k, v in sorted(rep["counts"].items())), "",
             "| | Run | Agent | Before | After | What happened |", "|---|---|---|---|---|---|"]
    for r in rep["rows"]:
        fmt = {True: "pass", False: "fail", None: "—"}
        lines.append(f"| {ICON.get(r['status'], '')} | `{r['run_id']}` | {r['agent']} | {fmt[r.get('before')]} | "
                     f"{fmt[r.get('after')] if 'after' in r else '—'} | {r['status']}: {r.get('detail', '')} |")
    return "\n".join(lines) + "\n"


def to_junit(rep: dict) -> str:
    cases = []
    for r in rep["rows"]:
        body = ""
        if r["status"] in FAILING:
            body = f"<failure message={quoteattr(r['status'])}>{escape(r.get('detail', ''))}</failure>"
        elif r["status"] == "needs live check":
            body = f"<skipped message={quoteattr(r.get('detail', ''))}/>"
        cases.append(f'  <testcase classname="blackbox.{escape(r["agent"])}" name={quoteattr(r["run_id"])}>{body}</testcase>')
    failures = sum(r["status"] in FAILING for r in rep["rows"])
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="blackbox-ci" tests="{rep["runs"]}" '
            f'failures="{failures}">\n' + "\n".join(cases) + "\n</testsuite>\n")


# ---- CLI -----------------------------------------------------------------------------------------------
def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="blackbox ci", description="Regression firewall for agent code.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("pin", help="write a regression pack from recorded runs")
    p.add_argument("run_ids", nargs="*")
    p.add_argument("--fail", type=int, default=5)
    p.add_argument("--pass", dest="n_pass", type=int, default=5)
    p.add_argument("--family")
    p.add_argument("--out", default=str(PACK_PATH))
    p.add_argument("--data", default=str(DEFAULT_DIR))
    r = sub.add_parser("run", help="replay the pack against this code")
    r.add_argument("--pack", default=str(PACK_PATH))
    r.add_argument("--live", action="store_true", help="re-run changed runs from the first changed step (needs models)")
    r.add_argument("--report", help="write a Markdown report here (e.g. for a PR comment)")
    r.add_argument("--junit", help="write JUnit XML here")
    r.add_argument("--import", dest="imports", action="append", default=[],
                   help="module that registers your agents (repeatable); the built-in agents are always loaded")
    args = ap.parse_args(argv)
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")

    if args.cmd == "pin":
        store = Store(args.data)
        pack = pin(store, run_ids=args.run_ids or None, n_fail=args.fail, n_pass=args.n_pass, family=args.family)
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(pack, ensure_ascii=False), encoding="utf-8")
        print(f"pinned {len(pack['runs'])} runs -> {out} ({out.stat().st_size // 1024} KB). Commit it.")
        return 0

    importlib.import_module("blackbox.agents.builtin")
    for mod in args.imports:
        importlib.import_module(mod)
    pack = json.loads(Path(args.pack).read_text(encoding="utf-8"))
    rep = run_pack(pack, live=args.live)
    md = to_markdown(rep)
    print(md)
    if args.report:
        Path(args.report).write_text(md, encoding="utf-8")
    if args.junit:
        Path(args.junit).write_text(to_junit(rep), encoding="utf-8")
    return 0 if rep["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
