# Aryan: Lead · Recording, Replay, Verify, Repair, Integration

**Machine:** RTX 4060 8 GB (runs `qwen2.5:7b` to generate runs when free)
**Folders you own:** `blackbox/core/`, `blackbox/recorder/`, `blackbox/replay/`, `blackbox/api/` (skeleton)
**Read first:** SYSTEM.md §4 (record/replay), §6.2–6.3 (verify, repair), §8 (API)

## Your USPs (SYSTEM.md §1A)
Must: U1 time-travel replay · U2 free re-watching (replay with no change = 0 model calls; add a test that counts them) · U3 Git-style storage (expose the `n save-points / MB / % de-duplicated` stat at `/api/health`) · U4 who-used-what map · U7 spot-the-difference · U13 verify · **U14 bad luck vs real bug** (verify reports its flip rate as 3/3 = real, 1/3 = flaky) · U15 smart re-run · U16 fixes tested first · U19 savings meter (with Advay) · U24 any provider.
Stretch, after M3: U17 one fix for many failures · **U18 cheaper-model advisor** (fork each LLM step with `agent-local`; list the steps where the outcome holds and the cost saved) · **U25 offline mode** (`models.offline.yaml`: Ollama agents + adapter checker on Ollama; demo with Wi-Fi off).

Beyond-PS (SYSTEM.md §1B): **X1 Autopilot, our headline**. On a checker alarm, roll back to the save-point before the flagged step and retry it with the strategy picked from `mistake_type` (re-search / `agent-strong` / re-ask with an argument check), then continue the run; record it as a fork with `patch.kind = "autopilot"`, measure % of failing runs rescued live and the extra tokens, build after Verify (H12–14). **X4 3-line wrapper**: `blackbox.wrap(openai_client)` in record-only mode (H9–10). Stretch: X9 privacy redaction before blobs are written.

## Checklist

| # | When | Build | Done when (check it yourself) |
|---|---|---|---|
| 1 | H0–2 | `core/schema.py` exactly as SYSTEM.md §4.1; repo skeleton; `models.yaml`; `.env.example`; `requirements.txt`; `.gitignore` | pushed; team chat told "schema v1 frozen" |
| 2 | H2–3 | `RunContext` that records `ctx.llm/tool/retrieve` into Steps; `ctx.state` logs reads/writes and fills `parents`; `Agent` base (state machine driver) | Radhesh can write an agent against it (hand-off #2) |
| 3 | H3–5 | `core/store.py`: SQLite `runs`/`steps`, save-point files named by fingerprint, `save_run`/`load_run`/`list_runs` | a run saved → loaded → identical |
| 4 | H4–6 | `recorder/providers.py`: one OpenAI-style client for Groq / OpenRouter / Ollama; `providers verify`; Groq key rotation on 429; token counts from the response, else `None` | `py -3 -m blackbox.recorder.providers verify` lists every model OK |
| 5 | H5–6 ✅M1 | `replay/engine.py`: `replay_from(run, k)`, `fork(run, k, change)` with change types `output / args / messages / model / state` | CLI demo: QA run → fork at its search step with a wrong paragraph → outcome changes |
| 6 | H6–7 | `fixtures/` (10 real runs incl. a run + its fork) + API skeleton (`/api/runs`, `/api/runs/{id}`, `/api/runs/{id}/steps/{idx}`) | Advay can start the moment he arrives |
| 7 | H7–9 | **Re-use of unaffected steps:** after step k, a step whose `input_hash` matches the original is re-used, not re-run. Fill `stats.n_rerun / n_reused / tokens_saved / seconds_saved`. | counts match the real number of provider calls (count them in a test) |
| 8 | H8–10 | Wire Aditya's `check_step` into the recorder **in a background thread** (never blocks the agent), saved to `step.monitor`; alarm event when off-track | a live run shows checker answers on each step; agent speed unchanged |
| 9 | H9–10 | `replay/diff.py`: line up two runs step by step (like `diff`), first difference, changed pairs, memory and outcome difference | fork vs parent shows the difference at step k |
| 10 | H10–11 ✅M2 | `data/shards.py merge`; `/api/runs/{id}/diagnosis` calling Aditya's `diagnose`; `/api/compare` | Advay's Run screen shows real suspects |
| 11 | H11–13 | **Verify** (§6.2): re-run each suspect fixed (passing-run step → stronger model), 3×; verified if it flips. Also label natural failures this way for Radhesh. | demo run shows "✅ step 5 verified, flipped 3/3"; 150+ natural failures labelled |
| 12 | H12–14 | **GenAI repair round 1** (§6.3): `judge-large` proposes 4 fixes → each tested by fork → results. Checker `mistake_type` with high confidence picks a direct strategy first. | at least one demo failure fixed by a proposed fix |
| 13 | H13–15 ✅M3 | Live streams: `/api/runs/{id}/events`, `/api/jobs/{id}/events`, plus `POST` for fork/verify/repair/report | Advay's Experiment screen streams live |
| 14 | H15–19 | bug bash, demo script (below), 2 rehearsals, backup screen recording, merge everyone's PRs | — |

## Not your job
The agents and mistakes (Radhesh), the ranker and report (Aditya), the
screens (Advay). Your job is to give them stable functions and review their
PRs fast.

## Demo script (≈4 min)
1. **Live run:** start a QA task on a small model. Steps appear one by one;
   at step 5 the checker light turns red and the alarm banner shows. The run
   then ends with a wrong answer.
2. **Run screen:** suspects are step 5 and step 7 (90% list). Show the
   evidence: "output contains `1912`, which appears in none of its inputs".
3. **Verify:** steps 0–4 are restored from the save-point, not re-run.
   Result: "✅ step 5 verified, flipped 3/3".
4. **Repair:** 4 GenAI fixes as cards; one passes, with "re-ran 4 of 12
   steps, 63% tokens saved".
5. **Report:** an incident report where every sentence links to a step.
6. **Eval:** our ranker vs the LLM judge on known mistakes, new mistake
   types, real failures and Who&When.
