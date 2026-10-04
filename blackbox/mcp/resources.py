"""MCP resources: recorded runs and Guardian incidents as readable documents (blackbox:// URIs)."""

from __future__ import annotations

from blackbox.mcp.registry import store

SCHEME = "blackbox://"

TEMPLATES = [
    {"uriTemplate": SCHEME + "run/{run_id}", "name": "Any recorded run as a case file", "mimeType": "text/markdown"},
    {"uriTemplate": SCHEME + "incident/{incident_id}", "name": "A Guardian incident", "mimeType": "text/plain"},
]


def list_resources(n_runs: int = 15, n_incidents: int = 10) -> list[dict]:
    from blackbox.guardian.service import list_incidents

    out = [{"uri": f"{SCHEME}run/{r.run_id}", "name": f"Failed run {r.run_id} ({r.task_family})",
            "description": f"guilty step {r.label.root_cause_step}" + (f", planted {r.fault.type}" if r.fault else ""),
            "mimeType": "text/markdown"}
           for r in store().list_runs(success=False, has_label=True, limit=n_runs)]
    out += [{"uri": f"{SCHEME}incident/{i.incident_id}", "name": f"Incident {i.incident_id}: {i.title}",
             "description": f"{i.severity}, {i.status}", "mimeType": "text/plain"}
            for i in list_incidents()[:n_incidents]]
    return out


def read(uri: str) -> tuple[str, str]:
    """(mime type, text). KeyError if the URI names nothing."""
    if not uri.startswith(SCHEME):
        raise KeyError(uri)
    kind, _, ident = uri[len(SCHEME):].partition("/")
    if kind == "run":
        from blackbox.api.main import diagnose
        from blackbox.api.ui import report_md

        tr = store().load_trace(ident)
        failed = tr.run.outcome is not None and not tr.run.outcome.success
        return "text/markdown", report_md(tr, diagnose(tr) if failed else None)
    if kind == "incident":
        from blackbox.mcp.tools.guardian import incident

        return "text/plain", incident(ident)
    raise KeyError(uri)


def complete(argument: str, prefix: str) -> list[str]:
    """Autocomplete run and incident ids, newest first."""
    if argument == "incident_id":
        from blackbox.guardian.service import list_incidents

        ids = [i.incident_id for i in list_incidents()]
    elif argument in ("run_id", "run_a", "run_b"):
        ids = [r.run_id for r in store().list_runs(limit=300)]
    else:
        return []
    return [i for i in ids if i.startswith(prefix)]
