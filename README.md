# Black Box: a flight recorder for AI agents

**Find the step that broke an agent run, then prove it was the cause by replaying the run with only that step repaired.**

[![PyPI](https://img.shields.io/pypi/v/halfabyte-blackbox?style=flat-square&color=4BC8C0&label=halfabyte-blackbox)](https://pypi.org/project/halfabyte-blackbox/)
[![Python](https://img.shields.io/pypi/pyversions/halfabyte-blackbox?style=flat-square&color=8B7CF6)](https://pypi.org/project/halfabyte-blackbox/)
[![License](https://img.shields.io/badge/license-MIT-15181D?style=flat-square)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-40%20suites-15181D?style=flat-square)](tests/)
[![MCP](https://img.shields.io/badge/MCP-28%20tools-15181D?style=flat-square)](docs/MCP.md)

When an AI agent gives you a wrong answer, the mistake usually happened several steps earlier. A bad search
result at step 3 quietly poisons steps 4 through 12, and the only thing you see is the wrong answer at the end.

Tracing tools, LangSmith, Langfuse and OpenTelemetry, **show** you those steps. You still have to read hundreds
of them to work out which one actually caused the failure, and you can never be sure you were right.

Black Box closes that loop. It records every step with a save-point, ranks the steps most likely to be at fault,
and then **proves** the diagnosis by re-running the agent from its own recording with one suspect repaired. If
the run now passes, that step was the cause. Unchanged steps are replayed from the recording, so the proof costs
**zero model calls** and re-runs only what actually changed.

---

## How it works: an air-crash investigation for agents

The design follows accident investigation deliberately, because that discipline already solved this problem.

| Air-crash investigation | Black Box |
|---|---|
| The flight recorder captures everything | **Record** every model call, tool call, search and memory change, with a save-point after each step |
| Live cockpit warnings | **Step checker** runs fast typed checks per step and warns *during* the run that a step looks wrong |
| Investigators draw up a suspect list | **Diagnose** with a trained graph model, plus a calibrated suspect list and plain-language evidence |
| Re-fly the flight in a simulator | **Replay** from any save-point; **fork** the run with one change applied |
| Prove the cause | **Verify**: repair only the suspect step, re-run, and check whether the outcome flips |
| The accident report | **Incident report** where every sentence points back to a recorded step |
| Safety recommendations for the whole fleet | **Fleet replay**: test one fix against similar past failures *and* past passing runs before it ships |

The key move is the last three rows. A ranking model can be wrong; a replay experiment cannot be hand-waved.

---

## Install

```bash
pip install halfabyte-blackbox              # recorder, replay, proof, CLI, CI, MCP server, trace import
pip install "halfabyte-blackbox[ui]"        # + REST API and dashboard backend
pip install "halfabyte-blackbox[all]"       # + step checker, ranking model, test agents, dataset loaders
```

## Add it to an agent you already have, in three lines

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

Your agent's own code does not change. Black Box wraps the boundaries where an agent touches the outside world.

## The part that makes it different: proof by replay

```python
blackbox.replay(trace)            # re-run the whole thing from the recording: 0 model calls, deterministic

# Repair one suspect step and see whether the outcome flips
child = blackbox.fork(trace, 2, blackbox.Change(kind="output", value={"result": {"rain": True}}))

blackbox.savings(child)           # steps re-run vs re-used, tokens and calls saved
```

Undoing one planted mistake in a 9-step run re-runs **1 step**, re-uses **8**, and spends **0 model calls**.
That is what turns "step 2 looks suspicious" into "step 2 caused this, and here is the run passing without it".

It also works on agents you did not write, demonstrated on Hugging Face `smolagents`, and on traces you have
already exported from somewhere else:

```bash
blackbox import otel traces.json
blackbox import langfuse trace.json
```

---

## Evidence

Claims about root-cause analysis are easy to make and hard to check, so everything below is measured on held-out
data with bootstrap confidence intervals, against baselines.

**The dataset we built:** 5,653 agent runs · 56,122 steps · **859 failures with a known guilty step**
(815 planted mistakes across 10 kinds, plus 44 real failures whose cause was established by replay experiment).
Questions come from HotpotQA and GSM8K, plus a shop task type held out entirely for testing. Save-points are
content-addressed and 80% de-duplicated, so 56k save-points fit in 10.4 MB.

**Diagnosis model** (graph features over who-used-whose-output), evaluated on data it never trained on:

| Test set | n | Top-1 (guilty step ranked first) | Top-3 |
|---|---:|---:|---:|
| Unseen questions, known mistake kinds | 67 | **0.60** | **0.82** |
| A task type never trained on (Shop) | 112 | **0.63** | **0.79** |
| Gradient-boosted baseline on the same split | 112 | 0.025 | n/a |
| Simple heuristics (first / last / random step) | | ≤ 0.25 | n/a |

Graph-derived features are worth **+16 points of Top-1** over text embeddings alone. The calibrated suspect list
names 5 steps and contains the guilty one **93%** of the time on held-out calibration runs, against a 90% target.

**An honest gap, because it matters more than the headline number.** On real, unplanted failures (n=17) the
model's first pick is rarely correct, because real causes tend to sit at the *planning* step rather than the step that
visibly misbehaved. Black Box handles this two ways: a policy that always includes the model's top 2 *plus* the
first decision step, and, above all, proof by replay, **which does not depend on the model being right**. The
ranker narrows the search; the replay experiment is what settles it.

**Live results from the system running end to end:**

- The regression firewall **BLOCKED** a proposed search rule: it fixed 1 of 4 similar failures but broke 1 of 2 passing runs.
- It **APPROVED** a different rule (fixed 1 of 3, broke 0); that rule is now offered automatically for look-alike failures.
- Crash-testing a question-answering agent scored it 4 of 5 stars: robust to 5 of 6 mistake kinds, weak against misleading search results.
- A causal report on a maths run found the calculator step **necessary but not sufficient** (the agent sometimes recovers), identified 2 verified recovery paths, and showed the mistake reached all 9 later steps.
- 859 labelled failures collapse into roughly **30 distinct failure patterns** by fingerprint.

---

## What is in the box

| Capability | What it does | Entry point |
|---|---|---|
| **Record** | Every model call, tool call, search and memory change, with a save-point after each step | `blackbox.wrap`, `@blackbox.tool`, `blackbox.run` |
| **Diagnose** | Rank the steps most likely to have caused the failure, with plain-language evidence | `blackbox show <run>`, `GET /api/runs/{id}/diagnosis` |
| **Prove** | Re-run with one suspect repaired at a time until the outcome flips | Verify (API, MCP `verify`) |
| **Causal report** | Necessary vs sufficient, joint causes, every recovery path, blast radius | `/causal`, MCP `causal_report` |
| **One fix for many** | Test one rule against similar past failures *and* past passing runs; APPROVE only if nothing breaks | `blackbox fleet <run>` |
| **Crash test** | Plant every known kind of mistake into a working agent and grade it 1 to 5 stars | `blackbox crash-test <run>` |
| **Seen this before?** | Failure fingerprints, look-alike failures, NOVEL flags, known fixes | MCP `similar_failures` |
| **Guardian** | Incidents in plain words over email, WhatsApp, Slack, Telegram; money-moving agents paused until a human approves | `blackbox.Guardian(...)` |
| **Black Box CI** | Replay pinned recorded runs on every pull request; fail the build on regressions | `blackbox ci pin` / `ci run` + GitHub Action |
| **MCP server** | Let Claude Code, Cursor or VS Code investigate failures with 28 tools | `blackbox mcp` |
| **Live Lab** | Ask any question, plant a mistake live, watch the 14-stage investigation | `blackbox lab "question"` |

**Safety is enforced, not advisory.** Tools that move money never execute during any replay, fork, verification
or fleet run, and Guardian never retries them without explicit human approval.

---

## Architecture

```
                  your agent (unchanged)
                            |
            +---------------v---------------+
            |  RECORDER                     |  models, tools, search, memory
            |  save-point after every step  |  content-addressed, 80% de-duplicated
            +---------------+---------------+
                            |
            +---------------v---------------+
            |  LIVE STEP CHECKER            |  typed questions per step
            |  Laya (local) -> Jev -> LLM   |  cascade, escalates on low confidence
            +---------------+---------------+
                            |
            +---------------v---------------+
            |  DIAGNOSIS                    |  graph model over data-flow edges
            |  + calibrated suspect list    |  + evidence in plain language
            +---------------+---------------+
                            |
            +---------------v---------------+
            |  REPLAY ENGINE                |  replay, fork, verify, causal report
            |  the proof layer              |  repair, fleet replay, crash test
            +---------------+---------------+
                            |
            +---------------v---------------+
            |  FINGERPRINTS & FAILURE ATLAS |  patterns, novelty, known fixes
            +---------------+---------------+
                            |
   +------------+-----------+----+------------+--------------+
   v            v                v            v              v
  Web        REST API +         CLI       MCP server    Black Box CI
dashboard    live streams                (IDE agents)  (GitHub Action)
```

Python package, FastAPI backend, React dashboard. Local models through Ollama, hosted through Groq or OpenRouter.
Every model is named in one file, `models.yaml`; keys live in `.env` and are never committed.

### The step checker cascade

Typed checks ("is this step consistent with its inputs?", "which mistake kind is this?") run first on
**Laya** (open-source, Apache-2.0, ~420M params, ~2 to 3 GB VRAM, ~30 ms per question on GPU, local and free).
Only when Laya's confidence is low do they escalate to **Jev**, and then to a full LLM. Black Box works with
Laya alone; each tier is measured rather than trusted. Labels for training never come from a model, only from
code checkers and replay experiments.

---

## Command line

```bash
blackbox runs --fail                    # failed runs
blackbox show <run_id>                  # step by step, with who-used-whose-output links
blackbox replay <run_id>                # replay from the recording
blackbox crash-test <run_id>            # red-team a passing run
blackbox fleet <run_id> --rule "..."    # one fix for many, with the regression firewall
blackbox ci pin && blackbox ci run      # regression firewall for agent code
blackbox guardian channels              # which alert channels are configured
blackbox mcp                            # MCP server on stdio
blackbox ui                             # API on http://127.0.0.1:8000
```

---

## Repository map

| Path | What lives there |
|---|---|
| `blackbox/core/` | Step schema, content-addressed store, hashing, privacy redaction |
| `blackbox/diagnosis/` | Graph model, GBM ranker, features, evidence, conformal calibration, fingerprints |
| `blackbox/api/` | FastAPI app, investigation jobs, live streams, snapshots |
| `blackbox/agents/` | Test agents (QA, maths, shop) and their tools |
| `blackbox/data/` | Dataset builder, task loaders (HotpotQA, GSM8K), OTel/Langfuse importers |
| `blackbox/eval/` | Metrics, baselines, LLM judge, reports |
| `blackbox/ci.py`, `blackbox/cli.py` | Regression firewall and command line |
| `web/` | React dashboard |
| `tests/` | 40 suites; `-m "not live"` skips anything needing provider keys |

Roughly 14,000 lines of Python across 110 modules.

## Development

```bash
pip install -e ".[all,dev]"
py -3 -m pytest -q -m "not live"           # full suite, no API keys needed
cd web && npm install && npm run dev       # dashboard on http://localhost:5173
```

Deeper documentation: system design in [`SYSTEM.md`](SYSTEM.md) · diagnosis model in
[`docs/DIAGNOSIS_GNN.md`](docs/DIAGNOSIS_GNN.md) · UI contract in [`docs/API_FOR_UI.md`](docs/API_FOR_UI.md) ·
MCP tools in [`docs/MCP.md`](docs/MCP.md) · CI in [`docs/CI.md`](docs/CI.md) · Guardian setup in
[`docs/GUARDIAN_SETUP.md`](docs/GUARDIAN_SETUP.md).

Workflow: branches `<name>/<feature>` → pull request into `dev` → `main` at milestones.

---

## Team

Built by **team Half a Byte** for the Bit N Build Maharashtra round.

| | |
|---|---|
| **Aryan Lomte** | Record and replay engine, fork and verify, the proof layer, API skeleton, fleet replay, CI, MCP server, Guardian, packaging |
| **Aditya** | Step checker questions, the trained diagnosis ranker, incident reports |
| **Radhesh** | Evaluation harness, test splits, live failure runs |
| **Advay Chavan** | Dashboard and screens, API surface extensions |

Released under the [MIT License](LICENSE).
