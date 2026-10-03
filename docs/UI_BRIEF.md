# Black Box dashboard: design brief

The UI must read as serious instrument software: a flight recorder, not an "AI app". Think Linear's restraint,
Vercel's typography, Raycast's density, and an aircraft's black box readout. Every pixel is data or structure.

The Guardian incident email already uses this language (`blackbox/guardian/render.py`, preview:
`py -3 -c "from blackbox.guardian.setup import test_incident; from blackbox.guardian import render; open('email.html','w',encoding='utf-8').write(render.html_email(test_incident()))"`).
The dashboard and the email must look like the same product.

---

## 1. Rules (read twice)

**Never**
- Purple/blue "AI" gradients, aurora blobs, glassmorphism, neon glows, sparkle icons, "✨ AI-powered" copy.
- Emoji in headings or buttons. Stock illustrations. 3D blobs. Animated gradients behind text.
- Lorem ipsum, placeholder numbers, fake charts, "coming soon" cards. If the API has no data: an honest empty state.
- More than one accent colour on a screen (severity colours are data, not decoration).
- Centred hero text on app screens. Cards inside cards inside cards.
- Animations longer than 400 ms in the app, bouncing, spinning loaders on everything, parallax for its own sake.

**Always**
- Real data from the API on every screen (fixtures only with `VITE_USE_FIXTURES=1`, labelled "FIXTURE DATA").
- Monospace for anything machine-made: run ids, step numbers, model names, numbers in tables, timestamps.
- Numbers right-aligned and tabular (`font-variant-numeric: tabular-nums`).
- One clear primary action per screen. Keyboard shortcuts for the main ones.
- Copy written for a person: "Step 4 caused the failure. Repairing only this step makes the run pass." Never "AI detected an anomaly".

## 2. Tokens

```css
:root {
  /* surfaces (darkest → raised) */
  --bg: #05070b;  --panel: #0b0f17;  --raised: #111827;  --line: #1f2937;  --line-strong: #374151;
  /* text */
  --text: #e5e7eb;  --text-strong: #ffffff;  --muted: #9ca3af;  --faint: #6b7280;  --ghost: #4b5563;
  /* the one accent */
  --accent: #f97316;
  /* data colours (only for meaning) */
  --guilty: #ef4444;  --guilty-bg: #2a0f12;   /* root cause, regressions, BLOCK, critical */
  --trail: #f59e0b;   --trail-bg: #2a1f05;    /* contamination trail, paused, warnings */
  --ok: #22c55e;      --ok-bg: #0b2416;       /* pass, fixed, APPROVE, robust */
  --info: #38bdf8;                            /* reused / replayed steps, links */
  --rec: #ef4444;                             /* the REC dot only */
  --radius: 10px; --radius-sm: 6px;
}
```
- Fonts: **Geist** (UI) and **JetBrains Mono** (data), from `@fontsource/geist-sans` and `@fontsource/jetbrains-mono`.
  Sizes: 12 / 13 / 14 / 16 / 20 / 28 / 40. Labels: mono 11px, uppercase, letter-spacing .14em, `--faint`.
- Spacing: 4-pt grid (4, 8, 12, 16, 24, 32, 48). Panels: 1px `--line` border, no shadows except a 1px inner top
  highlight `inset 0 1px 0 rgba(255,255,255,.03)`.
- Icons: `lucide-react`, 16px, stroke 1.75, `--muted`. No filled icons.

## 3. Motion

- **Lenis** (`lenis` package) for smooth scrolling on long pages (Investigate story, Lab, reports):
  ```ts
  // src/lib/smooth.ts
  import Lenis from "lenis";
  export function startSmoothScroll() {
    const lenis = new Lenis({ duration: 1.05, easing: (t) => 1 - Math.pow(1 - t, 3), smoothWheel: true });
    const raf = (time: number) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    return lenis;
  }
  ```
  Call it once in `main.tsx`. Scroll containers that must scroll natively (React Flow canvas, step drawer code
  blocks, tables) get `data-lenis-prevent`.
- **motion** (`motion/react`, the Framer Motion successor) for UI transitions. One easing everywhere:
  `[0.22, 1, 0.36, 1]`. Durations: 120 ms (hover/press), 220 ms (panels, drawers), 360 ms (screen enter).
- Streams (Lab stages, fleet rows, crash tests, verify attempts) appear row by row: fade + 6 px rise, 40 ms stagger.
  This is the product's signature: things *happen* on screen as the backend works. Never fake progress; render
  events as they arrive from SSE.
- Numbers that change count up once (300 ms, tabular). Verdicts (APPROVE / BLOCK / PROVED) land with a single
  220 ms scale from 0.96 → 1 and the colour fill. No confetti.
- Respect `prefers-reduced-motion`: disable Lenis smoothing and use opacity-only transitions.

## 4. Layout

