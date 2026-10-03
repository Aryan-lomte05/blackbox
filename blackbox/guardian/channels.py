"""Where incidents are delivered. A channel is used only when its settings exist;
otherwise it reports why it was skipped. The outbox always runs, so every message
can be inspected exactly as it would have been sent.

    Email (SMTP)  SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASSWORD, ALERT_EMAIL_FROM, ALERT_EMAIL_TO
    Mailgun       MAILGUN_API_KEY, MAILGUN_DOMAIN, ALERT_EMAIL_FROM, ALERT_EMAIL_TO
    WhatsApp      TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM ("whatsapp:+14155238886"),
                  ALERT_WHATSAPP_TO ("whatsapp:+91XXXXXXXXXX")
    Slack         SLACK_WEBHOOK_URL (an incoming webhook)
    Telegram      TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
    Voice call    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VOICE_FROM, ALERT_PHONE_TO (critical incidents only)
"""

from __future__ import annotations

import base64
import json
import os
import smtplib
import ssl
import urllib.parse
import urllib.request
from email.message import EmailMessage
from pathlib import Path

from blackbox.core.store import DEFAULT_DIR
from blackbox.guardian import render
from blackbox.guardian.incident import Incident

OUTBOX = DEFAULT_DIR / "outbox"


def _missing(*names: str) -> list[str]:
    return [n for n in names if not os.environ.get(n)]


class Channel:
    name = "channel"
    required: tuple[str, ...] = ()

    declines_because = ""

    def available(self) -> tuple[bool, str]:
        miss = _missing(*self.required)
        return (not miss, "ready" if not miss else f"not configured (set {', '.join(miss)})")

    def wants(self, inc: Incident) -> bool:  # noqa: ARG002 - subclasses decide by the incident
        """Whether this channel should carry this incident at all (e.g. phone calls only for critical ones)."""
        return True

    def ready_for(self, inc: Incident) -> tuple[bool, str]:
        """Send this incident on this channel? (False, the reason) when it is not configured or declines it."""
        ok, why = self.available()
        if ok and not self.wants(inc):
            return False, self.declines_because
        return ok, why

    def send(self, inc: Incident) -> str:
        raise NotImplementedError


class Outbox(Channel):
    """Writes the exact email (HTML + text) and WhatsApp message to data/outbox/<incident>/."""
    name = "outbox"

    def __init__(self, root: Path = OUTBOX):
        self.root = Path(root)

    def send(self, inc: Incident) -> str:
        d = self.root / inc.incident_id
        d.mkdir(parents=True, exist_ok=True)
        (d / "email.html").write_text(render.html_email(inc), encoding="utf-8")
        (d / "email.txt").write_text(render.text_email(inc), encoding="utf-8")
        (d / "whatsapp.txt").write_text(render.whatsapp(inc), encoding="utf-8")
        (d / "subject.txt").write_text(render.subject(inc), encoding="utf-8")
        (d / "slack.json").write_text(json.dumps(render.slack(inc), indent=2, ensure_ascii=False), encoding="utf-8")
        (d / "telegram.html").write_text(render.telegram(inc), encoding="utf-8")
        (d / "voice.txt").write_text(render.voice(inc), encoding="utf-8")
        return str(d)


class SMTPEmail(Channel):
    name = "email-smtp"
    required = ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "ALERT_EMAIL_TO")

    def send(self, inc: Incident) -> str:
        msg = EmailMessage()
        msg["Subject"] = render.subject(inc)
        msg["From"] = os.environ.get("ALERT_EMAIL_FROM") or os.environ["SMTP_USER"]
        msg["To"] = os.environ["ALERT_EMAIL_TO"]
        msg.set_content(render.text_email(inc))
        msg.add_alternative(render.html_email(inc), subtype="html")
        port = int(os.environ.get("SMTP_PORT", "587"))
        with smtplib.SMTP(os.environ["SMTP_HOST"], port, timeout=20) as s:
            s.starttls(context=ssl.create_default_context())
            s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
            s.send_message(msg)
        return f"sent to {msg['To']}"


