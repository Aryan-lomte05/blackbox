# SYSTEM.md — Black Box: A Flight Recorder for AI Agents

What we are building, in plain words, and what each part takes in and gives
out. How to work in this repo is in `CLAUDE.md`. Who builds what is in
`ASSIGNMENTS.md`. Code borrowed from our earlier project is in
`reference/from_26117/`.

---

## 0. The idea in one minute

An AI agent solves a task in many steps: it calls a model, calls tools, looks
things up and updates its memory. Sometimes one wrong step in the middle ruins
the whole run. Today's tracing tools (LangSmith, Langfuse) only **show** you
the steps. You still have to read hundreds of them to find the bad one.

**Black Box finds the bad step, proves it, and fixes it, the way an
air-crash investigation works:**

| Air-crash investigation              | Black Box                                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Flight recorder captures everything  | **Record** every step + a save-point after each one                                                              |
| Live cockpit warnings                | **Step checker** (fast typed checks per step, on Jev or an LLM) warns *during* the run that a step looks wrong |
| Investigators list suspects          | **Diagnose**: a model we train ranks the steps and gives a short suspect list                                    |
| Re-fly the flight in a simulator     | **Replay** from any save-point; **fork** with a change                                                     |
| Prove the cause                      | **Verify**: fix only the suspect step, re-run, and check whether the outcome flips                               |
| Accident report                      | **GenAI incident report**: every sentence points to a recorded step                                              |
| Safety recommendations for the fleet | **Fix** found by GenAI, then tested on *similar* failures                                                      |

### Where Jev fits, and where it doesn't

Jev (TypeSafe AI) takes text **state** plus **typed questions** (yes/no,
pick-one, rate-on-a-scale) and returns **probabilities with a confidence
score**, quickly and cheaply according to the vendor. It cannot write text.
So it fits exactly one job here:

| Job                                                                                         | Jev?            | Why                                                                                                                          |
| ------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Checking every step with fixed questions ("consistent with inputs?", "which mistake type?") | **Yes**   | Many small typed questions per step across thousands of steps, live during a run. A big LLM is too slow and costly for this. |
| Picking a repair strategy from the mistake type                                             | **Yes**   | One pick-one question; its confidence decides whether to escalate to an LLM                                                  |
| Running the agents                                                                          | No              | Agents need text and tool calls → Groq / OpenRouter / Ollama                                                                |
| Proposing fixes, writing the report                                                         | No              | Needs text → LLM                                                                                                            |
| Labels / deciding pass-fail                                                                 | **Never** | Labels come from code checkers and replay experiments only                                                                   |
| The diagnosis itself                                                                        | No              | Our**trained** ranker decides. Jev answers are just some of its inputs, and §7 shows how much they add.               |

**The checker runs as a cascade, and Jev is optional.** The same typed
questions run on **Laya** first (`convaiinnovations/laya`: open-source,
Apache-2.0, ~420M params, ~2–3 GB VRAM, ~30 ms per question on GPU, the same
Choice/Score/Noul API, local and free). When Laya's confidence is low, they
escalate to **Jev** (if we have a key), and then to an **LLM** through
`system-one-adapter`. Black Box works with Laya alone. §7 measures every tier
instead of trusting vendor claims. Laya's calibration and position-bias notes
are in its README; pass `option_order` to reduce position bias.

---

## 0A. Product shape: an installable package for existing agents (the final deliverable)

Black Box is **not a standalone app. It is a subsystem you add to an
existing agent project.** By the pitch (tomorrow, 4 pm) it must be:

```bash
pip install agent-blackbox[all]        # name TBC; import name: blackbox
```

and work on a project we did not write. There are three ways in, from least
to most effort for the user:

| Mode | What the user adds | What they get |
|---|---|---|
| **1. Wrap** (any existing agent) | `client = blackbox.wrap(OpenAI(...))` + `with blackbox.session("task-42"):` | every model call recorded, checked live, diagnosed, reported; replay of the recorded run |
| **2. Decorate** (existing Python agent) | `@blackbox.tool` on tool functions, `blackbox.run(agent_fn, input)` | + fork/what-if: the agent function is re-run with recorded answers served (0 calls) up to the changed step |
| **3. Native** (new agents) | write the agent against `RunContext` (our 3 test agents do) | + memory tracking, who-used-what map, every USP |

What ships in the package:
- the `blackbox` Python library (recorder, replay, checker cascade, diagnosis, verify, repair, report);
- the CLI: `blackbox ui` (the web app, pre-built and served by the package), `blackbox runs`, `blackbox diagnose <run>`, `blackbox test` (CI), `blackbox mcp` (IDE integration);
- the pre-trained ranker + step-checker weights (or a download command).

