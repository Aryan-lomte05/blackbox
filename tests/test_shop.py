"""Shop agent, its mock API, the generated tasks and the final-state checker."""

from __future__ import annotations

import copy
import json
from collections import Counter

import pytest

from blackbox.agents.base import get_agent, run_task
from blackbox.agents.shop import MAX_ACTIONS, ShopAgent, check_ops, describe_tools, parse_args
from blackbox.agents.tools import call_tool
from blackbox.core.schema import Change
from blackbox.data.farm import farm_task
from blackbox.data.tasks import load_tasks
from blackbox.data.tasks.ops_tasks import KINDS, N_TASKS, apply_actions, expected_state, make_task
from blackbox.faults.catalog import TRAIN_FAULTS
from blackbox.recorder import providers
from blackbox.recorder.providers import LLMResult
from blackbox.replay.engine import fork, replay

DB = {
    "orders": {
        "O1": {"customer": "Asha", "item": "mug", "qty": 2, "status": "placed", "paid": 16},
        "O2": {"customer": "Chen", "item": "mug", "qty": 3, "status": "delivered", "paid": 24},
        "O3": {"customer": "Ivan", "item": "lamp", "qty": 1, "status": "shipped", "paid": 25},
    },
    "stock": {"mug": 4, "lamp": 0},
    "prices": {"mug": 8, "lamp": 25},
    "refunds": [],
}
CALLS: list[str] = []


def _reply(text: str) -> LLMResult:
    return LLMResult(text, [], "stop", 30, 10, "fake", "fake-1")


def scripted(actions: list[tuple[str, dict]]):
    """A model that looks the order up, then does `actions` in order, then says DONE."""
    steps = [("get_order", {"order_id": actions[0][1]["order_id"]}), *actions]

    def model(messages, tools, params) -> LLMResult:
        system, user = messages[0]["content"], messages[-1]["content"]
        CALLS.append(user)
        if "list the steps" in system:
            return _reply("look the order up, then do what was asked")
        done = 0 if "(nothing done yet)" in user else len(user.split("Done so far:", 1)[1].strip().splitlines())
        if done >= len(steps):
            return _reply("DONE: all handled")
        name, args = steps[done]
        return _reply(f"ACTION: {name}\nARGS: {json.dumps(args)}")

    return model


@pytest.fixture(autouse=True)
def _clean():
    CALLS.clear()
    yield
    providers.clear_fakes()


def run_scripted(task, actions=None):
    providers.register_fake("fake-shop", scripted(actions or [tuple(a) for a in task.meta["actions"]]))
    return run_task(ShopAgent(), task, "fake-shop")


# ---- the mock API, through the registry -----------------------------------------
def test_lookups_change_nothing():
    got = call_tool("get_order", {"db": DB, "order_id": "O2"})
    assert got == {"ok": True, "order": {"order_id": "O2", **DB["orders"]["O2"]}, "unit_price": 8, "refunded": 0}
    assert call_tool("check_stock", {"db": DB, "item": "mug"}) == {
        "ok": True, "item": "mug", "in_stock": 4, "unit_price": 8}
    assert call_tool("get_order", {"db": DB, "order_id": "O9"}) == {"ok": False, "message": "no order O9"}
    assert call_tool("check_stock", {"db": DB, "item": "sofa"})["ok"] is False


def test_cancel_puts_units_back_and_never_mutates_its_input():
    before = copy.deepcopy(DB)
    out = call_tool("cancel_order", {"db": DB, "order_id": "O1"})
    assert DB == before
    assert out["ok"] and out["db"]["orders"]["O1"]["status"] == "cancelled" and out["db"]["stock"]["mug"] == 6
    assert call_tool("cancel_order", {"db": DB, "order_id": "O2"})["ok"] is False  # already delivered
    assert "db" not in call_tool("cancel_order", {"db": DB, "order_id": "O2"})


def test_ship_and_update_quantity_rules():
    assert call_tool("ship_order", {"db": DB, "order_id": "O1"})["db"]["orders"]["O1"]["status"] == "shipped"
    assert call_tool("ship_order", {"db": DB, "order_id": "O3"})["ok"] is False

    more = call_tool("update_quantity", {"db": DB, "order_id": "O1", "quantity": 5})["db"]
    assert more["orders"]["O1"] == {**DB["orders"]["O1"], "qty": 5, "paid": 40} and more["stock"]["mug"] == 1
    fewer = call_tool("update_quantity", {"db": DB, "order_id": "O1", "quantity": "1"})["db"]
    assert fewer["orders"]["O1"]["qty"] == 1 and fewer["stock"]["mug"] == 5
    assert "in stock" in call_tool("update_quantity", {"db": DB, "order_id": "O1", "quantity": 7})["message"]
    for bad in (0, 2.5, "many"):
        assert call_tool("update_quantity", {"db": DB, "order_id": "O1", "quantity": bad})["ok"] is False
    assert call_tool("update_quantity", {"db": DB, "order_id": "O2", "quantity": 1})["ok"] is False


