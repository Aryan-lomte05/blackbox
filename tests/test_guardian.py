"""Guardian: incidents for people who run agents unattended."""

from __future__ import annotations

import pytest

from blackbox.agents.base import run_task
from blackbox.core.store import Store
from blackbox.guardian.channels import Outbox, SMTPEmail, TwilioWhatsApp
from blackbox.guardian.service import Guardian, list_incidents
from blackbox.recorder import providers
from blackbox.recorder.providers import LLMResult
from tests.test_verify_autopilot_repair import TASK, CapitalAgent, model


@pytest.fixture(autouse=True)
def fakes():
    providers.register_fake("agent-weak", model("Lyon"))
    providers.register_fake("agent-strong", model("Paris"))
    yield
    providers.clear_fakes()


def _guardian(tmp_path, **kw):
    return Guardian(owner="Aryan", dashboard="http://dash", channels=[Outbox(tmp_path / "outbox"), SMTPEmail(), TwilioWhatsApp()],
                    root=tmp_path / "incidents", store=Store(tmp_path / "db"), investigate=False, **kw)


def test_failed_run_opens_an_incident_and_writes_every_message(tmp_path, monkeypatch):
    for v in ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "ALERT_EMAIL_TO", "TWILIO_ACCOUNT_SID"):
        monkeypatch.delenv(v, raising=False)
    g = _guardian(tmp_path)
    tr = run_task(CapitalAgent(), TASK, "agent-weak", store=g.store)
    inc = g.handle(tr)
    assert inc.kind == "failure" and inc.severity == "high" and "Lyon" in inc.what_happened
    assert inc.link == f"http://dash/incident/{inc.incident_id}"
    out = tmp_path / "outbox" / inc.incident_id
    assert {"email.html", "email.txt", "whatsapp.txt", "subject.txt"} <= {p.name for p in out.iterdir()}
    assert inc.link in (out / "whatsapp.txt").read_text(encoding="utf-8")
    status = {n["channel"]: n["status"] for n in inc.notifications}
    assert status == {"outbox": "sent", "email-smtp": "skipped", "whatsapp-twilio": "skipped"}  # never faked
    assert list_incidents(tmp_path / "incidents")[0].incident_id == inc.incident_id


def test_passing_run_raises_nothing(tmp_path):
    g = _guardian(tmp_path)
    assert g.handle(run_task(CapitalAgent(), TASK, "agent-strong", store=g.store)) is None


def test_same_problem_is_grouped_not_resent(tmp_path):
    g = _guardian(tmp_path)
    first = g.handle(run_task(CapitalAgent(), TASK, "agent-weak", store=g.store))
    again = g.handle(run_task(CapitalAgent(), TASK, "agent-weak", store=g.store))
    assert again.incident_id == first.incident_id and again.repeats == 2
    assert again.notifications[-1]["channel"] == "grouped"
    assert len(list((tmp_path / "outbox").iterdir())) == 1


def test_money_moving_tool_pauses_and_asks_for_approval(tmp_path):
    g = _guardian(tmp_path, money_moving_tools=("echo",))  # CapitalAgent's tool stands in for place_order
    inc = g.handle(run_task(CapitalAgent(), TASK, "agent-weak", store=g.store))
    assert inc.needs_approval and inc.severity == "critical"
    assert "nothing is retried without your approval" in inc.actions_taken[0]
    assert "paused" in (tmp_path / "outbox" / inc.incident_id / "whatsapp.txt").read_text(encoding="utf-8")


def test_messages_carry_no_personal_data(tmp_path):
    providers.register_fake("agent-leaky", lambda m, t, p: LLMResult("mail me at a.b@corp.io", [], "stop", 1, 1, "f", "x"))
    g = _guardian(tmp_path)
    inc = g.handle(run_task(CapitalAgent(), TASK, "agent-leaky", store=g.store))
    assert "a.b@corp.io" not in (tmp_path / "outbox" / inc.incident_id / "email.html").read_text(encoding="utf-8")


def test_investigation_names_a_verified_cause(tmp_path):
    g = Guardian(owner="Aryan", channels=[Outbox(tmp_path / "outbox")], root=tmp_path / "incidents",
                 store=Store(tmp_path / "db"), investigate=True)
    providers.register_fake("agent-local-7b", model("Paris"))  # the repair model Guardian uses
    inc = g.handle(run_task(CapitalAgent(), TASK, "agent-weak", store=g.store))
    assert inc.evidence["cause_note"] == "proven by replay" and inc.evidence["cause_step"] == 0
    assert any("tested" in h for h in inc.how_to_fix)


def test_investigation_never_executes_money_moving_tools(tmp_path):
    """Regression (found with the trader bot): Verify re-runs the agent; a money-moving tool must
    not run for real during an investigation."""
    from tests.test_verify_autopilot_repair import CapitalAgent as A

    calls = []
    real = A.tool_caller

    def counting(self, task):
        inner = real(self, task)
        def call(name, args):
            calls.append(name)
            return inner(name, args)
        return call

    A.tool_caller = counting
    try:
        g = Guardian(owner="t", channels=[Outbox(tmp_path / "outbox")], root=tmp_path / "incidents",
                     store=Store(tmp_path / "db"), investigate=True, money_moving_tools=("echo",))
        providers.register_fake("agent-local-7b", model("Paris"))
        tr = run_task(A(), TASK, "agent-weak", store=g.store)
        before = len(calls)
        inc = g.handle(tr)
        assert len(calls) == before, "a money-moving tool ran during the investigation"
        assert inc.needs_approval and "never re-run" in inc.why + " ".join(inc.how_to_fix)
    finally:
        A.tool_caller = real