**Proof for the judges:** take an existing open-source agent we did not
write, `pip install`, add 3 lines, and show Black Box diagnosing and fixing
its failures. Our QA/Math/Shop agents exist to generate training data and
to demo the native mode.

---

## 1. The pipeline

```
 ① RECORD ───► ② MONITOR (live) ───► ③ DIAGNOSE ───► ④ VERIFY ───► ⑤ REPAIR ───► ⑥ REPORT
 every step    step checker asks     trained ranker   re-run with    GenAI         GenAI incident
 + save-point  each step typed       using checker    only the       proposes      report, every
 + who-used-   → early warning,      answers + step   suspect step   fixes, each   sentence cites
 what links    auto save-point       facts → short    fixed → does   tested by     a step; atlas
               on alarm              suspect list     outcome flip?  cheap replay  of failure types
```

**What makes it stand out** (each item has a demo moment):

1. **Live early warning.** The step checker flags the bad step *while the
   agent is still running*, before the wrong final answer appears.
2. **A trained diagnosis model, not just an LLM's guess.** It learns from
   thousands of recorded runs and is compared against an LLM judge on the
   same failures.
3. **Proof, not probability.** The suspect is re-run with a fix. If the
   outcome flips, the cause is **verified** ✅.
4. **Cheap what-ifs.** A fork re-runs only the steps the change affects, and
   the screen shows "re-ran 4 of 12 steps, saved 63% tokens".
5. **GenAI that cannot make things up.** Fix proposals are tested by replay
   before anyone sees them. Report sentences without a valid step citation
   are deleted automatically.

The full list of what is ours is in §1A.

---

## 1A. Our technical USPs (pitch-ready)

Each USP has a **one-line pitch a non-technical judge understands**, what is
actually under the hood, the demo moment that proves it, an owner, and
whether it is a must-have or a stretch. **Pitch only what is built and
measured.** If a stretch item is not done by H17, it leaves the slides.

### A. Recording: "the flight recorder"

| # | USP | Say it like this | Under the hood | Demo moment | Owner | Tier |
|---|---|---|---|---|---|---|
| U1 | **Time-travel debugging** | "Rewind an AI agent like a video and press play from any moment." | A full save-point of the agent's memory after every step; agents are written as resumable state machines | Click step 5, then "Replay from here" | Aryan | must |
| U2 | **Free re-watching** | "Watching a recording again costs nothing; you don't pay for the flight twice." | A replay with no change is served entirely from recorded outputs: 0 model calls, 0 tokens | Replay a 12-step run: "0 tokens, 0.1 s" | Aryan | must |
| U3 | **Git-style storage** | "Thousands of save-points, but we only store what changed, like Git." | Content-addressed blobs; identical memory states are stored once | Storage stat: "N save-points, X MB, Y% de-duplicated" | Aryan | must |
| U4 | **Automatic 'who-used-what' map** | "We automatically draw which step's output fed which later step; nobody has to label it." | The `ctx.state` proxy logs reads/writes, so the data-flow graph is built for free | The arrows in the step graph | Aryan | must |

### B. Detection: "the cockpit warnings"

| # | USP | Say it like this | Under the hood | Demo moment | Owner | Tier |
|---|---|---|---|---|---|---|
| U5 | **Check-engine light for AI agents** | "We warn you while the agent is still running, before it gives a wrong answer." | A background step checker (Jev or LLM adapter) answers typed questions per step; alarm on low "on track" with high confidence; we measure **warning lead time** | The live run turns red at step 5; the wrong answer arrives at step 11 | Aditya + Aryan | must |
| U6 | **"Numbers from nowhere" detector** | "If the agent states a fact that appears in none of its sources, we catch it." | Numbers and names in a step's output are checked against all its data-flow ancestors | Evidence: "`1912` appears in none of its 3 inputs" | Aditya | must |
| U7 | **Spot-the-difference with a good run** | "We put the failed step next to the same step from a run that worked." | Step-by-step alignment (like `diff`) with a passing run of the same task | Side-by-side in the evidence panel | Aryan | must |
| U8 | **Contamination trail** ("blast radius") | "Like contact tracing: we show every later step the bad data infected." | A forward walk over the data-flow graph from the suspect to the final answer | Click a suspect, and the infected steps light up | Aditya | must |

### C. Diagnosis: "the investigators"