def test_refund_rules():
    part = call_tool("refund_order", {"db": DB, "order_id": "O2", "amount": 8.0})["db"]
    assert part["refunds"] == [{"order_id": "O2", "amount": 8}]  # 8.0 and 8 are the same refund
    assert part["orders"]["O2"]["status"] == "partially_refunded"
    assert call_tool("refund_order", {"db": part, "order_id": "O2", "amount": 20})["message"].startswith("only 16")
    full = call_tool("refund_order", {"db": part, "order_id": "O2", "amount": 16})["db"]
    assert full["orders"]["O2"]["status"] == "refunded" and len(full["refunds"]) == 2
    assert call_tool("refund_order", {"db": full, "order_id": "O2", "amount": 1})["ok"] is False
    assert call_tool("refund_order", {"db": DB, "order_id": "O1", "amount": 16})["ok"] is False  # not delivered
    for bad in (0, -5, "all of it", None):
        assert call_tool("refund_order", {"db": DB, "order_id": "O2", "amount": bad})["ok"] is False


def test_tool_list_shown_to_the_model_hides_the_database():
    text = describe_tools()
    assert "refund_order(order_id: string, amount: number)" in text and "db" not in text
    assert text.count("\n") == 5  # six shop tools, and none of the math tools


# ---- generated tasks --------------------------------------------------------------
def test_tasks_are_deterministic_solvable_and_cover_every_kind():
    tasks = load_tasks("ops")
    assert len(tasks) == N_TASKS == 200 and len({t.task_id for t in tasks}) == 200
    assert set(Counter(t.meta["kind"] for t in tasks)) == set(KINDS)
    assert [t.expected for t in load_tasks("ops", 30)] == [t.expected for t in tasks[:30]]
    assert [t.task_id for t in load_tasks("ops", 3, offset=198)] == ["ops-0198", "ops-0199"]
    for t in tasks:
        assert t.family == "ops" and set(t.input) == {"request", "db"}
        start = expected_state(t.input["db"])
        assert t.expected != start  # every task needs a change
        assert expected_state(apply_actions(t.input["db"], [tuple(a) for a in t.meta["actions"]])) == t.expected
        assert all(a[1]["order_id"] in t.input["request"] for a in t.meta["actions"])


def test_an_impossible_action_is_a_generator_error_not_a_task():
    with pytest.raises(ValueError, match="not solvable"):
        apply_actions(DB, [("cancel_order", {"order_id": "O2"})])


# ---- checker ------------------------------------------------------------------------
def test_checker_compares_the_final_database():
    task = make_task(0)
    assert check_ops({"reply": "done", "db": {**task.expected, "prices": {}}}, task.expected).success
    assert check_ops({"reply": "done", "db": task.input["db"]}, task.expected).success is False
    for junk in (None, "cancelled it", {"reply": "ok"}, {"db": None}):
        out = check_ops(junk, task.expected)
        assert out.success is False and out.checker == "ops_state"


# ---- agent ----------------------------------------------------------------------------
@pytest.mark.parametrize("index", range(len(KINDS)))
def test_shop_agent_solves_each_kind_and_replays_for_free(index):
    task = make_task(index)
    tr = run_scripted(task)
    assert tr.run.status == "done", tr.run.error
    assert tr.run.outcome.success, (task.meta, tr.run.outcome.final_answer)
    assert tr.steps[0].node == "plan" and tr.steps[-1].kind == "final" and 5 <= len(tr.steps) <= 15
    assert all(s.name in ("get_order", "cancel_order", "ship_order", "refund_order", "update_quantity")
               for s in tr.steps if s.kind == "tool")
    CALLS.clear()
    again = replay(tr)
    assert again.run.status == "done", again.run.error
    assert CALLS == [] and all(s.cached for s in again.steps if s.kind != "final")


def test_the_model_sees_tool_reports_but_never_the_database():
    tr = run_scripted(make_task(0))
    assert tr.run.outcome.success
    assert any("cancelled" in call for call in CALLS)  # the report reached the model
    assert not any('"db"' in call or '"orders"' in call for call in CALLS)
    tool = next(s for s in tr.steps if s.name == "cancel_order")
    assert "db" in tool.request["args"] and "db" in tool.output["result"]  # the tool itself gets and returns it


