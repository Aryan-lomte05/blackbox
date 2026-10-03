"""Verify, Autopilot and Repair on a tiny agent whose weak model gets the answer wrong."""

from __future__ import annotations

import json

import pytest

from blackbox.agents.base import Agent, Task, register_agent, register_checker, run_task
from blackbox.core.schema import Outcome
from blackbox.core.store import Store
from blackbox.recorder import providers
from blackbox.recorder.providers import LLMResult
from blackbox.replay.autopilot import Autopilot
from blackbox.replay.repair import repair
from blackbox.replay.verify import label_from_verification, suspects_by_position, verify

CALLS: list[str] = []


def model(answer: str):
    def fn(messages, tools, params):
        CALLS.append(answer)
        rules = " ".join(m["content"] for m in messages if m["role"] == "system")
        text = "Paris" if "capital city" in rules else answer
        return LLMResult(text, [], "stop", 5, 2, "fake", answer)
    return fn


@register_agent
class CapitalAgent(Agent):
    """plan (model) -> look (tool) -> answer."""
    name, version, family, entry = "capital_agent", "v1", "capital", "think"

    def init_state(self, task):
        return {"q": task.input["q"]}

    def tool_caller(self, task):
        return lambda name, args: {"echo": args["x"]}

    def think(self, ctx):
        ctx.state["guess"] = ctx.llm(ctx.model_id, [{"role": "user", "content": ctx.state["q"]}]).text
        return "look"

    def look(self, ctx):
        ctx.state["checked"] = ctx.tool("echo", x=ctx.state["guess"])["echo"]
        return "answer"

    def answer(self, ctx):
        ctx.final(ctx.state["checked"])
        return None

    nodes = {"think": think, "look": look, "answer": answer}


register_checker("capital", lambda a, e: Outcome(success=a == e, score=float(a == e), final_answer=a,
                                                  expected=e, checker="exact"))


@pytest.fixture(autouse=True)
def fakes(tmp_path):
    providers.register_fake("agent-weak", model("Lyon"))
    providers.register_fake("agent-strong", model("Paris"))
    CALLS.clear()
    yield
    providers.clear_fakes()


TASK = Task("capital", "cap-fr", {"q": "Capital of France?"}, expected="Paris")


def test_verify_proves_the_model_step_and_labels_it(tmp_path):
    store = Store(tmp_path)
    tr = run_task(CapitalAgent(), TASK, "agent-weak", store=store)
    assert not tr.run.outcome.success
    report = verify(tr, [1, 0], store=store, repeats=2)
    s1 = report["suspects"][0]  # every suspect is tested; the earliest verified cause wins
    assert s1["step"] == 1 and s1["verdict"] == "verified" and s1["causal_effect"] == 1.0
    assert report["verified_step"] == 0  # the tool step was a symptom; the model decision is the cause
    label = label_from_verification(tr, report, store)
    assert label.root_cause_step == 0 and store.load_trace(tr.run.run_id).run.label.source == "verified"


def test_verify_detects_bad_luck(tmp_path):
    store = Store(tmp_path)
    flip = iter(["Lyon", "Paris", "Paris", "Paris"])
    providers.register_fake("agent-flaky", lambda m, t, p: LLMResult(next(flip), [], "stop", 1, 1, "fake", "x"))
    tr = run_task(CapitalAgent(), TASK, "agent-flaky", store=store)
    report = verify(tr, [0], store=store, strong_model="agent-flaky", repeats=2)
    assert report["suspects"][0]["flaky"] and report["verified_step"] is None


def test_autopilot_rescues_the_run_before_it_answers(tmp_path):
    store = Store(tmp_path)

    def check(step, run, prior):
        bad = step.kind == "llm" and step.output["text"] == "Lyon"
        return {"answers": {"on_track": {"type": "noul", "noul": 0.05 if bad else 0.95, "confidence": 0.9}},
                "tier": "test"}

    tr = run_task(CapitalAgent(), TASK, "agent-weak", store=store, autopilot=Autopilot(check=check))
    assert tr.run.outcome.success and tr.run.outcome.final_answer == "Paris"
    rescue = tr.run.stats["autopilot_rescue"]
    assert rescue["flagged_step"] == 0 and rescue["rewound_to"] == 0
    original = store.load_trace(rescue["from_run"])
    assert original.run.status == "rewound"
    assert all(s.kind != "final" for s in original.steps)  # stopped before any answer was given


