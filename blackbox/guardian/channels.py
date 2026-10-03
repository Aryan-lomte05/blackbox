"""Where incidents are delivered. A channel is used only when its settings exist;
otherwise it reports why it was skipped. The outbox always runs, so every message
can be inspected exactly as it would have been sent.

    Email (SMTP)  SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASSWORD, ALERT_EMAIL_FROM, ALERT_EMAIL_TO
    Mailgun       MAILGUN_API_KEY, MAILGUN_DOMAIN, ALERT_EMAIL_FROM, ALERT_EMAIL_TO
    WhatsApp      TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM ("whatsapp:+14155238886"),
                  ALERT_WHATSAPP_TO ("whatsapp:+91XXXXXXXXXX")
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

    def available(self) -> tuple[bool, str]:
        miss = _missing(*self.required)
        return (not miss, "ready" if not miss else f"not configured (set {', '.join(miss)})")

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


def default_channels() -> list[Channel]:
    return [Outbox(), SMTPEmail(), MailgunEmail(), TwilioWhatsApp()]
