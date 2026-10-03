"""Math agent for GSM8K: plan -> (step -> calculate)* -> check -> answer.

The model never does arithmetic itself: it names one calculation at a time
and the calculator tool computes it. A run is 6 to 15 steps:

    plan(llm)  [step(llm)  calculator(tool)] x 1..MAX_CALCS  step(llm, DONE)  check(llm)  final
"""

from __future__ import annotations

from blackbox.agents import checkers  # noqa: F401 - registers the "math" checker
from blackbox.agents.base import Agent, Task, register_agent
from blackbox.agents.parsing import clip, field
from blackbox.agents.tools import call_tool
from blackbox.recorder.context import RunContext, ToolError

MAX_CALCS = 5
MAX_TURNS = 6  # step-node visits, including the one that says DONE

PLAN_SYSTEM = (
    "You plan how to solve a math word problem. List the calculations needed, in order, "
    "one short line each: what is being found and from which numbers in the problem. "
    "Do not compute the results. At most 5 lines. The last line must find what the question asks."
)
STEP_SYSTEM = (
    "You solve a math word problem one calculation at a time. A calculator does the arithmetic. "
    "Do the next line of the plan that has no result yet. Reply with exactly one line:\n"
    "CALC: <one arithmetic expression using only numbers and + - * / ( )>\n"
    "or, when every line of the plan has a result:\nDONE"
)
CHECK_SYSTEM = (
    "You check the solution of a math word problem. Given the problem and the calculator results, "
    "state the final answer to the question asked. Reply with exactly one line:\n"
    "FINAL: <number only, no units>"
)


def _format_results(results: list[dict]) -> str:
    if not results:
        return "(none yet)"
    return "\n".join(f"{i + 1}. {r['expr']} = {r['value']}" for i, r in enumerate(results))


@register_agent
class MathAgent(Agent):
    name, version, family, entry = "math_agent", "v1", "math", "plan"

    def init_state(self, task: Task) -> dict:
        return {"question": task.input["question"], "results": [], "turns": 0}

    def tool_caller(self, task: Task):
        return call_tool

    def plan(self, ctx: RunContext) -> str:
        res = ctx.llm(ctx.model_id, [
            {"role": "system", "content": PLAN_SYSTEM},
            {"role": "user", "content": f"Problem: {ctx.state['question']}"},
        ], max_tokens=160)
        ctx.state["plan"] = clip(res.text, 600)
        return "step"

    def step(self, ctx: RunContext) -> str:
        results, turns = ctx.state["results"], ctx.state["turns"]
        res = ctx.llm(ctx.model_id, [
            {"role": "system", "content": STEP_SYSTEM},
            {"role": "user", "content": (
                f"Problem: {ctx.state['question']}\n\nPlan:\n{ctx.state['plan']}\n\n"
                f"Results so far:\n{_format_results(results)}"
            )},
        ], max_tokens=48)
        expr = field(res.text, "CALC")
        ctx.state["turns"] = turns + 1
        if expr is None or len(results) >= MAX_CALCS or turns + 1 >= MAX_TURNS:
            return "check"
        ctx.state["expr"] = expr
        return "calculate"

    def calculate(self, ctx: RunContext) -> str:
        expr = ctx.state["expr"]
        try:
            value = ctx.tool("calculator", expression=expr)
        except ToolError as exc:
            value = f"error: {clip(str(exc), 120)}"  # recorded on the step; the model sees it next turn
        # read after the call: the calculator depends on `expr` only, so its
        # parents and its re-use fingerprint must not include earlier results
        ctx.state["results"] = ctx.state["results"] + [{"expr": expr, "value": value}]
        return "step"

    def check(self, ctx: RunContext) -> str:
        results = ctx.state["results"]
        res = ctx.llm(ctx.model_id, [
            {"role": "system", "content": CHECK_SYSTEM},
            {"role": "user", "content": (
                f"Problem: {ctx.state['question']}\n\nCalculator results:\n{_format_results(results)}"
            )},
        ], max_tokens=32)
        ctx.state["answer"] = field(res.text, "FINAL") or clip(res.text, 80)
        return "answer"

    def answer(self, ctx: RunContext) -> None:
        ctx.final(ctx.state["answer"])
        return None

    nodes = {"plan": plan, "step": step, "calculate": calculate, "check": check, "answer": answer}
