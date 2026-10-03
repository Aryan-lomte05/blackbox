# Black Box MCP server

Ask your IDE assistant (Claude Code, Cursor, VS Code) about your agents' failures; it uses Black Box's tools.

```bash
# this repo: already registered in .mcp.json (Claude Code asks to approve it once)
claude mcp add blackbox -- py -3 -m blackbox.mcp_server     # any other project
```

Zero extra dependencies: JSON-RPC 2.0 over stdio, protocol 2025-06-18.

| Kind | What |
|---|---|
| Read tools | `list_failures`, `run_steps`, `diagnose`, `dataset_summary`, `failure_patterns`, `list_incidents`, `incident`, `status` |
| Act tools | `investigate`, `verify` (proves the cause), `replay` (0 model calls), `fork` (what-if), `repair` (GenAI fixes tested by replay), `live_lab`, `decide_incident`, `cheaper_model` |
| Beyond logs | `time_travel` (stand inside step k: what it saw, remembered, did, and what it affected), `blame_map` (Mermaid diagram: guilty step, contamination trail, suspects), `compare_runs`, `search_steps` (across all recordings), `export_test` (failure → pytest), `instrument_my_agent` (reads your agent file, says which lines to change) |
| Resources | recent failed runs `blackbox://run/<id>` (case file) and incidents `blackbox://incident/<id>`; templates for any id |
| Prompts | `investigate_latest_failure`, `explain_run_for_non_coder`, `what_if` |
| Extras | live progress notifications for long tools (verify, live_lab), autocomplete for run and incident ids |

Safety: re-runs never execute money-moving tools (`dry_run_tools`); `decide_incident` only records a decision.

Try: *"Why did my latest failed run go wrong? Show me the blame map, then prove it."*
