# AUDIT.md — what was built, how it was checked

Newest first. One entry per pushed change: what, why, how verified, what is
left. Everyone appends their own entries (CLAUDE.md §Git workflow).

---

## Radhesh · `radhesh/*` branches

### 3. Mistakes F7–F10, kept back from training (checklist row 7) · `radhesh/faults-unseen`
- **What:** `faults/catalog.py` now has all ten mistakes.
  - F7 wrong tool: the tool the model named is swapped for another of the
    same family, preferring one with the same arguments. Shop runs only (the
    QA and Math agents never choose between tools).
  - F8 memory lost: a text or list value is emptied (not removed: a missing
    key would crash the agent, and a crash is never a label), only where a
    later step reads the emptied value.
  - F9 instruction dropped: one sentence of the system prompt, or its whole
    reply-format block, is removed and the step is asked again for real.
  - F10 answers too early: stops instead of calculating / calling a tool /
    searching again.
  - F1 can now give another existing record id (Shop order ids).
  - Farm: `--faults all`. F7–F10 are never planted on a training task; on
    other QA/Math tasks their runs get split `test_new_mistakes`; Shop runs
    stay `test_new_tasks`.
- **Verified:** 27 new tests (`tests/test_faults_unseen.py`), 169 passing.
  10 sampled changes per mistake and agent appear in the forked step; F8 is
  forked at every allowed step of all three agents with no crash; three
  mutated rules each fail a test.
- **Real runs** (60 new tasks per family, `agent-local`, 4 forks, all ten
  mistakes): 552 runs, 142 labelled failures, **0 crashes**. Pass→fail:

  | | F1 | F2 | F3 | F4 | F5 | F6 | F7 | F8 | F9 | F10 |
  |---|---|---|---|---|---|---|---|---|---|---|
  | Math | 100% (15) | 78% (9) | 44% (9) | – | – | 66% (32) | – | 14% (7) | 43% (7) | 60% (5) |
  | QA | – | – | – | 73% (26) | 46% (28) | 24% (54) | – | 38% (16) | 9% (11) | 0% (5) |
  | Shop | 43% (23) | – | 70% (23) | – | – | 67% (6) | 15% (20) | 0% (41) | 0% (20) | 20% (15) |

  (run counts in brackets; the F9 numbers are from before the format-block
  option was added.)
- **Outside the 30–90% target, and why:** Math F1 is 100% (any changed number
  in arithmetic changes the answer). Shop F7–F10 are low because the 3B model
  keeps making redundant calls after the request is already handled, so a
  mistake planted on one of those steps is harmless, and wiped history only
  makes it repeat calls the tools refuse. QA F10 is 0%: the agent's own
  minimum of two searches absorbs an early answer. QA F6 24%. To tune next.
