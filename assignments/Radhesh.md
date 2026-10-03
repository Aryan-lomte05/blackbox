# Radhesh: Test Agents, Planted Mistakes, Data Generation, Evaluation

**Machine:** RTX 3050. Run `nvidia-smi` first. With 4 GB use `qwen2.5:1.5b`/`3b`; with 6 GB use `qwen2.5:3b`.
**Folders you own:** `blackbox/agents/`, `blackbox/faults/`, `blackbox/data/` (except `shards.py`), `blackbox/eval/`
**Read first:** SYSTEM.md §3 (data), §4.2 (`ctx`), §7 (evaluation)
**Code to port:** `reference/from_26117/backend/tools/registry.py` (tool decorator) and `reference/from_26117/backend/retrieval/lexical.py` (BM25 search)

## What "data" means here (no confusion)
- **Download:** only the *questions*. HotpotQA (`hotpotqa/hotpot_qa`, config `distractor`, split `validation`; each question comes with its own 10 paragraphs) and GSM8K (`openai/gsm8k`, config `main`, split `test`). Who&When (`Kevin355/Who_and_When`) is for testing only.
- **Generate:** every agent run we train on, using our agents.

## Your USPs (SYSTEM.md §1A)
Must: **U20 crash-test dummies** (planted mistakes; own the data slide numbers) · U11 unseen-mistake tests (with Aditya; you build the splits and the eval rows).
Stretch, after M3: **U23 every crash becomes a test** (`data/export_test.py`: write the save-point before the cause plus the expected outcome as a pytest file that replays the run and asserts it now passes).

Beyond-PS (SYSTEM.md §1B): **X7 model report card** (per agent model: failure-type mix, guilty-step positions, fix rate) · **X8 BlackBox-3K dataset** (dataset card + loader + export script, ~1 h at H15) · stretch **X6 agent CI** (`blackbox test` replays exported crash tests, exit code ≠ 0 on regression).

## Checklist

| # | When | Build | Done when |
|---|---|---|---|
| 1 | H0–2 | collect a Groq key **from every teammate** + 1 OpenRouter key into the shared `.env` (never commit it); `ollama pull qwen2.5:3b` on your machine; download HotpotQA + GSM8K into `data/raw/` | `data/raw/` has both; keys tested |
| 2 | H2–5 | `agents/tools/`: port `registry.py` (drop the approval gate), `search` (BM25 over the question's 10 paragraphs), `calculator`, `python_exec` (subprocess, 5 s timeout) | each tool has a test that **calls it through the registry** |
| 3 | H2–5 | **QA agent** (plan → search → read → search again or answer) and **Math agent** (plan → calculate → check → answer) as state machines using **only** `ctx.*`; 6–15 steps per run | a run records end to end; nothing called outside `ctx` |
| 4 | H3–5 | checkers: QA = word-overlap F1 ≥ 0.6 (SQuAD normalisation), Math = exact number | 20 known pairs each pass the unit test |
| 5 | H5–6 ✅M1 | `faults/`: F1–F6. Each is `make_change(run, step_idx) -> change`, only for the right step type | 10 sampled changes per type actually appear in the forked step |
| 6 | H6 | `data/farm.py`: for each task, a clean run; if it passes, 2–3 forks with a random F1–F6 at a random allowed step. Failed fork → `Label(root_cause_step=k, source="injected")`. Recovered fork → kept as a passing run with `fault` set. Write a shard. | **200 runs handed to Aditya by H6** |
| 7 | H6–10 | **Shop agent** + mock shop API (orders, stock, refunds kept in `ctx.state`) + ~200 generated tasks with the correct final state; F7–F10; `data/splits.py` (by task id, SYSTEM.md §3.3) | Shop runs record; every run has a split |
| 8 | H6–11 ✅M2 | farm running on **all machines** (yours, Advay's from H7, Aryan's when free) + Groq + OpenRouter overflow; send shards to the Drive folder | **≥ 3,000 runs, ≥ 1,500 with a known guilty step** |
| 9 | H9–12 | natural failures: run clean tasks on the weakest local model, keep failures (no label). Aryan's Verify labels them. | 300+ unlabelled natural failures |
| 10 | H11–14 | `eval/`: baselines (random, last step, first error), **LLM judge** (`judge-large`, Who&When paper's "all-at-once" + "step-by-step" prompts), Who&When importer, and every table in SYSTEM.md §7 → `data/reports/latest.json` + `latest.md` | `py -3 -m blackbox.eval.report` runs clean from scratch |
| 11 | H15–17 | bug bash, data slides | — |

## Data health check (post in team chat at H8, H11, H14)
For each mistake type, report:
- the number of runs;
- the % that turned a pass into a fail (aim for 30–90%; outside that range,
  tune the mistake's strength);
- the number of crashed runs.

A crash is **our bug**, not an agent failure. Record crashes, count them and
never use them as labels.

## Tips
- A fork only pays for the steps after k, so planted mistakes are cheap.
  Spread k evenly across positions, or the model just learns "blame the last
  steps".
- Ollama settings: `OLLAMA_NUM_PARALLEL=2 OLLAMA_FLASH_ATTENTION=1
  OLLAMA_KV_CACHE_TYPE=q8_0 OLLAMA_KEEP_ALIVE=30m`. Keep `num_ctx` the same on
  every call.
