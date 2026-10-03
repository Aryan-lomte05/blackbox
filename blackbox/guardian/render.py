"""What the owner receives: a styled HTML email, a plain-text email, and a short WhatsApp message.

Email HTML uses inline styles and tables only, because mail clients strip
<style> blocks and modern CSS.
"""

from __future__ import annotations

import html

from blackbox.guardian.incident import Incident

COLORS = {"critical": "#ef4444", "high": "#f97316", "medium": "#eab308", "low": "#22c55e"}
GLOWS = {"critical": "#2a0f12", "high": "#2a1608", "medium": "#262006", "low": "#0b2416"}  # dark tints


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


def slack(inc: Incident) -> dict:
    """A Slack incoming-webhook payload (Block Kit), with a plain `text` fallback for notifications."""
    fix = inc.how_to_fix[0] if inc.how_to_fix else "Open the incident for details."
    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": f"Black Box · {inc.severity.upper()}: {inc.title}"[:150]}},
        {"type": "section", "fields": [{"type": "mrkdwn", "text": f"*What happened*\n{inc.what_happened}"},
                                       {"type": "mrkdwn", "text": f"*Why*\n{inc.why}"}]},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*Fix:* {fix}"}},
    ]
    if inc.needs_approval:
        blocks.append({"type": "context", "elements": [{"type": "mrkdwn", "text":
                       ":double_vertical_bar: The agent is *paused*. Nothing is retried until you approve."}]})
    blocks.append({"type": "actions", "elements": [{"type": "button", "text": {"type": "plain_text", "text": "Open incident"},
                                                    "url": inc.link, "style": "danger" if inc.severity == "critical" else "primary"}]})
    return {"text": subject(inc), "blocks": blocks}


def telegram(inc: Incident) -> str:
    """Telegram message, parse_mode=HTML."""
    fix = inc.how_to_fix[0] if inc.how_to_fix else "Open the incident for details."
    esc = html.escape
    lines = [f"🚨 <b>Black Box · {esc(inc.severity.upper())}</b>", f"<b>{esc(inc.title)}</b>", "",
             f"<b>What happened:</b> {esc(inc.what_happened)}", f"<b>Why:</b> {esc(inc.why)}", f"<b>Fix:</b> {esc(fix)}"]
    if inc.needs_approval:
        lines.append("⏸ Your agent is <b>paused</b>. Nothing will be retried until you approve.")
    lines += ["", f'<a href="{esc(inc.link, quote=True)}">Open incident</a>']
    return "\n".join(lines)


