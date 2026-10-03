"""An async 'existing project' agent (AsyncOpenAI-style client + async tool)."""

from __future__ import annotations

import asyncio

import pytest

openai_types = pytest.importorskip("openai.types.chat")

import blackbox  # noqa: E402
from blackbox import Change, Outcome  # noqa: E402

REAL: list[str] = []


class FakeAsyncCompletions:
    async def create(self, *, model, messages, **kw):
        REAL.append(messages[-1]["content"])
        last = messages[-1]["content"]
        text = f"STOCK:{last.split('QTY=')[1]}" if "QTY=" in last else "LOOKUP"
        return openai_types.ChatCompletion.model_validate({
            "id": "x", "object": "chat.completion", "created": 0, "model": model,
            "choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": text}}],
            "usage": {"prompt_tokens": 4, "completion_tokens": 2, "total_tokens": 6},
        })


class FakeAsyncOpenAI:
    base_url = "https://openrouter.ai/api/v1"

    class chat:  # noqa: N801
        completions = FakeAsyncCompletions()


client = blackbox.wrap(FakeAsyncOpenAI())


@blackbox.tool
async def stock(item: str) -> int:
    await asyncio.sleep(0)
    return 3


async def shop_agent(item: str) -> str:
    first = await client.chat.completions.create(model="m", messages=[{"role": "user", "content": item}])
    assert first.choices[0].message.content == "LOOKUP"
    qty = await stock(item)
    final = await client.chat.completions.create(model="m", messages=[{"role": "user", "content": f"QTY={qty}"}])
    return final.choices[0].message.content


def check(a, e):
    return Outcome(success=a == e, score=float(a == e), final_answer=a, expected=e, checker="exact")


def test_async_record_replay_fork(tmp_path):
    blackbox.configure(tmp_path)
    REAL.clear()
    tr = asyncio.run(blackbox.arun(shop_agent, "widget", family="shop", expected="STOCK:3", check=check))
    assert tr.run.status == "done", tr.run.error
    assert tr.run.outcome.success and [s.kind for s in tr.steps] == ["llm", "tool", "llm", "final"]
    assert tr.steps[0].meta["provider"] == "openrouter"

    REAL.clear()
    again = asyncio.run(blackbox.areplay(tr, shop_agent))
    assert again.run.outcome.final_answer == "STOCK:3" and REAL == []

    child = asyncio.run(blackbox.afork(tr, shop_agent, 1, Change(kind="output", value={"result": 0})))
    assert child.run.outcome.final_answer == "STOCK:0" and len(REAL) == 1