def test_wrong_action_fails_the_task_without_crashing():
    task = make_task(5)  # ship
    oid = task.meta["actions"][0][1]["order_id"]
    tr = run_scripted(task, [("cancel_order", {"order_id": oid})])
    assert tr.run.status == "done" and tr.run.outcome.success is False


def test_a_tool_that_returns_nothing_leaves_the_database_alone():
    task = make_task(0)  # cancel
    tr = run_scripted(task)
    idx = next(s.idx for s in tr.steps if s.name == "cancel_order")
    child = fork(tr, idx, Change(kind="output", value={"result": None}))
    assert child.run.status == "done", child.run.error
    assert child.run.outcome.success is False
    assert child.run.outcome.final_answer["db"]["orders"] == task.input["db"]["orders"]


def test_unknown_tool_bad_args_and_unparseable_args_are_reported_to_the_model():
    replies = iter([
        "plan",
        "ACTION: delete_everything\nARGS: {}",
        'ACTION: cancel_order\nARGS: {"order_id": "O1", "reason": "x"}',
        "ACTION: get_order\nARGS: order one please",
        "DONE: gave up",
    ])
    providers.register_fake("fake-shop", lambda m, t, p: _reply(next(replies)))
    tr = run_task(ShopAgent(), make_task(0), "fake-shop")
    assert tr.run.status == "done", tr.run.error
    tools = [s for s in tr.steps if s.kind == "tool"]
    assert [s.name for s in tools] == ["delete_everything", "cancel_order"]  # the unparseable call was never made
    assert "No tool named" in tools[0].error and "does not take ['reason']" in tools[1].error
    assert tr.run.outcome.success is False


def test_several_calls_in_one_reply_means_the_first_one():
    task = make_task(0)
    oid = task.meta["actions"][0][1]["order_id"]
    both = (f'ACTION: get_order\nARGS: {{"order_id": "{oid}"}}\n'
            f'ACTION: cancel_order\nARGS: {{"order_id": "{oid}"}}')
    replies = iter(["plan", both, "DONE: ok"])
    providers.register_fake("fake-shop", lambda m, t, p: _reply(next(replies)))
    tr = run_task(ShopAgent(), task, "fake-shop")
    assert [s.name for s in tr.steps if s.kind == "tool"] == ["get_order"]


def test_a_repeated_call_is_noted_not_paid_for_and_runs_stay_within_fifteen_steps():
    task = make_task(0)
    oid = task.meta["actions"][0][1]["order_id"]
    same = f'ACTION: get_order\nARGS: {{"order_id": "{oid}"}}'
    providers.register_fake("fake-shop", lambda m, t, p: _reply(same))
    tr = run_task(ShopAgent(), task, "fake-shop")
    assert tr.run.status == "done", tr.run.error
    assert sum(s.kind == "tool" for s in tr.steps) == 1  # asked seven times, called once
    assert "this exact call was just made" in tr.steps[-2].request["messages"][-1]["content"]
    assert len(tr.steps) <= 15

    counter = iter(range(100))
    providers.register_fake("fake-shop",
                            lambda m, t, p: _reply(f'ACTION: check_stock\nARGS: {{"item": "x{next(counter)}"}}'))
    busy = run_task(ShopAgent(), task, "fake-shop")
    assert busy.run.status == "done" and len(busy.steps) <= 15
    assert sum(s.kind == "tool" for s in busy.steps) == MAX_ACTIONS


def test_parse_args():
    assert parse_args('{"order_id": "O101", "amount": 40}') == {"order_id": "O101", "amount": 40}
    assert parse_args('here: {"order_id": "O101"} thanks') == {"order_id": "O101"}
    assert parse_args("{order_id: O101, quantity: 3}") == {"order_id": "O101", "quantity": 3}
    assert parse_args(None) == {} and parse_args("") == {}
    assert parse_args("order one please") is None and parse_args("[1, 2]") is None


# ---- farm -------------------------------------------------------------------------------
def test_farm_handles_shop_tasks_and_puts_them_in_the_new_task_split():
    task = make_task(1)  # cancel + refund: two changing tool steps
    providers.register_fake("fake-shop", scripted([tuple(a) for a in task.meta["actions"]]))
    traces = farm_task(task, "fake-shop", store=None, n_forks=3, fault_types=TRAIN_FAULTS, seed=0)
    clean, forks = traces[0], traces[1:]
    assert clean.run.agent == "shop_agent@v1" and clean.run.outcome.success
    assert len(forks) == 3 and all(f.run.status == "done" for f in forks), [f.run.error for f in forks]
    assert {t.run.split for t in traces} == {"test_new_tasks"}
    assert isinstance(get_agent("shop_agent@v1"), ShopAgent)
