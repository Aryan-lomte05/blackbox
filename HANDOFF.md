# HANDOFF: read this first in a new session

## 🎬 4 Oct ~13:10: final state for Pitch 2 (16:00)
- **Demo video:** `data/blackbox_demo_5min.mp4` (5:00, every screen on live data, waits fast-forwarded) and its timed
  3-person voiceover `docs/VOICEOVER.md`. Recorder + editor scripts live in the session scratchpad (`record_full.js`,
  `edit.py`: segment log → waits ~2 s at 8-16x, results held to reach exactly 5:00).
- **Round 1 run sheet + Q&A:** `docs/ROUND1_RUNBOOK.md`. **PyPI:** `docs/PUBLISHING.md` (built + verified; needs your
  PyPI token; `agent-blackbox` was free).
- **Fixed today from frame-by-frame review (#56–#65):** demo case list emptied by a test (cache now per store);
  engines' premature `done` (empty causal table, cut-off crash test); streams now reconnect; hard-coded values
  removed (PROVED, regressions "0", run ids, question text, invented placeholders); evidence said every search
  "returned nothing"; run graph top-to-bottom; status 22.5 s → 5 ms, dataset 7 s → 70 ms (memoized per store
  revision, background status snapshot, warm start, dataset stale-while-revalidate).
- **Run it:** `py -3 -m blackbox.cli ui --port 8000` (warms its caches; wait for "caches warm") and
  `cd web && npx vite --port 5173 --host 127.0.0.1`. Never launch these from a Claude session you might restart.

## ☀ Morning of 4 Oct (written 05:00): what to do first
1. **Guardian is live**: email (EmailJS, flight-recorder design), WhatsApp (Twilio sandbox), Slack all delivered
   (#48–#53). Before the pitch: send "hi" to +1 415 523 8886 on WhatsApp (24 h sandbox window). Phone calls off.
   Check: `py -3 -m blackbox.cli guardian test --severity high`. Lab with real alerts: `blackbox lab "..." --notify`.
2. **Verify runs on the local 7B by default** (#54, `BLACKBOX_VERIFY_MODEL`). To use Groq: put `GROQ_API_KEYS` in
   `.env`, then `BLACKBOX_VERIFY_MODEL=agent-strong-groq` (llama-3.3-70b; falls back to the 7B).
3. **Advay**: `docs/UI_BRIEF.md` (design system) + `docs/UI_PROMPTS.md` (prompts in order); release
   `ui-kit-2026-10-04`; add him as a repo collaborator if not done.
4. **Re-run e2e** across the /docs cases after tonight's changes: `py -3 scripts/e2e_docs.py --base http://127.0.0.1:8001 --skip-lab` (server: `blackbox ui --port 8001`).
5. Open (not started): **Laya fine-tune** on labelled steps (Aditya's checker; check whether the `laya` package
   supports training, else train a small classifier on checker answers); **real-failure model**: label the 314
   unlabelled natural failures with Verify on the 7B (`py -3 -m blackbox.replay.label_natural --limit 100 --repeats 1
   --import blackbox.agents.builtin`), then retrain `gnn train --variant with_real_failures` and compare on
   `test_natural` (n=17 today, Top-1 0). Do not change demo data in the hour before a pitch.
6. Rotate keys pasted in chat (OpenRouter, Slack webhook, EmailJS private key, Twilio token) after the hackathon.

## ⏱ Update 4 Oct ~03:10 IST: **Pitch 1 at 11:00**, Pitch 2 at 16:00 (if we pass). Freeze the demo at 09:30.
Merged to dev overnight (each its own PR, CI green):
| PR | What | Where |
|---|---|---|
| #37, #40 | MCP server as a package, 27 tools, resources, prompts, progress, autocomplete | `blackbox/mcp/`, `docs/MCP.md`, `.mcp.json` |
| #38 | forks re-use the whole run family: undoing a planted mistake = 1 step re-run, 0 model calls, deterministic | `recorder/context.py`, `replay/engine.py` |
| #39 | **fleet replay** (one fix for many, time machine, regression firewall APPROVE/BLOCK) + **causal report** (necessary / sufficient, joint causes, recovery paths, blast radius) | `replay/fleet.py`, `replay/causal.py`, `blackbox fleet` |
| #41 | **failure fingerprints** (seen before? NOVEL? known fixes); UI fixtures for every new screen; Advay start-here | `diagnosis/fingerprint.py`, `fixtures/ui/`, `assignments/Advay.md` |
| #42 | Guardian channels: Slack, Telegram, voice call (critical only) | `guardian/channels.py` |
| #43 | **crash test / red team**: every known mistake planted, graded, 1-5 stars | `replay/chaos.py`, `blackbox crash-test` |
| #44 | fix: planted runs now write save-points; **backfill repaired 2,140 of 2,142** affected runs (2 differ, reported) | `data/farm.py`, `scripts/backfill_savepoints.py` |
| #45 | **import OpenTelemetry / Langfuse traces** (CLI, API, MCP) | `data/importers/external.py`, `examples/traces/` |
In flight: **Black Box CI** (`blackbox ci pin|run`, GitHub Action `.github/actions/blackbox-ci`, `docs/CI.md`): the
wheel installs in a clean venv and passes on an 8-run pack.
**Release for the dashboard** `ui-kit-2026-10-04`: live store (5,672 runs, save-points backfilled), models, UI kit.
The UI owner needs collaborator access to the private repo to download it.
**Model retrained 02:41** (overnight pipeline, n_features 37): unseen questions Top-1 0.597 / Top-3 0.821 (n=67, the
test set grew from 28); Shop 0.634 / 0.795 (n=112); real failures still Top-1 0 (n=17); suspect set k=5, 93% on calib.
Pitch deck source for NotebookLM: `docs/PITCH_BRIEF.md`.
Real results worth quoting (from runs, not memory): F4 search rule BLOCKED (fixed 1/4, broke 1/2); fixture rule APPROVED
(fixed 1/3, broke 0/1); 858 labelled failures → 30 fingerprints; crash test of a QA run ★★★★☆ (weak against
misleading search paragraphs); causal report on a Math run: calculator step necessary, not sufficient, 2 recovery paths.
Demo story: crash test finds a weakness → causal report explains it → fleet fix tests a rule → firewall verdict →
Guardian incident → MCP: ask Claude Code the same questions.

State as of **4 Oct 2026, ~02:30 IST** (pitch: **4 Oct, 16:00**). Lead: Aryan (`Aryan-lomte05`).
Repo: `Aryan-lomte05/Half_a_Byte_maharashtra_round` (private). Work on `dev`; `main` only at milestones.

## 1. What Black Box is (one paragraph)
A flight recorder for AI agents, shipped as a Python package. Record every step of an agent run with a
save-point → warn live (step checker) → diagnose the guilty step (trained model) → **prove** it by
re-running with only that step repaired (re-running only affected steps) → GenAI fixes tested by replay →
cited report. Beyond the PS: **Guardian** (WhatsApp / email incidents for people running agents
unattended, money-moving tools never re-run), **Live Lab** (type a question, plant a mistake live,
watch 14 stages), Autopilot, MCP server, 3-line wrapper for any agent (proven on smolagents).
Design: `SYSTEM.md`. Rules: `CLAUDE.md`. Ownership: `ASSIGNMENTS.md`. Evidence log: `AUDIT.md`.
USP truth table: `docs/USP_STATUS.md`. UI contract: `docs/API_FOR_UI.md`. Mentor briefing:
https://claude.ai/artifact/QqhsADSgwmMpyFc26sJaav (shared as anyone-with-link).

## 2. Team (GitHub handles: never @mention first names)
| Who | Handle | Owns | State |
|---|---|---|---|
| Aryan (lead) | `Aryan-lomte05` | core, recorder, replay, verify/repair/autopilot, API, Guardian, Lab, graph-feature model, integration | active |
| Radhesh | `rad117` | agents, mistakes F1–F10, farm, splits, eval harness, dataset card | asked to farm balanced tool/search mistakes on his machine (Math 300–800, QA 400–2000) + F7–F10 on test tasks, and share shards |
| Aditya | `02Aditya2323` | step checker (Laya cascade), GBM ranker, conformal, report | checker merged (#23), ranker merged via #33 (his authorship kept) |
| Advay | unknown handle | web app (React; "grandest dashboard") | nothing pushed yet; everything he needs is in `docs/API_FOR_UI.md` + `fixtures/ui/` |

## 3. Numbers (all reproducible from `data/`)
- Data: **5,431 runs, 53,950 steps, 817 labelled failures**; save-points 80% de-duplicated.
- Diagnosis (graph-feature model, CV-chosen; test sets used once), planted mistakes:
  unseen questions Top-1 **0.607** [0.43, 0.79] / Top-3 **0.929** (n=28); Shop (never trained) Top-1
  **0.652** / Top-3 0.768 (n=112). Baselines ≤ 0.25. GBM (Aditya): 0.448 / 0.621; Shop 0.025.
- 90% suspect list: k=6 calibrated on `calib`; coverage 0.96 known / 0.91 Shop / 0.77 real.
- **Honest gap:** real failures (nothing planted, cause proven by Verify, n=17): model Top-1 **0**;
  real causes cluster at step 0 (the plan). Suspect policy = model top 2 + first decision → Top-3 0.65.
- e2e: **58/58** `/docs` use cases passed (v1); v2 (adds UI endpoints, ranker, Guardian, Lab) was running.

## 4. Running right now / in progress (check with `blackbox status`)
- **Overnight pipeline** `scripts/overnight.sh` (started ~00:45): 1 Math farm ✅ (835 runs; F3 flips only
  4.5% on Math: agent recovers) → **2 QA farm (search mistakes) running** → 3 Laya backfill on labelled
  failures (`scripts/backfill_monitor.py`) → 4 retrain `gnn train --variant with_real_failures` (now with
  checker features, n_features=37) → 5 dataset export. Logs: `data/logs/overnight_*.log`.
- **e2e v2** on a test server at **port 8001**: `data/logs/e2e_docs_v2.log` (28 PASS so far, no FAIL).
  Branch `aryan/e2e-v2` pushed, **PR not opened yet**: open it, merge after CI.
- Labeller (real failures) was stopped (it used the OpenRouter quota). Resume with
  `py -3 -m blackbox.replay.label_natural --limit 60 --repeats 1 --strong-model agent-local-14b --import blackbox.agents.builtin`
  once the farm is done (the 14B is slow but free).

## 5. Next steps (in order)
1. When the overnight pipeline finishes: read `data/logs/overnight_retrain.log`; compare with the
   numbers above (old model kept as `data/models/gnn_planted_only.pt`, `gnn_full_variant.pt`).
   If worse, restore the better one. Re-run `scripts/export_ui_fixtures.py`; re-run e2e (incl. Lab).
2. Merge Radhesh's shards (Drive → `data/shards/`): `py -3 -m blackbox.data.shards merge data/shards/`.
   Retrain both models (ours: `gnn train`; Aditya's: `python -m blackbox.diagnosis.ranker`), compare.
3. Calibrate the checker alarm on labelled steps (Aditya); then Autopilot on real runs (X1).
4. Advay's UI: support him from `docs/API_FOR_UI.md`; keep the API stable.
5. Pitch prep: demo script (Investigate → Lab → Guardian trader bot → atlas), rehearse, backup video.
   Update the briefing artifact with final numbers.

## 6. How to run things
```bash
pip install -e ".[ui,ml,agents,dev]" lightgbm shap        # this machine already has everything
blackbox ui                      # :8000  (/docs dropdown demo, / inspector); restart after pulls
blackbox lab "question"          # Live Lab (CLI); POST /api/lab streams the same 14 stages
blackbox status --watch 5        # queue, jobs, GPU, logs, data, model
blackbox demo | mcp | export-test <run> | models | runs --fail | show <run>
py -3 examples/trader_bot.py --glitch      # Guardian demo (critical incident, outbox email/WhatsApp)
py -3 examples/smolagents_demo.py          # 3-line integration on a third-party framework
py -3 scripts/e2e_docs.py --base http://127.0.0.1:8001 [--skip-lab]
py -3 -m pytest -q -m "not live"           # ~240 tests; CI runs the same on every PR
```

## 7. Gotchas learned the hard way (do not repeat)
- **Never kill processes with an inline `python -c` that contains the target's name**: it matches and
  kills itself (exit 15, happened 3×). Use `scratchpad/stop_port.py <port>` / `stopjobs.py` style
  files, or match by listening port.
- **Gate commits on the test exit code**, not `| tail` (a failing test was committed once).
- **Capture the PR number from `gh pr create`** output; never assume it (merged a teammate's PR by
  accident once).
- **`gh pr merge --delete-branch` auto-closes PRs stacked on that branch** (closed #20 by accident).
- OpenRouter keys are **free tier: 50 req/day/account, exhausted for 3 Oct**. Client now fails fast and
  falls back (`fallback:` in `models.yaml`: agent-strong → local 14B, judge-large → local 7B).
  $10 credit on OpenRouter = 1,000/day.
- Tests must be **hermetic**: locally trained models (gnn.pt, ranker_A.pkl in `data/models/`) change
  API results; tests stub `gnn.available` and hide `blackbox.diagnosis.predict`.
- **Leak guard**: diagnosis features must never use cached/latency/tokens/meta/fault (replayed steps
  differ in those). `tests/test_gnn.py` enforces it.
- **Money safety**: tools in `money_moving_tools` never execute during any re-run (`dry_run_tools`).
- `.gitignore` `data/` must stay anchored as `/data/` (once hid `blackbox/data/`).
- Model binaries never go in git: weights live in the private release `data-2026-10-03`
  (dataset, our model, Aditya's ranker).
- Windows console: set `PYTHONIOENCODING=utf-8` for scripts that print symbols.
