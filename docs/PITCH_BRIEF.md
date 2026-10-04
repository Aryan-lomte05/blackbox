# Black Box: a flight recorder for AI agents

*Source document for the pitch deck. Team Half a Byte. Every number below comes from the project's data files
(`data/models/gnn_metrics.json`, `fixtures/ui/*.json`), measured on 4 Oct 2026.*

## 1. The problem (one slide)
AI agents now take real actions: they search, call tools, move money, answer customers. When one gets something
wrong, the mistake usually happened many steps before the bad answer. A wrong search result at step 2 becomes a
wrong fact at step 5 and a wrong refund at step 9. Today a developer reads logs by hand, guesses which step was
to blame, changes something, and re-runs everything, paying for every model call again. Nobody can say for sure
which step caused the failure, or whether a fix breaks something else.

## 2. What Black Box is (one sentence)
A flight recorder for AI agents: it records every step, finds the step that caused a failure, **proves** it by
replaying history with that one step changed, and checks that a fix works on past failures without breaking
anything that used to work.

## 3. How it works (the loop)
**Record → Warn → Diagnose → Prove → Explain → Fix → Check the fix on history → Alert the owner**
1. **Record**: 3 lines added to an existing agent (wrap the model client, mark the tools, run under the recorder).
   Every step is saved with a save-point, like a game save. Works on agents we did not write (proven on Hugging Face smolagents),
   and can **import traces** the agent already exports (OpenTelemetry, Langfuse).
2. **Warn**: a live step checker flags suspicious steps while the agent runs.
3. **Diagnose**: a trained model ranks which step most likely caused the failure, with plain-language evidence.
4. **Prove**: Black Box re-runs the agent from the recording with only that step repaired. If the run now passes,
   the cause is proven by experiment, not guessed. Unchanged steps are served from the recording, so re-runs are
   fast and cost almost nothing (a replay makes **0 model calls**).
5. **Explain**: a causal report says, for each suspect, whether it was **necessary** (fixing it alone fixes the run)
   and **sufficient** (it alone breaks a working run), how far the damage spread (blast radius), and every verified
   way the run could have recovered.
6. **Fix**: GenAI proposes fixes, and every fix is tested by replay before anyone sees it.
7. **One fix for many + regression firewall**: turn one failure into one general rule, re-run similar past
   failures **and** passing runs with it, and only APPROVE the rule if it fixes failures and breaks nothing.
8. **Guardian**: for people who run agents unattended (a trader, a shop owner): the incident is explained in plain
   words by email, WhatsApp, Slack, Telegram, or a phone call for critical cases, with a link to an incident page.
   Agents that move money are paused until the owner approves; money-moving tools are never re-executed by Black Box.

## 4. What makes it different (USPs, in plain words)
- **Proof, not a guess.** Other tools show logs and maybe a suspicion. Black Box re-runs history with one step changed and shows the run passing.
- **Time travel.** Stand inside any step: what the agent saw, what it remembered, what it did, what it affected.
- **What-if in seconds.** Change one step and only the affected steps re-run; undoing a planted mistake re-runs 1 step and re-uses 8.
- **One fix, many failures, zero regressions.** A rule is tested on the fleet of past runs before it ships (APPROVE / BLOCK).
- **"Have we seen this before?"** Every failure gets a fingerprint; 859 labelled failures collapse into about 30 failure patterns; brand-new kinds are flagged NOVEL; approved fixes are offered for look-alikes.
- **Crash test.** Black Box breaks a working agent in every way it knows (10 kinds of mistakes) and gives it a 1-5 star safety rating: did it recover, fail safely, fail silently, or try something unsafe?
- **Live Lab.** Type any question; the agent answers live; Black Box plants a mistake on stage and investigates it in 14 visible stages.
- **Works inside your IDE.** A Model Context Protocol server with 28 tools: ask Claude Code "why did my run fail?" and it uses Black Box to diagnose, prove, and fix.
- **Black Box CI: a regression firewall on every pull request.** Pin real recorded runs once; on every PR they are replayed against the new code. Black Box pinpoints the exact step where behaviour changed, re-runs only from there, and fails the build on a regression. One `pip install` plus a ready-made GitHub Action (verified from a clean install).
- **Bring your existing traces.** Already using OpenTelemetry or Langfuse? Import those traces and diagnose them, with no code change.
- **Built for non-coders too.** Guardian speaks the owner's language and never re-runs anything that moves money.

