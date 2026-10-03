"""Black Box on an agent framework we did not write: Hugging Face smolagents.

The agent code below is ordinary smolagents. Black Box adds three lines
(marked ◆): wrap the model's OpenAI client, decorate the tool, run under the
recorder. Then the run can be replayed (0 model calls) and forked.

    pip install smolagents
    py -3 examples/smolagents_demo.py            # needs Ollama with qwen2.5:7b
"""

from __future__ import annotations

import sys

from smolagents import OpenAIServerModel, ToolCallingAgent, tool

import blackbox
from blackbox import Change, Outcome

MODEL = OpenAIServerModel(model_id="qwen2.5:7b", api_base="http://localhost:11434/v1", api_key="ollama",
                          temperature=0)
MODEL.client = blackbox.wrap(MODEL.client, provider="ollama")          # ◆ 1. record every model call

POPULATION = {"pune": 7_400_000, "nagpur": 2_900_000, "nashik": 2_100_000}


@tool
@blackbox.tool                                                           # ◆ 2. record every tool call
def city_population(city: str) -> int:
    """Look up the population of an Indian city.

    Args:
        city: the city's name, e.g. "Pune"
    """
    return POPULATION.get(city.strip().lower(), 0)


def compare_cities(question: str) -> str:
    """An ordinary smolagents agent: nothing Black Box-specific in here."""
    agent = ToolCallingAgent(tools=[city_population], model=MODEL, max_steps=5, verbosity_level=0)
    return str(agent.run(question))


def check(answer, expected) -> Outcome:
    ok = expected.lower() in str(answer).lower()
    return Outcome(success=ok, score=float(ok), final_answer=answer, expected=expected, checker="contains")


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")
    question = "Which city has more people, Pune or Nagpur? Look both up, then answer with just the city name."
    trace = blackbox.run(compare_cities, question, family="smolagents", expected="Pune", check=check)  # ◆ 3.
    r = trace.run
    print(f"RECORDED run {r.run_id}: {r.status}, answer {r.outcome.final_answer if r.outcome else None!r}, "
          f"{len(trace.steps)} steps")
    for s in trace.steps:
        print(f"  [{s.idx}] {s.kind:5} {s.name:18} used {s.parents}")

    again = blackbox.replay(trace)
    print(f"REPLAY: {again.run.stats['n_llm_calls']} model calls, answer {again.run.outcome.final_answer!r}")

    tool_steps = [s.idx for s in trace.steps if s.kind == "tool" and s.request["args"].get("city", "").lower() == "nagpur"]
    if tool_steps:
        k = tool_steps[0]
        child = blackbox.fork(trace, k, Change(kind="output", value={"result": 9_000_000},
                                               note="what if the tool said Nagpur has 9M people"))
        sv = blackbox.savings(child)
        print(f"FORK at step {k} (tool says Nagpur has 9,000,000): answer {child.run.outcome.final_answer!r}, "
              f"passed={child.run.outcome.success}; re-ran {sv['steps_executed']}/{sv['steps_total']} steps, "
              f"re-used {sv['steps_reused']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
