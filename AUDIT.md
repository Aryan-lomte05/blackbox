# AUDIT.md — what was built, how it was checked

Newest first. One entry per pushed change: what, why, how verified, what is
left. Everyone appends their own entries (CLAUDE.md §Git workflow).

---

## Aryan · `aryan/core-recorder`

### 5. Verify, Autopilot, GenAI Repair (U13, U14, U16, X1)
- **Verify** (`replay/verify.py`): per suspect, tries "twin" (the matching
  step from a passing run of the same task), "stronger" (re-ask the model
  decision behind the step with `agent-strong`) and "rerun" (no change,
  nothing re-used). Live strategies are repeated (default 3). Verified =
  a repair passes in ≥ 50% of attempts and a plain rerun does not ("bad luck"
  otherwise). **It credits the step where the fix was applied:** a tool step
  fed by a bad model decision is a symptom, and the decision is the cause.
  `label_from_verification` writes `Label(source="verified")` for natural
  failures.
- **Autopilot** (`replay/autopilot.py`): a synchronous checker after each
  step. Alarm when P(on track) < 0.3 with confidence ≥ 0.6, which raises a
  rewind the agent cannot swallow. The partial run is saved as `rewound`
  (it never reached an answer), and a fork from the decision step with
  `agent-strong` takes over, re-using the prefix. At most 2 rewinds; it never
  loops on the strong model. Answer shape expected from Aditya's checker:
  Laya/Jev `answers` (`on_track.noul`, `.confidence`).
- **Repair** (`replay/repair.py`): judge-large sees the steps around the bad
  step (**never the expected answer**) and proposes `add_rule` / `model` /
  `args`. Inapplicable proposals are rejected with a reason. Every candidate
  is run by fork, and the card carries pass/fail, answer and savings. There
  is a second round with the history if none passes.
- **Verified:** `tests/test_verify_autopilot_repair.py` (5): verify credits
  step 0 with CE 1.0 and writes the label; a flaky model is detected as bad
  luck; autopilot rescues a run before it answers; repair rejects an
  inapplicable fix and passes a prompt-rule fix; fallback suspect ordering.
  The first version credited the symptom step; the test caught it and it was
  fixed.
- **Limits:** pairs of interacting causes (ddmin) are not done yet. Repair
  "transfer to similar failures" (U17) waits for Aditya's failure groups.

### 4. Shards (`data/shards.py`)
- Export this machine's runs (with save-points) to
  `data/shards/<machine>_<time>.jsonl.gz`; merge folders into the central DB.
  Idempotent; unreadable lines are reported, never dropped silently.
- **Verified:** `tests/test_shards.py`: export → merge gives identical steps
  and all save-points; re-merge adds 0.

### 3. API skeleton, compare, CLI, CI
- `/api/health` (db counts incl. save-point de-duplication, models,
  providers configured), `/api/runs` (filters), `/api/runs/{id}` (+ graph
  edges), `/api/runs/{id}/steps/{idx}` (+ save-point), `POST replay`,
  `POST fork`, `/api/compare`. CLI: `blackbox runs/show/replay/models/ui`. CI:
  pytest + web build on PRs.
- **Verified:** `tests/test_api.py`: compare's first divergence is exactly
  the forked step; outcome flip reported.

### 2. 3-line integration for existing projects (USP X4, SYSTEM.md §0A)
- **What:** `blackbox.wrap(client)` (any OpenAI-compatible client),
  `@blackbox.tool` / `@blackbox.retriever`, `blackbox.run(agent_fn, input)`,
  `blackbox.session()` (record-only), and `blackbox.configure(data_dir)`.
  A user's agent function is re-runnable by import path (`module:qualname@fn`),
  so fork works from another process (the UI).
- **Why:** the deliverable is a package you add to someone else's agent.
- **Verified:** `tests/test_integrations.py`: an agent written without Black
  Box records llm/tool/llm/final steps with provider and tokens; replay makes
  0 real calls; a fork that changes the tool output flips the answer with 1
  real call; unwrapped use is untouched; a session without a checker records
  no verdict.
- **Limits:** streaming calls pass through unrecorded (warned); async clients
  are not wrapped yet; tool results must be JSON-like (anything else is
  stored as text, with a warning).

### 1. Core: schema, store, recorder, providers, replay/fork
- **What:** schema v1; SQLite + fingerprint-named save-points; `RunContext`
  (memory read/write log → `parents`, save-point per step, background checker
  hook); providers for Groq/OpenRouter/Ollama with key rotation and
  `providers verify`; `replay` and `fork` with re-use of unaffected steps;
  `pyproject.toml` for the package.
- **Design note:** replay re-executes the agent's code with every step before
  the fork served from the recording (0 provider calls) and checked for
  divergence. This is more robust than restoring mid-function state, and
  save-points are still stored for inspection.
- **Verified:** `tests/test_core_replay.py` (5 tests): parents and
  save-points correct, replay 0 calls, a fork re-uses the independent step
  after the fork and re-executes only the dependent one (tokens_saved
  counted), state change works, and a non-deterministic agent is reported as
  a crash, not a failure.
- **Not yet verified:** live provider calls (needs keys in `.env`; run
  `py -3 -m blackbox.recorder.providers verify`).