| # | USP | Say it like this | Under the hood | Demo moment | Owner | Tier |
|---|---|---|---|---|---|---|
| U9 | **Learns from thousands of runs, not one prompt** | "It has studied thousands of failures, so it doesn't guess like a chatbot does." | A LightGBM ranker over step facts plus checker answers, trained on planted-mistake runs | Eval: our ranker vs LLM judge | Aditya | must |
| U10 | **Honest suspect list** | "When we say 90% sure, we're right 90% of the time, and we show the proof." | Split conformal prediction, calibrated on a held-out set; coverage reported per test set | "Suspects: 5, 7 (90%)" and the coverage table | Aditya | must |
| U11 | **Works on mistakes it has never seen** | "We tested it on kinds of mistakes we deliberately never showed it." | Train on F1–F6, test on F7–F10, a new task type, real failures and other people's agents (Who&When) | The eval table's "new mistakes" rows | Aditya + Radhesh | must |
| U12 | **Explains in plain English** | "Every suspicion comes with reasons a human can read." | SHAP reasons turned into template sentences | Evidence panel | Aditya | must |

### D. Proof and repair: "the simulator"

| # | USP | Say it like this | Under the hood | Demo moment | Owner | Tier |
|---|---|---|---|---|---|---|
| U13 | **We prove it, we don't just accuse** | "We re-fly the flight with only that step fixed. If it lands safely, that was the cause." | A counterfactual fork at the suspect; the outcome flips → verified | "✅ step 5 verified" | Aryan | must |
| U14 | **Bad luck or real bug?** | "We re-run it three times to tell a fluke from a real problem." | Verify repeats each experiment 3× and reports the flip rate (3/3 = real, 1/3 = flaky) | "flipped 3/3" vs "flaky 1/3" badge | Aryan | must |
| U15 | **Spreadsheet-style smart re-run** | "Like Excel recalculating only the cells you changed, we re-run only the steps a fix affects." | A step is re-used when its fingerprint (request + values it read) is unchanged | "re-ran 4 of 12 steps · saved 63% tokens · 9 s" | Aryan | must |
| U16 | **Fixes tested before you see them** | "The AI suggests fixes, and we try each one before showing it." | GenAI proposes 4 patches, each runs as a cached fork, and the results come with the cards | Fix cards with ✅ / ❌ | Aryan | must |
| U17 | **One fix, many failures ("vaccine")** | "A fix found for one failure is tested on all similar failures." | Apply the winning prompt fix to the other runs in the same failure group | "fixes 31 of 40 similar failures" | Aryan | stretch |
| U18 | **Cheaper-model advisor** | "We tell you which steps could use a cheaper model without breaking anything." | Fork each LLM step with a smaller model; if the outcome holds, that step is safe to downgrade | "Steps 2, 4, 9 work on the 3B model → −40% cost" | Aryan | stretch |
| U19 | **Savings meter** | "Every experiment shows how much time and money it saved." | Counts from real provider calls vs a full re-run | Running total on the Experiment screen | Aryan + Advay | must |

### E. Learning and reporting: "the safety board"

| # | USP | Say it like this | Under the hood | Demo moment | Owner | Tier |
|---|---|---|---|---|---|---|
| U20 | **Crash-test dummies for AI** | "We crash agents on purpose, in 10 different ways, to teach the system what failure looks like." | Fault injection by forking a passing run (chaos engineering), labelled automatically | The data slide: "3,000 runs, 10 mistake types" | Radhesh | must |
| U21 | **Accident report with receipts** | "Every sentence in the report links to the exact step that proves it." | The GenAI report plus a citation checker that deletes uncited sentences | Click `[step 5]` in the report | Aditya | must |
| U22 | **Top-5 ways your agent fails** | "We group thousands of failures into a short list of patterns." | Group verified causes by mistake type and step type; an LLM names each group | Atlas screen | Aditya | stretch |
| U23 | **Every crash becomes a test** | "One click turns a failure into a saved test, so it never comes back unnoticed." | Export the save-point before the cause, plus the expected outcome, as a replayable pytest case | "Export as test" button → file | Radhesh | stretch |

### F. Practical: "fits any cockpit"

| # | USP | Say it like this | Under the hood | Demo moment | Owner | Tier |
|---|---|---|---|---|---|---|
| U24 | **Any model, any provider** | "Works with cloud AI or a model on your own laptop; switch with one line." | One OpenAI-style client for Groq / OpenRouter / Ollama; models named only in `models.yaml` | Same task run on Groq and on local Ollama | Aryan | must |
| U25 | **Runs fully offline if needed** | "Your agent's data can stay on your own machine." | Ollama for the agents, LLM-adapter checker on Ollama, SQLite storage: no cloud required | Wi-Fi off, the live run still works | Aryan | stretch |
| U26 | **Plug-in step checks** | "The warning checks are swappable: fast specialist model or general AI." | Same typed questions on Jev or on any LLM via `system-one-adapter`; we measure both | Jev vs LLM table (speed, cost, accuracy) | Aditya | must (table only if a Jev key arrives) |

---

## 1B. Beyond the problem statement: how we beat 41 other teams