def voice(inc: Incident) -> str:
    """What the phone call says: short, no symbols, no links."""
    parts = [f"This is Black Box. A {inc.severity} problem with your agent. {inc.title}.",
             f"What happened: {inc.what_happened}"]
    if inc.needs_approval:
        parts.append("Your agent is paused. Nothing will be retried until you approve it in the incident page.")
    parts.append("Details are in your email and messages. Goodbye.")
    return " ".join(parts)


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
    """The incident as a dark "flight recorder" report. Email-safe: tables, inline styles, bgcolor attributes."""
    e = html.escape
    color = COLORS.get(inc.severity, "#d9480f")
    glow = GLOWS.get(inc.severity, "#3a1d12")
    mono = "font-family:'JetBrains Mono',Consolas,'Courier New',monospace"
    sans = "font-family:'Segoe UI',Inter,Helvetica,Arial,sans-serif"
    ev = inc.evidence or {}
    cause = ev.get("cause_step")

    def section(n: str, label: str, body: str) -> str:
        return (f'<tr><td style="padding:0 28px 14px"><table role="presentation" width="100%" cellpadding="0" '
                f'cellspacing="0" bgcolor="#111827" style="background:#111827;border:1px solid #1f2937;border-radius:12px">'
                f'<tr><td style="padding:16px 18px">'
                f'<div style="{mono};font-size:11px;letter-spacing:.14em;color:#6b7280">{n} &nbsp;·&nbsp; {label}</div>'
                f'{body}</td></tr></table></td></tr>')

    para = f"margin:8px 0 0;{sans};font-size:15px;line-height:1.55;color:#e5e7eb"
    fixes = "".join(
        f'<tr><td valign="top" style="padding:8px 10px 0 0;{mono};font-size:13px;color:{color}">{i:02d}</td>'
        f'<td style="padding:8px 0 0;{sans};font-size:15px;line-height:1.5;color:#e5e7eb">{e(f)}</td></tr>'
        for i, f in enumerate(inc.how_to_fix, 1))
    actions = "".join(f'<div style="margin:8px 0 0;{sans};font-size:14px;color:#a7f3d0">✓ &nbsp;{e(a)}</div>'
                      for a in inc.actions_taken)

    rows = []
    for s in ev.get("timeline", []):
        guilty = s.get("idx") == cause
        dot, ink, bg = (color, "#ffffff", glow) if guilty else (("#f59e0b", "#fde68a", "#111827") if s.get("flag")
                                                                 else ("#374151", "#9ca3af", "#111827"))
        rows.append(
            f'<tr><td bgcolor="{bg}" style="background:{bg};padding:7px 10px;{mono};font-size:12px;color:#6b7280;'
            f'border-top:1px solid #1f2937;white-space:nowrap">STEP {e(str(s.get("idx")))}</td>'
            f'<td bgcolor="{bg}" style="background:{bg};padding:7px 6px;border-top:1px solid #1f2937">'
            f'<span style="display:inline-block;width:9px;height:9px;border-radius:9px;background:{dot}"></span></td>'
            f'<td bgcolor="{bg}" style="background:{bg};padding:7px 10px;{mono};font-size:12px;color:{ink};'
            f'border-top:1px solid #1f2937">{e(str(s.get("label", "")))}'
            f'{" &nbsp;◀ ROOT CAUSE" if guilty else (" &nbsp;· " + e(str(s.get("flag"))) if s.get("flag") else "")}'
            f'</td></tr>')
    flight_data = (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
                   f'style="margin-top:10px;border:1px solid #1f2937;border-radius:8px">{"".join(rows)}</table>'
                   if rows else "")

    cause_block = ""
    if cause is not None:
        cause_block = (f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px"><tr>'
                       f'<td bgcolor="{glow}" style="background:{glow};border:1px solid {color};border-radius:10px;'
                       f'padding:12px 16px"><div style="{mono};font-size:11px;letter-spacing:.14em;color:{color}">'
                       f'GUILTY STEP</div><div style="{mono};font-size:30px;font-weight:700;color:#ffffff">'
                       f'#{e(str(cause))}</div></td>'
                       f'<td style="padding-left:14px;{sans};font-size:13px;line-height:1.5;color:#9ca3af">'
                       f'{e(str(ev.get("cause_note") or "Found by the diagnosis model and checked by replay."))}</td>'
                       f'</tr></table>')

    paused = ""
    if inc.needs_approval:
        paused = (f'<tr><td style="padding:0 28px 14px"><table role="presentation" width="100%" cellpadding="0" '
                  f'cellspacing="0" bgcolor="#2a1f05" style="background:#2a1f05;border:1px solid #b45309;border-radius:12px">'
                  f'<tr><td style="padding:14px 18px;{sans};font-size:14px;line-height:1.5;color:#fde68a">'
                  f'<b style="color:#fbbf24">⏸ YOUR AGENT IS PAUSED.</b> It moves money, so Black Box will not let it '
                  f'retry until you approve. Nothing was re-run on your behalf.</td></tr></table></td></tr>')

    meta = " · ".join(filter(None, [inc.owner, inc.created_at.replace("T", " ").replace("+00:00", " UTC"),
                                    f"seen {inc.repeats}×" if inc.repeats > 1 else ""]))
    approve_btn = (f'<td style="padding-left:10px"><a href="{e(inc.link)}#decision" style="display:inline-block;'
                   f'border:1px solid #4b5563;color:#e5e7eb;text-decoration:none;{sans};font-size:14px;font-weight:600;'
                   f'padding:13px 20px;border-radius:8px">Review &amp; approve retry</a></td>' if inc.needs_approval else "")

    return f"""<!doctype html><html><head><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"></head>
<body style="margin:0;padding:0;background:#05070b" bgcolor="#05070b">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">{e(inc.what_happened)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#05070b" style="background:#05070b;padding:28px 10px">
<tr><td align="center">
<table role="presentation" width="620" cellpadding="0" cellspacing="0" bgcolor="#0b0f17" style="max-width:620px;width:100%;background:#0b0f17;border:1px solid #1f2937;border-radius:16px;overflow:hidden">
  <tr><td bgcolor="{color}" style="background:{color};height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>
  <tr><td style="padding:18px 28px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="{mono};font-size:12px;letter-spacing:.18em;color:#9ca3af"><span style="color:#ef4444">●</span> REC &nbsp;BLACK BOX &nbsp;<span style="color:#4b5563">/ FLIGHT RECORDER FOR AI AGENTS</span></td>
      <td align="right" style="{mono};font-size:11px;color:#4b5563">INCIDENT {e(inc.incident_id)}</td>
    </tr></table></td></tr>
  <tr><td style="padding:26px 28px 6px">
    <span style="display:inline-block;padding:5px 12px;border-radius:999px;background:{glow};border:1px solid {color};color:{color};{mono};font-size:11px;font-weight:700;letter-spacing:.16em">{e(inc.severity.upper())} · {e(inc.kind.upper())}</span>
    <h1 style="margin:14px 0 6px;{sans};font-size:26px;line-height:1.25;font-weight:800;color:#ffffff">{e(inc.title)}</h1>
    <div style="{mono};font-size:12px;color:#6b7280">{e(meta)}</div>
  </td></tr>
  <tr><td style="padding:14px 0 0"></td></tr>
  {paused}
  {section("01", "WHAT HAPPENED", f'<p style="{para}">{e(inc.what_happened)}</p>')}
  {section("02", "ROOT CAUSE", f'<p style="{para}">{e(inc.why)}</p>{cause_block}')}
  {section("03", "HOW TO FIX IT", f'<table role="presentation" cellpadding="0" cellspacing="0">{fixes}</table>')}
  {section("04", "WHAT BLACK BOX ALREADY DID", actions) if actions else ""}
  {section("05", "FLIGHT DATA · THE LAST STEPS OF THE RUN", flight_data) if flight_data else ""}
  <tr><td style="padding:8px 28px 26px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td><a href="{e(inc.link)}" style="display:inline-block;background:{color};color:#ffffff;text-decoration:none;{sans};font-size:14px;font-weight:700;padding:13px 22px;border-radius:8px">Open the incident →</a></td>
      {approve_btn}
    </tr></table>
  </td></tr>
  <tr><td style="padding:16px 28px 22px;border-top:1px solid #1f2937;{mono};font-size:11px;line-height:1.6;color:#4b5563">
    RUN {e(inc.run_id)} · every statement above comes from the recorded run.<br>
    Black Box never re-runs tools that move money. Same problem again within 30 minutes is grouped, not re-sent.
  </td></tr>
</table>
<div style="padding:14px;{mono};font-size:11px;color:#374151">Black Box · Team Half a Byte</div>
</td></tr></table></body></html>"""
