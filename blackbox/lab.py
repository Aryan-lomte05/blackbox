"""Live Lab: type any question and watch the whole Black Box pipeline on it, live.

    blackbox lab "Who directed the film Inception, and in what year was it released?"
    blackbox lab "A shop sells 12 pens per box. Riya buys 7 boxes and gives away 15 pens. How many are left?"
    blackbox lab --family ops            (a generated shop with orders, stock and refunds)

What the dataset farm did offline, done in front of you:
an agent answers, Black Box plants a mistake at one step, the answer breaks,
and then the investigation finds, proves and fixes it. Every number shown
comes from the runs this command records.

Stages (also streamed by POST /api/lab as events of type "stage"):
  1 understand  2 knowledge  3 run live  4 clean answer  5 choose a mistake  6 plant it
  7 broken answer  8 live checker  9 diagnose  10 verify  11 repair  12 compare  13 incident  14 scorecard
"""

from __future__ import annotations

import json
import random
import re
import time
import urllib.parse
import urllib.request
import uuid
from typing import Any, Callable

from blackbox.core.schema import FaultSpec, Label, Trace
from blackbox.core.store import Store

Emit = Callable[[dict], None]
MISTAKE_ORDER = ("F6", "F2", "F3", "F1", "F10", "F9", "F8", "F7", "F4", "F5")
NAMES = {"F1": "wrong tool argument", "F2": "wrong tool result", "F3": "tool returned nothing",
         "F4": "misleading paragraph", "F5": "missing paragraph", "F6": "wrong fact",
         "F7": "wrong tool", "F8": "lost memory", "F9": "dropped instruction", "F10": "answered too early"}
_MATHY = re.compile(r"\d")
_MATH_WORDS = re.compile(r"\b(how many|how much|total|each|per|left|remain|cost|sum|times|percent|average|more than|less than)\b", re.I)


def _short(v: Any, n: int = 160) -> str:
    t = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False, default=str)
    t = " ".join(t.split())
    return t if len(t) <= n else t[: n - 1] + "…"


def guess_family(question: str) -> str:
    return "math" if _MATHY.search(question) and _MATH_WORDS.search(question) else "qa"


