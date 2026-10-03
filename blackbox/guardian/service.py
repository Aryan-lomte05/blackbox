"""Guardian service: run -> incident -> investigation -> notification.

Money-moving or irreversible tools (e.g. place_order, transfer, refund) are
named by the owner. If one appears in a failed run, Guardian never retries it
automatically: the incident asks for approval instead.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from blackbox.core.privacy import redact
from blackbox.core.schema import Trace
from blackbox.core.store import DEFAULT_DIR, Store
from blackbox.guardian.channels import Channel, default_channels
from blackbox.guardian.incident import Incident, signature_of

INCIDENTS = DEFAULT_DIR / "incidents"


def _short(v, n: int = 140) -> str:
    t = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False, default=str)
    t = " ".join(str(t).split())
    return t if len(t) <= n else t[: n - 1] + "…"


def _step_label(s) -> str:
    if s.kind == "tool":
        args = ", ".join(f"{k}={_short(v, 30)}" for k, v in (s.request.get("args") or {}).items() if k != "db")
        return f"called {s.name}({args})" + (f" → error: {_short(s.error, 80)}" if s.error else
                                             f" → {_short((s.output or {}).get('result'), 60)}")
    if s.kind == "llm":
        out = s.output or {}
        calls = ", ".join(c["name"] for c in out.get("tool_calls") or [])
        return f"model decided: {_short(out.get('text') or ('call ' + calls), 90)}"
    if s.kind == "retrieval":
        return f"searched: {_short((s.request.get('args') or {}).get('query'), 60)}"
    if s.kind == "final":
        return f"final answer: {_short((s.output or {}).get('answer'), 80)}"
    return f"{s.kind} {s.name}"


def dashboard_url() -> str:
    """Where incident links point: BLACKBOX_DASHBOARD_URL (.env), else the local server."""
    return (os.environ.get("BLACKBOX_DASHBOARD_URL") or os.environ.get("BLACKBOX_DASHBOARD")
            or "http://127.0.0.1:8000").rstrip("/")


class Guardian:
    def __init__(self, owner: str = "", dashboard: str | None = None, *,
                 money_moving_tools: tuple[str, ...] = (), channels: list[Channel] | None = None,
                 investigate: bool = True, dedupe_minutes: int = 30, store: Store | None = None,
                 root: Path | None = None):
        self.owner = owner
        self.channels = channels if channels is not None else default_channels()  # also loads .env
        self.dashboard = (dashboard or dashboard_url()).rstrip("/")
        self.money_moving = set(money_moving_tools)
        self.investigate = investigate
        self.dedupe = timedelta(minutes=dedupe_minutes)
        self.store = store
        self.root = Path(root) if root is not None else INCIDENTS  # resolved per call (tests redirect it)

    # ---- storage ----------------------------------------------------------------------
    def _save(self, inc: Incident) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        (self.root / f"{inc.incident_id}.json").write_text(inc.model_dump_json(indent=2), encoding="utf-8")

    def _recent_same(self, signature: str) -> Incident | None:
        if not self.root.exists():
            return None
        now = datetime.now(timezone.utc)
        for f in sorted(self.root.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)[:200]:
            inc = Incident.model_validate_json(f.read_text(encoding="utf-8"))
            if inc.signature == signature and now - datetime.fromisoformat(inc.created_at) < self.dedupe:
                return inc
        return None

    # ---- the incident ---------------------------------------------------------------------
    def build(self, trace: Trace) -> Incident | None:
        r = trace.run
        alarms = [s for s in trace.steps if isinstance(s.monitor, dict) and s.monitor.get("alarm")]
        if r.status == "done" and r.outcome is not None and r.outcome.success and not alarms:
            return None
        if r.status == "rewound" or r.stats.get("autopilot_rescue"):
            return None  # the autopilot already fixed it before any answer was given
        kind = "crash" if r.status == "crashed" else "failure" if (r.outcome and not r.outcome.success) else "alarm"
        errors = [s for s in trace.steps if s.error]
        money = [s for s in trace.steps if s.kind == "tool" and s.name in self.money_moving]

        # cause: verified if we can, else the diagnosis' first suspect, else the first error
        cause, how, cause_note = None, [], ""
        if money and kind == "failure":
            cause_note = "not re-run: this run moves money, so Black Box never re-runs it to prove the cause"
            how.append("Black Box never re-runs a run that moves money. Check the step below, fix its input, "
                       "then approve a retry on the incident page.")
            if not errors:  # the diagnosis model only reads the recording: safe even when money is involved
                try:
                    from blackbox.api.main import diagnose

                    suspects = diagnose(trace).get("suspects") or []
                    if suspects:
                        cause = suspects[0]
                        cause_note = "most likely (diagnosis model); " + cause_note
                except Exception:  # noqa: BLE001 - falls back to the last step below, with the reason
                    pass
        elif kind == "failure" and self.investigate and self.store is not None and trace.steps:
            try:
                from blackbox.api.main import diagnose
                from blackbox.replay.verify import verify

                from blackbox.recorder.context import dry_run_tools

                d = diagnose(trace)
                token = dry_run_tools.set(frozenset(self.money_moving))  # defence in depth
                try:
                    rep = verify(trace, list(d.get("suspects", []))[:3], store=self.store, repeats=1,
                                 strong_model="agent-local-7b")
                finally:
                    dry_run_tools.reset(token)
                cause = rep["verified_step"]
                if cause is not None:
                    best = next(s for s in rep["suspects"] if s.get("cause_step") == cause)
                    strat = max(best["strategies"], key=lambda x: x["flipped"] / x["attempts"])
                    cause_note = "proven by replay"
                    how.append({"twin": "Use the answer this step gave in an earlier successful run (tested: the run then passes).",
                                "stronger": "Have a stronger model make this decision (tested: the run then passes).",
                                "rerun": "Run this step again: it gave a wrong result this time (tested: re-running fixes the run)."
                                }.get(strat["strategy"], "A tested repair exists for this step."))
                elif d.get("suspects"):
                    cause, cause_note = d["suspects"][0], "most likely, not yet proven"
            except Exception as exc:  # noqa: BLE001 - an incident is still sent, with the reason recorded
                cause_note = f"investigation failed: {type(exc).__name__}"
        if cause is None and errors:
            prefix = cause_note + "; " if cause_note else ""
            cause, cause_note = errors[0].idx, prefix + "the first step that raised an error"
        if cause is None and trace.steps:
            cause, cause_note = trace.steps[-1].idx, "the last step before the run stopped"

        cs = trace.steps[cause] if cause is not None and cause < len(trace.steps) else None
        agent = r.agent.split("@")[0].split(":")[-1]
        if kind == "crash":
            last = (r.error or "").strip().splitlines()[-1:] or ["unknown error"]
            what = f"Your agent “{agent}” stopped with an error before finishing: {_short(last[0], 160)}."
        elif kind == "failure":
            exp = f", but {_short(r.outcome.expected, 80)} was expected" if r.outcome.expected not in (None, "") else ""
            what = f"Your agent “{agent}” finished with a wrong result: {_short(r.outcome.final_answer, 100)}{exp}."
        else:
            what = f"The live checker flagged step {alarms[0].idx} of your agent “{agent}” as going wrong."
        why = (f"Step {cs.idx} ({cause_note}): {_step_label(cs)}." if cs is not None else "No steps were recorded.")
        if cs is not None and cs.error:
            how.insert(0, f"The tool “{cs.name}” failed with: {_short(cs.error, 120)}. Check its connection, "
                          "credentials and limits, then retry from the incident page.")
        if not how:
            how.append("Open the incident, replay the run from this step and try a change: only the affected steps re-run.")
        how.append("Compare this run with a recent successful one on the incident page to see where they diverged.")

        actions = []
        needs_approval = bool(money)
        if needs_approval:
            actions.append(f"Paused the agent. {len(money)} money-moving call(s) in this run "
                           f"({', '.join(sorted({s.name for s in money}))}); nothing is retried without your approval.")
        if cause_note == "proven by replay":
            actions.append(f"Re-ran the run with step {cause} repaired: it passes. The original was left untouched.")
        timeline = [{"idx": s.idx, "label": _step_label(s), "flag": ("⚠ cause" if s.idx == cause else
                                                                    "error" if s.error else "")}
                    for s in trace.steps[-12:]]
        severity = "critical" if needs_approval else "high" if kind in ("crash", "failure") else "medium"
        sig = signature_of(r.agent, kind, cs.name if cs else None, (cs.error if cs else None) or r.error)
        title = {"crash": f"{agent} crashed", "failure": f"{agent} gave a wrong result",
                 "alarm": f"{agent} is going off track"}[kind]
        inc = Incident(incident_id=uuid.uuid4().hex[:10], run_id=r.run_id, owner=self.owner, kind=kind,
                       severity=severity, title=title, what_happened=what, why=why, how_to_fix=how,
                       actions_taken=actions, needs_approval=needs_approval, signature=sig,
                       evidence={"cause_step": cause, "cause_note": cause_note, "timeline": timeline,
                                 "errors": [{"idx": s.idx, "error": _short(s.error, 200)} for s in errors]})
        inc.link = f"{self.dashboard}/incident/{inc.incident_id}"
        masked, _ = redact(inc.model_dump(mode="json"))  # no personal data or keys leave in a message
        return Incident.model_validate(masked)

    def handle(self, trace: Trace) -> Incident | None:
        inc = self.build(trace)
        if inc is None:
            return None
        prev = self._recent_same(inc.signature)
        if prev is not None:  # same problem again: group it, do not spam the owner
            prev.repeats += 1
            prev.notifications.append({"channel": "grouped", "status": "skipped",
                                       "detail": f"same problem as before (run {trace.run.run_id}); not re-sent"})
            self._save(prev)
            return prev
        for ch in self.channels:
            ok, why = ch.ready_for(inc)
            if not ok:
                inc.notifications.append({"channel": ch.name, "status": "skipped", "detail": why})
                continue
            try:
                inc.notifications.append({"channel": ch.name, "status": "sent", "detail": ch.send(inc)})
            except Exception as exc:  # noqa: BLE001 - a failed channel is recorded, the others still go
                inc.notifications.append({"channel": ch.name, "status": "failed",
                                          "detail": f"{type(exc).__name__}: {_short(str(exc), 160)}"})
        self._save(inc)
        return inc


def list_incidents(root: Path = INCIDENTS) -> list[Incident]:
    if not root.exists():
        return []
    files = sorted(root.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    return [Incident.model_validate_json(f.read_text(encoding="utf-8")) for f in files]


def get_incident(incident_id: str, root: Path = INCIDENTS) -> Incident | None:
    f = root / f"{incident_id}.json"
    return Incident.model_validate_json(f.read_text(encoding="utf-8")) if f.exists() else None


def decide(incident_id: str, approve: bool, by: str, note: str = "", root: Path = INCIDENTS) -> Incident:
    """Record the owner's decision on a paused retry. Black Box records it; the owner's agent
    (or its scheduler) reads `status` before retrying. Nothing money-moving is retried here."""
    inc = get_incident(incident_id, root)
    if inc is None:
        raise KeyError(incident_id)
    if inc.status != "open":
        raise ValueError(f"incident {incident_id} is already {inc.status}")
    inc.status = "approved" if approve else "rejected"
    inc.decision = {"by": by, "at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "note": note}
    (root / f"{inc.incident_id}.json").write_text(inc.model_dump_json(indent=2), encoding="utf-8")
    return inc


def is_retry_approved(incident_id: str, root: Path = INCIDENTS) -> bool:
    """For the owner's agent: may the paused action be retried?"""
    inc = get_incident(incident_id, root)
    return inc is not None and inc.status == "approved"