### What most teams will build
They will put a LangGraph or plain agent behind a trace viewer (a LangSmith
clone), ask an LLM "which step failed?", train a classifier on a small
dataset, and offer a replay that re-runs everything. **Everyone will have a
trace graph and an LLM judge, so neither wins on its own.** We win on things
the others won't have.

| # | Beyond-PS USP | Say it like this | Under the hood | Why others won't have it | Owner | Tier |
|---|---|---|---|---|---|---|
| X1 | **Autopilot: fixes the agent mid-flight** | "We don't just record the crash, we prevent it. When the warning light comes on, Black Box rewinds a few steps and retries before the agent gives a wrong answer." | On an alarm, roll back to the save-point before the flagged step, then retry the step with the strategy the checker's `mistake_type` picks (re-search / stronger model / re-ask with argument check); the run continues | The PS asks for post-mortem debugging; nobody else will close the loop live | Aryan | **must** (headline) |
| X2 | **Our own model: a step-checker we fine-tuned** | "We trained our own small AI that checks every agent step in 30 milliseconds, free, on a laptop GPU." | Fine-tune **Laya** (open-source ModernBERT, 420M params, Jev-compatible Choice/Score/Noul) on our recorded steps with known labels; compare base Laya vs fine-tuned vs Jev vs LLM | Others call an API; we ship a model with numbers | Aditya | stretch-must (do it once ≥1,500 labelled runs exist) |
| X3 | **Three-tier checker cascade** | "A free local check first, a premium check only when it's unsure, a big AI only as last resort, like triage in a hospital." | Laya (local, ~30 ms) → if confidence < threshold → Jev (if key) → if still unsure → LLM; we report % handled locally, speed and cost vs always-LLM | Uses the measured idea that a local-first cascade can match a hosted model's accuracy faster | Aditya | must |
| X4 | **Plugs into anyone's agent in 3 lines** | "Add three lines to your agent and you get a black box. No rewrite." | **Record-only mode**: wrap any OpenAI-compatible client (`blackbox.wrap(client)`), so every call is recorded, checked and diagnosed (replay needs the full `ctx` mode) | Others' tools only work on their own demo agent | Aryan | must |
| X5 | **Ask your IDE why the agent failed (MCP server)** | "Developers can ask Claude Code or Cursor 'why did run 42 fail?', and Black Box answers with evidence." | An MCP server (FastMCP) exposing `list_failures`, `diagnose`, `verify`, `compare`, `report` over our API | Meets developers where they work; a 1-hour build | Advay | stretch-must |
| X6 | **Agent CI: crashes become tests** | "Every failure becomes an automatic test, so the same bug can never sneak back in." | `blackbox test` replays exported crash save-points (U23) against the current agent/prompt and exits non-zero on regression; usable in GitHub Actions | Turns a debugger into an engineering workflow | Radhesh | stretch |
| X7 | **Model report card** | "Which AI model fails how? We show each model's typical mistakes." | Our runs span Groq 8B, local 7B and 3B; per model, the failure-type mix, guilty-step positions, checker alarms and fix rates | Falls out of our data for free | Radhesh | must |
| X8 | **We publish a dataset: BlackBox-3K** | "We're releasing the first public set of agent failures that you can actually rewind and replay." | ~3,000 runs with save-points, data-flow graph, labelled guilty steps and planted-mistake metadata; a dataset card plus a loader | A research contribution, not just an app | Radhesh | must (packaging only, ~1 h) |
| X9 | **Privacy guard for recordings** | "Personal data is masked before anything is saved." | Redact emails, phones, cards and keys with regex, plus a Laya `noul` "contains personal data?" check on free text, before blobs hit disk | Enterprise-ready, which judges ask about | Aryan | stretch |
| X10 | **Minutes to milliseconds** | "A developer took 9 minutes to find the bug by reading the trace; Black Box took under a second." | A tiny timed study: 3 teammates × 3 failed runs, raw trace viewer vs Black Box; report median time-to-find and accuracy | A human-impact number nobody else will measure | all (H15) | must |

### The comparison slide

| | Typical team | **Black Box** |
|---|---|---|
| When does it help? | After the crash | **During the flight**: warns and self-corrects (X1) |
| How does it find the bad step? | Asks an LLM | **Trained ranker + our own fine-tuned checker** (U9, X2) |
| How sure is it? | Not stated | **Honest 90% suspect list**, coverage measured (U10) |
| Is the cause proven? | No | **Replay experiment, 3× repeat** (U13, U14) |
| Replay cost | Re-runs everything | **Only what changed** + savings meter (U15, U19) |
| Fix | Suggested text | **Tested fix**, plus whether it cures similar failures (U16, U17) |
| Works on my agent? | Demo agent only | **3-line wrapper, MCP server, CI** (X4–X6) |
| Contribution beyond the app | — | **BlackBox-3K dataset, model report card** (X7, X8) |

