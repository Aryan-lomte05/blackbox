"""An 'existing project' agent, written with no knowledge of Black Box, gets
recording, replay and fork by wrapping its client and decorating its tool."""

from __future__ import annotations

import pytest

openai_types = pytest.importorskip("openai.types.chat")

import blackbox  # noqa: E402
from blackbox import Change, Outcome  # noqa: E402

REAL_CALLS: list[str] = []


class FakeCompletions:
    """Stands in for openai's chat.completions: returns real ChatCompletion objects."""

    def create(self, *, model, messages, **kw):
        REAL_CALLS.append(messages[-1]["content"])
        last = messages[-1]["content"]
        text = f"FORECAST:{last.split('RAIN=')[1]}" if "RAIN=" in last else "CALL_WEATHER"
        return openai_types.ChatCompletion.model_validate({
            "id": "x", "object": "chat.completion", "created": 0, "model": model,
            "choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": text}}],
            "usage": {"prompt_tokens": 7, "completion_tokens": 3, "total_tokens": 10},
        })


class FakeChat:
    completions = FakeCompletions()


class FakeOpenAI:
    base_url = "https://api.groq.com/openai/v1"
    chat = FakeChat()


client = blackbox.wrap(FakeOpenAI())


@blackbox.tool
def get_weather(city: str) -> dict:
    return {"city": city, "rain": False}


def weather_agent(question: str) -> str:  # the user's unchanged agent
    first = client.chat.completions.create(model="llama-3.1-8b-instant",
                                           messages=[{"role": "user", "content": question}])
    assert first.choices[0].message.content == "CALL_WEATHER"
    w = get_weather("Pune")
    second = client.chat.completions.create(model="llama-3.1-8b-instant",
                                            messages=[{"role": "user", "content": f"RAIN={w['rain']}"}])
    return second.choices[0].message.content


def check(answer, expected) -> Outcome:
    return Outcome(success=answer == expected, score=float(answer == expected),
                   final_answer=answer, expected=expected, checker="exact")


@pytest.fixture(autouse=True)
def _store(tmp_path):
    blackbox.configure(tmp_path)
    REAL_CALLS.clear()


def test_unwrapped_use_is_untouched():
    assert weather_agent("Will it rain?") == "FORECAST:False"
    assert len(REAL_CALLS) == 2


def test_run_records_steps_with_tokens_and_provider():
    tr = blackbox.run(weather_agent, "Will it rain?", family="weather", expected="FORECAST:False", check=check)
    assert tr.run.status == "done", tr.run.error
    assert tr.run.outcome.success
    assert [s.kind for s in tr.steps] == ["llm", "tool", "llm", "final"]
    assert tr.steps[0].meta["provider"] == "groq" and tr.steps[0].tokens_in == 7
    assert blackbox.default_store().load_trace(tr.run.run_id).steps == tr.steps


def test_replay_and_fork_on_user_agent():
    tr = blackbox.run(weather_agent, "Will it rain?", family="weather", expected="FORECAST:False", check=check)
    REAL_CALLS.clear()
    again = blackbox.replay(tr)
    assert again.run.outcome.final_answer == "FORECAST:False" and REAL_CALLS == []

    child = blackbox.fork(tr, 1, Change(kind="output", value={"result": {"city": "Pune", "rain": True}}))
    assert child.run.outcome.final_answer == "FORECAST:True" and not child.run.outcome.success
    assert child.steps[0].cached and len(REAL_CALLS) == 1


def test_session_record_only():
    with blackbox.session("s1") as s:
        client.chat.completions.create(model="m", messages=[{"role": "user", "content": "hi"}])
        s.final("done")
    assert [st.kind for st in s.trace.steps] == ["llm", "final"]
    assert s.trace.run.outcome is None  # no checker registered for 'app': no invented verdict


def test_wrapped_agent_gets_content_based_links():
    """Wrap mode sees calls, not memory: links are inferred from content (an earlier
    step's output appearing in a later request)."""
    tr = blackbox.run(weather_agent, "Will it rain?", family="weather", expected="FORECAST:False", check=check)
    llm2 = tr.steps[2]  # its prompt carries the tool's result (RAIN=False)
    assert 1 in llm2.parents and llm2.meta.get("parents_inferred") == "content"
