# Demo video voiceover (5:00): Aryan · Radhesh · Aditya

Video: `data/blackbox_demo_5min.mp4`. Waits are fast-forwarded and labelled ">> 12x" in the corner; results play
at normal speed. Each line starts at its timestamp and fits its segment at an easy pace (≈ 2.5 words a second).
The next speaker starts when the screen changes. If you finish early, let the screen speak.

| Time | Who | On screen | Line |
|---|---|---|---|
| 0:00 | **Aryan** | Overview | "AI agents now act for us: they search, call tools, move money. When one fails, the mistake usually happened several steps earlier, and today a developer reads logs and guesses. **Black Box is a flight recorder for AI agents.** It records every step, finds the step that caused the failure, and proves it." |
| 0:20 | **Radhesh** | Runs | "Every run here is real. We built question-answering, math and shop agents, recorded nearly six thousand runs, and planted ten kinds of realistic mistakes, so for 870 failures we know exactly which step is guilty." |
| 0:34 | **Aryan** | Investigate | "One click investigates a failed run." |
| 0:40 | **Aryan** | Investigate result | "Our model ranks the planted step first. Then Black Box *proves* it: it replays the run from the recording with only that step repaired, and the answer comes out right. It re-ran a handful of steps, re-used the rest from the recording, and made zero model calls for anything that didn't change." |
| 1:03 | **Aditya** | Run graph + step | "This is the run as a graph of who used whose output. The guilty step is red. Click it and you see exactly what it returned: a paragraph about the wrong season. The diagnosis model learns from this structure. On failures it never saw, it puts the guilty step first sixty percent of the time and in the top three eighty-two percent; simple baselines manage twenty-five." |
| 1:29 | **Radhesh** | Live Lab | "Now live. We type a question, the agent answers it, and Black Box plants a mistake into that run on the spot." |
| 1:36 | **Radhesh** | Lab result | "The agent answers 508. We planted one mistake into its calculator step, and the answer broke. The live checker watched every step, the diagnosis put the planted step in its top three, and Verify proved it: repair that one step, and the answer is 508 again. Fourteen stages, on a laptop GPU." |
| 2:03 | **Aditya** | Causal report | "For any failure we go further than 'which step'." |
| 2:07 | **Aditya** | Causal result | "Was the step necessary? Was it sufficient on its own? Black Box tests both by experiment, shows how far the damage spread (here, every later step), and lists every verified way the run could have recovered." |
| 2:28 | **Aryan** | Fleet fix | "Fixing one failure isn't enough. Here's one rule, tested on similar past failures *and* on runs that used to pass." |
| 2:33 | **Aryan** | Fleet verdict | "It fixed nothing and broke two runs that used to pass, so the regression firewall **blocks** it. A fix only ships if it fixes failures and breaks nothing, and you can see exactly which runs it would have broken." |
| 2:54 | **Radhesh** | Crash test | "The crash test breaks a working agent in every way we know." |
| 2:58 | **Radhesh** | Crash result | "Six kinds of mistakes, each graded: robust, failed safely, failed silently, or unsafe. Four stars: this agent survives five of them, but trusts a misleading search result without question. Every failure becomes new training data." |
| 3:19 | **Aditya** | Seen before? | "Every failure gets a fingerprint. Ninety-nine past failures share this one, all the same kind, so Black Box can say 'we've seen this before', flag new kinds of failure, and offer fixes that were already approved." |
| 3:35 | **Aditya** | Compare | "Compare lines up the original run with the broken one, step by step, and shows exactly where they diverged." |
| 3:51 | **Aryan** | Incidents | "For people who run agents unattended, like a trader, Guardian explains each incident in plain words on email, WhatsApp and Slack, and pauses any agent that moves money until a human approves." |
| 4:08 | **Aditya** | Atlas | "The atlas: the most common failure patterns across all our runs." |
| 4:19 | **Radhesh** | Dataset | "Every label comes from a planted mistake or a replay experiment, never from the model being tested." |
| 4:30 | **Aditya** | Checker | "The live step checker asks typed questions about each step as the agent runs, and raises an alarm when a step stops making sense." |
| 4:41 | **Aryan** | Machine | "All of it runs on one laptop GPU, with local models by default." |
| 4:51 | **Aryan** | Models (close) | "And it ships as a Python package: three lines into any agent, a CI check for pull requests, and a server for your IDE. Black Box: record, find, prove, fix." |

**After the video (live, ~1 min):** the trader bot in the terminal (`py -3 examples/trader_bot.py --glitch`: phone
buzzes), then Claude Code: *"Why did run e22f1bc00a66445c fail? Show me the blame map."*