### The 30-second version (for the opening slide)
> "Black Box is a flight recorder for AI agents. It **warns you live** when a
> step goes wrong. It **names the guilty step** and is honest about how sure it
> is. It **proves the cause** by re-flying the run with that one step fixed,
> re-running only what changed. It **finds a fix that's already been tested**,
> and writes an **accident report where every sentence has a receipt**."

---

## 2. Problem statement → our component → what the judge sees

| PS key feature        | Component                           | On screen                                                                                      |
| --------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| Execution Data        | ① Recorder                         | A run builds itself live, step by step                                                         |
| Failure Diagnosis     | ② step checker + ③ trained ranker | Red warning on the step during the run; heat colours + "Suspects: step 5, 7" afterwards        |
| Failure Explanation   | ③ Evidence + ⑥ report             | Evidence panel (checker answers, step facts, data trail to the final answer) + incident report |
| Checkpointed Replay   | ① save-points + replay             | "Restored steps 0–4 from save-point, not re-run"                                              |
| Alternative Execution | ④ Verify + ⑤ Repair               | "✅ Verified: fixing step 5 flips the outcome", then candidate fixes with results              |
| Model Evaluation      | §7                                 | Accuracy on known failures, on*new kinds* of failures and on real failures, vs LLM judge     |
| Trace Comparison      | Compare view                        | Two runs side by side, first difference marked                                                 |

---

## 3. Data: what we download and what we generate (decided)

> **We generate all the agent runs ourselves. We only download the *questions*
> our agents work on, plus one outside dataset that we use purely for
> testing.**

Why generate? Replay and verification need runs with save-points that we can
re-execute. Nobody publishes runs like that.

