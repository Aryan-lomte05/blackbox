"""Evidence sentences must be true of the recorded step."""

from __future__ import annotations

import pytest

from blackbox.agents.base import run_task
from blackbox.core.schema import Change
from blackbox.diagnosis.evidence import sentences
from blackbox.recorder import providers
from blackbox.replay.engine import fork
from tests.test_core_replay import ToyAgent, _task, fake_model, store  # noqa: F401 (fixture)


@pytest.fixture(autouse=True)
def _fake():
    providers.register_fake("fake-model", fake_model)
    yield
    providers.clear_fakes()


def test_a_search_that_returned_documents_is_not_said_to_have_returned_nothing(store):  # noqa: F811
    """Regression (4 Oct): the check read `result`, but searches store `docs`, so every search step was described
    as "It returned nothing." in the diagnosis evidence."""
    tr = run_task(ToyAgent(), _task(), "fake-model", store=store)
    assert tr.steps[1].kind == "retrieval" and tr.steps[1].output["docs"]
    assert "It returned nothing." not in sentences(tr, 1)


def test_a_search_that_really_returned_nothing_says_so(store):  # noqa: F811
    tr = run_task(ToyAgent(), _task(), "fake-model", store=store)
    empty = fork(tr, 1, Change(kind="output", value={"docs": []}), store=store)
    assert "It returned nothing." in sentences(empty, 1)
