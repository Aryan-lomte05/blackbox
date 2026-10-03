"""`blackbox` command line.

    blackbox ui [--port 8000]          serve the API (+ the web app once it is built into the package)
    blackbox runs [--fail] [-n 20]     list recorded runs
    blackbox show <run_id>             print a run step by step
    blackbox replay <run_id>           replay from the recording (0 model calls) and compare outcomes
    blackbox models                    check every models.yaml model exists at its provider
    blackbox demo [--run ID]           the whole investigation on a real failed run
    blackbox status [--watch 5]        what is running right now (queue, processes, GPU, logs, data)
    blackbox lab "question" [--repair] the Live Lab: plant a mistake in a live run and investigate it
"""

from __future__ import annotations

import argparse
import json
import sys

from blackbox.core.store import Store


def _short(value, width: int = 90) -> str:
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, default=str)
    text = " ".join(text.split())
    return text if len(text) <= width else text[: width - 1] + "…"


def cmd_runs(args) -> int:
    runs = Store(args.data).list_runs(success=False if args.fail else None, task_family=args.family, limit=args.n)
    if not runs:
        print("no runs recorded yet")
        return 0
    for r in runs:
        verdict = "crash" if r.status == "crashed" else ("—" if r.outcome is None else
                                                          ("pass" if r.outcome.success else "FAIL"))
        fork = f" fork of {r.parent_run_id}@{r.fork_step_idx}" if r.parent_run_id else ""
        print(f"{r.run_id}  {verdict:5}  {r.task_family:8} {r.task_id:20} steps={r.stats.get('n_steps', '?')}{fork}")
    return 0


def cmd_show(args) -> int:
    tr = Store(args.data).load_trace(args.run_id)
    r = tr.run
    print(f"run {r.run_id}  agent={r.agent}  model={r.model_id}  status={r.status}")
    if r.outcome:
        print(f"outcome: {'PASS' if r.outcome.success else 'FAIL'}  answer={_short(r.outcome.final_answer, 60)}"
              f"  expected={_short(r.outcome.expected, 60)}")
    for s in tr.steps:
        flag = " (reused)" if s.cached else ""
        parents = f" ← {s.parents}" if s.parents else ""
        body = s.error and f"ERROR {s.error}" or _short(s.output)
        print(f"  [{s.idx:2}] {s.kind:9} {s.name:22}{parents}{flag}\n       {body}")
    if r.error:
        print("\ncrash:\n" + r.error)
    return 0


def cmd_replay(args) -> int:
    import blackbox  # noqa: F401  (registers integrations for function agents)
    from blackbox.replay.engine import replay, savings

    store = Store(args.data)
    tr = store.load_trace(args.run_id)
    again = replay(tr)
    print(json.dumps({"status": again.run.status, "same_outcome":
                      bool(again.run.outcome and tr.run.outcome
                           and again.run.outcome.success == tr.run.outcome.success),
                      "savings": savings(again)}, indent=2))
    return 0 if again.run.status == "done" else 1


def cmd_models(args) -> int:
    from blackbox.recorder.providers import verify

    rows = verify()
    for mid, status, detail in rows:
        print(f"{status:8} {mid:16} {detail}")
    return 0 if all(s == "OK" for _, s, _ in rows) else 1


def cmd_ui(args) -> int:
    try:
        import uvicorn
    except ImportError:
        print("the UI needs the extra: pip install 'agent-blackbox[ui]'", file=sys.stderr)
        return 2
    from blackbox.api.main import create_app

    print(f"Black Box on http://{args.host}:{args.port}  (data: {args.data})")
    uvicorn.run(create_app(Store(args.data), examples=True), host=args.host, port=args.port)
    return 0


def _export_test(args) -> int:
    from pathlib import Path

    from blackbox.api.ui import export_test

    path = Path(args.out) / f"test_run_{args.run_id}.py"
    path.write_text(export_test(Store(args.data).load_trace(args.run_id)), encoding="utf-8")
    print(f"wrote {path}  (run it with: pytest {path})")
    return 0


def cmd_crash_test(args) -> int:
    import blackbox.agents.builtin  # noqa: F401
    from blackbox.replay.chaos import crash_test, format_report

    store = Store(args.data)

    def show(e: dict) -> None:
        if e.get("type") == "test":
            print(f"  {e['n']}/{e['of']} {e['fault']} at step {e['step']}: {e['verdict']}", flush=True)

    print(format_report(crash_test(store.load_trace(args.run_id), store, per_fault=args.per_fault, on_event=show)))
    return 0


