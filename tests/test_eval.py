"""Evaluation harness: metrics, baselines, LLM judge, Who&When import, report."""

from __future__ import annotations

import json

import pytest

from blackbox.agents.base import run_task
from blackbox.agents.math_agent import MathAgent
from blackbox.core.schema import Label
from blackbox.core.store import Store
from blackbox.data.farm import farm_task
from blackbox.data.importers.who_and_when import to_trace
from blackbox.eval import llm_judge, report
from blackbox.eval.baselines import first_error, last_step
from blackbox.eval.metrics import candidates, expected_random, guilty_step, score
from blackbox.faults.catalog import TRAIN_FAULTS
from blackbox.recorder import providers
from blackbox.recorder.providers import LLMResult
from tests.test_agents import fake_math, math_task


@pytest.fixture(autouse=True)
def _fakes():
    providers.register_fake("fake-math", fake_math)
    yield
    providers.clear_fakes()


def labelled_run(root: int, split: str = "test_known"):
    trace = run_task(MathAgent(), math_task(), "fake-math")
    trace.run.outcome.success = False
    trace.run.label = Label(root_cause_step=root, source="injected")
    trace.run.split = split
    return trace


WW_ROW = {
    "question": "How much did I save?", "question_ID": "abc123", "ground_truth": "$55",
    "history": [{"content": "plan", "role": "assistant", "name": "Planner"},
                {"content": "wrong price", "role": "assistant", "name": "Verification_Expert"},
                {"content": "final", "role": "user"}],
    "mistake_agent": "Verification_Expert", "mistake_step": "1", "mistake_reason": "no price data",
}


# ---- metrics ---------------------------------------------------------------------------
def test_score_on_known_rankings():
    m = score([[2, 5, 1], [0, 1, 2], [4, 3], []], [2, 2, 9, 1])
    assert m["n"] == 4
    assert m["top1"] == 0.25 and m["top3"] == 0.5
    assert m["pm1"] == 0.25  # only the first: 2 is within one of 2; 0 is two away from 2
    assert m["mrr"] == round((1 + 1 / 3 + 0 + 0) / 4, 4)
    assert score([], []) == {"n": 0}
    with pytest.raises(ValueError):
        score([[1]], [1, 2])


def test_bootstrap_interval_brackets_the_mean_and_is_repeatable():
    rankings, roots = [[1]] * 30 + [[0]] * 10, [1] * 40
    a, b = score(rankings, roots), score(rankings, roots)
    assert a == b and a["top1"] == 0.75
    low, high = a["top1_ci95"]
    assert 0.55 < low < 0.75 < high < 0.92
    assert score([[1]], [1])["top1_ci95"] is None  # one run: no interval


def test_candidates_exclude_the_final_step_and_label_must_point_at_a_candidate():
    trace = labelled_run(2)
    assert candidates(trace) == list(range(len(trace.steps) - 1)) and guilty_step(trace) == 2
    trace.run.label = Label(root_cause_step=len(trace.steps) - 1, source="injected")
    assert guilty_step(trace) is None  # the final answer step cannot be blamed
    trace.run.label = None
    assert guilty_step(trace) is None


def test_expected_random_matches_one_over_candidates():
    trace = labelled_run(0)
    n = len(candidates(trace))  # 7
    m = expected_random([trace])
    assert m["top1"] == round(1 / n, 4) and m["top3"] == round(3 / n, 4)
    assert m["pm1"] == round(2 / n, 4)  # steps 0 and 1 are within one of step 0
    middle = expected_random([labelled_run(3)])
    assert middle["pm1"] == round(3 / n, 4)
    assert expected_random([]) == {"n": 0}


# ---- baselines -------------------------------------------------------------------------
def test_baselines_rank_every_candidate_once():
    trace = labelled_run(2)
    assert last_step(trace) == sorted(candidates(trace), reverse=True)
    assert first_error(trace) == candidates(trace)  # no error: plain order
    trace.steps[4].error = "ValueError: boom"
    trace.steps[2].error = "ValueError: earlier"
    assert first_error(trace)[:3] == [2, 4, 0] and sorted(first_error(trace)) == candidates(trace)


