"""Tools for Guardian incidents: failures explained for the people who run agents unattended."""

from __future__ import annotations

from blackbox.mcp.registry import tool

INCIDENT_ID = {"incident_id": {"type": "string", "description": "an incident id (autocomplete is available)"}}


@tool("list_incidents", "Guardian incidents: failed, crashed or flagged runs explained for their owner.",
      category="guardian", properties={"limit": {"type": "integer", "default": 10}})
def list_incidents(limit: int = 10) -> str:
    from blackbox.guardian.service import list_incidents as list_all

    incidents = list_all()[: int(limit)]
    if not incidents:
        return "No incidents yet: they appear when a watched run fails, crashes or is flagged."
    return "\n".join(f"{i.incident_id} [{i.severity}] {i.status:8} {i.title} (run {i.run_id})" for i in incidents)


@tool("incident", "One incident: what happened, why, how to fix it, who was notified.", category="guardian",
      properties=INCIDENT_ID, required=("incident_id",))
def incident(incident_id: str) -> str:
    from blackbox.guardian import render
    from blackbox.guardian.service import get_incident

    inc = get_incident(incident_id)
    if inc is None:
        raise KeyError(incident_id)
    sent = "; ".join(f"{n['channel']}: {n['status']}" for n in inc.notifications)
    return render.text_email(inc) + f"\n\nNotifications: {sent or 'none'}\nStatus: {inc.status}"


@tool("decide_incident", "Approve, or keep paused, the retry of a money-moving agent. The decision is final and "
      "recorded with who made it.", category="guardian",
      properties={**INCIDENT_ID, "approve": {"type": "boolean"}, "note": {"type": "string"}},
      required=("incident_id", "approve"))
def decide_incident(incident_id: str, approve: bool, note: str = "") -> str:
    from blackbox.guardian.service import decide

    inc = decide(incident_id, bool(approve), "IDE assistant", note)
    return f"Incident {inc.incident_id} is now {inc.status} (by {inc.decision['by']} at {inc.decision['at']})."
