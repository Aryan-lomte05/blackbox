# Aditya: Step Checker, Trained Ranker, Evidence, Incident Report

**Machine:** M1 Air. LightGBM and small embedding models run fine on it.
**Folders you own:** `blackbox/monitor/`, `blackbox/diagnosis/`, `blackbox/report/`
**Read first:** SYSTEM.md §5 (step checker), §6.1 (ranker), §6.4 (report), §7 (evaluation)
**Code to port:** `reference/from_26117/backend/retrieval/citation_validation.py` (for the report checker)

## Your USPs (SYSTEM.md §1A)
Must: U5 check-engine light (the questions; Aryan wires them in) · **U6 numbers-from-nowhere** · **U8 contamination trail** (forward walk on `parents` from the suspect to the final step; return the step list in the evidence) · U9 trained ranker · U10 honest 90% list · U11 unseen-mistake tests · U12 plain-English reasons · U21 report with receipts · U26 plug-in checks (Jev vs LLM table, only if a Jev key arrives).
Stretch, after M3: **U22 top-5 failure patterns** (group verified causes by mistake type + step type; `judge-large` names each group).

Beyond-PS (SYSTEM.md §1B): **X3 checker cascade** (Laya local → Jev → LLM; `pip install laya`, model `convaiinnovations/laya`; record `tier` on each answer; report % answered locally, ms and cost). **X2 fine-tune Laya** on our labelled steps once ≥1,500 labelled runs exist (train on the 4060 via Aryan; ~2–3 GB VRAM): base vs fine-tuned vs Jev vs LLM in the eval. Laya on M1 runs on CPU/MPS (≈0.2–0.5 s/question), which is fine for development.

## Checklist

| # | When | Build | Done when |
|---|---|---|---|
| 1 | H0–2 | request **Jev early access** (typesafe.ai); `pip install typesafe-sdk system-one-adapter[openai] lightgbm shap scikit-learn sentence-transformers` | adapter answers a test question through Groq |
| 2 | H2–5 | `monitor/questions.py`: the question bank in SYSTEM.md §5 (`consistent`, `on_track`, `mistake_type`, `severity`). `monitor/check.py`: `check_step(step, run) -> dict` builds the state text (task + this step's request/output + short summaries of the steps it used) and calls **Jev if `TYPESAFE_API_KEY` is set, else the adapter on Groq**. Same output shape both ways. | hand-off #3 to Aryan by **H5** |
| 3 | H2–6 | `diagnosis/features.py` on 3–4 hand-written fake runs: step type, position, error, empty output, how many later steps used it, does the final answer depend on it, memory changed, **unsupported facts** (numbers/names in output found in none of its inputs), checker answers + drop in `on_track` | features computed for every step of the fake runs |
| 4 | H6–9 | run on Radhesh's first 200 real runs. Add **"normal or odd?"**: embed step text (`BAAI/bge-small-en-v1.5`), distance to the nearest same-type step from **passing training runs** | — |
| 5 | H8–11 ✅M2 | `diagnosis/ranker.py`: LightGBM `lambdarank`, one group per failed run, trained on `train`, stopped early on `val`. Train **twice**: without checker features and with them (that comparison is a slide). | Top-1 / Top-3 on `test_known` posted in team chat |
| 6 | H10–11 | `diagnose(run) -> {scores, suspects, evidence}`, handed to Aryan for the API (hand-off #7) | Run screen shows real suspects |
| 7 | H11–12 | **Suspect list (90%)**: on the `calib` set, find how far down the ranked list you must go so the real cause is included 90% of the time (split conformal; about 30 lines); apply it at test time | report the actual hit rate per test set |
| 8 | H11–13 | **Evidence sentences**: top 3 SHAP reasons per suspect written as plain sentences ("output contains `1912`, which appears in none of its 3 inputs"), the trail of steps to the final answer, and the matching step from a passing run of the same task if one exists | evidence panel readable by a non-ML person |
| 9 | H12–15 ✅M3 | **GenAI incident report** (`report/`): `judge-large` fills Summary · Timeline · Probable cause · Contributing factors · Evidence · Recommended fix · Confidence; every sentence ends `[step N]`; the citation checker deletes sentences citing steps not in the evidence and reports how many | 10 reports, 0 sentences with invalid citations after the checker |
| 10 | H13–15 | give Radhesh the "Jev alone", "ranker without checker" and "ranker with checker" predictions for the eval tables; if a Jev key exists, the **Jev vs adapter** comparison (accuracy, ms per call, cost) | rows filled in `latest.json` |
| 11 | *stretch* | chance-of-success curve (a small model predicting pass/fail after each step from run outcomes) | — |
| 12 | H15–17 | results slides | — |

## Traps
- **Never let the same question sit in train and test.** Splits are by task
  id, already done in `data/splits.py`. Fit anything that learns "normal"
  (nearest-neighbour bank, scalers) on `train` only.
- **The "matching passing step" feature** must come from the same split, and
  you must also report the ranker *without* it, because new tasks have no
  passing twin.
- **Position-only check:** train a ranker that only sees the step's position.
  If it scores close to the real one, the planted mistakes are badly spread:
  tell Radhesh.
- If a run can't be scored, print its id and the reason. Never skip it
  silently.