# ---- Who&When ----------------------------------------------------------------------------
def test_who_and_when_record_becomes_a_labelled_external_trace():
    trace = to_trace(WW_ROW, "Algorithm-Generated")
    assert trace.run.task_family == "external" and trace.run.split == "test_outside"
    assert trace.run.label.root_cause_step == 1 and trace.run.label.source == "imported"
    assert trace.run.outcome.success is False and trace.run.outcome.expected == "$55"
    assert [s.name for s in trace.steps] == ["Planner", "Verification_Expert", "user"]
    assert trace.steps[1].output == {"text": "wrong price"} and trace.steps[2].parents == [1]
    assert guilty_step(trace) == 1 and candidates(trace) == [0, 1, 2]
    assert to_trace(WW_ROW, "Algorithm-Generated").run.run_id == trace.run.run_id  # stable id: re-import is safe
    assert to_trace(WW_ROW, "Hand-Crafted").run.run_id != trace.run.run_id


@pytest.mark.parametrize("bad", ["7", "-1", None, "step two"])
def test_who_and_when_record_with_an_impossible_step_is_skipped(bad):
    assert to_trace({**WW_ROW, "mistake_step": bad}, "Hand-Crafted") is None


def test_who_and_when_hand_crafted_field_names():
    row = {k: v for k, v in WW_ROW.items() if k != "ground_truth"} | {"groundtruth": "0.2"}
    assert to_trace(row, "Hand-Crafted").run.task_expected == "0.2"


# ---- LLM judge ------------------------------------------------------------------------------
def test_parse_steps_keeps_order_and_drops_impossible_steps():
    assert llm_judge.parse_steps("STEPS: 4, 2, 4, 99\nREASON: x", [0, 1, 2, 3, 4]) == [4, 2]
    assert llm_judge.parse_steps("I think step 3 then 1", [0, 1, 2, 3]) == [3, 1]
    assert llm_judge.parse_steps("no idea", [0, 1]) == []
    assert llm_judge.parse_steps("STEPS: 0, 1, 2, 3", [0, 1, 2, 3]) == [0, 1, 2]


def test_judge_all_at_once_and_cache(tmp_path):
    prompts: list[str] = []

    def judge_model(messages, tools, params):
        prompts.append(messages[-1]["content"])
        return LLMResult("STEPS: 2, 4\nREASON: wrong arithmetic", [], "stop", 50, 10, "fake", "fake-judge")

    providers.register_fake("fake-judge", judge_model)
    trace = labelled_run(2)
    judge = llm_judge.Judge("fake-judge", tmp_path / "cache.json")
    assert judge.rank(trace, "all_at_once") == [2, 4] and judge.calls == 1
    assert judge.rank(trace, "all_at_once") == [2, 4] and judge.calls == 1  # cached
    prompt = prompts[0]
    assert "Step 0 [llm:plan]" in prompt and "calculator(" in prompt and "The run FAILED" in prompt
    assert str(trace.run.task_expected) not in prompt.split("Steps:")[0]  # the expected answer is not shown
    assert f"Step {len(trace.steps) - 1} " not in prompt  # nor is the final step
    judge.save()
    again = llm_judge.Judge("fake-judge", tmp_path / "cache.json")
    assert again.rank(trace, "all_at_once") == [2, 4] and again.calls == 0


def test_judge_step_by_step_stops_at_the_first_yes():
    def judge_model(messages, tools, params):
        return LLMResult("YES" if "Step 3 [" in messages[-1]["content"] else "No.", [], "stop", 5, 1, "fake", "j")

    providers.register_fake("fake-judge", judge_model)
    judge = llm_judge.Judge("fake-judge")
    assert judge.rank(labelled_run(3), "step_by_step") == [3] and judge.calls == 4  # steps 0..3, then stop

    providers.register_fake("fake-judge", lambda m, t, p: LLMResult("NO", [], "stop", 5, 1, "fake", "j"))
    never = llm_judge.Judge("fake-judge")
    assert never.rank(labelled_run(3), "step_by_step") == []  # blamed nothing: a miss, not a guess


