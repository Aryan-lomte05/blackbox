# CLAUDE.md — Agentic Coding Guide for Black Box

Read by Claude Code (or any coding agent) working in this repo. It is the
ground truth for **how** to work here. What we build is in `SYSTEM.md`. Who
owns what is in `ASSIGNMENTS.md` and `assignments/<Name>.md`. Keep all three
accurate; when they disagree, `ASSIGNMENTS.md` wins on ownership and
`SYSTEM.md` wins on design.

## Project summary
Black Box is a flight recorder for AI agents. It records every step of agent
runs (model, tool, search, memory) with a save-point after each. A step
checker flags suspicious steps live. A trained ranker lists the likely guilty
steps with evidence. Replay experiments verify the cause. GenAI proposes fixes,
each tested by cheap replay, and writes a cited incident report. Hackathon
build: 19 hours, 4 people.

## Repo layout
```
blackbox/
  core/       schema.py (the contract), store.py, hashing.py          — Aryan
  recorder/   RunContext, providers (Groq/OpenRouter/Ollama)          — Aryan
  replay/     replay_from, fork, step re-use, diff, verify, repair    — Aryan
  api/        FastAPI                                                 — Aryan (skeleton), Advay (extras)
  agents/     QA, Math, Shop agents + tools/                          — Radhesh
  faults/     planted mistakes F1–F10                                  — Radhesh
  data/       task loaders, farm, splits, shards, importers           — Radhesh (shards.py: Aryan)
  eval/       baselines, LLM judge, report tables                     — Radhesh
  monitor/    step-checker questions + cascade (Laya → Jev → LLM)    — Aditya
  diagnosis/  features, ranker, suspect list, evidence                — Aditya
  report/     GenAI incident report + citation checker                — Aditya
web/          Vite + React app                                        — Advay
reference/from_26117/   old project code to PORT from, never import
fixtures/     small real sample runs for UI + tests
data/         gitignored: DB, save-points, shards, reports
```

## Stack
- Python 3.11+, FastAPI, Pydantic v2, SQLite, LightGBM, shap, scikit-learn,
  sentence-transformers, rank_bm25, `openai` SDK pointed at a base_url.
- LLM providers: **Groq, OpenRouter, Ollama**, all through the
  OpenAI-compatible chat API. Configured only in `models.yaml` + `.env`.
- Step checker cascade: **Laya** (local, `pip install laya`) → **Jev**
  (`typesafe-sdk`, only if `TYPESAFE_API_KEY` is set) → LLM via
  `system-one-adapter`. Same questions, same answer shape.
