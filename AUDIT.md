# AUDIT.md — what was built, how it was checked

Newest first. One entry per pushed change: what, why, how verified, what is
left. Everyone appends their own entries (CLAUDE.md §Git workflow).

---

## Aryan · `aryan/core-recorder`

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