def test_repair_cards_are_tested_by_fork(tmp_path):
    store = Store(tmp_path)
    tr = run_task(CapitalAgent(), TASK, "agent-weak", store=store)
    proposals = {"candidates": [
        {"fix": "args", "value": {"x": "Paris"}, "rationale": "not a tool step -> rejected"},
        {"fix": "add_rule", "value": "Answer with the capital city.", "rationale": "be specific"},
    ]}
    providers.register_fake("judge-large", lambda m, t, p: LLMResult(json.dumps(proposals), [], "stop", 1, 1, "f", "j"))
    providers.load_registry()  # models list for the prompt
    out = repair(tr, 0, store=store, rounds=1)
    assert len(out["cards"]) == 1 and out["cards"][0]["passed"]
    assert out["best"]["change"]["kind"] == "messages"


def test_suspects_fallback_orders_model_calls_late_first(tmp_path):
    tr = run_task(CapitalAgent(), TASK, "agent-weak", store=Store(tmp_path))
    assert suspects_by_position(tr)[0] == 0


def test_verify_does_not_blame_the_answer_step_by_copying_a_twins_answer(tmp_path):
    """Regression: pasting a passing run's answer into the step that writes the
    answer always 'fixes' the run. That is a symptom, not the root cause."""
    store = Store(tmp_path)
    run_task(CapitalAgent(), TASK, "agent-strong", store=store)          # a passing twin exists
    tr = run_task(CapitalAgent(), TASK, "agent-weak", store=store)       # failed run
    report = verify(tr, [1, 0], store=store, repeats=1)                  # answer-producing step listed first
    s1 = next(s for s in report["suspects"] if s["step"] == 1)
    assert "twin" not in [x["strategy"] for x in s1["strategies"]]
    assert report["verified_step"] == 0                                  # the earliest real cause


def test_rerun_fixing_a_tool_step_is_proof_not_bad_luck(tmp_path):
    """A tool is a deterministic function: if re-running it gives a result that fixes the run,
    the recorded output was wrong (a planted mistake or a transient tool failure). That step
    is the cause. 'Bad luck' only applies to model calls, which can answer differently."""
    from blackbox.core.schema import Change, Label
    from blackbox.replay.engine import fork

    store = Store(tmp_path)
    good = run_task(CapitalAgent(), TASK, "agent-strong", store=store)
    broken = fork(good, 1, Change(kind="output", value={"result": {"echo": "Lyon"}}), store=store)  # planted at the tool
    broken.run.label = Label(root_cause_step=1, source="injected")
    report = verify(broken, [1], store=store, repeats=2)
    s = report["suspects"][0]
    assert s["verdict"] == "verified" and not s["flaky"]
    assert report["verified_step"] == 1



def test_verify_repairs_only_the_suspect_not_everything_after_it(tmp_path):
    """Regression (found in the Live Lab): re-running an earlier, innocent deterministic step must not
    re-execute every later step too. That silently regenerates a later planted mistake, so the
    innocent step looked like the cause. Only steps the repair affects may re-run."""
    from blackbox.core.schema import Change
    from blackbox.replay.engine import fork
    from tests.test_core_replay import ToyAgent, _task, fake_model

    providers.register_fake("fake-model", fake_model)
    store = Store(tmp_path)
    good = run_task(ToyAgent(), _task(), "fake-model", store=store)          # plan, search, tool, answer, final
    broken = fork(good, 3, Change(kind="output", value={"text": "Tokyo"}), store=store)  # planted wrong answer
    assert not broken.run.outcome.success
    report = verify(broken, [1], store=store, repeats=1)                    # the search (step 1) is innocent
    assert report["verified_step"] is None, report["suspects"][0]
