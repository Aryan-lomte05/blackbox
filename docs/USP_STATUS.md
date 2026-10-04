# USP status: what is built, with the evidence

One honest source of truth for the pitch and the UI (state: 4 Oct, ~02:00). A USP goes on a slide only
if its row says **Done** and the evidence is reproducible. Numbers come from `AUDIT.md`,
`data/models/gnn_metrics.json`, `data/reports/e2e_docs.md`.

Legend: **Done** = built, tested, demoable · **Partial** = built, with a stated gap · **Missing** = not built.

## Recording: "the flight recorder"

| # | USP | Status | Where | Evidence |
|---|---|---|---|---|
| U1 | Time-travel debugging | Done | `replay/engine.py` | fork/replay tests; `/api/runs/{id}/fork`; e2e 58/58 |
| U2 | Free re-watching | Done | `replay()` | every replay in e2e: **0 model calls** |
| U3 | Git-style storage | Done | `core/store.py` | 29k save-points stored once each: **78% de-duplicated** |
| U4 | Who-used-what map | Done | `recorder/context.py` | memory tracking (native); inferred from content for third-party agents (smolagents) |

## Detection: "the cockpit warnings"

| # | USP | Status | Where | Evidence |
|---|---|---|---|---|
| U5 | Check-engine light | Partial | `monitor/` (Aditya), `replay/autopilot.py` | Laya alarm fired on exactly the planted step in the Live Lab (consistent 0.12); not calibrated yet, LLM tier answers 1.0 for everything |
| U6 | Numbers from nowhere | Done | `diagnosis/graph_data.py`, `evidence.py` | feature + sentence ("states '1912', found in none of the steps it used") |
| U7 | Spot-the-difference | Done | `replay/diff.py`, verify "twin" | compare tests; `/api/compare` |
| U8 | Contamination trail | Done | `diagnosis/evidence.py: trail()` | in `/diagnosis` evidence and the run graph (dataflow edges) |

## Diagnosis: "the investigators"

| # | USP | Status | Where | Evidence |
|---|---|---|---|---|
| U9 | Learns from thousands of runs | Done | `diagnosis/gnn.py` (graph features), `diagnosis/ranker.py` (GBM) | planted, unseen questions: Top-1 **0.607** [0.43, 0.79], Top-3 **0.929**; Shop (never trained) Top-1 **0.652**. GBM: 0.448 / 0.621; Shop 0.025 |
| U10 | Honest 90% suspect list | Done | `evidence.py: calibrate()` | k=6 calibrated on `calib` only; coverage **0.96** known / **0.91** Shop / 0.77 real failures |
| U11 | Works on mistakes it never saw | Partial | splits | new task type: done (Shop). F7–F10 runs live on Radhesh's machine, not merged yet |
| U12 | Plain-English reasons | Done | `evidence.py: sentences()` | per suspect, in `/diagnosis`, MCP `diagnose`, Investigate |
| — | Real failures | Partial (honest gap) | `gnn.py` real-failure set | model Top-1 0/17; suspect policy (model top 2 + first decision) Top-3 **0.65**; fix = more real labels |

## Proof and repair: "the simulator"

| # | USP | Status | Where | Evidence |
|---|---|---|---|---|
| U13 | Prove, don't accuse | Done | `replay/verify.py` | Verify repairs only its suspect (bug found + fixed with a failing-first test) |
| U14 | Bad luck vs real bug | Done | verify reruns | `test_verify_detects_bad_luck`; tool reruns count as proof |
| U15 | Spreadsheet-style smart re-run | Done | fingerprint re-use | e.g. Lab: "re-ran 1 of 8 steps, saved 832 tokens" |
| U16 | Fixes tested before shown | Done | `replay/repair.py` | e2e: 4 fixes tried, 4 passed (on a planted case) |
| U17 | One fix, many failures | Missing | — | needs the atlas groups + repair; stretch |
| U18 | Cheaper-model advisor | Done | `replay/advisor.py` | e2e: 5 model calls checked, 5 safe on the 3B model |
| U19 | Savings meter | Done (API) | `savings()` | in every fork / verify / Lab response; UI pending |

## Learning and reporting: "the safety board"

| # | USP | Status | Where | Evidence |
|---|---|---|---|---|
| U20 | Crash-test dummies | Done | `faults/catalog.py`, `data/farm.py` (Radhesh) | 10 planted mistake types; 3,800+ runs |
| U21 | Report with receipts | Done | Investigate story, `/report`, Guardian email | every line from recorded facts |
| U22 | Top-5 ways your agent fails | Done (API) | `/api/atlas`, MCP `failure_patterns` | e.g. "Math: wrong fact at a check step: 17%" |
| U23 | Every crash becomes a test | Done | `/export-test`, `blackbox export-test` | exported test replays a real failure in 0.18 s |

## Practical

| # | USP | Status | Where | Evidence |
|---|---|---|---|---|
| U24 | Any model, any provider | Done | `recorder/providers.py`, `models.yaml` | Groq / OpenRouter / Ollama; per-model fallback when a free quota runs out |
| U25 | Runs fully offline | Partial | local Ollama + fallbacks | recording, replay, diagnosis, verify run locally; Lab QA needs Wikipedia; not demoed with Wi-Fi off |
| U26 | Plug-in checks | Done | `monitor/cascade.py` (Aditya) | Laya → Jev → LLM; Jev untested (no key) |

## Beyond the problem statement

| # | USP | Status | Evidence |
|---|---|---|---|
| X1 | Autopilot (prevent, not just debug) | Partial | built + tested with a stand-in checker; needs the calibrated checker to fire on real runs |
| X2 | Our own fine-tuned checker | Missing | Laya not fine-tuned yet (labelled steps exist) |
| X3 | Checker cascade | Done | Aditya's cascade, merged (#23) |
| X4 | 3-line wrapper on any agent | Done | smolagents demo: replay 0 calls, fork flips the answer re-running 2/6 steps |
| X5 | MCP server for IDEs | Done | `blackbox mcp`; tested over stdio |
| X6 | Agent CI | Done | exported tests + `pytest` |
| X7 | Model report card | Done | `/api/dataset` → `model_report_card` |
| X8 | BlackBox-3K dataset | Done | private release `data-2026-10-03` (card + loader) |
| X9 | Privacy guard | Done | redaction tests (emails, Indian phone numbers, cards, keys) |
| X10 | Minutes → milliseconds study | Missing | needs 3 people × 3 runs, timed |
| G | Guardian (operators, WhatsApp/email, approval) | Done (delivery untested) | trader-bot demo; money-moving tools never re-run during investigations |
| L | Live Lab (type a question, plant a mistake live) | Done | `blackbox lab`, `POST /api/lab` (14 streamed stages) |

**Count:** 26 Done (3 API-only until the UI lands) · 8 Partial · 4 Missing (U17, X2, X10, plus real-failure accuracy as a stated gap).
