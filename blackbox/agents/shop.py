"""Shop agent: handles a customer request against a mock shop API.

    plan(llm)  [act(llm)  call(tool)] x 1..MAX_ACTIONS  act(llm, DONE)  final

A run is 5 to 15 steps. The shop's database lives in ctx.state["db"]; tools
receive it and return the changed one (blackbox.agents.tools.shop). The
model never sees the database, only what the tools report. The final answer
is the database the agent leaves behind, which the checker compares with the
correct one.
"""

from __future__ import annotations

import json
import re
from typing import Any

from blackbox.agents.base import Agent, Task, register_agent, register_checker
from blackbox.agents.parsing import clip, field
from blackbox.agents.tools import shop as shop_tools
from blackbox.agents.tools.registry import call_tool, get_tool_schemas
from blackbox.core.schema import Outcome
from blackbox.recorder.context import RunContext, ToolError

MAX_ACTIONS = 6
MAX_TURNS = 7  # act-node visits, including the one that says DONE

_KEY_VALUE = re.compile(r"""["']?(\w+)["']?\s*[:=]\s*("[^"]*"|'[^']*'|[^,}\s]+)""")


def describe_tools() -> str:
    """The tool list shown to the model, from the registry's own schemas (without `db`)."""
    lines = []
    for schema in get_tool_schemas(shop_tools.CATEGORY):
        fn = schema["function"]
        params = ", ".join(f"{name}: {spec['type']}" for name, spec in fn["parameters"]["properties"].items()
                           if name != "db")
        lines.append(f"- {fn['name']}({params}): {fn['description']}")
    return "\n".join(lines)


PLAN_SYSTEM = (
    "You are a shop support agent. Read the customer request and list the steps to handle it, "
    "one short line each, naming the order ids. Always look up an order before changing it. "
    "At most 4 lines.\n\nTools you will be able to use:\n" + describe_tools()
)
ACT_SYSTEM = (
    "You are a shop support agent handling a customer request with tools. "
    "Do one tool call at a time. Always look up an order with get_order before changing it. "
    "If a tool says ok=false, read its message and do not repeat the same call. "
    "As soon as the results show the request is handled, reply DONE.\n\n"
    "Tools:\n" + describe_tools() + "\n\n"
    "Reply in exactly this format:\n"
    "ACTION: <tool name>\n"
    'ARGS: <JSON object, e.g. {"order_id": "O101"}>\n'
    "or, when the request has been fully handled:\n"
    "DONE: <one sentence telling the customer what was done>"
)


def parse_args(raw: str | None) -> dict | None:
    """The ARGS line as a dict. Small models drop quotes or add text; None if hopeless."""
    if not raw:
        return {}
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    text = match.group() if match else raw
    try:
        value = json.loads(text)
        return value if isinstance(value, dict) else None
    except json.JSONDecodeError:
        pass
    out: dict[str, Any] = {}
    for key, val in _KEY_VALUE.findall(text):
        val = val.strip("\"'")
        try:
            out[key] = json.loads(val)
        except json.JSONDecodeError:
            out[key] = val
    return out or None


def _format_history(history: list[dict]) -> str:
    if not history:
        return "(nothing done yet)"
    return "\n".join(
        f"{i + 1}. {h['tool']}({json.dumps(h['args'])}) -> {clip(json.dumps(h['result']), 260)}"
        for i, h in enumerate(history)
    )


def check_ops(answer: Any, expected: Any) -> Outcome:
    """Pass when the database the agent left equals the correct one."""
    db = answer.get("db") if isinstance(answer, dict) else None
    got = {k: db.get(k) for k in ("orders", "stock", "refunds")} if isinstance(db, dict) else None
    ok = got is not None and got == expected
    return Outcome(success=ok, score=float(ok), final_answer=answer, expected=expected, checker="ops_state")


register_checker("ops", check_ops)


@register_agent
class ShopAgent(Agent):
    name, version, family, entry = "shop_agent", "v1", "ops", "plan"

    def init_state(self, task: Task) -> dict:
        return {"request": task.input["request"], "db": task.input["db"], "history": [], "turns": 0}

    def tool_caller(self, task: Task):
        return call_tool

    def plan(self, ctx: RunContext) -> str:
        res = ctx.llm(ctx.model_id, [
            {"role": "system", "content": PLAN_SYSTEM},
            {"role": "user", "content": f"Customer request: {ctx.state['request']}"},
        ], max_tokens=120)
        ctx.state["plan"] = clip(res.text, 500)
        return "act"

    def act(self, ctx: RunContext) -> str:
        history, turns = ctx.state["history"], ctx.state["turns"]
        res = ctx.llm(ctx.model_id, [
            {"role": "system", "content": ACT_SYSTEM},
            {"role": "user", "content": (
                f"Customer request: {ctx.state['request']}\n\nPlan:\n{ctx.state['plan']}\n\n"
                f"Done so far:\n{_format_history(history)}"
            )},
        ], max_tokens=96)
        ctx.state["turns"] = turns + 1
        # a model that writes several calls at once means the first one next
        action = field(res.text, "ACTION", first=True)
        proposed = None if action is None else {
            "tool": action.split("(")[0].strip(), "args": parse_args(field(res.text, "ARGS", first=True))}
        repeated = bool(history) and proposed is not None and (
            (proposed["tool"], proposed["args"]) == (history[-1]["tool"], history[-1]["args"]))
        if proposed is None or len(history) >= MAX_ACTIONS or turns + 1 >= MAX_TURNS:
            ctx.state["reply"] = field(res.text, "DONE") or clip(res.text, 200)
            return "answer"
        if repeated:
            # small models re-issue the call they just made; say so instead of paying for it again
            ctx.state["history"] = history + [{**proposed, "result": {
                "ok": False, "message": "this exact call was just made; do the next step or reply DONE"}}]
            return "act"
        ctx.state["action"] = proposed
        return "call"

    def call(self, ctx: RunContext) -> str:
        action, db = ctx.state["action"], ctx.state["db"]
        tool_name, args = action["tool"], action["args"]
        if args is None:
            result: Any = {"ok": False, "message": "ARGS was not a JSON object"}
            args = {}
        else:
            try:
                result = ctx.tool(tool_name, **{**args, "db": db})
            except ToolError as exc:
                result = {"ok": False, "message": clip(str(exc), 160)}  # recorded on the step
            except TypeError as exc:  # an argument name that is not a valid keyword
                result = {"ok": False, "message": clip(str(exc), 160)}
        if not isinstance(result, dict):
            result = {"ok": False, "message": "the tool returned nothing"}
        if result.get("ok") and isinstance(result.get("db"), dict):
            ctx.state["db"] = result["db"]
        shown = {k: v for k, v in result.items() if k != "db"}  # the model sees the report, not the database
        ctx.state["history"] = ctx.state["history"] + [{"tool": tool_name, "args": args, "result": shown}]
        return "act"

    def answer(self, ctx: RunContext) -> None:
        ctx.final({"reply": ctx.state["reply"], "db": ctx.state["db"]})
        return None

    nodes = {"plan": plan, "act": act, "call": call, "answer": answer}
