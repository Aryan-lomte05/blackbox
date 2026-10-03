"""Guardian setup helpers: channel status, test incident through every ready channel, Telegram chat id."""

from __future__ import annotations

import io
import json

import pytest

from blackbox.guardian import setup
from blackbox.guardian.channels import Channel, Outbox


class _Ready(Channel):
    name = "ready"

    def send(self, inc):
        return f"delivered {inc.incident_id}"


class _Broken(Channel):
    name = "broken"

    def send(self, inc):
        raise ConnectionError("network down")


class _Unset(Channel):
    name = "unset"
    required = ("BLACKBOX_TEST_UNSET_VAR",)

    def send(self, inc):  # pragma: no cover - never called
        raise AssertionError


def test_test_incident_is_plainly_a_test_and_needs_approval():
    inc = setup.test_incident()
    assert inc.title.startswith("TEST:") and inc.severity == "critical" and inc.needs_approval
    assert inc.incident_id in inc.link


def test_send_test_reports_every_channel(tmp_path, monkeypatch):
    monkeypatch.delenv("BLACKBOX_TEST_UNSET_VAR", raising=False)
    rows = setup.send_test(channels=[Outbox(tmp_path), _Ready(), _Broken(), _Unset()])
    by = {r["channel"]: r for r in rows}
    assert by["outbox"]["status"] == "sent" and by["ready"]["status"] == "sent"
    assert by["broken"]["status"] == "failed" and "network down" in by["broken"]["detail"]
    assert by["unset"]["status"] == "skipped" and "BLACKBOX_TEST_UNSET_VAR" in by["unset"]["detail"]
    status = {r["channel"]: r["ready"] for r in setup.channel_status([_Ready(), _Unset()])}
    assert status == {"ready": True, "unset": False}


def test_telegram_chat_ids_from_updates(monkeypatch):
    updates = {"ok": True, "result": [
        {"message": {"chat": {"id": 42, "type": "private", "first_name": "Aryan"}}},
        {"message": {"chat": {"id": -100, "type": "group", "title": "Half a Byte"}}},
        {"message": {"chat": {"id": 42, "type": "private", "first_name": "Aryan"}}}]}
    calls = []

    def fake_urlopen(url, timeout=None):
        calls.append(url)
        return io.BytesIO(json.dumps(updates).encode())

    monkeypatch.setattr(setup.urllib.request, "urlopen", fake_urlopen)
    chats = setup.telegram_chat_ids("T0K")
    assert calls == ["https://api.telegram.org/botT0K/getUpdates"]
    assert {c["chat_id"]: c["name"] for c in chats} == {42: "Aryan", -100: "Half a Byte"}


def test_telegram_chat_ids_needs_a_token(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    with pytest.raises(KeyError):
        setup.telegram_chat_ids()
