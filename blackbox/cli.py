"""`blackbox` command line.

    blackbox ui [--port 8000]          serve the API (+ the web app once it is built into the package)
    blackbox runs [--fail] [-n 20]     list recorded runs
    blackbox show <run_id>             print a run step by step
    blackbox replay <run_id>           replay from the recording (0 model calls) and compare outcomes
    blackbox models                    check every models.yaml model exists at its provider
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
    uvicorn.run(create_app(Store(args.data)), host=args.host, port=args.port)
    return 0


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