class MailgunEmail(Channel):
    name = "email-mailgun"
    required = ("MAILGUN_API_KEY", "MAILGUN_DOMAIN", "ALERT_EMAIL_TO")

    def send(self, inc: Incident) -> str:
        data = urllib.parse.urlencode({
            "from": os.environ.get("ALERT_EMAIL_FROM") or f"Black Box <blackbox@{os.environ['MAILGUN_DOMAIN']}>",
            "to": os.environ["ALERT_EMAIL_TO"], "subject": render.subject(inc),
            "text": render.text_email(inc), "html": render.html_email(inc)}).encode()
        auth = base64.b64encode(f"api:{os.environ['MAILGUN_API_KEY']}".encode()).decode()
        req = urllib.request.Request(f"https://api.mailgun.net/v3/{os.environ['MAILGUN_DOMAIN']}/messages", data=data,
                                     headers={"Authorization": f"Basic {auth}"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return f"accepted ({r.status})"


class TwilioWhatsApp(Channel):
    name = "whatsapp-twilio"
    required = ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM", "ALERT_WHATSAPP_TO")

    def send(self, inc: Incident) -> str:
        sid = os.environ["TWILIO_ACCOUNT_SID"]
        body = render.whatsapp(inc)[:1500]  # WhatsApp body limit is 1600 characters
        data = urllib.parse.urlencode({"From": os.environ["TWILIO_WHATSAPP_FROM"],
                                       "To": os.environ["ALERT_WHATSAPP_TO"], "Body": body}).encode()
        auth = base64.b64encode(f"{sid}:{os.environ['TWILIO_AUTH_TOKEN']}".encode()).decode()
        req = urllib.request.Request(f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json", data=data,
                                     headers={"Authorization": f"Basic {auth}"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return f"queued, message sid {json.load(r).get('sid')}"


def _post_json(url: str, payload: dict, headers: dict | None = None) -> tuple[int, bytes]:
    req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json", **(headers or {})})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status, r.read()


class SlackWebhook(Channel):
    name = "slack"
    required = ("SLACK_WEBHOOK_URL",)

    def send(self, inc: Incident) -> str:
        status, _ = _post_json(os.environ["SLACK_WEBHOOK_URL"], render.slack(inc))
        return f"posted ({status})"


class TelegramBot(Channel):
    name = "telegram"
    required = ("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID")

    def send(self, inc: Incident) -> str:
        url = f"https://api.telegram.org/bot{os.environ['TELEGRAM_BOT_TOKEN']}/sendMessage"
        _, body = _post_json(url, {"chat_id": os.environ["TELEGRAM_CHAT_ID"], "text": render.telegram(inc)[:4000],
                                   "parse_mode": "HTML", "disable_web_page_preview": True})
        return f"sent, message id {json.loads(body).get('result', {}).get('message_id')}"


class TwilioVoiceCall(Channel):
    """Phones the owner and reads the incident aloud. Critical incidents only: a call is an interruption."""
    name = "voice-call"
    required = ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VOICE_FROM", "ALERT_PHONE_TO")
    declines_because = "phone calls are only for critical incidents"

    def wants(self, inc: Incident) -> bool:
        return inc.severity == "critical"

    def send(self, inc: Incident) -> str:
        from xml.sax.saxutils import escape

        sid = os.environ["TWILIO_ACCOUNT_SID"]
        twiml = (f'<Response><Say voice="alice">{escape(render.voice(inc))}</Say><Pause length="1"/>'
                 f'<Say voice="alice">Repeating. {escape(inc.title)}.</Say></Response>')
        data = urllib.parse.urlencode({"From": os.environ["TWILIO_VOICE_FROM"], "To": os.environ["ALERT_PHONE_TO"],
                                       "Twiml": twiml}).encode()
        auth = base64.b64encode(f"{sid}:{os.environ['TWILIO_AUTH_TOKEN']}".encode()).decode()
        req = urllib.request.Request(f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Calls.json", data=data,
                                     headers={"Authorization": f"Basic {auth}"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return f"calling, call sid {json.load(r).get('sid')}"


def default_channels() -> list[Channel]:
    # Channel settings live in .env; load it here so every path (API, trader bot, CLI) sees them.
    try:
        from dotenv import load_dotenv

        load_dotenv(override=False)
    except ImportError:
        pass
    return [Outbox(), SMTPEmail(), MailgunEmail(), TwilioWhatsApp(), SlackWebhook(), TelegramBot(), TwilioVoiceCall()]
