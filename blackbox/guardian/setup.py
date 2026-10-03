"""Guardian setup helpers: see which channels are configured, send a real test incident, find a Telegram chat id.

    blackbox guardian channels             which channels are ready, and what each one still needs
    blackbox guardian test [--severity]    send a clearly-marked TEST incident through every ready channel
    blackbox guardian telegram-chat-id     after you message your bot once, print your chat id

Settings are read from .env (never printed). Setup steps for each channel: docs/GUARDIAN_SETUP.md.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

from blackbox.guardian.channels import Channel, default_channels
from blackbox.guardian.incident import Incident


def _load_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:  # python-dotenv is a core dependency; tolerate its absence anyway
        return
    load_dotenv(override=False)


def test_incident(severity: str = "critical", dashboard: str | None = None) -> Incident:
    """A sample incident, plainly labelled as a test, shaped like the trader-bot demo."""
    stamp = datetime.now(timezone.utc).strftime("%H%M%S")
    base = dashboard or os.environ.get("BLACKBOX_DASHBOARD_URL", "http://localhost:8000")
    return Incident(
        incident_id=f"test-{stamp}", run_id="test-run", owner=os.environ.get("ALERT_OWNER_NAME", ""),
        kind="failure", severity=severity,  # type: ignore[arg-type]
        title="TEST: trader_bot placed an order 10x too large",
        what_happened="This is a test from Black Box Guardian. In the demo scenario, the agent bought 100 shares "
                      "instead of 10.",
        why="Step 4 read the quantity from the wrong field of the order form (proven by replay).",
        how_to_fix=["Validate the quantity against the order form before place_order.",
                    "Keep the agent paused until you approve the retry."],
        needs_approval=True, signature=f"guardian-test-{stamp}", link=f"{base}/#/incidents/test-{stamp}",
    )


def channel_status(channels: list[Channel] | None = None, inc: Incident | None = None) -> list[dict]:
    inc = inc or test_incident()
    rows = []
    for ch in channels or default_channels():
        ok, why = ch.ready_for(inc)
        rows.append({"channel": ch.name, "ready": ok, "detail": why})
    return rows


def send_test(severity: str = "critical", channels: list[Channel] | None = None) -> list[dict]:
    """Send a test incident through every ready channel. Returns {channel, status, detail} per channel."""
    inc = test_incident(severity)
    rows = []
    for ch in channels or default_channels():
        ok, why = ch.ready_for(inc)
        if not ok:
            rows.append({"channel": ch.name, "status": "skipped", "detail": why})
            continue
        try:
            rows.append({"channel": ch.name, "status": "sent", "detail": ch.send(inc)})
        except Exception as exc:  # noqa: BLE001 - report every channel, keep going
            rows.append({"channel": ch.name, "status": "failed", "detail": f"{type(exc).__name__}: {exc}"[:300]})
    return rows


def telegram_chat_ids(token: str | None = None) -> list[dict]:
    """Chats that have messaged the bot recently (Telegram getUpdates). Message the bot first."""
    token = token or os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        raise KeyError("TELEGRAM_BOT_TOKEN is not set")
    with urllib.request.urlopen(f"https://api.telegram.org/bot{token}/getUpdates", timeout=20) as r:
        updates = json.load(r).get("result", [])
    seen: dict[int, dict] = {}
    for u in updates:
        chat = (u.get("message") or u.get("channel_post") or {}).get("chat")
        if chat:
            seen[chat["id"]] = {"chat_id": chat["id"], "type": chat.get("type"),
                                "name": chat.get("title") or " ".join(filter(None, [chat.get("first_name"),
                                                                                     chat.get("last_name")]))}
    return list(seen.values())


def main(argv: list[str] | None = None) -> int:
    _load_env()
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(prog="blackbox guardian", description="Guardian channel setup.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("channels", help="which channels are ready")
    t = sub.add_parser("test", help="send a TEST incident through every ready channel")
    t.add_argument("--severity", default="critical", choices=["critical", "high", "medium", "low"],
                   help="critical also places the phone call (if configured)")
    sub.add_parser("telegram-chat-id", help="print the chat id of whoever messaged your bot")
    args = ap.parse_args(argv)

    if args.cmd == "channels":
        for r in channel_status():
            print(f"{'✅' if r['ready'] else '·'} {r['channel']:16} {r['detail']}")
        return 0
    if args.cmd == "test":
        rows = send_test(args.severity)
        for r in rows:
            mark = {"sent": "✅", "failed": "❌", "skipped": "·"}[r["status"]]
            print(f"{mark} {r['channel']:16} {r['status']}: {r['detail']}")
        sent = [r for r in rows if r["status"] == "sent" and r["channel"] != "outbox"]
        print(f"\n{len(sent)} real channel(s) delivered. The outbox copy is in data/outbox/.")
        return 1 if any(r["status"] == "failed" for r in rows) else 0
    chats = telegram_chat_ids()
    if not chats:
        print("No messages yet: open your bot in Telegram, press Start (or send any message), then run this again.")
        return 1
    for c in chats:
        print(f"TELEGRAM_CHAT_ID={c['chat_id']}    ({c['type']}: {c['name']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