def test_judge_bounds_its_cost_on_long_runs():
    long_row = {**WW_ROW, "mistake_step": "30",
                "history": [{"content": "word " * 400, "name": f"agent{i}"} for i in range(60)]}
    trace = to_trace(long_row, "Hand-Crafted")
    prompts: list[str] = []

    def judge_model(messages, tools, params):
        prompts.append(messages[-1]["content"])
        return LLMResult("STEPS: 30", [], "stop", 5, 1, "fake", "j")

    providers.register_fake("fake-judge", judge_model)
    judge = llm_judge.Judge("fake-judge")
    assert judge.rank(trace, "all_at_once") == [30]
    assert "Step 59 [" in prompts[0] and len(prompts[0]) < 2 * llm_judge.RUN_CHARS  # every step, each cut short
    assert judge.rank(trace, "step_by_step") is None and judge.calls == 1  # too long: no prediction, no calls


def test_judge_availability_reports_the_missing_key(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    providers._rings.pop("openrouter", None)
    assert "OPENROUTER_API_KEY is not set" in llm_judge.available("judge-large")
    assert "No model id" in llm_judge.available("no-such-model")
    providers.register_fake("fake-judge", lambda m, t, p: None)
    assert llm_judge.available("agent-local") is None  # Ollama needs no key


# ---- report -----------------------------------------------------------------------------------
@pytest.fixture
def traces():
    out = farm_task(math_task(), "fake-math", store=None, n_forks=4, fault_types=TRAIN_FAULTS, seed=0)
    for t in out:
        t.run.split = "test_known"
    out.append(to_trace(WW_ROW, "Algorithm-Generated"))
    return out


def test_report_tables_and_absent_reasons(traces):
    r = report.build_report(traces)
    labelled = [t for t in traces if guilty_step(t) is not None]
    assert r["data"]["runs"] == len(traces) and r["data"]["labelled_failures"] == len(labelled)
    assert r["data"]["labelled_by_source"]["imported"] == 1 and r["data"]["crashed"] == 0
    known = r["guilty_step"]["test_known"]
    assert known["n_labelled"] == len(labelled) - 1
    assert set(known["methods"]) >= {"random", "last_step", "first_error"}
    assert all(m["n"] == known["n_labelled"] for m in known["methods"].values())
    assert r["guilty_step"]["test_outside"]["n_labelled"] == 1
    assert "external" not in r["health"] and "math" in r["health"]  # imported runs are not ours to health-check
    assert set(r["model_report_card"]) == {"fake-math"}
    assert r["model_report_card"]["fake-math"]["clean_pass_rate"] == 1.0
    assert sum(r["model_report_card"]["fake-math"]["guilty_step_position"].values()) == len(labelled) - 1
    # nothing is invented: tables without data are named with a reason
    for missing in ("llm_judge", "suspect_list", "guilty_step.test_natural", "live_warning", "repair"):
        assert r["absent"][missing]
    assert "guilty_step.test_known" not in r["absent"]
    json.dumps(r)  # serialisable


def test_report_with_judge_limits_how_many_runs_it_judges(traces):
    providers.register_fake("fake-judge", lambda m, t, p: LLMResult("STEPS: 1", [], "stop", 5, 1, "fake", "j"))
    judge = llm_judge.Judge("fake-judge")
    r = report.build_report(traces, judge=judge, judge_limit=1)
    methods = r["guilty_step"]["test_known"]["methods"]
    assert methods["llm_judge_all_at_once"]["n"] == 1 and methods["last_step"]["n"] > 1
    assert "llm_judge" not in r["absent"] and r["judge"]["model_id"] == "fake-judge"
    assert not any(k.startswith("llm_judge") for row in r["guilty_step_top1_by_mistake"].values() for k in row)


def test_main_writes_json_and_markdown(tmp_path, traces):
    store = Store(tmp_path)
    for t in traces:
        store.save_trace(t)
    store.close()
    assert report.main(["--data", str(tmp_path)]) == 0
    data = json.loads((tmp_path / "reports" / "latest.json").read_text(encoding="utf-8"))
    md = (tmp_path / "reports" / "latest.md").read_text(encoding="utf-8")
    assert data["data"]["runs"] == len(traces)
    assert "## Finding the guilty step" in md and "### test_known: does it work?" in md
    assert "## Not in this report" in md and "| random |" in md


def test_main_on_an_empty_store_reports_nothing_rather_than_failing(tmp_path):
    assert report.main(["--data", str(tmp_path)]) == 0
    data = json.loads((tmp_path / "reports" / "latest.json").read_text(encoding="utf-8"))
    assert data["data"]["runs"] == 0 and data["guilty_step"] == {}
    assert "guilty_step.test_known" in data["absent"]
