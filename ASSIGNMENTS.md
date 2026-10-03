# ASSIGNMENTS.md — Who builds what, and when

This file decides **ownership**. If anything else disagrees, this wins.
Design lives in `SYSTEM.md`; working rules live in `CLAUDE.md`. Each person's
step-by-step list is in `assignments/<Name>.md`.

## 0. The deliverable
An **installable Python package** (`pip install agent-blackbox`) that adds Black Box to an *existing* agent project in 3 lines (SYSTEM.md §0A), shown on an agent we did not write. Packaging: Aryan (library, CLI, `wrap()`); Advay (web UI bundled into the package, `blackbox ui`); Radhesh (the "existing project" integration demo + `blackbox test`); Aditya (shipping the trained ranker/checker weights).

## 1. Who owns what (one owner per folder)

| Person | Machine | Owns (folders) | In one line |
|---|---|---|---|
| **Aryan** (lead) | RTX 4060 8 GB | `core/` `recorder/` `replay/` `api/` (skeleton) | Recording, save-points, replay/fork, compare, verify, GenAI repair, integration, demo |
| **Radhesh** | RTX 3050 | `agents/` `faults/` `data/` `eval/` | The 3 test agents, planted mistakes, generating ~3,000 runs, then the evaluation tables |
| **Aditya** | M1 Air | `monitor/` `diagnosis/` `report/` | Step-checker questions, the trained ranker, suspect list, evidence, GenAI incident report |
| **Advay** (joins ~H7) | RTX 4050 6 GB | `web/` + extra API routes | Every screen, live streaming in the browser, demo driving |

Nobody edits another person's folder without asking in the team chat. The
exception is `core/schema.py`, which follows the change rule in `CLAUDE.md`.

## 2. Hand-offs: the only things that can block someone

| # | What | From → To | Due | Until it lands, use |
|---|---|---|---|---|
| 1 | `core/schema.py` | Aryan → all | **H2** | SYSTEM.md §4.1 |
| 2 | `RunContext` + `Agent` base (records to a JSON file is enough) | Aryan → Radhesh | **H3** | write the agent against the §4.2 signatures |
| 3 | Step-checker questions + `check_step(step, run) -> dict` | Aditya → Aryan | **H5** | a stub returning `None` |
| 4 | `fork(run_id, k, change)` | Aryan → Radhesh, Aditya | **H6** | — (planted-mistake runs start at H6) |
| 5 | First 200 real runs (shard file) | Radhesh → Aditya | **H6** | 3–4 hand-written fake runs |
| 6 | `fixtures/` (10 real runs incl. a run + its fork) + API skeleton | Aryan → Advay | **H7** | — |
| 7 | `diagnose(run) -> {scores, suspects, evidence}` | Aditya → Aryan | **H11** | a stub ranking by "first error" |
| 8 | `data/reports/latest.json` | Radhesh → Advay | **H13** | "No evaluation yet" empty state |

**Rule:** never wait. If your input is late, build against the stub shape.

## 3. Timeline (19 hours, H0 = kickoff)

| Hours | Aryan | Radhesh | Aditya | Advay |
|---|---|---|---|---|
| **H0–2** (together) | schema, repo skeleton, `models.yaml`, `.env.example`, `requirements.txt` | Groq key **from everyone**, OpenRouter key, `ollama pull`, download HotpotQA + GSM8K | `pip install laya` + check it runs, ask TypeSafe for Jev early access, install `system-one-adapter`, LightGBM | — |
| **H2–6** | store, `RunContext`, providers, save-points | QA + Math agents, tools, checkers | step-checker questions + `check_step` on both Jev and adapter; feature code on fake runs | — |
| **✅ M1 @ H6** | one run recorded → replayed from step k → forked | 200 clean runs, mistakes F1–F6 coded | `check_step` works on a real run | — |
| **H6–11** | re-use of unaffected steps, compare, checker wired into recorder, API skeleton, shard merge | planted-mistake runs on all machines, Shop agent, F7–F10, test-set splits | ranker v1 (no checker features) → v2 (with), first accuracy numbers | port the 26117 UI, Run screen + Runs list on fixtures |
| **✅ M2 @ H11** | API serves real DB + diagnosis | ≥ 1,500 runs with a known guilty step | ranker numbers on `test_known` | Run screen on the live API |
| **H11–15** | Verify (+ labelling natural failures), GenAI repair round 1, live streams | eval harness: baselines, LLM judge, Who&When import, `latest.json` | suspect list (90%), evidence sentences, GenAI incident report | Live run screen + alarm, Experiment, Compare, Report, Eval |
| **✅ M3 @ H15** | whole demo path works | all eval tables filled | report + evidence final | all screens wired |
| **H15–17** | bug bash, demo script | bug bash, data slides | results slides | polish, empty/error states |
| **✅ M4 @ H17–19** | **feature freeze at H17**, 2 rehearsals, backup screen recording | | | drives the demo |

**Sleep:** take 90-minute naps one at a time during H11–H15, while
generation or training runs. Aryan and Advay are never off together after
H11.

## 4. Must-have vs stretch (USP numbers refer to SYSTEM.md §1A)

| Must-have (demo breaks without it) | Stretch (only after M3) |
|---|---|
| U1 time-travel replay · U2 free re-watching · U3 storage stat · U4 who-used-what map | U17 one fix, many failures |
| U5 live check-engine light (Jev or LLM fallback) | U18 cheaper-model advisor |
| U6 numbers-from-nowhere · U7 spot-the-difference · U8 contamination trail | U22 top-5 failure patterns (atlas) |
| U9 trained ranker · U10 honest 90% suspect list · U11 unseen-mistake tests · U12 plain-English reasons | U23 every crash becomes a test |
| U13 verify ✅ · U14 bad luck vs real bug · U15 smart re-run · U16 fixes tested first · U19 savings meter | U25 fully offline mode |
| U20 crash-test dummies (planted mistakes) · U21 report with receipts | GenAI-planted mistakes, repair round 2 |
| U24 any model/provider · U26 plug-in checks · compare screen · eval page with real numbers | Who&When (if the download/format fights us) |

**Beyond-PS (SYSTEM.md §1B):** must = X1 autopilot · X3 checker cascade (Laya → Jev → LLM) · X4 3-line wrapper · X7 model report card · X8 BlackBox-3K dataset · X10 minutes-to-milliseconds study. Stretch-must = X2 fine-tuned Laya · X5 MCP server. Stretch = X6 agent CI · X9 privacy guard.

**Pitch rule:** a USP goes on a slide only if it works in the demo and its
number comes from `data/`. Advay keeps a USP checklist on the team board and
ticks each one only after seeing it work in the browser.

## 4A. Branches and CI/CD
- Workflow: `<name>/<feature>` → PR → `dev` → (milestone) → `main`. Details are in CLAUDE.md §Git workflow.
- **CI** (Aryan, ~H6, 30 min): `.github/workflows/ci.yml` runs pytest (no live tests), ruff and the web build on every PR.
- **CD** (Advay, after M3, stretch): deploy the API + web from `main` so judges get a live link; the laptop demo stays primary.

## 5. Decide at kickoff (10 minutes, then stop discussing)
1. Do we get a Jev early-access key today? If not by H6, the step checker
   runs on the adapter, and the "Jev vs LLM" table becomes "if time".
2. Which model runs the agents: Groq `llama-3.1-8b-instant` plus local
   `qwen2.5:7b`/`3b` (proposed: all of them, for variety).
3. The one-sentence pitch line, so the eval measures exactly that.
