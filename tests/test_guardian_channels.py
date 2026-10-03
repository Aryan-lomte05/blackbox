"""Guardian channels: Slack, Telegram and voice call send the right request; a call is made only for critical
incidents; nothing goes out unless the channel is configured. The network is stubbed."""

from __future__ import annotations

import io
import json
import urllib.parse

import pytest

from blackbox.guardian import channels, render
from blackbox.guardian.channels import Outbox, SlackWebhook, TelegramBot, TwilioVoiceCall
from blackbox.guardian.incident import Incident


def _incident(severity="critical", paused=True) -> Incident:
    return Incident(incident_id="inc1", run_id="r1", kind="failure", severity=severity, title="trader_bot placed a wrong order",
                    what_happened="It bought 100 shares instead of 10.", why="Step 4 read the quantity from the wrong field.",
                    how_to_fix=["Validate the quantity before place_order."], needs_approval=paused, signature="s1",
                    link="http://dash/incidents/inc1")


@pytest.fixture
def sent(monkeypatch):
    calls = []

    class Reply(io.BytesIO):
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def fake_urlopen(req, timeout=None):
        calls.append({"url": req.full_url, "data": req.data, "headers": dict(req.header_items())})
        return Reply(json.dumps({"sid": "CA1", "result": {"message_id": 7}}).encode())

    monkeypatch.setattr(channels.urllib.request, "urlopen", fake_urlopen)
    return calls


def test_unconfigured_channels_say_what_to_set(monkeypatch):
    for var in ("SLACK_WEBHOOK_URL", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"):
        monkeypatch.delenv(var, raising=False)
    ok, why = SlackWebhook().available()
    assert not ok and "SLACK_WEBHOOK_URL" in why
    assert "TELEGRAM_CHAT_ID" in TelegramBot().available()[1]


def test_slack_posts_block_kit_with_a_link(monkeypatch, sent):
    monkeypatch.setenv("SLACK_WEBHOOK_URL", "https://hooks.slack.test/abc")
    assert SlackWebhook().send(_incident()) == "posted (200)"
    body = json.loads(sent[0]["data"])
    assert sent[0]["url"] == "https://hooks.slack.test/abc" and body["text"].startswith("[Black Box · CRITICAL]")
    assert body["blocks"][-1]["elements"][0]["url"] == "http://dash/incidents/inc1"
    assert any("paused" in json.dumps(b) for b in body["blocks"])


def test_telegram_sends_escaped_html(monkeypatch, sent):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "T0K")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "42")
    inc = _incident()
    inc.why = "quantity <10> & price"
    assert TelegramBot().send(inc) == "sent, message id 7"
    body = json.loads(sent[0]["data"])
    assert sent[0]["url"] == "https://api.telegram.org/botT0K/sendMessage"
    assert body["chat_id"] == "42" and body["parse_mode"] == "HTML" and "&lt;10&gt; &amp;" in body["text"]


def test_voice_call_only_for_critical_and_reads_the_incident(monkeypatch, sent):
    for k, v in {"TWILIO_ACCOUNT_SID": "AC1", "TWILIO_AUTH_TOKEN": "t", "TWILIO_VOICE_FROM": "+1555",
                 "ALERT_PHONE_TO": "+9199"}.items():
        monkeypatch.setenv(k, v)
    call = TwilioVoiceCall()
    assert not call.wants(_incident(severity="high")) and call.wants(_incident())
    assert call.send(_incident()) == "calling, call sid CA1"
    form = urllib.parse.parse_qs(sent[0]["data"].decode())
    assert sent[0]["url"].endswith("/Accounts/AC1/Calls.json") and form["To"] == ["+9199"]
    assert "<Say" in form["Twiml"][0] and "paused" in form["Twiml"][0] and "http" not in render.voice(_incident())


def test_a_configured_call_channel_declines_a_non_critical_incident_and_says_why(monkeypatch, sent):
    for k, v in {"TWILIO_ACCOUNT_SID": "AC1", "TWILIO_AUTH_TOKEN": "t", "TWILIO_VOICE_FROM": "+1555",
                 "ALERT_PHONE_TO": "+9199"}.items():
        monkeypatch.setenv(k, v)
    assert TwilioVoiceCall().ready_for(_incident(severity="high")) == (False, "phone calls are only for critical incidents")
    assert TwilioVoiceCall().ready_for(_incident(severity="critical")) == (True, "ready")
    assert sent == []


def test_outbox_keeps_every_channel_message_for_inspection(tmp_path):
    Outbox(tmp_path).send(_incident())
    files = {p.name for p in (tmp_path / "inc1").iterdir()}
    assert {"email.html", "whatsapp.txt", "slack.json", "telegram.html", "voice.txt"} <= files
