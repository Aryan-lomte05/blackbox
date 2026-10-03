# API for the UI: build the dashboard without touching the backend

For Advay (and anyone building the web app). Everything below is live and tested: 58/58 `/docs` use
cases pass end to end (`scripts/e2e_docs.py`). Real responses for every screen are in `fixtures/ui/`,
generated from our recorded data by `scripts/export_ui_fixtures.py`, so screens can be built without
a GPU or running agents.

## Run the backend

```bash
pip install -e ".[ui,ml,agents]"
# data: unzip blackbox-3k_2026-10-03.zip from the GitHub release into data/dataset, then
py -3 -c "from blackbox.data.dataset import load_into_store; from blackbox.core.store import Store; print(load_into_store('data/dataset/blackbox-3k', Store()))"
blackbox ui                       # http://127.0.0.1:8000  (/docs = interactive API, / = interim inspector)
```

CORS allows `http://localhost:5173` (Vite) and `http://localhost:3000` (Next/CRA); set `BLACKBOX_CORS` for others.

**Types:** `npx openapi-typescript http://127.0.0.1:8000/openapi.json -o src/api/schema.d.ts`
(or from the committed `docs/openapi.json`).

## Screens → endpoints

| Screen | Endpoint(s) | Fixture |
|---|---|---|
| **Home / overview**: KPIs, model headline, recent runs, recent failures, incidents, job queue | `GET /api/ui/overview` | `overview.json` |
| **Machine & jobs** (live): queue, running jobs, GPU, logs | `GET /api/status` (poll every 5–10 s) | `status.json` |
| **Dataset**: totals, families, test sets, label sources, planted-mistake health, model report card | `GET /api/dataset` | `dataset.json` |
| **Runs table**: filters (outcome, family, test set, planted mistake, labelled) + paging | `GET /api/runs?outcome=&family=&split=&fault=&labelled=&limit=&offset=` | `runs_failed_labelled.json` |
| **Run graph** (React Flow): nodes with positions, kinds, previews, suspect rank, guilty / planted flags, checker answers; data-flow + order edges | `GET /api/runs/{id}/graph` | `run_graph.json` |
| **Step drawer**: full request / output / memory after the step | `GET /api/runs/{id}/steps/{idx}` | `run_step_0.json` |
| **Diagnosis panel**: top suspects, scores, known guilty step, hit or miss | `GET /api/runs/{id}/diagnosis` | `diagnosis.json` |
| **Investigate** ("one click does everything"): story lines + every number | `POST /api/investigate/{case}` or `?run_id=` (12–20 s) | `investigate_model_finds_it.json` |
| **Live Lab**: type a question, watch 14 stages stream | `POST /api/lab` → `GET /api/jobs/{job_id}/events` (SSE) | event shapes below |
| **Experiments**: verify / repair / advise / replay / fork | `POST /api/runs/{id}/verify\|repair\|advise\|replay\|fork` → job SSE | see `/docs` examples |
| **Compare**: two runs aligned step by step | `GET /api/compare?a=&b=` | `compare.json` |
| **Failure atlas**: top failure patterns | `GET /api/atlas` | `atlas.json` |
| **Incidents (Guardian)**: list, detail, approve / reject paused retry | `GET /api/incidents`, `GET /api/incidents/{id}`, `POST /api/incidents/{id}/decision` | `incidents.json`, `incident_detail.json` |
| **Case file / export**: Markdown report, pytest regression file | `GET /api/runs/{id}/report`, `GET /api/runs/{id}/export-test` (text) | `report.md` |
| **Live run**: start a task and stream its steps | `POST /api/runs` → `GET /api/runs/{run_id}/events` (SSE) | — |
| **Import traces**: drop an OpenTelemetry / Langfuse JSON file → imported runs with suspects | `POST /api/import/otel\|langfuse?failed=` (body: the file's JSON) | samples in `examples/traces/` |
| **Seen this before?** fingerprint chips, look-alike failures, NOVEL badge, known fixes | `GET /api/runs/{id}/similar?k=5` (instant) | `similar.json` |
| **Causal report**: per suspect necessary ✓/✗, sufficient ✓/✗, verdict; joint causes; recovery-path tree; blast radius (money steps in red) | `POST /api/runs/{id}/causal?suspects=` → job SSE (10–60 s) | `causal_job.json` |
| **One fix for many / firewall**: the rule, a live row per re-run run (fixed / still failing / regression / held), big APPROVE / BLOCK / NO EFFECT verdict, failure rate before → after | `POST /api/runs/{id}/fleet-fix` {rule?, model?, n_fail, n_pass} → job SSE (~40 s per run) | `fleet_fix_job.json` |
| **Crash test (red team)**: star rating, one tile per planted mistake (robust / failed safely / failed silently / unsafe), "weak against" list | `POST /api/runs/{id}/crash-test?per_fault=1` (passing run) → job SSE (~5 s per mistake) | `crash_test_job.json` |
| **Time machine A/B**: same screen, history of a family under a new rule or model | `POST /api/time-machine` {family, rule?, model?, n_fail, n_pass} → job SSE | same shape as fleet |

## Streams (Server-Sent Events)

Use `new EventSource(url)` and listen per event type. A late subscriber gets the full history first,
then live events; the stream ends after `done` or `error`. Every event has `seq` and `t` (unix seconds).

| Job | Event types and fields |
|---|---|
| Live run | `start` {run_id, agent, model_id} · `step` {run_id, step} · `done` {result: {run_id, status, outcome, autopilot_rescue}} |
| Verify | `attempt` {step, strategy, attempt} · `result` {step, strategy, passed, run_id, savings} · `verdict` {step, cause_step, verdict, causal_effect, flaky} · `done` {result} |
| Repair | `proposing` {round} · `rejected` {reason} · `candidate` {change, passed, run_id, savings, answer} · `done` |
| Advise | `advice` {step, from_model, to_model, still_passes, savings} · `done` |
| **Lab** | `stage` {n: 1..14, title, detail, data, t} · `step` {phase: "clean", step: {idx, kind, name, node, used, output}} · `done` {result: scorecard} |
| Causal | Verify's events, then `sufficiency` {step, sufficient (true/false/null), note, run} · `joint_search` {suspects} · `pair` {steps, passed, run} · `done` {summary}; result: {cause, steps[{step, necessary, sufficient, verdict}], joint, recovery_paths[{step, how, run}], blast_radius{contaminated, reaches_answer, money_moving_steps, severity}, summary} |
| Crash test | `plan` {tests[{fault, step}]} · `test` {n, of, fault, step, verdict, run_id} · `done` {counts, score, stars, weak_against}; result: {stars 1-5, score, counts, weak_against, new_labelled_failures, rows[{fault, fault_name, step, verdict, run_id, answer}]} |
| Fleet / time machine | `proposing` · `rule` {rule} · `fleet` {runs} · `run` {n, of, run_id, verdict, new_run} · `done` {counts, decision, why}; result: {decision: APPROVE\|BLOCK\|NO EFFECT, why, counts, fix_rate, failure_rate_before, failure_rate_after, rows[{run_id, family, before, after, verdict, new_run, answer, savings}]} |

Lab stage numbers are fixed (1 understand, 2 knowledge, 3 run live, 4 clean answer, 5 choose a mistake,
6 plant it, 7 broken answer, 8 live checker, 9 diagnose, 10 verify, 11 repair, 12 compare, 13 incident,
14 scorecard). A stage can repeat (e.g. 5–7 when the agent recovers and another mistake is tried), so
render by `n` and append.

## Shapes worth knowing

- **Run card** (lists, overview): `run_id, family, family_label, task_id, agent, model, outcome
  ("pass" | "fail" | "crashed" | "rewound" | "no verdict"), planted, guilty_step, label_source, steps,
  split, created_at, parent_run_id`.
- **Graph node `data`**: `idx, kind (llm | tool | retrieval | final | state), name, node, label, preview,
  error, reused, latency_ms, tokens, suspect_rank (1..3 | null), suspect_p, is_guilty, is_planted,
  checker {on_track, consistent, alarm, tier} | null`. Positions: x = data-flow depth × 300, y = lane × 130.
  Use dagre or ELK if you want a different layout; the edges carry `type` = `dataflow` | `order`.
- **Savings** (fork / verify / lab): `steps_total, steps_executed, steps_reused, tokens_saved, seconds_saved`.
- **Errors**: HTTP 4xx/5xx with `{"detail": "plain sentence"}`. Show the sentence; it is written for people.

## Design notes (from the product, not taste)

- Honesty is the brand: never show a placeholder number. If an endpoint returns nothing, show an empty
  state that says what will appear and how to get it (e.g. "No incidents yet: incidents appear when a
  watched run fails").
- Colour the five step kinds consistently everywhere (graph, tables, Lab).
- Suspect rank 1 / 2 / 3, the known guilty step and "planted" are different things; show all three.
- Money-moving incidents (`needs_approval: true`) get the approve / keep-paused control prominently.
- The Lab is the showpiece: animate stages 1–14 as a pipeline, stream the agent's steps under stage 3,
  and end on the scorecard.
