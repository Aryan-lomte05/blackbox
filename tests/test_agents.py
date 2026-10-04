"""QA and Math agents record end to end and replay with zero model calls.

The replay check is the proof that an agent touches the world only through
ctx: anything else (randomness, time, I/O) raises ReplayDivergence.
"""

from __future__ import annotations

import pytest

from blackbox.agents.base import Task, get_agent, run_task
from blackbox.agents.math_agent import MAX_CALCS, MathAgent
from blackbox.agents.qa import MAX_HOPS, QAAgent
from blackbox.core.schema import Change
from blackbox.recorder import providers
from blackbox.recorder.providers import LLMResult
from blackbox.replay.engine import fork, replay

CALLS: list[str] = []

PARAGRAPHS = [
    {"title": "Ed Wood (film)", "text": "Ed Wood is a 1994 biographical film directed by Tim Burton."},
    {"title": "Scott Derrickson", "text": "Scott Derrickson (born July 16, 1966) is an American director."},
    {"title": "Woodson, Arkansas", "text": "Woodson is a census-designated place in Pulaski County."},
    {"title": "Ed Wood", "text": "Edward Davis Wood Jr. (1924-1978) was an American filmmaker and actor."},
    {"title": "Doctor Strange", "text": "Doctor Strange is a 2016 superhero film directed by Scott Derrickson."},
]


def _reply(text: str) -> LLMResult:
    return LLMResult(text, [], "stop", 20, 8, "fake", "fake-1")


def fake_qa(messages, tools, params) -> LLMResult:
    system, user = messages[0]["content"], messages[-1]["content"]
    CALLS.append(user)
    if system.startswith("You plan searches"):
        return _reply("SEARCH: Scott Derrickson nationality")
    if system.startswith("You are answering"):
        new = user.split("New paragraphs:", 1)[1]
        if "Notes so far:\n(none yet)" in user:
            fact = "Scott Derrickson is American" if "Scott Derrickson (born" in new else "nothing useful"
            return _reply(f"NOTE: {fact}\nNEXT: SEARCH Ed Wood filmmaker")
        fact = "Ed Wood was American" if "Edward Davis Wood" in new else "nothing useful"
        return _reply(f"NOTE: {fact}\nNEXT: ANSWER")
    notes = user.split("Notes:", 1)[1]
    both = "Scott Derrickson is American" in notes and "Ed Wood was American" in notes
    return _reply("ANSWER: yes" if both else "ANSWER: unknown")


def fake_math(messages, tools, params) -> LLMResult:
    system, user = messages[0]["content"], messages[-1]["content"]
    CALLS.append(user)
    if system.startswith("You plan how"):
        return _reply("1. eggs left after eating and baking\n2. money from selling them")
    last_line = user.strip().splitlines()[-1]
    last = last_line.rsplit("=", 1)[1].strip() if "=" in last_line else None  # None: no result to read
    if system.startswith("You solve"):
        if last is None:
            return _reply("CALC: 16 - 3 - 4")
        if "2." not in user.split("Results so far:", 1)[1]:
            return _reply(f"CALC: {last} * 2")
        return _reply("DONE")
    return _reply(f"FINAL: {last}" if last is not None else "FINAL: unknown")


def qa_task() -> Task:
    return Task("qa", "qa-test", {"question": "Were Scott Derrickson and Ed Wood of the same nationality?",
                                  "paragraphs": PARAGRAPHS},
                expected={"answer": "yes", "supporting_titles": ["Ed Wood", "Scott Derrickson"]})


def math_task() -> Task:
    return Task("math", "math-test", {"question": "Janet's ducks lay 16 eggs. She eats 3 and bakes 4, "
                                                  "then sells the rest for $2 each. How much does she make?"},
                expected="18")


@pytest.fixture(autouse=True)
def _fakes():
    providers.register_fake("fake-qa", fake_qa)
    providers.register_fake("fake-math", fake_math)
    CALLS.clear()
    yield
    providers.clear_fakes()


