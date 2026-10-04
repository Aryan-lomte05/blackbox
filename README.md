# Black Box: a flight recorder for AI agents

When an AI agent fails, the mistake usually happened several steps before the wrong answer. Black Box records
every step of an agent run, **finds the step that caused the failure, and proves it**: it re-runs the agent from
its recording with only that step repaired. If the run now passes, that step was the cause. Unchanged steps come
from the recording, so a replay costs zero model calls and a fix re-runs only what changed.

```bash
pip install agent-blackbox                 # recorder, replay, proof, CLI, CI, MCP server, trace import
pip install "agent-blackbox[ui]"           # + the API / dashboard backend
pip install "agent-blackbox[all]"          # + step checker, ranking model, test agents, dataset loaders
```

## Add it to an existing agent (3 lines)

```python
import blackbox
from openai import OpenAI

client = blackbox.wrap(OpenAI())             # 1. every model call is recorded

@blackbox.tool                               # 2. every tool call is recorded and replayable
def get_weather(city: str) -> dict:
    ...

def my_agent(question: str) -> str:          # your agent, unchanged
    ...

trace = blackbox.run(my_agent, "Will it rain in Pune?")       # 3. run it under the recorder
```

```python
blackbox.replay(trace)                                         # re-run from the recording: 0 model calls
child = blackbox.fork(trace, 2, blackbox.Change(kind="output", value={"result": {"rain": True}}))
blackbox.savings(child)                                        # steps re-run vs re-used, tokens saved
```

Works with agents you did not write (shown on Hugging Face smolagents), and with traces you already export:
`blackbox import otel traces.json` / `blackbox import langfuse trace.json`.

## What it does

| Capability | How |
|---|---|
| **Record** every model call, tool call, search and memory change, with a save-point after each step | `blackbox.wrap`, `@blackbox.tool`, `blackbox.run` |
| **Diagnose**: rank the steps most likely to have caused a failure, with plain-language evidence | `blackbox show <run>`, API `/api/runs/{id}/diagnosis` |
| **Prove** the cause by re-running with one suspect repaired at a time | Verify (API, MCP `verify`) |
| **Causal report**: necessary vs sufficient, joint causes, every recovery path, blast radius | API `/causal`, MCP `causal_report` |
| **One fix for many**: test one rule on similar past failures and passing runs; APPROVE only if nothing breaks | `blackbox fleet <run>` |
| **Crash test**: plant every known kind of mistake into a working agent, grade it 1–5 stars | `blackbox crash-test <run>` |
| **Seen this before?**: failure fingerprints, look-alike failures, novel failures, known fixes | MCP `similar_failures` |
| **Guardian**: incidents in plain words on email, WhatsApp, Slack, Telegram; money-moving agents paused until approved | `blackbox.Guardian(...)`, `blackbox guardian test` |
| **Black Box CI**: replay pinned recorded runs on every pull request; fail on regressions | `blackbox ci pin` / `blackbox ci run`, GitHub Action |
| **MCP server**: let Claude Code, Cursor or VS Code investigate failures with 28 tools | `blackbox mcp` |
| **Live Lab**: ask any question, plant a mistake live, watch the 14-stage investigation | `blackbox lab "question"` |

Safety: tools that move money never execute during any re-run, and Guardian never retries them without a human.

## Command line

```bash
blackbox runs --fail             # failed runs
blackbox show <run_id>           # step by step, with who-used-whose-output links
blackbox replay <run_id>         # replay from the recording
blackbox crash-test <run_id>     # red-team a passing run
blackbox fleet <run_id> --rule "..."   # one fix for many, with a regression firewall
blackbox ci pin && blackbox ci run      # regression firewall for agent code
blackbox guardian channels       # which alert channels are configured
blackbox mcp                     # MCP server on stdio
blackbox ui                      # API on http://127.0.0.1:8000
```

Models are named in one file, `models.yaml` (Ollama locally, Groq or OpenRouter hosted); keys live in `.env`.

## Development (this repository)

```bash
pip install -e ".[all,dev]"
py -3 -m pytest -q -m "not live"
cd web && npm install && npm run dev       # dashboard on http://localhost:5173
```

Design: `SYSTEM.md` · rules: `CLAUDE.md` · UI contract: `docs/API_FOR_UI.md` · MCP: `docs/MCP.md` · CI: `docs/CI.md` ·
Guardian setup: `docs/GUARDIAN_SETUP.md`. Branches `<name>/<feature>` → PR into `dev` → `main` at milestones.

Built by team Half a Byte: Aryan Lomte, Radhesh, Aditya, Advay Chavan.