def wikipedia_paragraphs(question: str, k: int = 8) -> list[dict]:
    """Lead paragraphs of the top Wikipedia articles for the question (the QA agent's knowledge)."""
    def get(params: dict) -> dict:
        url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode({**params, "format": "json"})
        req = urllib.request.Request(url, headers={"User-Agent": "BlackBox-Lab/0.1 (hackathon demo)"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.load(r)

    hits = get({"action": "query", "list": "search", "srsearch": question, "srlimit": k})["query"]["search"]
    titles = [h["title"] for h in hits]
    if not titles:
        return []
    pages = get({"action": "query", "prop": "extracts", "exintro": 1, "explaintext": 1,
                 "titles": "|".join(titles)})["query"]["pages"].values()
    by_title = {p["title"]: (p.get("extract") or "").strip() for p in pages}
    return [{"title": t, "text": _short(by_title.get(t, ""), 1200)} for t in titles if by_title.get(t)]


def _answer(trace: Trace) -> Any:
    finals = [s for s in trace.steps if s.kind == "final"]
    return finals[-1].output.get("answer") if finals else None


def run_lab(question: str = "", *, family: str | None = None, mistake: str = "auto", repair: bool = False,
            model: str = "agent-local-7b", store: Store | None = None, emit: Emit | None = None,
            seed: int | None = None, notify: bool = False) -> dict:
    """notify=True sends stage 13's incident through every configured Guardian channel (email, WhatsApp,
    Slack, ...); by default it is only written to the outbox, so practice runs do not page anyone."""
    import blackbox.agents.builtin  # noqa: F401 - registers our agents and checkers
    from blackbox.agents.base import Task, get_agent, get_checker, run_task
    from blackbox.faults.catalog import allowed_steps, make_change
    from blackbox.replay.diff import compare
    from blackbox.replay.engine import fork, savings

    store = store or Store()
    out = emit or (lambda e: None)
    t0 = time.perf_counter()
    rng = random.Random(seed if seed is not None else time.time_ns())
    card: dict[str, Any] = {"question": question}

    def stage(n: int, title: str, detail: str, **data) -> None:
        out({"type": "stage", "n": n, "title": title, "detail": detail, "data": data,
             "t": round(time.perf_counter() - t0, 1)})

    # 1 understand
    family = family or guess_family(question)
    agent_ref = {"qa": "qa_agent@v1", "math": "math_agent@v1", "ops": "shop_agent@v1"}[family]
    stage(1, "Understand the question", f"Routed to the {family.upper()} agent ({agent_ref}) on {model}.",
          family=family, agent=agent_ref, model=model)

    # 2 knowledge / task
    task_id = f"lab-{family}-{uuid.uuid4().hex[:8]}"
    if family == "qa":
        paragraphs = wikipedia_paragraphs(question)
        if not paragraphs:
            raise ValueError("Wikipedia returned nothing for this question; try rephrasing it")
        task = Task("qa", task_id, {"question": question, "paragraphs": paragraphs}, expected={"answer": None})
        stage(2, "Gather knowledge", f"Fetched {len(paragraphs)} Wikipedia paragraphs for the agent to search.",
              titles=[p["title"] for p in paragraphs])
    elif family == "math":
        task = Task("math", task_id, {"question": question}, expected=None)
        stage(2, "Gather knowledge", "A word problem: the agent plans, calls a calculator, checks and answers.")
    else:
        from blackbox.data.tasks.ops_tasks import make_task

        base = make_task(rng.randrange(150, 200))
        question = question or base.input["request"]
        task = Task("ops", task_id, {"request": question, "db": base.input["db"]}, expected=base.expected)
        card["question"] = question
        stage(2, "Gather knowledge", f"Shop with {len(base.input['db']['orders'])} orders. Request: {question}",
              orders=list(base.input["db"]["orders"]))

    # 3-4 run the agent live, get the clean answer
    stage(3, "Run the agent live", "Every model call, tool call and search is recorded with a save-point.")
    step_event = lambda s: out({"type": "step", "phase": "clean", "step": {  # noqa: E731
        "idx": s.idx, "kind": s.kind, "name": s.name, "node": s.node, "used": s.parents,
        "output": _short(s.error or s.output, 200)}})
    clean = run_task(get_agent(agent_ref), task, model, store=store, on_step=[step_event])
    if clean.run.status != "done":
        raise RuntimeError(f"the agent crashed: {_short(clean.run.error, 300)}")
    answer = _answer(clean)
    if family != "ops":  # the agent's own clean answer is the reference a planted mistake must change
        clean.run.task_expected = {"answer": answer} if family == "qa" else answer
        clean.run.outcome = get_checker(family)(answer, clean.run.task_expected)
        store.save_trace(clean)
    ok = clean.run.outcome.success if clean.run.outcome else None
    card.update(clean_run=clean.run.run_id, clean_answer=answer, steps=len(clean.steps))
    stage(4, "Clean answer", f"{_short(answer, 200)}  ({len(clean.steps)} steps"
          + (f"; correct per the shop's expected state: {ok}" if family == "ops" else "; this is the reference") + ")",
          answer=answer, run_id=clean.run.run_id, steps=len(clean.steps))
    if family == "ops" and not ok:
        stage(4, "Clean answer", "The agent got this shop request wrong on its own: investigating the real failure.")

    # 5-7 plant a mistake until one breaks the answer
    broken, planted = (clean, None) if (family == "ops" and not ok) else (None, None)
    tries = [mistake] if mistake != "auto" else list(MISTAKE_ORDER)
    attempts = []
    for ft in tries:
        if broken is not None:
            break
        steps = allowed_steps(clean, ft)
        if not steps:
            continue
        k = rng.choice(steps)
        change = make_change(clean, ft, k, rng)
        if change is None:
            continue
        stage(5, "Choose a mistake", f"{ft} ({NAMES[ft]}) at step {k} ({clean.steps[k].kind}:{clean.steps[k].name}).",
              mistake=ft, step=k, change=change.model_dump(mode="json"))
        child = fork(clean, k, change, store=store)
        sv = savings(child)
        child.run.fault = FaultSpec(type=ft, step_idx=k, params={"change_kind": change.kind, "note": change.note})
        changed = child.run.status == "done" and child.run.outcome is not None and not child.run.outcome.success
        attempts.append({"mistake": ft, "step": k, "broke_it": changed, "answer": _answer(child)})
        stage(6, "Plant it", f"Re-ran {sv['steps_executed']} of {sv['steps_total']} steps; re-used {sv['steps_reused']} "
              f"from the recording; saved {sv['tokens_saved']} tokens.", savings=sv, run_id=child.run.run_id)
        if changed:
            child.run.label = Label(root_cause_step=k, source="injected", notes="planted live in the Lab")
            store.save_trace(child)
            broken, planted = child, {"mistake": ft, "name": NAMES[ft], "step": k}
            stage(7, "Broken answer", f"Now answers {_short(_answer(child), 160)} instead of {_short(answer, 80)}. "
                  f"Ground truth: step {k} is the guilty step.", answer=_answer(child), guilty=k)
        else:
            store.save_trace(child)
            stage(7, "Broken answer", f"The agent recovered (still {_short(_answer(child), 80)}). "
                  "Trying a different mistake.", recovered=True)
    if broken is None:
        raise RuntimeError(f"no planted mistake changed the answer ({len(attempts)} tried): the agent recovered every time")
    card.update(broken_run=broken.run.run_id, planted=planted, attempts=attempts)
    guilty = planted["step"] if planted else None

    # 8 live checker on the broken run
    try:
        from blackbox.monitor import cascade
        from blackbox.monitor.check import check_step

        flags = []
        saved_threshold = cascade.ESCALATE_THRESHOLD
        cascade.ESCALATE_THRESHOLD = 0.0  # the Lab shows Laya's own answer (fast, local), no escalation
        try:
          for s in broken.steps:
            if s.kind == "final":
                continue
            r = check_step(s, broken.run, broken.steps[: s.idx])
            if r:
                flags.append({"idx": s.idx, "on_track": round(r["on_track"]["prob"], 2),
                              "consistent": round(r["consistent"]["prob"], 2), "alarm": r.get("alarm"),
                              "tier": r.get("tier")})
        finally:
            cascade.ESCALATE_THRESHOLD = saved_threshold
        alarms = [f["idx"] for f in flags if f["alarm"]]
        low = min(flags, key=lambda f: f["consistent"]) if flags else None
        stage(8, "Live checker", (f"Alarm on step(s) {alarms}." if alarms else "No alarm raised.")
              + (f" Lowest 'consistent with its inputs': step {low['idx']} ({low['consistent']})." if low else "")
              + f" Checked {len(flags)} steps with {flags[0]['tier'] if flags else 'no'} tier.", checks=flags, alarms=alarms)
        card["checker_alarms"] = alarms
    except Exception as exc:  # noqa: BLE001 - the Lab continues; the reason is shown
        stage(8, "Live checker", f"Checker unavailable: {type(exc).__name__}: {_short(str(exc), 120)}")

    # 9 diagnose
    from blackbox.api.main import diagnose
    from blackbox.replay.verify import verify

    d = diagnose(broken)
    suspects = list(d.get("suspects", []))[:3]
    hit = guilty in suspects if guilty is not None else None
    stage(9, "Diagnose", f"Top suspects {suspects} ({d.get('source')})."
          + ("" if guilty is None else (" The planted step is ranked first." if suspects and suspects[0] == guilty
                                        else " The planted step is in the top 3." if hit else " The planted step is NOT in the top 3.")),
          suspects=suspects, guilty=guilty, hit=hit, scores=d.get("scores", [])[:5])
    card.update(suspects=suspects, diagnosis_hit=hit)

    # 10 verify (the planted step is added if the diagnosis missed it, so the proof can still be shown)
    test = suspects if (guilty is None or guilty in suspects) else suspects + [guilty]
    # Verify needs a model stronger than the one that ran the agent, or "re-ask with a stronger model" is
    # impossible and a model-call mistake can only look like bad luck.
    strong = "agent-strong" if model != "agent-strong" else "agent-local-14b"
    rep = verify(broken, test, store=store, repeats=1, strong_model=strong)
    cause = rep["verified_step"]
    passing = next((run["run_id"] for s in rep["suspects"] for st in s["strategies"] for run in st["runs"]
                    if run["passed"] and st["forked_at"] == cause), None)
    stage(10, "Verify", (f"PROVED step {cause} is the cause: repairing it alone makes the run pass." if cause is not None
                         else "No single suspect's repair fixed the run.")
          + ("" if cause is None or guilty is None else (" Matches the planted step." if cause == guilty else
                                                         f" (Planted at step {guilty}; step {cause} is "
                                                         f"{'an earlier' if cause < guilty else 'a later'} point that also saves it.)")),
          cause=cause, guilty=guilty, tested=test, report=rep["suspects"])
    if guilty is not None and cause != guilty:
        own = next((x for x in rep["suspects"] if x["step"] == guilty), None)
        if own is not None:
            stage(10, "Verify", f"The planted step {guilty} on its own: {own['verdict']} "
                  f"(repairing just that step {'fixes' if own['verified'] else 'does not fix'} the run).",
                  planted_step_verdict=own["verdict"], planted_step_fixes=own["verified"])
    card.update(verified_cause=cause)

    # 11 repair
    if repair and cause is not None:
        from blackbox.replay.repair import repair as run_repair

        rp = run_repair(broken, cause, store=store, rounds=1)
        n_ok = sum(c["passed"] for c in rp["cards"])
        stage(11, "Repair", f"{len(rp['cards'])} GenAI fixes proposed for step {cause}; {n_ok} passed when tested by replay.",
              cards=[{"fix": c["change"]["kind"], "note": _short(c["change"].get("note") or "", 120), "passed": c["passed"]}
                     for c in rp["cards"]])
        card["repairs"] = {"tried": len(rp["cards"]), "passed": n_ok}
    else:
        stage(11, "Repair", "Skipped (pass repair=true to ask the big model for fixes and test each one).")

    # 12 compare
    c = compare(clean, broken)
    stage(12, "Compare", f"Clean vs broken: first difference at aligned position {c['first_divergence']}, "
          f"{c['n_changed']} step pairs changed.", first_divergence=c["first_divergence"], changed=c["n_changed"])
    if passing:
        fixed = store.load_trace(passing)
        stage(12, "Compare", f"Fixed run {passing} answers {_short(_answer(fixed), 120)}.", fixed_run=passing)

    # 13 incident
    try:
        from blackbox.guardian.channels import Outbox, default_channels
        from blackbox.guardian.service import Guardian

        channels = default_channels() if notify else [Outbox()]
        inc = Guardian(owner="Lab", channels=channels, store=store, investigate=False, dedupe_minutes=0).handle(broken)
        if inc is not None:
            sent = [n["channel"] for n in inc.notifications if n["status"] == "sent" and n["channel"] != "outbox"]
            where = (f"Sent to {', '.join(sent)}" if sent else "Written to the outbox only") + \
                f" (copy in data/outbox/{inc.incident_id}/)."
            stage(13, "Incident", f"[{inc.severity}] {inc.title}. {where}",
                  incident_id=inc.incident_id, link=inc.link, notified=sent)
            card["incident"] = inc.incident_id
    except Exception as exc:  # noqa: BLE001
        stage(13, "Incident", f"Guardian unavailable: {type(exc).__name__}")

    # 14 scorecard
    card.update(seconds=round(time.perf_counter() - t0, 1))
    stage(14, "Scorecard", f"Planted {planted['mistake'] if planted else 'nothing'} at step {guilty}; diagnosis top 3 "
          f"{'found' if hit else 'missed'} it; Verify proved step {cause}; {card['seconds']} s in total.", card=card)
    return card


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys

    p = argparse.ArgumentParser(prog="blackbox lab", description="Live Lab: plant a mistake in a live run and investigate it.")
    p.add_argument("question", nargs="?", default="")
    p.add_argument("--family", choices=["qa", "math", "ops"])
    p.add_argument("--mistake", default="auto", choices=["auto", *MISTAKE_ORDER])
    p.add_argument("--repair", action="store_true")
    p.add_argument("--model", default="agent-local-7b")
    p.add_argument("--notify", action="store_true", help="send the incident to the configured channels (email, WhatsApp, Slack)")
    args = p.parse_args(argv)
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")
    if not args.question and args.family != "ops":
        p.error("type a question (or use --family ops)")

    def show(e: dict) -> None:
        if e["type"] == "stage":
            print(f"\n[{e['n']:>2}/14] {e['title'].upper():22} {e['detail']}   ({e['t']} s)", flush=True)
        elif e["type"] == "step":
            s = e["step"]
            print(f"        #{s['idx']:<2} {s['kind']:9} {s['name']:16} {s['output'][:90]}", flush=True)

    try:
        run_lab(args.question, family=args.family, mistake=args.mistake, repair=args.repair, model=args.model, emit=show,
                notify=args.notify)
    except (RuntimeError, ValueError) as exc:
        print(f"\nLab stopped: {exc}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
