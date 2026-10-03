"""What the owner receives: a styled HTML email, a plain-text email, and a short WhatsApp message.

Email HTML uses inline styles and tables only, because mail clients strip
<style> blocks and modern CSS.
"""

from __future__ import annotations

import html

from blackbox.guardian.incident import Incident

COLORS = {"critical": "#b42318", "high": "#d9480f", "medium": "#9a6100", "low": "#1f7a4d"}


def subject(inc: Incident) -> str:
    rep = f" (x{inc.repeats})" if inc.repeats > 1 else ""
    return f"[Black Box · {inc.severity.upper()}] {inc.title}{rep}"


def whatsapp(inc: Incident) -> str:
    fix = inc.how_to_fix[0] if inc.how_to_fix else "Open the incident for details."
    lines = [
        f"🚨 *Black Box · {inc.severity.upper()}*",
        f"*{inc.title}*",
        "",
        f"*What happened:* {inc.what_happened}",
        f"*Why:* {inc.why}",
        f"*Fix:* {fix}",
    ]
    if inc.needs_approval:
        lines.append("⏸ Your agent is *paused*. Nothing will be retried until you approve.")
    lines += ["", f"Open incident: {inc.link}"]
    return "\n".join(lines)


def text_email(inc: Incident) -> str:
    out = [subject(inc), "", f"What happened: {inc.what_happened}", f"Why: {inc.why}", "", "How to fix:"]
    out += [f"  - {f}" for f in inc.how_to_fix]
    if inc.actions_taken:
        out += ["", "What Black Box already did:"] + [f"  - {a}" for a in inc.actions_taken]
    if inc.needs_approval:
        out += ["", "Your agent is PAUSED. Nothing will be retried until you approve it on the incident page."]
    out += ["", f"Incident page: {inc.link}", f"Run: {inc.run_id} · {inc.created_at}"]
    return "\n".join(out)


def html_email(inc: Incident) -> str:
    e = html.escape
    color = COLORS.get(inc.severity, "#d9480f")
    fixes = "".join(f'<li style="margin:0 0 6px">{e(f)}</li>' for f in inc.how_to_fix)
    actions = "".join(f'<li style="margin:0 0 6px">{e(a)}</li>' for a in inc.actions_taken)
    timeline = "".join(
        f'<tr><td style="padding:6px 10px;border-bottom:1px solid #e6e9ee;font:12px Consolas,monospace;color:#5b6676">#{e(str(s["idx"]))}</td>'
        f'<td style="padding:6px 10px;border-bottom:1px solid #e6e9ee;font:13px Segoe UI,Arial,sans-serif;color:#17202b">'
        f'{"<b>" if s.get("flag") else ""}{e(s["label"])}{"</b>" if s.get("flag") else ""}</td>'
        f'<td style="padding:6px 10px;border-bottom:1px solid #e6e9ee;font:12px Segoe UI,Arial,sans-serif;color:{color}">{e(s.get("flag", ""))}</td></tr>'
        for s in inc.evidence.get("timeline", [])
    )
    approval = (f'<tr><td style="padding:14px 24px;background:#fbefd5;font:14px Segoe UI,Arial,sans-serif;color:#7a4d00">'
                f'⏸ <b>Your agent is paused.</b> Nothing will be retried until you approve it on the incident page.</td></tr>'
                if inc.needs_approval else "")
    return f"""<!doctype html><html><body style="margin:0;padding:0;background:#f2f4f7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f7;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e1e5eb">
  <tr><td style="background:#16202c;padding:16px 24px;font:600 13px Segoe UI,Arial,sans-serif;color:#ffffff;letter-spacing:.06em">
    <span style="color:#ff8a4c">■</span>&nbsp; BLACK BOX · INCIDENT REPORT</td></tr>
  <tr><td style="padding:22px 24px 8px">
    <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:{color};color:#fff;font:700 11px Segoe UI,Arial,sans-serif;letter-spacing:.08em">{e(inc.severity.upper())}</span>
    <h1 style="margin:12px 0 4px;font:700 22px Segoe UI,Arial,sans-serif;color:#16202c">{e(inc.title)}</h1>
    <p style="margin:0;font:13px Segoe UI,Arial,sans-serif;color:#5b6676">{e(inc.owner and inc.owner + " · ")}{e(inc.created_at)}{f" · seen {inc.repeats} times" if inc.repeats > 1 else ""}</p>
  </td></tr>
  {approval}
  <tr><td style="padding:16px 24px 0">
    <h2 style="margin:0 0 6px;font:700 12px Segoe UI,Arial,sans-serif;color:#5b6676;letter-spacing:.08em">WHAT HAPPENED</h2>
    <p style="margin:0;font:15px/1.5 Segoe UI,Arial,sans-serif;color:#17202b">{e(inc.what_happened)}</p></td></tr>
  <tr><td style="padding:16px 24px 0">
    <h2 style="margin:0 0 6px;font:700 12px Segoe UI,Arial,sans-serif;color:#5b6676;letter-spacing:.08em">WHY</h2>
    <p style="margin:0;font:15px/1.5 Segoe UI,Arial,sans-serif;color:#17202b">{e(inc.why)}</p></td></tr>
  <tr><td style="padding:16px 24px 0">
    <h2 style="margin:0 0 6px;font:700 12px Segoe UI,Arial,sans-serif;color:#5b6676;letter-spacing:.08em">HOW TO FIX IT</h2>
    <ul style="margin:0;padding-left:18px;font:15px/1.5 Segoe UI,Arial,sans-serif;color:#17202b">{fixes}</ul></td></tr>
  {f'''<tr><td style="padding:16px 24px 0"><h2 style="margin:0 0 6px;font:700 12px Segoe UI,Arial,sans-serif;color:#5b6676;letter-spacing:.08em">WHAT BLACK BOX ALREADY DID</h2>
    <ul style="margin:0;padding-left:18px;font:14px/1.5 Segoe UI,Arial,sans-serif;color:#17202b">{actions}</ul></td></tr>''' if actions else ""}
  {f'''<tr><td style="padding:16px 24px 0"><h2 style="margin:0 0 6px;font:700 12px Segoe UI,Arial,sans-serif;color:#5b6676;letter-spacing:.08em">TIMELINE</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e9ee;border-radius:6px">{timeline}</table></td></tr>''' if timeline else ""}
  <tr><td style="padding:22px 24px 26px" align="left">
    <a href="{e(inc.link)}" style="display:inline-block;background:#d9480f;color:#ffffff;text-decoration:none;font:700 14px Segoe UI,Arial,sans-serif;padding:12px 20px;border-radius:6px">Open the incident in Black Box →</a>
    <p style="margin:12px 0 0;font:12px Segoe UI,Arial,sans-serif;color:#8a94a3">Run {e(inc.run_id)} · incident {e(inc.incident_id)}. Every statement above comes from the recorded run.</p>
  </td></tr>
</table></td></tr></table></body></html>"""