- Web: Vite + React 19 + Tailwind 4 + @xyflow/react + dagre + zustand +
  @tanstack/react-query (same stack as 26117's frontend).

## Commands
```bash
py -3 -m pip install -e ".[all,dev]"              # installs the package + `blackbox` CLI
cp .env.example .env                                   # then fill keys
blackbox models                                        # every models.yaml tag exists
py -3 -m blackbox.data.farm --family qa --n 50 --model agent-small   # generate runs → shard
py -3 -m blackbox.data.shards merge                    # shards → data/blackbox.db
py -3 -m blackbox.diagnosis.train
py -3 -m blackbox.eval.report
blackbox ui                                            # API on :8000 (dev: py -3 -m uvicorn blackbox.api.main:app --reload)
cd web && npm install && npm run dev                   # http://localhost:5173
py -3 -m pytest tests/test_<area>.py -q                # run the tests that touch your change
```

## Hard rules (breaking these breaks the product)

1. **Only `models.yaml` names a model.** Code uses registry ids
   (`agent-small`, `judge-large`), never tags or provider URLs.
2. **Agents touch the world only through `RunContext`.** LLM, tool,
   retrieval, state, clock and randomness all go through `ctx.*`. A direct
   `openai`/`requests`/`random`/`time` call inside an agent is an unrecorded
   step: replay will silently diverge and the trace will lie.
3. **Agents are resumable state machines.** All state lives in `ctx.state`.
   No Python locals carry meaning across nodes. A checkpoint must be a
   complete resume point.
4. **`blackbox/core/schema.py` is the contract.** See §Schema below.
5. **Labels never come from the thing being evaluated.** Ground truth comes
   from injection, counterfactual replay, a human, or an imported dataset,
   and `label.source` always says which. The diagnosis model never labels
   its own training data.
6. **Splits are by `hash(task_id)`.** A run, its fault forks and its
   counterfactual forks share a split. Never random-split runs.
7. **Secrets live in `.env` only.** Never commit, print or log an API key.
   `.env.example` lists the variable names.
8. **Tokens and costs are measured, never estimated.** If the provider did
   not report it, the field is `None`.
9. **Jev (or any step checker) only answers typed questions, and never
   decides labels or pass/fail.** Labels come from code checkers and replay
   experiments. Checker calls run in the background and must never slow or
   break the agent. If the checker is down, record no answer: never a default.
10. **GenAI output is never shown unverified.** Proposed fixes are shown with
    their replay result. Report sentences without valid `[step N]` citations
    are deleted.
11. **Never import from `reference/`.** Copy the piece you need into your own
    folder, strip what you don't need, and test it.

## Schema
`SCHEMA_VERSION` lives in `core/schema.py`. Changing a field needs:
- a version bump,
- a migration or re-import note in the PR,
- regenerated `fixtures/`,
- a message in the team chat **before** merging, because the farm, the
  model, the API and the UI all read it.

Adding an optional field with a default is allowed without a bump. Renaming
or removing a field is not.

## Git workflow (feature branches)
```
main      ← always demo-able. Only merged from dev at milestones (M1–M4), tagged m1..m4.
dev       ← integration branch. Every feature PR targets dev.
<name>/<feature>   e.g. aryan/recorder, radhesh/qa-agent, aditya/ranker, advay/run-screen
```
- Branch from the latest `dev`, keep branches small (one feature, under ~4 h of
  work), rebase on `dev` before opening a PR, and delete the branch after
  merge.
- **Every PR into `dev` needs:** tests for the touched area passing locally,
  a one-line description of what to check, and one reviewer (Aryan by
  default; Aryan's own PRs are reviewed by Aditya). Squash-merge.
- **`dev` → `main`** only at milestones, after the demo path works end to
  end on `dev`. Tag `m1`, `m2`, ….
- Never commit directly to `main` or `dev`. Never force-push them.
- Commit messages: `area: what changed`, e.g. `replay: re-use unaffected steps`.
- `data/`, `.env`, `*.db`, model weights and shards are gitignored. Small
  real sample runs go in `fixtures/` (keep them under 2 MB).

### CI/CD (planned, see ASSIGNMENTS.md)
- **CI (from ~H6):** GitHub Actions on every PR to `dev`/`main`: `pytest -m
  "not live"`, `ruff`, `cd web && npm ci && npm run build`. A red PR is not
  merged.
- **CD (after M3, stretch):** on a push to `main`, build the API and web
  images and deploy (Render/Railway/Fly for the API, Vercel/Netlify for the
  web app). The demo still runs from a laptop; deployment is a bonus link
  for judges.

## Review rules (inherited from 26117, where each one was learned the hard way)

1. **A tool isn't built until it has been called.** Every agent tool needs a
   test that invokes it through the registry, the way the agent does.
   Import-time correctness proves nothing.
2. **A test you haven't seen fail isn't a test.** Run a new regression test
   against the previous commit once.
3. **Harnesses print their own failures.** Never write `except: pass` in
   farm, training or eval code. If a run crashes, record it as a crashed run
   with its error. Do not drop it silently and do not record it as a "failure"
   of the agent. Crash ≠ task failure: a recorder bug must never become a
   training label.
4. **No fabricated data, not even labelled.** The UI never shows placeholder
   runs, scores or metrics when the backend is down. It shows an honest empty
   or error state. Fields we don't know are absent.
5. **Stale data never stands in for live data.** `fixtures/` are for
   development and tests, and are opt-in, never a silent fallback.
6. **A capability must exist on every path that reaches it.** Example: the
   step cache must apply to UI forks, farm fault-forks and counterfactual
   labeling alike. Put logic where all paths must call it.
7. **Test the real thing.** Mocks are fine for unit tests, but each provider
   needs one `live` test (marked, skippable without keys) that hits the real
   API. Only a live test catches a model tag that stopped existing.
8. **A feature is done when it works in the UI.** A full working demo means:
   live run → checker alarm → suspects + evidence → verify ✅ → repair →
   report → compare. "Backend tests pass" is not done.

## Hackathon priorities
The must-have vs stretch list is in `ASSIGNMENTS.md` §4. If time runs short,
protect this path in order:
1. A recorded run renders as a step graph with a step panel.
2. A failed run gets suspects with evidence (ranker without checker features
   is enough).
3. Fork or verify at the suspect: the outcome flips and the re-use counter
   shows.
4. The eval page has real numbers vs baselines.
5. Live checker alarm, GenAI repair, incident report, compare.