| what                                                                      | download or generate             | where from                                                                     | used for                            |
| ------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------- |
| HotpotQA questions (each comes with its own 10 short paragraphs + answer) | **download**               | HuggingFace`hotpotqa/hotpot_qa`, config `distractor`, split `validation` | tasks for the QA agent              |
| GSM8K math word problems + answers                                        | **download**               | HuggingFace`openai/gsm8k`, config `main`, split `test`                   | tasks for the Math agent            |
| Shop tasks (orders, refunds, stock) + correct final state                 | **generate** with a script | `data/tasks/ops_tasks.py`                                                    | tasks for the Shop agent            |
| **Every agent run (trace)**                                         | **generate**               | our 3 agents on Groq / OpenRouter / Ollama                                     | training and testing                |
| Who&When (other people's agent failures, with the guilty step marked)     | **download**               | HuggingFace`Kevin355/Who_and_When` (confirm at H0)                           | outside test only, never trained on |

### 3.1 How we get failures with a known answer

| kind of run                                   | how we make it                                                       | do we know the guilty step?                                                                          | how many                     |
| --------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Clean**                               | the agent just does the task; a checker marks pass/fail              | —                                                                                                   | ~700                         |
| **Planted mistake**                     | take a passing run, fork it at step k, plant a mistake (table below) | yes, step k,**if** the run now fails. If the agent recovers, it is kept as "odd but harmless". | ~2,000                       |
| **GenAI-planted mistake** *(stretch)* | an LLM invents a subtle mistake for that specific step               | same                                                                                                 | ~300                         |
| **Natural failure**                     | small local models (qwen2.5:3b) fail on their own                    | found by ④ Verify: the earliest step whose fix flips the outcome                                    | ~300, of which 150+ labelled |

Checkers are plain code (word overlap for QA, exact number for math, final
database state for Shop), so **no AI decides what counts as a failure**.

### 3.2 Mistake catalog

| id  | mistake                                                        | step type |
| --- | -------------------------------------------------------------- | --------- |
| F1  | wrong tool argument (wrong id, number off by one, wrong unit)  | tool      |
| F2  | tool returns a wrong value                                     | tool      |
| F3  | tool silently returns nothing                                  | tool      |
| F4  | search returns a misleading paragraph instead of the right one | search    |
| F5  | search misses the right paragraph                              | search    |
| F6  | model states a wrong intermediate fact                         | model     |
| F7  | model picks the wrong tool                                     | model     |
| F8  | memory value deleted/overwritten                               | memory    |
| F9  | an instruction is dropped from the prompt                      | model     |
| F10 | model answers too early                                        | model     |

The model **trains on F1–F6 only**. F7–F10 are kept back to test whether it
handles mistakes it has never seen.

### 3.3 Test sets (split by task, so the same question never sits in both training and test)

| set                 | what is in it                            | question it answers                    |
| ------------------- | ---------------------------------------- | -------------------------------------- |
| train / val / calib | 70 / 10 / 10% of QA + Math tasks, F1–F6 | —                                     |
| test_known          | the other 10%, F1–F6                    | does it work?                          |
| test_new_mistakes   | F7–F10                                  | does it handle new kinds of mistakes?  |
| test_new_tasks      | all Shop runs                            | does it handle a new kind of task?     |
| test_natural        | real failures, labelled by ④            | does it work on real failures?         |
| test_outside        | Who&When                                 | does it work on other people's agents? |

### 3.4 Machines

| who     | GPU           | local model               | job                                     |
| ------- | ------------- | ------------------------- | --------------------------------------- |
| Aryan   | RTX 4060 8 GB | qwen2.5:7b                | generate runs when free                 |
| Advay   | RTX 4050 6 GB | qwen2.5:3b                | generate runs in the background from H7 |
| Radhesh | RTX 3050      | qwen2.5:3b (1.5b if 4 GB) | generate runs, natural failures         |
| Aditya  | M1 Air        | —                        | training (LightGBM runs fine on CPU)    |

Groq (one free key per person) is the fast lane, OpenRouter is the overflow,
and local Ollama is unlimited. Ollama settings measured last project:
`OLLAMA_NUM_PARALLEL=2 OLLAMA_FLASH_ATTENTION=1 OLLAMA_KV_CACHE_TYPE=q8_0 OLLAMA_KEEP_ALIVE=30m`. Keep `num_ctx` fixed, because changing it reloads the
model (about 13 s).

---

## 4. ① Record and replay (owner: Aryan)

### 4.1 What one step looks like (`blackbox/core/schema.py`, frozen at H2)

```python
SCHEMA_VERSION = 1
StepKind = Literal["llm", "tool", "retrieval", "state", "final"]

class Step(BaseModel):
    run_id: str; idx: int; kind: StepKind
    name: str                    # model id / tool name / search name
    node: str                    # which part of the agent made it ("plan", "search", ...)
    request: dict                # what was asked (prompt / tool args / search query)
    output: dict | None          # what came back
    error: str | None
    reads: list[str]; writes: list[str]   # memory keys used / changed
    parents: list[int]           # which earlier steps produced what this step used
    input_hash: str              # fingerprint of request + values read (replay re-use key)
    state_hash_after: str        # the save-point after this step
    state_diff: dict
    latency_ms: float
    tokens_in: int | None; tokens_out: int | None   # as reported by provider, else None
    cached: bool = False         # True = re-used during replay, not re-run
    monitor: dict | None = None  # step-checker answers for this step (§5)
    meta: dict = {}

class FaultSpec(BaseModel): type: str; step_idx: int; params: dict; generator: str = "catalog"
class Outcome(BaseModel):   success: bool; score: float; final_answer: Any; expected: Any; checker: str
class Label(BaseModel):     root_cause_step: int | None; source: Literal["injected","verified","imported"]; notes: str = ""

class Run(BaseModel):
    run_id: str; schema_version: int
    task_family: Literal["qa","math","ops","external"]; task_id: str; task_input: dict
    agent: str; model_id: str
    parent_run_id: str | None; fork_step_idx: int | None; patch: dict | None
    fault: FaultSpec | None; outcome: Outcome | None; label: Label | None
    split: str | None
    stats: dict                  # n_steps, n_rerun, n_reused, tokens, tokens_saved, seconds_saved
    created_at: str; machine: str
```

Runs are stored in SQLite. Big values (save-points, long outputs) go to files
named by their fingerprint, so identical save-points are stored once. Each
machine writes `data/shards/<machine>_<time>.jsonl.gz`; these are shared via
Drive and merged into one DB on Aryan's machine.

### 4.2 The recorder (`RunContext`)

Agents never call a model, tool or search directly. They go through `ctx`,
which records everything:

```python
ctx.llm(model_id, messages, tools=None) ; ctx.tool(name, **args) ; ctx.retrieve(query, k)
ctx.state      # the agent's memory; reads/writes are logged → `parents` filled automatically
ctx.rng, ctx.now()
```

### 4.3 Model providers

Groq, OpenRouter and Ollama all use the same OpenAI-style API, so one client
with three base URLs covers them. Jev uses `typesafe-sdk`
(`TYPESAFE_API_KEY`). Only `models.yaml` names models. At startup we check
that every named model exists.

### 4.4 Replay and fork

- Agents are written as small state machines: each step reads memory, does
  one thing, writes memory and names the next step. So **any save-point is a
  complete restart point.** (We write this ourselves; LangGraph can't re-use
  unaffected steps.)
- **How replay works (as built):** the agent's own code runs again, but every step before k is served from the recording: 0 model calls, and a check that each step asks exactly what it asked before. Any difference means the agent used something outside `ctx`, and it is reported as a crash. Save-points are stored after every step for inspection and the UI.
- `fork(run, k, change)` is the same, but step k gets a change: a new output,
  new tool arguments, an edited prompt, another model, or an edited memory
  value.
- **Re-use after k:** if a later step asks exactly the same thing with the
  same inputs as in the original run, its old answer is re-used.
- Every fork reports **steps re-run, steps re-used, tokens and seconds saved**,
  counted from real calls.

### 4.5 Compare

Line up two runs step by step, the way `diff` lines up two files. Mark where
they first differ, which steps changed, the memory differences and the
outcome difference.

---

## 5. ② Step checker / flight monitor (owners: Aditya writes the questions, Aryan wires it in)

After every step, the recorder sends the checker one batched call through
the cascade (X3): **Laya locally → Jev if Laya is unsure and a key exists →
LLM via `system-one-adapter`**. Every tier uses the same questions and the
same answer format, and `step.monitor.tier` records which tier answered. The **state** is
the task, the step's request and output, and short summaries of the steps it
used. The **questions** form our question bank (`blackbox/monitor/questions.py`):

```python
questions = {
  "consistent":   Noul(instructions="The step's output is consistent with the inputs it was given."),
  "on_track":     Noul(instructions="After this step the agent is still on track to solve the task."),
  "mistake_type": Choice(instructions="What kind of mistake, if any, this step contains.",
                         criteria={"none": "...", "wrong_tool_argument": "...", "wrong_tool_result": "...",
                                   "empty_result": "...", "misleading_search": "...", "missed_info": "...",
                                   "wrong_fact": "...", "wrong_tool": "...", "lost_memory": "...",
                                   "ignored_instruction": "...", "answered_too_early": "..."}),
  "severity":     Score(instructions="How badly this step would hurt the final answer.",
                        criteria=["harmless", "minor", "could derail the task", "will derail the task"]),
}
```

- Answers are saved on the step (`step.monitor`) with Jev's probabilities and
  confidence.
- **Alarm** when `on_track` is low with high confidence: the UI turns the
  step red **during the run** and logs the time between alarm and final
  answer as "warning lead time".
- The monitor call runs **in the background** and never slows or blocks the
  agent. If the checker is down, the step is recorded without monitor answers. It is
  never faked (CLAUDE.md).
- **Fallback / comparison:** `system-one-adapter` runs the *same questions*
  through a Groq LLM. This keeps us working without a Jev key, and §7 compares
  Jev vs LLM on accuracy, speed and cost.

## 6. ③ Diagnose, ④ Verify, ⑤ Repair, ⑥ Report

### 6.1 ③ Diagnose: the trained ranker (owner: Aditya)

For each step of a failed run we build a row of facts and train a model to
rank the steps by how likely each one is to be the cause.

- **Step-checker answers:** p(consistent), p(on_track), the mistake-type probabilities,
  severity, confidence, and the *drop* in p(on_track) from the previous step.
- **Step facts:** step type, position, error flag, empty output, how many
  later steps used its output, whether the final answer depends on it,
  memory changed, and "**unsupported facts**" (numbers or names in the output
  that appear in none of its inputs).
- **"Normal or odd?":** how different this step looks from the same kind of
  step in passing runs (a nearest-neighbour distance on text embeddings).
- **Chance-of-success curve** *(if time)*: a small model trained on run
  outcomes predicts "chance this run still succeeds" after each step. A
  sudden drop is a strong clue, and the curve is easy to show on screen.

**Model:** LightGBM ranker trained on the planted-mistake runs (F1–F6). It is
fast, works on a laptop CPU and can explain itself (SHAP: which facts pushed
a step up the list).

**Suspect list:** instead of one guess, show the shortest list of steps that
contains the real cause 90% of the time. The list length is tuned on the
`calib` set (this is split conformal prediction; about 30 lines). We report
whether the 90% holds on each test set.

**Evidence per suspect:** its checker answers, the top 3 facts that made it a
suspect (as plain sentences such as "output contains `1912`, which appears in
none of its inputs"), the trail of steps from it to the final answer, and the
matching step from a passing run of the same task (if one exists).

### 6.2 ④ Verify (owner: Aryan)

For each suspect, re-run from that step with a repaired version of it (in
order: the matching step from a passing run → the same step re-run with a
stronger model). Do this 3 times. If the run now passes, the suspect is
**verified ✅**, with "flipped 3/3". If no single step flips it, try fixing
pairs of suspects. The same routine labels the natural failures for
`test_natural`.

### 6.3 ⑤ Repair with GenAI (owner: Aryan; stretch beyond 1 round)

1. A large LLM (`judge-large`) reads the steps around the verified cause plus
   the evidence, and proposes 4 fixes: a prompt rewrite, an added rule,
   different tool arguments, or a different model.
2. Each fix is tested by a cheap fork.
3. Show the results as cards: passed?, tokens, steps re-run. Keep the best,
   ask the LLM to improve on them, and repeat once.
4. *(stretch)* Apply the winning prompt fix to other failures of the same
   type and report "fixes 31 of 40 similar failures".

**The checker routes the fix:** the `mistake_type` answer chooses the first repair
strategy (search mistake → re-search; tool argument → re-ask with argument
check). Only low-confidence cases go to the large LLM, the "confidence-gated
routing" pattern from Jev's docs.

### 6.4 ⑥ Incident report with GenAI (owner: Aditya)

The large LLM writes: **Summary · Timeline · Probable cause (verified?) ·
Contributing factors · Evidence · Recommended fix · Confidence**. Every
sentence must end with `[step N]`. A checker (ported from 26117's
`citation_validation.py`) deletes any sentence that cites a step missing from
the evidence, and shows how many it deleted. The report exports as markdown.

### 6.5 Failure atlas *(stretch)*

Group verified causes by checker mistake type plus step type. Show counts and
examples, with an LLM-written one-line name per group, for example
"second search returned a same-name distractor (43 runs)".

---

## 7. Evaluation (harness: Radhesh; models: Aditya)

`py -3 -m blackbox.eval.report` writes `data/reports/latest.json` and
`latest.md`.

| table                                                            | what it shows                                                                                                                                                                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding the guilty step**: Top-1, Top-3, within ±1 step | per test set (§3.3), for: random · last step · first error ·**LLM judge** (the Who&When paper's method) · **Jev alone** · **our ranker without Jev** · **our ranker with Jev** |
| **Suspect list**                                           | promised 90% vs actual hit rate, average list length, per test set                                                                                                                                            |
| **Jev vs LLM**                                             | same monitor questions: accuracy, time per call, cost per 1,000 steps, and whether its probabilities are honest (a reliability plot)                                                                          |
| **Live warning**                                           | % of failed runs flagged before the final answer, false-alarm rate on passing runs, lead time in steps                                                                                                        |
| **Verify**                                                 | % of suspect lists containing a verified cause; steps re-run vs full re-run                                                                                                                                   |
| **Repair**                                                 | % of failures fixed when the fix targets our top suspect vs a random step vs the last step (same budget)                                                                                                      |
| **Report**                                                 | % of sentences with valid citations before and after the checker                                                                                                                                              |

Every number comes from a script run on `data/`. No number is typed by hand.

---

## 8. API (Aryan writes the skeleton, Advay extends it)

```
GET  /api/health                      providers + step checker reachable, DB counts
GET  /api/runs?family=&outcome=&fault=&split=&q=&limit=&offset=
GET  /api/runs/{id}                   run + steps + links
GET  /api/runs/{id}/steps/{idx}       full step incl. save-point (loaded on click)
GET  /api/runs/{id}/diagnosis         {scores[], suspects[], coverage, evidence[], monitor[]}
POST /api/runs                        start live run {task_family, task_id, model_id} → {run_id}
POST /api/runs/{id}/fork              {step_idx, change} → {run_id}
POST /api/runs/{id}/verify            → {job_id}
POST /api/runs/{id}/repair            → {job_id}
POST /api/runs/{id}/report            → {job_id}
GET  /api/runs/{id}/events            live stream: start | step | monitor | alarm | done | error
GET  /api/jobs/{job_id}/events        live stream: attempt | result | verdict | report | done
GET  /api/compare?a=&b=
GET  /api/eval/latest
GET  /api/tasks?family=
```

## 9. Screens (owner: Advay)

| screen               | what is on it                                                                                                                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Live run**   | Pick a task, press run, and watch steps appear. A checker light on each step goes green/amber/red, and an**alarm banner** shows when the checker flags trouble.                                                                                                                           |
| **Run**        | Step graph (boxes = steps, arrows = "used output of"), coloured by suspicion, suspects outlined. An "on track" line chart under the graph. Clicking a step opens Request / Output / Memory change / checker answers. Evidence panel. Buttons:**Verify · Repair · Report · Fork here**. |
| **Experiment** | Each re-run attempt as a card (what changed, steps re-run vs re-used, pass/fail), ending in the verdict badge; then the repair fix cards                                                                                                                                                        |
| **Report**     | The incident report; clicking`[step N]` jumps to the step                                                                                                                                                                                                                                     |
| **Compare**    | Two runs side by side, first difference marked                                                                                                                                                                                                                                                  |
| **Eval**       | The §7 tables and charts                                                                                                                                                                                                                                                                       |
| **Runs**       | Searchable list                                                                                                                                                                                                                                                                                 |

## 10. Code from 26117

Copied into `reference/from_26117/` so everyone has it. Read it and **port**
what fits; never import from it. See `reference/from_26117/README.md`.
