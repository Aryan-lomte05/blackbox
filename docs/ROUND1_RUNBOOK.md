# Round 1 run sheet: 5 min presentation (prototype included) + 2 min Q&A

**Before your turn (2 min):** API on :8000 and dashboard on :5173 running (`blackbox ui`; `cd web && npx vite --port 5173 --host 127.0.0.1`).
Open tabs: ① http://127.0.0.1:5173/ (Overview) ② /investigate ③ /lab with the question pasted ④ phone with WhatsApp + Gmail open.
Send "hi" to +1 415 523 8886 on WhatsApp (sandbox window). Lab question (proven at 10:40, 19 s):
> A shop sells pens at 17 rupees each. Riya buys 24 pens and pays a 100 rupee delivery fee. How much does she pay in total?

## The 5 minutes
| Time | Say | Do |
|---|---|---|
| 0:00–0:40 | "AI agents now act for us: they search, call tools, move money. When one fails, the mistake usually happened steps earlier. Today a developer reads logs and guesses. **Black Box is a flight recorder for AI agents: it finds the step that caused the failure and proves it.**" | Overview tab: 5,685 recorded runs, 860 labelled failures |
| 0:40–1:50 | "Watch it live. I ask the agent a question; Black Box plants a mistake into its run, finds it, and proves it by replaying history with only that step repaired." | Lab tab → **Run Live Lab** (tick *Notify my phone*). Narrate the stages as they land: clean answer 508 → mistake planted → wrong answer → checker → **diagnosis ranks the guilty step first** → **Verify: PROVED** → fixed run answers 508 again |
| 1:50–2:30 | "Proof, not a guess: re-running only the changed steps, from the recording. That replay costs zero model calls for everything that did not change." | Point at "re-ran 1 of 9 steps, re-used 7" |
| 2:30–3:10 | "And the owner is told, in plain words: email, WhatsApp, Slack, with the agent paused if it moves money." | Show the phone: WhatsApp + email (dark incident report) |
| 3:10–4:10 | "It is a product, not a notebook: a pip package, 3 lines into any agent; **one fix for many** with a regression firewall; a **crash test** that rates an agent 1–5 stars; **Black Box CI** that fails a pull request when a prompt change breaks a recorded run; and an MCP server so Claude Code can investigate failures from the IDE." | Click through Fleet fix, Crash test, Similar screens (fixtures already loaded) |
| 4:10–5:00 | "Our model, on failures it never saw: guilty step first **60%** of the time, in the top 3 **82%**; on a task type it never trained on, 63% / 79%. Baselines are at 25% or less. Where the model is unsure, replay proves the cause anyway. Black Box: record, find, prove, fix." | Dataset or Overview tab |

**If the Lab is slow or fails:** switch to tab ② Investigate → case *model_finds_it* → Investigate (12–20 s, recorded run).

## Q&A (2 min: short answers, one number each)
**What exactly is new?** Others show logs or guess a culprit. We *prove* the cause: re-run the agent from its recording with only that step repaired; if it passes, that step caused it. Plus a regression firewall for fixes, and CI on pull requests.

**How do you know which step is guilty (ground truth)?** Two sources, never the model itself: mistakes we planted (we know where), and real failures whose cause was proven by replay (44 so far). 860 labelled failures in 5,685 runs.

**What is the model?** Graph features over "which step used whose output" (data flow), plus step-checker answers, ranked per step; chosen by cross-validation; evaluated once on held-out sets. Top-1 0.60 / Top-3 0.82 on unseen questions (n=67), 0.63 / 0.79 on an unseen task type (n=112).

**Weakness?** Real, unplanted failures: the model's first pick is usually wrong (n=17), because real causes cluster at the plan step. That is why the product does not trust the model alone: Verify proves causes by experiment.

**Isn't replay expensive?** No: steps are content-addressed; a replay serves recorded outputs (0 model calls) and a fix re-runs only steps whose inputs changed (e.g. 1 of 9).

**Non-deterministic LLMs?** Verify repeats attempts and separates "bad luck" (a plain rerun also fixes it) from a real cause.

**Does it work on agents you didn't write?** Yes: `blackbox.wrap(client)`, `@blackbox.tool`, `blackbox.run(...)` (shown on Hugging Face smolagents), or import existing OpenTelemetry / Langfuse traces.

**Money / safety?** Tools that move money never execute during any re-run (dry-run), and Guardian pauses such agents until a human approves.

**Privacy?** Runs are stored locally; keys and personal data are redacted from alerts; models can be fully local (Ollama).

**Which models?** Local Qwen 2.5 7B via Ollama by default (verify too); Groq / OpenRouter optional, configured in one file.

**What would you do next?** More real-failure labels (Verify now runs locally, fast), a fine-tuned step checker, and Black Box CI as a GitHub Marketplace action.
