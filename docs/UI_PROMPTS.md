# Prompts for building the dashboard with Claude Code

Paste these one at a time, in order. Each ends with a check: don't move on until it passes in the browser.
The design rules are in `docs/UI_BRIEF.md`; the API contract is in `docs/API_FOR_UI.md`.

---

### 0. Set up (once)
```
Read CLAUDE.md, docs/UI_BRIEF.md (the design rules: follow them exactly), docs/API_FOR_UI.md (the API
contract) and assignments/Advay.md. Then set up web/ from scratch on branch advay/dashboard:
Vite + React 19 + TypeScript + Tailwind 4, @xyflow/react, dagre, zustand, @tanstack/react-query,
react-router, lenis, motion, lucide-react, @fontsource/geist-sans, @fontsource/jetbrains-mono.
Put the tokens from UI_BRIEF.md §2 in src/styles/tokens.css and map them into Tailwind's theme.
Create src/lib/api.ts (typed fetch, VITE_API_URL default http://localhost:8000, fixtures only when
VITE_USE_FIXTURES=1, from fixtures/ui/), src/lib/stream.ts (useJobStream: EventSource on
/api/jobs/{id}/events, one listener per event type, closes on done/error), src/lib/smooth.ts (Lenis as
in the brief, reduced-motion aware). Build the app shell: the 232 px sidebar with the nav groups from §4,
the top bar with a ⌘K palette (jump to a run id or a screen), and machine status from /api/status at the
bottom of the sidebar. No screens yet. Show me the shell, then run npm run build.
```
Check: the shell renders, the sidebar status shows real numbers from the running backend, the build passes.

### 1. Signature components
```
Build the components in UI_BRIEF.md §5: RecMark, MonoLabel, StepChip, Verdict, StreamLog, KPI,
SavingsMeter, EmptyState, then RunGraph (React Flow + dagre, left to right, node and edge styles exactly as
specified; guilty node red, trail amber with animated trail edges, reused steps with a blue ring) and
StepDrawer (request / output / memory tabs, collapsible mono JSON, copy buttons). Add a /dev/components
page that shows every component with real data from fixtures/ui (run_graph.json, run_step_0.json,
investigate_model_finds_it.json). Motion per §3 only.
```
Check: /dev/components looks like the email (`docs/UI_BRIEF.md` top), with no gradients or glows.

### 2. Investigate + Run page (the core of the demo)
```
Build the Investigate screen and the Run page as specified in UI_BRIEF.md §6.1 and §6.2 against the live
backend. Investigate: case picker from GET /api/cases, one button, the
story streamed into StreamLog, then KPIs. Run page: RunGraph + right panel with diagnosis
(GET /api/runs/{id}/diagnosis), evidence sentences, and action buttons. Verify starts
POST /api/runs/{id}/verify and streams attempt / result / verdict events into a StreamLog inside the panel,
ending in a Verdict block (PROVED step N / NOT THE CAUSE / BAD LUCK) with the SavingsMeter. Clicking a
node opens StepDrawer. Wire empty and error states.
```
Check: open the model_finds_it case, press Investigate, then Verify the top suspect: the verdict lands live.

### 3. Live Lab
```
Build the Live Lab (UI_BRIEF.md §6.3): POST /api/lab {question, mistake, notify}, stream the 14 stages
into a vertical timeline (render by stage number n and append; stages can repeat), show the clean and
broken runs as two mini graphs when their stages arrive, end with the scorecard. "Notify my phone" toggle
sets notify. This is the audience moment: the timeline must feel alive (row-by-row reveal, the REC dot
pulsing while it streams) but never fake: only real events.
```
Check: a question runs end to end (3–5 min on the local 7B) and every stage appears as it happens.

### 4. Fleet fix, Causal report, Crash test, Seen before?
```
Build the four "Prove" screens from UI_BRIEF.md §6.4–6.7, each from the run page actions and as its own
screen with a run picker: fleet fix (POST /api/runs/{id}/fleet-fix, rows fill live from `run` events,
final Verdict APPROVE / BLOCK / NO EFFECT with failure rate before → after), causal report
(POST /api/runs/{id}/causal: the necessary / sufficient table, recovery-path chips, blast-radius bar),
crash test (POST /api/runs/{id}/crash-test on a passing run: stars, tiles per mistake, weak against),
seen before? (GET /api/runs/{id}/similar: fingerprint chips, share count, NOVEL badge, known fixes). Event
and result shapes: docs/API_FOR_UI.md; real results: fixtures/ui/*_job.json and similar.json.
```
Check: each screen renders its fixture correctly AND runs live once.

### 5. Incidents, Overview, Atlas, Dataset
```
Build Incidents (table + detail with the email's sections, notifications per channel, Approve / Keep
paused via POST /api/incidents/{id}/decision), Overview (GET /api/ui/overview: KPIs, recent failures,
job queue), Atlas (GET /api/atlas, horizontal bars) and Dataset (GET /api/dataset). Dense tables, mono
numbers, tabular figures, honest empty states.
```
Check: everything shows real data; nothing on screen is invented.

### 6. Polish pass (from 09:00: no new features)
```
Polish the demo path (Investigate → Run page → Verify → Lab → Fleet fix → Causal → Crash test →
Incidents): check every screen at 1440 px and 1280 px, keyboard focus states, loading skeletons that match
the final layout (no spinners on whole pages), reduced motion, error states with the API's detail
sentence. Remove anything that is not data or structure. Run npm run build and fix every warning.
```

---

**Rules for every prompt:** if an endpoint behaves differently from `API_FOR_UI.md`, stop and report it; don't
work around it in the UI. Commit after every screen (`web: <screen>`), open PRs into `dev`.
