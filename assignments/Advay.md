# Advay: Full-stack · Every Screen, Live Streaming, Demo Driver

## ▶ START HERE (4 Oct, 02:40): Pitch 1 is at 11:00, freeze the UI at 09:30
1. `git checkout dev && git pull`. The backend is done and stable; you only build `web/`.
2. **Contract:** `docs/API_FOR_UI.md` (screen → endpoint → fixture, stream event shapes). **Real responses:**
   `fixtures/ui/*.json`, so you can build every screen with no backend and no GPU. All endpoints with dropdown
   examples: `docs/openapi.json`, or `/docs` when the backend runs.
3. Backend on your machine (optional): `pip install -e ".[ui,agents]"`, then put the dataset from the GitHub
   release `data-2026-10-03` into `data/`, then `blackbox ui` → http://localhost:8000. Or point the UI at Aryan's
   machine on the LAN.
4. **Build in this order (the demo script):**
   1. **Investigate** (one click): story lines + numbers (`investigate_model_finds_it.json`)
   2. **Run graph**: guilty step red, contamination trail orange, suspects badges (`run_graph.json`)
   3. **Live Lab**: type a question, the 14 stages stream in (SSE, shapes in the doc)
   4. **One fix for many / firewall**: a row per re-run run, big APPROVE / BLOCK (`fleet_fix_job.json`)
   5. **Causal report**: necessary / sufficient table, recovery paths, blast radius (`causal_job.json`)
   6. **Seen this before?**: fingerprint chips, look-alikes, NOVEL badge (`similar.json`)
   7. **Guardian incidents**: list, detail, approve / reject (`incidents.json`, `incident_detail.json`)
   8. **Overview** home + **Atlas** + **Dataset**
5. The MCP server (X5) is **done** (`docs/MCP.md`); it is not on your list.

**Joins:** about H7. **Machine:** RTX 4050 6 GB.
**First 10 minutes:** start a run generator in the background (Radhesh gives you the one-line command), then build screens.
**Folders you own:** `web/`, plus any API routes the screens need beyond Aryan's skeleton (`/api/tasks`, `/api/eval/latest`, filters/paging)
**Read first:** SYSTEM.md §0–2 (what this is), §8 (API), §9 (screens)

## Code to port (already in this repo; you don't need the 26117 checkout)
`reference/from_26117/frontend/` contains:

| file | becomes |
|---|---|
| `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/index.css` | starting point for `web/` (drop packages you don't use) |
| `src/components/plan/PlanGraphView.jsx` + `PlanNode.jsx` | the **step graph** (xyflow + dagre layout) |
| `src/components/stream/useAgentStream.js`, `ExecutionEventCard.jsx`, `AgentStreamView.jsx` | **live step stream** for Live run / Experiment |
| `src/components/common/CopyButton.jsx`, `ErrorBoundary.jsx`, `src/components/ui/*` | as is |
| `src/lib/api.js`, `queryClient.js`, `motion.js`, `src/store/toastStore.js` | the pattern of **one** backend client file |
| `docs/Technical_Specs/AGENT_STREAM_PROTOCOL.md` | how the old stream events looked (ours: SYSTEM.md §8) |

## Your USPs (SYSTEM.md §1A)
You make every USP **visible**. Keep a USP checklist (U1–U26) on the team board and tick each one only after it works in the browser. Specifically yours: U19 savings meter (running total on Experiment), U8 contamination trail highlighting on the graph, U14 "flipped 3/3" vs "flaky" badge, U3 storage stat in the header, U10 "90%" label on the suspect list.
Stretch: "Export as test" button (U23), Atlas screen (U22), cheaper-model advisor panel (U18).

Beyond-PS (SYSTEM.md §1B): **X1 autopilot** shown live (the alarm → "rewinding to step 4" → retry → run continues ✅) · **X5 MCP server** (FastMCP over our API: `list_failures`, `diagnose`, `verify`, `compare`, `report`; demo by asking Claude Code "why did run X fail?"), H15–17 · **X10 minutes-to-milliseconds** timing study screen/notes at H15.

## Checklist (in priority order)

| # | When | Screen | Done when |
|---|---|---|---|
| 1 | H7–9 | set up `web/` from the ported stack; **Runs** list (filters: task type, pass/fail, mistake type, test set) | lists runs from Aryan's API skeleton, not from JSON imports |
| 2 | H8–11 ✅M2 | **Run**: step graph (boxes = steps, arrows = "used output of", coloured by suspicion, suspects outlined); step panel with tabs Request / Output / Memory change / Checker answers; **evidence panel** | works on the live API with real diagnosis |
| 3 | H11–13 | **Live run**: pick a task + model → run → steps stream in → checker light per step (green/amber/red) → **alarm banner** on red | a real run streams live with the alarm |
| 4 | H12–14 | **Experiment**: Verify and Repair as live cards (what changed, steps re-run vs re-used (shown greyed), pass/fail) → verdict badge "✅ step 5 verified (3/3)" → fix cards | real verify job streams |
| 5 | H13–14 | **Compare**: two runs side by side, first difference marked, memory and outcome difference; "compare with original" button on every fork | — |
| 6 | H14–15 ✅M3 | **Report**: render the incident report; `[step N]` jumps to the step; shows "N sentences removed by citation check" | — |
| 7 | H14–15 | **Eval**: tables from `/api/eval/latest`; when there is no report, show "No evaluation yet", **never sample numbers** | — |
| 8 | H15–17 | polish, loading/empty/error states, keyboard flow for the demo | freeze at H17 |
| 9 | H17–19 | drive the demo while Aryan talks (SYSTEM.md / Aryan.md demo script) | 2 clean rehearsals |

## Rules
- **No fake data on screen, ever:** no placeholder runs, scores or numbers,
  and no fixture fallback when the API is down. Show an honest error instead.
- Save-points can be large, so load `/steps/{idx}` only when the user clicks
  a step.
- Runs with more than ~60 steps (Who&When): show a simple timeline instead of
  the graph.
- A screen is "done" when it works in the browser against the real API on
  the demo laptop.