def cmd_fleet(args) -> int:
    import blackbox.agents.builtin  # noqa: F401
    from blackbox.replay.fleet import fleet_test, format_report, one_fix_for_many, similar_runs

    store = Store(args.data)

    def show(e: dict) -> None:
        if e.get("type") == "rule":
            print(f"rule: {e['rule']}")
        elif e.get("type") == "run":
            print(f"  {e['n']}/{e['of']} {e['run_id']}: {e['verdict']}", flush=True)

    if args.model and not args.rule:
        ids = similar_runs(store, store.load_trace(args.run_id), args.fail, args.n_pass)
        rep = fleet_test(store, ids, model=args.model, on_event=show)
    else:
        rep = one_fix_for_many(store, args.run_id, rule=args.rule, n_fail=args.fail, n_pass=args.n_pass, on_event=show)
    print(format_report(rep))
    return 0


def cmd_demo(args) -> int:
    from blackbox.demo import demo

    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")
    return demo(Store(args.data), args.run, args.repeats)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="blackbox", description="A flight recorder for AI agents.")
    p.add_argument("--data", default=None, help="data directory (default: $BLACKBOX_DATA or ./data)")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("runs", help="list recorded runs")
    s.add_argument("--fail", action="store_true", help="only failed runs")
    s.add_argument("--family")
    s.add_argument("-n", type=int, default=20)
    s.set_defaults(fn=cmd_runs)

    s = sub.add_parser("show", help="print a run step by step")
    s.add_argument("run_id")
    s.set_defaults(fn=cmd_show)

    s = sub.add_parser("replay", help="replay a run from its recording")
    s.add_argument("run_id")
    s.set_defaults(fn=cmd_replay)

    s = sub.add_parser("models", help="check models.yaml against providers")
    s.set_defaults(fn=cmd_models)

    s = sub.add_parser("demo", help="diagnose -> verify -> repair -> compare on a real failed run")
    s.add_argument("--run")
    s.add_argument("--repeats", type=int, default=1)
    s.set_defaults(fn=cmd_demo)

    s = sub.add_parser("lab", help="Live Lab: type a question, plant a mistake live, watch the investigation")
    s.add_argument("rest", nargs=argparse.REMAINDER)
    s.set_defaults(fn=lambda a: __import__("blackbox.lab", fromlist=["main"]).main(a.rest))

    s = sub.add_parser("ci", help="regression firewall for agent code: pin recorded runs, replay them on every PR")
    s.add_argument("rest", nargs=argparse.REMAINDER)
    s.set_defaults(fn=lambda a: __import__("blackbox.ci", fromlist=["main"]).main(a.rest))

    s = sub.add_parser("import", help="import traces your agent already exports (OpenTelemetry, Langfuse)")
    s.add_argument("rest", nargs=argparse.REMAINDER)
    s.set_defaults(fn=lambda a: __import__("blackbox.data.importers.external", fromlist=["main"]).main(
        a.rest + ["--data", str(a.data)]))

    s = sub.add_parser("crash-test", help="red team a passing run: plant every known mistake, 1-5 star rating")
    s.add_argument("run_id")
    s.add_argument("--per-fault", type=int, default=1)
    s.set_defaults(fn=cmd_crash_test)

    s = sub.add_parser("fleet", help="one fix for many: test a rule (or a GenAI-written one) on similar failures + passing runs")
    s.add_argument("run_id")
    s.add_argument("--rule", default=None, help="the instruction to test; default: GenAI writes one from this failure")
    s.add_argument("--model", default=None, help="or test a model swap instead (time machine A/B)")
    s.add_argument("--fail", type=int, default=3)
    s.add_argument("--pass", dest="n_pass", type=int, default=2)
    s.set_defaults(fn=cmd_fleet)

    s = sub.add_parser("mcp", help="run Black Box as an MCP server on stdio (for Claude Code, Cursor, ...)")
    s.set_defaults(fn=lambda a: __import__("blackbox.mcp", fromlist=["serve"]).serve())

    s = sub.add_parser("export-test", help="write a pytest regression test that replays a recorded run")
    s.add_argument("run_id")
    s.add_argument("--out", default=".")
    s.set_defaults(fn=lambda a: _export_test(a))

    s = sub.add_parser("status", help="what is running now: queue, processes, GPU, logs, data, model")
    s.add_argument("--watch", type=float, default=0)
    s.set_defaults(fn=lambda a: __import__("blackbox.status", fromlist=["main"]).main(
        ["--watch", str(a.watch)] if a.watch else []))

    s = sub.add_parser("ui", help="serve the API and web app")
    s.add_argument("--host", default="127.0.0.1")
    s.add_argument("--port", type=int, default=8000)
    s.set_defaults(fn=cmd_ui)

    args = p.parse_args(argv)
    if args.data is None:
        from blackbox.core.store import DEFAULT_DIR

        args.data = DEFAULT_DIR
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
