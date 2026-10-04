"""Failure fingerprints: similar past failures, novelty, known fixes."""

from __future__ import annotations

import pytest

from blackbox.agents.base import run_task
from blackbox.core.schema import Change, Label
from blackbox.diagnosis.fingerprint import fingerprint, save_fleet_report, similar
from blackbox.recorder import providers
from blackbox.replay.engine import fork
from tests.test_core_replay import DOCS, ToyAgent, _task, fake_model, store  # noqa: F401 (fixture)


@pytest.fixture(autouse=True)
def _fake():
    providers.register_fake("fake-model", fake_model)
    yield
    providers.clear_fakes()


def _labelled(store, trace, step):  # noqa: F811
    trace.run.label = Label(root_cause_step=step, source="injected")
    store.save_trace(trace)
    return trace


def _failures(store):  # noqa: F811
    good = run_task(ToyAgent(), _task(), "fake-model", store=store)
    wrong_doc = _labelled(store, fork(good, 1, Change(kind="output", value={"docs": DOCS["japan"]}), store=store), 1)
    no_doc = _labelled(store, fork(good, 1, Change(kind="output", value={"docs": []}), store=store), 1)
    bad_plan = _labelled(store, fork(good, 0, Change(kind="output", value={"text": "search: nowhere"}), store=store), 0)
    return good, wrong_doc, no_doc, bad_plan


def test_fingerprint_describes_where_and_how_it_failed(store):  # noqa: F811
    _, wrong_doc, no_doc, _ = _failures(store)
    fp = fingerprint(no_doc, 1)
    assert {"cause:retrieval", "cause_name:search", "signal:empty_result", "spread:reaches_answer"} <= set(fp["tokens"])
    assert fp["id"].startswith("FP-") and fingerprint(no_doc, 1)["id"] == fp["id"]  # stable
    assert "signal:empty_result" not in fingerprint(wrong_doc, 1)["tokens"]


def test_look_alike_failures_are_found_and_a_new_kind_is_novel(store):  # noqa: F811
    _, wrong_doc, no_doc, bad_plan = _failures(store)
    rep = similar(store, wrong_doc)
    assert rep["closest"][0]["run_id"] == no_doc.run.run_id and not rep["novel"]
    assert rep["library_size"] == 2  # only failed runs: the toy agent searches by country, so bad_plan passed
    # the library holds only search failures: a cause at the plan (an llm step, at the start) is a new kind
    assert similar(store, bad_plan)["novel"]


def test_an_approved_fleet_fix_is_offered_for_look_alike_failures(store):  # noqa: F811
    _, wrong_doc, no_doc, _ = _failures(store)
    report = {"change": {"instruction": "Search again if the paragraph is about another country.", "model": None},
              "decision": "APPROVE", "counts": {"fixed": 3}, "failures_tested": 4}
    save_fleet_report(store, report, wrong_doc)
    fixes = similar(store, no_doc)["known_fixes"]
    assert fixes and fixes[0]["rule"].startswith("Search again") and fixes[0]["fixed"] == 3
