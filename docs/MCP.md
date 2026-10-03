# Black Box MCP server

Your IDE assistant (Claude Code, Cursor, VS Code) investigates agent failures with Black Box's tools:
*"Why did my latest failed run go wrong? Show me the blame map, prove the cause, and find a fix that breaks nothing."*

## Setup

```bash
# this repository: registered in .mcp.json (Claude Code asks once to approve it)
claude mcp add blackbox -- py -3 -m blackbox.mcp      # any other project
blackbox mcp                                          # run it by hand (stdio)
```

Model Context Protocol `2025-06-18` over stdio (newline-delimited JSON-RPC 2.0). No dependencies beyond Black Box.

## Capabilities

### Tools (28)

| Category | Tool | What it does | Cost |
|---|---|---|---|
| runs | `list_failures` | recent failed runs with the known guilty step | instant |
| runs | `run_steps` | one run step by step | instant |
| runs | `search_steps` | search every recorded step (`"timeout"`, `"no results"`) | seconds |
| runs | `compare_runs` | align two runs: first divergence, outcome flip | instant |
| runs | `dataset_summary`, `failure_patterns` | what is recorded; top failure patterns | seconds |
| diagnosis | `diagnose` | ranked suspect steps with plain-language evidence | seconds |
| diagnosis | `verify` | prove the cause by repairing one suspect at a time | 10-60 s |
| diagnosis | `causal_report` | necessary vs sufficient, joint causes, recovery paths, blast radius | 10-60 s |
| diagnosis | `investigate` | diagnose → verify → compare, as a story | 10-60 s |
| diagnosis | `similar_failures` | seen this before? fingerprint, look-alike failures and their causes, NOVEL, approved fixes | instant |
| diagnosis | `time_travel` | stand inside step k: what it saw, remembered, did, and affected | instant |
| diagnosis | `blame_map` | Mermaid diagram: guilty step, contamination trail, suspects | seconds |
| experiments | `replay` | re-run from the recording, 0 model calls | instant |
| experiments | `fork` | what-if: change one step's output, re-run only what changes | seconds |
| experiments | `repair` | GenAI fixes for a step, each tested by replay | minutes |
| experiments | `fleet_fix` | one failure → one general rule → tested on similar failures + passing runs → APPROVE / BLOCK | ~40 s per run |
| experiments | `time_machine` | re-run recorded history under a new rule or model | ~40 s per run |
| experiments | `crash_test` | red team a passing run: every known mistake planted, graded, 1-5 stars; failures become labelled data | ~5 s per mistake |
| experiments | `cheaper_model` | which model calls can move to a cheaper model | minutes |
| experiments | `live_lab` | type a question; plant a mistake live; 14-stage investigation | 1-5 min |
| guardian | `list_incidents`, `incident` | incidents explained for the agent's owner | instant |
| guardian | `decide_incident` | approve or keep paused a money-moving retry (recorded, final) | instant |
| developer | `export_test` | failure → pytest regression test (replays, 0 model calls) | instant |
| developer | `instrument_agent` | reads your agent file; says which lines to change to record it | instant |
| developer | `import_traces` | import OpenTelemetry / Langfuse exports and diagnose the failed runs (no agent code change) | seconds |
| developer | `status` | jobs, GPU, data totals, model results on this machine | instant |

### Resources
- `blackbox://run/<run_id>`: a run's case file (Markdown); recent failed runs are listed.
- `blackbox://incident/<incident_id>`: a Guardian incident.
- Templates for both, and autocomplete for `run_id`, `run_a`, `run_b`, `incident_id`.

### Prompts
`investigate_latest_failure`, `explain_run_for_non_coder`, `what_if`, `fix_this_class_of_failure`.

### Progress
Long tools (`verify`, `causal_report`, `fleet_fix`, `time_machine`, `live_lab`) send
`notifications/progress` for each stage when the client passes a `progressToken`.

## Safety
- Re-runs are forks: unchanged steps come from the recording; money-moving tools never execute (`dry_run_tools`).
- `decide_incident` only records the owner's decision; nothing is retried by the server.
- A tool error is returned to the assistant (`isError: true`); the server keeps running.

## Code layout (`blackbox/mcp/`)

| Module | Responsibility |
|---|---|
| `protocol.py` | JSON-RPC 2.0 / MCP wire format: version, error codes, message builders |
| `registry.py` | typed `Tool` spec and `@tool` decorator; store injection (`configure`); progress reporting |
| `server.py` | request dispatch (`handle`) and the stdio transport (`serve`) |
| `tools/` | one module per category: `runs`, `diagnosis`, `experiments`, `guardian`, `developer` |
| `resources.py` | `blackbox://` resources, templates, id autocomplete |
| `prompts.py` | ready-made workflows |

Adding a tool: write a function in the right `tools/` module, decorate it with
`@tool(name, description, category=..., properties=..., required=...)`, return text, add a test in
`tests/test_mcp.py`. `test_every_tool_has_a_category_a_description_and_an_object_schema` checks the contract.
