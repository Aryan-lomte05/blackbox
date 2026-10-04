"""Every tool is called through the registry, the way an agent calls it
(CLAUDE.md review rule 1), and the search is called through ctx.retrieve."""

from __future__ import annotations

from typing import Literal

import pytest

from blackbox.agents.base import Agent, Task, run_task
from blackbox.agents.tools import call_tool, get_tool_schemas
from blackbox.agents.tools.registry import _describe_parameters
from blackbox.agents.tools.search import make_retriever, tokenize

PARAGRAPHS = [
    {"title": "Scott Derrickson", "text": "Scott Derrickson (born July 16, 1966) is an American director."},
    {"title": "Ed Wood", "text": "Edward Davis Wood Jr. was an American filmmaker, actor and writer."},
    {"title": "Woodson, Arkansas", "text": "Woodson is a census-designated place in Pulaski County."},
]


# ---- registry -----------------------------------------------------------------
def test_calculator_through_registry():
    assert call_tool("calculator", {"expression": "(48 / 2) * 3"}) == 72
    assert call_tool("calculator", {"expression": "$1,200 x 3 ="}) == 3600
    assert call_tool("calculator", {"expression": "9 * 2 = 19"}) == 18  # a stated result is ignored
    assert call_tool("calculator", {"expression": "20% * 50"}) == 10
    assert call_tool("calculator", {"expression": "17 % 5"}) == 2
    assert call_tool("calculator", {"expression": "7 / 2"}) == 3.5


@pytest.mark.parametrize("expr", ["__import__('os').system('echo hi')", "open('x')", "a + 1", "", "9 ** 999"])
def test_calculator_rejects_anything_but_arithmetic(expr):
    with pytest.raises(ValueError):
        call_tool("calculator", {"expression": expr})


def test_python_exec_through_registry():
    assert call_tool("python_exec", {"code": "print(sum(range(5)))"}) == "10"


def test_python_exec_reports_errors_and_times_out():
    with pytest.raises(RuntimeError, match="ZeroDivisionError"):
        call_tool("python_exec", {"code": "print(1/0)"})
    with pytest.raises(TimeoutError):
        call_tool("python_exec", {"code": "while True: pass"})


def test_unknown_tool_and_bad_arguments_are_errors_the_agent_can_see():
    with pytest.raises(KeyError, match="No tool named 'calculater'"):
        call_tool("calculater", {"expression": "1+1"})
    with pytest.raises(TypeError, match="does not take"):
        call_tool("calculator", {"expression": "1+1", "precision": 2})
    with pytest.raises(TypeError, match="missing required"):
        call_tool("calculator", {})


def test_schemas_are_derived_from_type_hints():
    schemas = {s["function"]["name"]: s["function"] for s in get_tool_schemas("math")}
    assert set(schemas) == {"calculator", "python_exec"}
    params = schemas["calculator"]["parameters"]
    assert params["required"] == ["expression"]
    assert params["properties"]["expression"]["type"] == "string"
    assert "parentheses" in params["properties"]["expression"]["description"]
    assert get_tool_schemas("no-such-category") == []


def test_schema_keeps_containers_optionals_and_literals():
    def f(values: list[float], mode: Literal["a", "b"], limit: int | None = None, flag: bool = False): ...

    p = _describe_parameters(f)
    assert p["properties"]["values"] == {"type": "array", "items": {"type": "number"}}
    assert p["properties"]["mode"] == {"type": "string", "enum": ["a", "b"]}
    assert p["properties"]["limit"] == {"type": "integer"}
    assert p["required"] == ["values", "mode"]


# ---- search -------------------------------------------------------------------
def test_tokenize_is_case_and_punctuation_insensitive():
    assert tokenize("Inspection Report: (SOP-114-Rev3), v2.5.") == ["inspection", "report", "sop-114-rev3", "v2.5"]


def test_search_ranks_the_matching_paragraph_first():
    search = make_retriever(PARAGRAPHS)
    docs = search("who is scott derrickson?", k=2)
    assert docs[0]["title"] == "Scott Derrickson" and docs[0]["id"] == 0
    assert set(docs[0]) == {"id", "title", "text", "score"}
    assert search("zebra quantum", k=3) == []  # no shared word, no result
    assert search("the of and", k=3) == []  # only stopwords


class _SearchAgent(Agent):
    name, version, family, entry = "search_probe", "v1", "probe", "go"

    def retriever(self, task):
        return make_retriever(task.input["paragraphs"])

    def tool_caller(self, task):
        return call_tool

    def go(self, ctx):
        ctx.state["docs"] = ctx.retrieve("ed wood filmmaker", k=1)
        ctx.state["n"] = ctx.tool("calculator", expression="6 * 7")
        ctx.final(ctx.state["docs"][0]["title"])
        return None

    nodes = {"go": go}


def test_tools_record_as_steps_when_called_through_ctx():
    task = Task("probe", "p1", {"paragraphs": PARAGRAPHS}, expected=None)
    tr = run_task(_SearchAgent(), task, "unused-model")
    assert tr.run.status == "done", tr.run.error
    assert [s.kind for s in tr.steps] == ["retrieval", "tool", "final"]
    assert tr.steps[0].output["docs"][0]["title"] == "Ed Wood"
    assert tr.steps[1].name == "calculator" and tr.steps[1].output == {"result": 42}
