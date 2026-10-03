# Black Box: a flight recorder for AI agents

Add Black Box to an existing agent and it **records every step**, **warns
while the agent is running**, **names the step that broke the run**, **proves
it** by re-running with only that step fixed (re-running only what changed),
and **writes the incident report**.

> Status: hackathon build in progress. What works today is listed in
> `AUDIT.md`. Design: `SYSTEM.md`. Team plan: `ASSIGNMENTS.md`.

## Install (from this repo)

```bash
pip install -e ".[ui,dev]"          # core + API + tests
pip install -e ".[all,dev]"         # + step checker, ML, test agents
cp .env.example .env                # add GROQ_API_KEYS / OPENROUTER_API_KEY
```

## Add it to your agent (3 lines)

```python
import blackbox
from openai import OpenAI

client = blackbox.wrap(OpenAI(base_url="https://api.groq.com/openai/v1", api_key=...))  # 1

@blackbox.tool                                                                          # 2
def get_weather(city: str) -> dict:
    ...

def my_agent(question: str) -> str:          # your existing agent, unchanged
    ...

trace = blackbox.run(my_agent, "Will it rain in Pune?")                                  # 3
```

Then:

```python
blackbox.replay(trace)                       # re-run from the recording: 0 model calls
child = blackbox.fork(trace, 2, blackbox.Change(kind="output", value={"result": {"rain": True}}))
blackbox.savings(child)                      # {"steps_reused": ..., "tokens_saved": ...}
```

Outside `blackbox.run(...)`, the wrapped client and tools behave exactly like
the originals. For record-only use without a function to re-run, use
`with blackbox.session("task-1") as s: ...; s.final(answer)`.

## Command line

```bash
blackbox runs --fail          # failed runs
blackbox show <run_id>        # step by step, with who-used-what links
blackbox replay <run_id>      # replay from the recording
blackbox models               # every models.yaml model exists?
blackbox ui                   # API on http://127.0.0.1:8000 (web app: see web/)
```

## Development

```bash
py -3 -m pytest -q -m "not live"
```

Team rules: `CLAUDE.md`. Branches: `<name>/<feature>` → PR into `dev` →
`main` at milestones.