- Left sidebar (232 px): ● REC wordmark, then nav groups: **Investigate** (Overview, Runs, Investigate, Live Lab) ·
  **Prove** (Causal report, Fleet fix, Crash test, Seen before?) · **Operate** (Incidents, Atlas, Dataset).
  Bottom: machine status (from `/api/status`: queue, GPU, data totals) in mono 11px.
- Top bar: page title (20px, semibold), breadcrumb run id in mono, primary action on the right, `⌘K` command palette
  (jump to run id, screen, case).
- Content max width 1280 px, 24 px gutters. Dense tables (36 px rows), not cards, for lists.
- Run page = the centre of the product: graph (left 60%) + panel (right 40%: diagnosis, evidence, actions).

## 5. Signature components (build these first, reuse everywhere)

| Component | What it is |
|---|---|
| `RecMark` | the ● REC dot (pulses 1.6 s only while a job streams) + "BLACK BOX" mono wordmark |
| `MonoLabel` | uppercase mono 11px label with optional index ("01 · ROOT CAUSE") |
| `StepChip` | `STEP 4` mono chip; variants guilty (red), trail (amber), suspect rank 1–3, reused (blue ring) |
| `Verdict` | big verdict block: PROVED / NOT THE CAUSE / APPROVE / BLOCK / NO EFFECT / ★★★★☆ |
| `StreamLog` | renders SSE events as rows with timestamp (mono, `+12.4s`), icon, text; auto-scroll unless the user scrolled up |
| `RunGraph` | React Flow + dagre (left→right). Nodes: 220×64, kind icon, name, 1-line preview, step chip. Edges: data-flow solid, order dashed `--ghost`. Guilty node red border + red bg tint; trail nodes amber border; trail edges amber and animated (dash offset) |
| `StepDrawer` | right drawer: request / output / memory-after tabs, JSON in mono with collapsible keys, copy buttons |
| `KPI` | label + big tabular number + 1-line context ("of 5,672 runs") |
| `SavingsMeter` | "re-ran 1 of 9 steps · 0 model calls · 1,526 tokens saved" in mono, blue |
| `EmptyState` | honest: what is missing and the exact command or endpoint that fills it |

## 6. Screens (in demo order)

1. **Investigate**: case picker (showcase cases) → one button "Investigate" → `StreamLog` of the numbered story,
   then a summary row of `KPI`s (guilty step, proved, re-used steps, seconds). Link: "Open run".
2. **Run page**: `RunGraph` + panel: diagnosis (top suspects with probability bars, evidence sentences), known
   guilty step, actions: Verify · Causal report · Fleet fix · Seen before? · Export test · Report (Markdown).
3. **Live Lab**: one large input ("Ask the agent anything"), mistake picker (auto, F1–F10 with names), a
   "Notify my phone" toggle (`notify: true`), then 14 stages as a vertical timeline that fills in live; the clean run
   and the broken run render as two mini graphs side by side when stages 4 and 7 arrive; scorecard at the end.
4. **Fleet fix / firewall**: the rule (editable text area, or "Let Black Box write the rule"), N fail / N pass
   steppers, then a table that fills row by row (run, before → after, verdict chip), and the verdict block:
   APPROVE (green) / BLOCK (red) / NO EFFECT (grey) with "failure rate 67% → 33%".
5. **Causal report**: table per suspect: step, necessary ✓/✗, sufficient ✓/✗/—, verdict; recovery paths as a list of
   chips ("step 2 · stronger model → pass"); blast radius as a bar of later steps with contaminated ones filled,
   money-moving steps in red.
6. **Crash test**: stars, score, then one tile per planted mistake (F-code, name, step, verdict colour), "weak against".
7. **Seen before?**: fingerprint tokens as mono chips, "14 of 858 failures share this fingerprint (all F3)", NOVEL
   badge when novel, known fixes with "fixed 1/3" and the rule text.
8. **Incidents**: dense table (severity dot, title, status, time); detail = the email's content in the app (what /
   why / fix / flight data) + notifications per channel (email ✓, WhatsApp ✓, Slack ✓) + Approve / Keep paused.
9. **Overview**: KPIs (runs, labelled failures, proved causes, incidents open), recent failures table, job queue.
10. **Atlas** (failure patterns, horizontal bars) and **Dataset** (totals, families, mistakes, model report card).

## 7. Data

- One client `src/lib/api.ts` (typed fetch wrappers, `VITE_API_URL`, default `http://localhost:8000`), one hook per
  endpoint with TanStack Query, `useJobStream(jobId)` for SSE (`EventSource` on `/api/jobs/{id}/events`, one
  listener per event type, closes on `done` / `error`).
- Shapes and every event type: `docs/API_FOR_UI.md`. Real examples: `fixtures/ui/*.json`.
- Errors: show the API's `detail` sentence in a small `--guilty` bordered panel with a retry button.

## 8. Done means
A screen is done when it works against the live backend in the browser, has its empty and error states, passes
`npm run build`, and looks right at 1440 px and at 1280 px. Screens 1–6 are the demo path; polish them before 7–10.