- **Found in the recorder, not changed (Aryan's folders):**
  1. A `state` change is applied in `RunContext._begin` after the fork step is
     closed, so the write is recorded on no step: an F8 run shows no evidence
     at its planted step. Applying the pending change before
     `_close_open_step()` fixes it. `test_memory_loss_is_recorded_as_a_write_
     of_the_planted_step` is marked xfail until then.
  2. `fork()` runs with no store and saves afterwards, so a fork's
     `state_hash_after` values name blobs that were never written.

### 2. Shop agent, mock shop API, 200 generated tasks (checklist row 7) · `radhesh/shop-agent`
- **What:**
  - `agents/tools/shop.py`: six tools (`get_order`, `check_stock`,
    `cancel_order`, `ship_order`, `update_quantity`, `refund_order`). The
    database is plain data in `ctx.state["db"]`; a tool takes it and returns
    the changed one, and keeps no state of its own, so a replayed and a
    re-run tool step land on the same database.
  - `agents/shop.py`: plan → (act → call)* → answer, 5–15 steps. The model
    sees tool reports, never the database. Checker `ops_state`: the database
    the agent leaves equals the correct one.
  - `data/tasks/ops_tasks.py`: 200 tasks over 7 kinds, deterministic. The
    expected database is produced by running the correct actions through the
    same tools.
  - Farm and task loader accept `--family ops`; every Shop run gets split
    `test_new_tasks`.
- **Verified:** 23 new tests in `tests/test_shop.py`, 137 in total passing.
  Each of the 7 task kinds is solved and replays with 0 model calls. Three
  mutations of the agent (no repeated-call guard, last action instead of
  first, database shown to the model) each fail a test.
- **Real runs:** 60 tasks on `agent-local` (qwen2.5:3b): 153 runs, 0 crashes,
  37/60 clean runs pass, mean 12.1 steps. Pass→fail: F1 83%, F3 38%, F6 23%.
- **Limits:** F6 is under the 30% target on Shop runs: a changed number in
  the plan text is usually harmless. F2 does not apply (tool results are
  objects, not single values). F7–F10 come on `radhesh/faults-unseen`.

### 1. Tools, checkers, QA + Math agents, mistakes F1–F6, farm (checklist rows 1–6)
- **What:**
  - `agents/tools/`: registry (ported from 26117, approval gate removed),
    `calculator` (parses the expression, no `eval`), `python_exec`
    (subprocess, 5 s timeout), BM25 `search` built per task over the
    question's own 10 paragraphs.
  - `agents/checkers.py`: QA = SQuAD-normalised F1 ≥ 0.6, Math = exact number.
  - `agents/qa.py` (7–9 steps) and `agents/math_agent.py` (6–15 steps), both
    using only `ctx.*`. `agents/builtin.py` registers them; `get_agent` now
    loads it on a miss, so the API and CLI can replay our runs.
  - `faults/catalog.py`: F1–F6 as `make_change(trace, fault_type, step_idx, rng)`.
  - `data/download.py`, `data/tasks/`, `data/splits.py` (sha1 of the task id),
    `data/farm.py` (clean run → forks → labels → shard → health check).
- **Verified:** 92 new tests (`test_tools`, `test_checkers`, `test_agents`,
  `test_faults`, `test_farm`), 102 in total passing. Every tool is called
  through the registry and through `ctx`. Both agents replay with 0 model
  calls. 10 sampled changes per mistake type appear in the forked step. A
  crashed run or crashed fork is counted and never labelled.
- **Real runs:** a 30-task trial per family on `agent-local` (qwen2.5:3b)
  gave 135 runs with 0 crashes. Clean pass rate: 13/30 Math, 12/30 QA.
  Pass→fail rate: F1 71%, F2 83%, F3 67%, F5 67%, F6 44–52%, F4 14% (since
  strengthened: the distractor now takes the right paragraph's id).
- **Changed outside my folders:** `.gitignore` `data/` → `/data/`. Unanchored,
  it ignored the code folder `blackbox/data/` as well.
- **Not yet verified:** Groq and OpenRouter runs (no keys in `.env` on my
  machine yet). The `@pytest.mark.live` test per agent is not written.
- **Open with Aryan:** a shard is one `Trace` JSON per line, gzip. Save-point
  blobs stay in the producing machine's `data/blobs/`, so a merged DB has the
  `state_hash_after` values without the blobs behind them.

### Aryan's review of Radhesh's agents + farm (PR into `dev`)
- Approved: QA/Math agents use only `ctx`; F1–F6 are mechanical edits (no
  model); splits use sha1 (stable across machines; `hash()` is salted per
  process). `get_agent` lazily loading the built-in agents is right.
- **Changed while merging (Aryan):** one shard format for the team.
  `farm.write_shard` now delegates to `data/shards.write_traces`, so
  save-points travel with the runs (Radhesh's "open with Aryan" item).
  `merge` still reads the early bare-Trace shards. Test:
  `test_farm_shard_carries_savepoints_and_old_format_still_merges`.

### 14. Two recorder bugs found by Radhesh, fixed · `aryan/recorder-fixes`
- **A fork's memory change was recorded on no step:** it was applied after
  the fork step was closed, so an F8 ("memory lost") run had no evidence at
  its planted step, which is bad training data for the GNN. Now it is applied
  while the fork step is still open (`_apply_pending_state_patch`, also in
  `close()`), so it shows in that step's `writes` / `state_diff`.
- **Forks never wrote their save-points:** `fork()` ran with no store, so a
  saved fork's `state_hash_after` named blobs that did not exist. It now runs
  with the store (same for `afork`).
- **Verified:** Radhesh's `test_memory_loss_is_recorded_as_a_write_of_the_planted_step`
  (was xfail) and `test_fork_writes_its_save_points_and_attributes_a_state_change`
  both **fail on the old code and pass on the fix**. 171 tests pass.
- **Data note:** F8 runs generated before this fix lack the write at the
  planted step. Regenerate them (or drop F8 rows) before the final GNN
  training.

### 13. Diagnosis GNN (scope: docs/DIAGNOSIS_GNN.md) · `aryan/gnn`
- **What:** a relational graph network over a run (nodes = steps; 4 edge
  types: data flow and order, both directions), plain PyTorch, a 5-seed
  ensemble. Main head: which step is guilty. Auxiliary heads: does the run
  fail; does a step look wrong. Features: structure, errors, MiniLM text
  embeddings, "facts from nowhere", overlap with the answer.
- **Leak guard (tests):** features never use `cached`, latency, tokens,
  `meta`, fault or patch. In our planted forks those fields alone would point
  at the planted step. `test_leak_guard_*` checks that a replayed run has
  identical features.
- **First results (3 Oct, 18:40; 507 runs, 66 labelled failures in train):**
  test_known n=12: **GNN Top-1 0.417 [95% CI 0.17, 0.67]**, Top-3 0.583, vs
  random 0.119, last model call 0.083, fallback order 0.083. Ablation (n=9 at
  training time): no message passing 0.111, order edges only 0.444, no text
  0.333. **Small n: indicative only.** Weakest on F6 (wrong fact, 0/3). On the
  demo's planted-F6 run it ranks the true step 4th.
- **Wired:** `GET /api/runs/{id}/diagnosis` order is Aditya's `predict` →
  GNN → labelled fallback, so the demo and Verify now get GNN suspects.
- **Bugs found and fixed while building:** a crash on batches with no labels;
  the random baseline printed 0.000 (argmax of ties) and is now the expected
  value; the API test silently used the locally trained model and is now
  hermetic.
- **Next:** retrain when the Math farm finishes; add the step-checker answers
  as features (aimed at F6); conformal suspect lists on top (Aditya).

### Farm on Aryan's 4060 (qwen2.5:7b, offsets 2000 / 800)
- QA: 150 tasks → 399 runs, **79 labelled failures, 0 crashes**; clean pass
  85/150. Flip rate: F4 59%, **F5 14%, F6 27% (below the 30–90% target: for
  Radhesh to tune)**. Math restarted after **my bad offset** (2000 > the 1,319
  GSM8K problems → 0 tasks).

### 12. `blackbox demo` on real runs, and a Verify flaw it exposed · `aryan/demo-verify-fix`
- `blackbox demo [--run ID]`: diagnose → verify → repair → compare on a real
  failed run, printed as a story. Run on Aryan's 4060 farm data (qwen2.5:7b
  agent; Nemotron-3-Super-120B (free OpenRouter) as `agent-strong` / `judge-large`).
- **Flaw found by running it on a planted-mistake run (F6 at step 0):** Verify
  "verified" step 7, the step that writes the answer, by pasting a passing
  run's output into it. That copies the answer and proves nothing. Fixed:
  (1) no twin repair on answer-producing steps; (2) every suspect is tested and
  the **earliest** verified step is the cause (SYSTEM.md §6.2). Regression
  test `test_verify_does_not_blame_the_answer_step_by_copying_a_twins_answer`
  failed before the fix and passes after.
- After the fix the same run verifies step 4 (a stronger model there flips
  it). Step 0 was not tried because the fallback suspect order only offers
  [7, 6, 4]: **the trained ranker is what closes this gap** (good before/after
  for the pitch).
- `label_natural` now tests every step earliest-first, uses no ranker output
  (hard rule 5) and repairs with the local 7B by default (free OpenRouter
  keys are rate-limited).
- Real repair output on that run: 3 of 4 GenAI fixes passed, each re-running
  1 of 9 steps (1,576 tokens saved per fix); the fixed answer is "Columbine".
- Storage on real farm data: 1,974 save-points stored as 518 files (74%
  de-duplicated).

## Aryan · `aryan/core-recorder` → merged to `dev` (PR #1); later work on `aryan/*` branches

### 11. First live verification (real model, local Ollama) · `aryan/live-tests`
- `tests/test_live_ollama.py` (marked `live`, skipped in CI and when Ollama is
  down): `models.yaml`'s `agent-local` tag exists; the registry path records
  **real token counts** from qwen2.5:3b; a wrapped `OpenAI(base_url=ollama)`
  client records tool → llm → final, and a fork with a changed tool output
  re-runs the dependent model call, which answers with the new value. 3/3 pass
  (16 s) on Aryan's 4060.
- Groq/OpenRouter are still unverified: no keys in `.env` yet.

### 10. Async agents (X4 completeness) · `aryan/async-wrap`
- `blackbox.wrap()` now also wraps `AsyncOpenAI` clients (detected
  automatically); `@blackbox.tool` works on `async def` tools; `await
  blackbox.arun(agent, input)`, `areplay`, `afork` for async agent functions.
- The recorder's step machine is split into decide (`_begin`) / execute / finish
  (`_finish`), so the sync and async paths share one set of replay rules
  (rule 6: one implementation for every path).
- **Verified:** `tests/test_async_integrations.py`: an async agent records
  llm/tool/llm/final, replay makes 0 real calls, a fork re-runs 1 call. All 77
  tests pass after the refactor.

### 9. Reviewed and merged Radhesh's tools + checkers (PR #4)
- His commit was rebased onto `dev` with authorship kept (his branch was cut
  from my pre-merge branch). Review notes are in the PR. CI failed first
  because `rank-bm25` was only in an extra that CI did not install: fixed
  (`[agents]` in CI; `datasets` moved to `[data]`). 76 tests passed at merge.

### 8. Cheaper-model advisor (U18) and privacy guard (X9) · `aryan/advisor-privacy`
- **Advisor** (`replay/advisor.py`, `POST /api/runs/{id}/advise` as a job):
  for a passing run, each model call is forked onto a cheaper model on its
  own; it reports which steps still pass and the tokens movable. Money is
  shown only if `models.yaml` has `price_per_mtok` for both models; nothing is
  estimated.
- **Privacy** (`core/privacy.py`, `Store(redact=True)` or `BLACKBOX_REDACT=1`):
  masks emails, phone numbers (incl. the Indian `+91 98765 43210` format),
  Luhn-valid card numbers and API-key shapes in requests, outputs, memory
  diffs, save-points, task input, expected answer, outcome and errors.
  `input_hash` is kept, so replay still recognises steps; masked outputs
  replay masked (stated in the module).
- **Verified:** `tests/test_advisor_privacy.py`: the advisor finds an unsafe
  downgrade and a safe one, and invents no USD. The redaction test **caught
  two leaks in the first version** (final answer in `outcome`, and Indian
  phone format); both are fixed. 20 tests pass.

### 7. CI is live (PR #2)
- GitHub Actions runs on every PR into `dev`/`main`: pytest + a web build
  (skipped until `web/` exists). **CI caught a real bug on its first run:**
  `.gitignore`'s `data/` also ignored `blackbox/data/`, so `shards.py` had
  never been committed. Anchored to `/data/`; fixed in PR #2.

### 6. Live streams and jobs (Aryan #13; feeds Advay's Live run + Experiment screens)
- `POST /api/runs` starts a live run in the background (`autopilot: true`
  needs `blackbox.monitor.check.check_step`); `GET /api/runs/{id}/events`
  streams `start | step | done | error` as Server-Sent Events. `POST
  /api/runs/{id}/verify` and `POST /api/runs/{id}/repair` return a `job_id`;
  `GET /api/jobs/{id}/events` streams `attempt | result | verdict` /
  `proposing | rejected | candidate`, then `done`. `GET /api/jobs/{id}` gives
  the status and result. Late subscribers get the full history first.
- `GET /api/runs/{id}/diagnosis` uses `blackbox.diagnosis.predict.diagnose`
  (Aditya) when present; until then it returns an **explicitly labelled
  fallback** order (`source: "fallback: ..."`), never a fake score.
- **Verified:** `tests/test_api.py::test_live_run_streams_steps_then_verify_job`:
  5 step events then done; the failed outcome is reported; the verify job
  streams attempt/result/verdict/done.

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