# ---- QA -----------------------------------------------------------------------
def test_qa_agent_records_end_to_end():
    tr = run_task(QAAgent(), qa_task(), "fake-qa")
    assert tr.run.status == "done", tr.run.error
    assert tr.run.outcome.success and tr.run.outcome.final_answer == "yes"
    assert [s.kind for s in tr.steps] == ["llm", "retrieval", "llm", "retrieval", "llm", "llm", "final"]
    assert [s.node for s in tr.steps] == ["plan", "search", "read", "search", "read", "answer", "answer"]
    assert 6 <= len(tr.steps) <= 15
    # the second search must not bring back paragraphs already read
    first, second = tr.steps[1].output["docs"], tr.steps[3].output["docs"]
    assert not {d["id"] for d in first} & {d["id"] for d in second}
    # data-flow: the answer step used the notes written by the last read step
    assert 4 in tr.steps[5].parents


def test_qa_agent_replays_with_zero_model_calls():
    tr = run_task(QAAgent(), qa_task(), "fake-qa")
    CALLS.clear()
    again = replay(tr)
    assert again.run.status == "done", again.run.error
    assert CALLS == [] and all(s.cached for s in again.steps if s.kind != "final")
    assert again.run.outcome.final_answer == "yes"


def test_qa_agent_fails_when_a_search_is_emptied_and_survives_a_broken_one():
    tr = run_task(QAAgent(), qa_task(), "fake-qa")
    child = fork(tr, 1, Change(kind="output", value={"docs": []}))
    assert child.run.status == "done", child.run.error
    assert child.run.outcome.success is False  # a task failure, not a crash
    junk = fork(tr, 1, Change(kind="output", value={"docs": None}))
    assert junk.run.status == "done", junk.run.error


def test_qa_agent_stops_after_max_hops():
    providers.register_fake("fake-qa", lambda m, t, p: _reply("NOTE: nothing useful\nNEXT: SEARCH wood"))
    tr = run_task(QAAgent(), qa_task(), "fake-qa")
    assert tr.run.status == "done", tr.run.error
    assert sum(s.kind == "retrieval" for s in tr.steps) == MAX_HOPS


# ---- Math ---------------------------------------------------------------------
def test_math_agent_records_end_to_end():
    tr = run_task(MathAgent(), math_task(), "fake-math")
    assert tr.run.status == "done", tr.run.error
    assert tr.run.outcome.success and tr.run.outcome.final_answer == "18"
    assert [s.kind for s in tr.steps] == ["llm", "llm", "tool", "llm", "tool", "llm", "llm", "final"]
    assert [s.output["result"] for s in tr.steps if s.kind == "tool"] == [9, 18]
    assert 6 <= len(tr.steps) <= 15
    assert tr.steps[4].parents == [3]  # the calculator used the expression its step wrote


def test_math_agent_replays_with_zero_model_calls():
    tr = run_task(MathAgent(), math_task(), "fake-math")
    CALLS.clear()
    again = replay(tr)
    assert again.run.status == "done", again.run.error
    assert CALLS == [] and all(s.cached for s in again.steps if s.kind != "final")


def test_math_agent_wrong_tool_value_flips_the_outcome():
    tr = run_task(MathAgent(), math_task(), "fake-math")
    child = fork(tr, 2, Change(kind="output", value={"result": 10}))
    assert child.run.status == "done", child.run.error
    assert child.run.outcome.success is False and child.run.outcome.final_answer == "20"
    assert child.steps[0].cached and child.steps[1].cached and not child.steps[3].cached


def test_math_agent_sees_a_calculator_error_and_carries_on():
    def bad_then_done(messages, tools, params):
        if messages[0]["content"].startswith("You solve"):
            results = messages[-1]["content"].split("Results so far:", 1)[1]
            return _reply("DONE" if "error" in results else "CALC: sixteen minus three")
        return _reply("FINAL: 0")

    providers.register_fake("fake-math", bad_then_done)
    tr = run_task(MathAgent(), math_task(), "fake-math")
    assert tr.run.status == "done", tr.run.error
    tool_step = next(s for s in tr.steps if s.kind == "tool")
    assert tool_step.error and "ValueError" in tool_step.error
    assert tr.run.outcome.success is False


def test_math_agent_never_exceeds_fifteen_steps():
    providers.register_fake("fake-math", lambda m, t, p: _reply("CALC: 1 + 1\nFINAL: 2"))
    tr = run_task(MathAgent(), math_task(), "fake-math")
    assert tr.run.status == "done", tr.run.error
    assert sum(s.kind == "tool" for s in tr.steps) == MAX_CALCS and len(tr.steps) <= 15


def test_agents_are_found_by_name_for_replay():
    assert isinstance(get_agent("qa_agent@v1"), QAAgent)
    assert isinstance(get_agent("math_agent@v1"), MathAgent)