## 5. Evidence (numbers)
**Dataset we built:** 5,653 agent runs, 56,122 steps, **859 failures with a known guilty step** (815 planted
mistakes of 10 kinds, 44 real failures whose cause was proven by experiment). Questions from HotpotQA and GSM8K,
plus a shop task type used only for testing. Save-points are 80% de-duplicated (10.4 MB for 56k save-points).

**Diagnosis model (graph features over who-used-whose-output), on data it never saw:**
| Test set | n | Top-1 (guilty step ranked first) | Top-3 |
|---|---|---|---|
| Unseen questions, known mistake kinds | 67 | **0.60** | **0.82** |
| A task type never trained on (Shop) | 112 | **0.63** | **0.79** |
| Simple baselines (first / last / random step) | | ≤ 0.25 | |

Calibrated suspect list: the 5 steps it names contain the guilty one 93% of the time on held-out calibration
runs (target 90%).
**Honest gap:** on real, unplanted failures (n=17) the model's first pick is rarely right: real causes sit at the
plan step. Black Box handles this with a policy (model's top 2 + the first decision step) and, above all, with
**proof by replay**, which does not depend on the model being right.

**Live results:**
- Regression firewall BLOCKED a search rule: it fixed 1 of 4 similar failures but broke 1 of 2 passing runs.
- It APPROVED another rule (fixed 1 of 3, broke 0); that rule is now offered automatically for look-alike failures.
- Crash test of a question-answering agent: ★★★★☆, robust to 5 of 6 mistakes, weak against misleading search results.
- Causal report on a math run: the calculator step was necessary but not sufficient (the agent sometimes recovers); 2 verified recovery paths; the mistake reached all 9 later steps.
- Undoing a planted mistake: 1 step re-run, 8 re-used, 0 model calls, deterministic.

## 6. Demo flow (5 minutes)
1. **Crash test** a working agent → it is weak against misleading search results.
2. **Investigate** one of those failures → the guilty step, highlighted on the run graph with its contamination trail.
3. **Causal report** → necessary / sufficient, blast radius, recovery paths.
4. **One fix for many** → a rule is tested on past failures and passing runs → firewall verdict.
5. **Guardian** → the trader bot glitches → a plain-language incident email / WhatsApp, the agent paused until approval.
6. **Live Lab** with a question from the audience.
7. **In the IDE**: ask Claude Code "why did my latest run fail?" → it uses Black Box's tools.
8. **On a pull request**: edit the agent's prompt → Black Box CI names the step whose behaviour changed and blocks
   the merge if a recorded run regresses.

## 7. Architecture (one diagram)
Agent → **Recorder** (models, tools, search, memory, save-points; content-addressed storage) →
**Live checker** → **Diagnosis** (graph model + calibrated suspect list + evidence) →
**Replay engine** (replay, fork, verify, causal report, repair, fleet replay, crash test) →
**Fingerprints & atlas** → **Guardian** (incidents, channels, approvals) →
surfaces: **web dashboard**, **REST API + live streams**, **CLI**, **MCP server** for IDE assistants, **Black Box CI**
(GitHub Action) for pull requests.
Python package (`pip install`), FastAPI, React dashboard, local models via Ollama plus Groq / OpenRouter.

## 8. Team
Aryan (lead: recorder, replay, proof, diagnosis model, API, Guardian, MCP) · Radhesh (agents, mistake catalog,
data farm, evaluation) · Aditya (live step checker, ranking model, calibration) · Advay (dashboard).
