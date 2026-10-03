"""Tests for blackbox/monitor/. All non-live tests need zero real keys or GPU."""
from __future__ import annotations

import json
from unittest.mock import patch

import pytest

from blackbox.core.schema import Run, Step
from blackbox.monitor.cascade import check_step
from blackbox.monitor.state_builder import build_state

# ── helpers ────────────────────────────────────────────────────────────────────

def _run(task_input=None):
    return Run(
        run_id="r1",
        task_family="qa",
        task_id="t1",
        task_input=task_input or {"question": "What year did WWII end?"},
        agent="agent@v1",
        model_id="agent-small",
    )


def _step(idx=0, kind="llm", output=None, parents=None, error=None):
    s = Step(
        run_id="r1",
        idx=idx,
        kind=kind,
        name="agent-small" if kind == "llm" else "tool",
        node="plan",
        request={"messages": [{"role": "user", "content": "go"}]},
        output=output or {"text": "searching…"},
        input_hash="h1",
    )
    if parents:
        s.parents = parents
    if error:
        s.error = error
    return s


def _fake(on_track_prob: float, confidence: float, tier="laya") -> dict:
    return {
        "consistent": {"prob": 0.9, "noul": 0.9, "confidence": confidence},
        "on_track": {"prob": on_track_prob, "noul": on_track_prob, "confidence": confidence},
        "mistake_type": {
            "none": 0.8,
            "wrong_fact": 0.1,
            "wrong_tool_argument": 0.02,
            "wrong_tool_result": 0.02,
            "empty_result": 0.02,
            "misleading_search": 0.01,
            "missed_info": 0.01,
            "wrong_tool": 0.01,
            "lost_memory": 0.0,
            "ignored_instruction": 0.0,
            "answered_too_early": 0.01,
        },
        "mistake_type_confidence": confidence,
        "severity": {
            "harmless": 0.7,
            "minor": 0.2,
            "could_derail": 0.05,
            "will_derail": 0.05,
        },
        "severity_confidence": confidence,
        "tier": tier,
        "latency_ms": 31.0,
    }


# ── state_builder ──────────────────────────────────────────────────────────────

def test_state_contains_task():
    state = build_state(_step(), _run({"question": "WWII end?"}), [])
    assert "WWII" in state and "CURRENT STEP" in state


def test_state_includes_parent():
    parent = _step(idx=0, output={"text": "found 1945"})
    current = _step(idx=1, parents=[0])
    state = build_state(current, _run(), [parent])
    assert "1945" in state and "RELEVANT PRIOR STEPS" in state


def test_state_truncates_long_output():
    s = _step(output={"text": "x" * 3000})
    assert len(build_state(s, _run(), [])) < 6000


def test_state_shows_error():
    s = _step(error="timeout")
    assert "timeout" in build_state(s, _run(), [])


# ── cascade / alarm ────────────────────────────────────────────────────────────

def test_alarm_fires_low_on_track():
    fake = _fake(0.15, 0.92)
    with patch("blackbox.monitor.adapters.laya_adapter.ask", return_value=fake), patch(
        "blackbox.monitor.adapters.laya_adapter.overall_confidence", return_value=0.92
    ):
        r = check_step(_step(idx=3), _run(), [])
    assert r is not None
    assert r["alarm"] is True
    assert r["alarm_lead_step"] == 3
    assert r["tier"] == "laya"


def test_no_alarm_high_on_track():
    fake = _fake(0.92, 0.95)
    with patch("blackbox.monitor.adapters.laya_adapter.ask", return_value=fake), patch(
        "blackbox.monitor.adapters.laya_adapter.overall_confidence", return_value=0.95
    ):
        r = check_step(_step(), _run(), [])
    assert r is not None
    assert r["alarm"] is False


def test_final_step_returns_none():
    assert check_step(_step(kind="final"), _run(), []) is None


def test_all_tiers_fail_returns_none():
    with patch("blackbox.monitor.adapters.laya_adapter.ask", side_effect=Exception("down")), patch(
        "blackbox.monitor.adapters.jev_adapter.is_available", return_value=False
    ), patch("blackbox.monitor.adapters.llm_adapter.ask", side_effect=Exception("down")):
        assert check_step(_step(), _run(), []) is None


def test_escalates_to_jev_on_low_laya_confidence():
    laya_low = _fake(0.5, 0.40)
    jev_high = _fake(0.5, 0.90, tier="jev")
    with patch("blackbox.monitor.adapters.laya_adapter.ask", return_value=laya_low), patch(
        "blackbox.monitor.adapters.laya_adapter.overall_confidence", return_value=0.40
    ), patch("blackbox.monitor.adapters.jev_adapter.is_available", return_value=True), patch(
        "blackbox.monitor.adapters.jev_adapter.ask", return_value=jev_high
    ), patch(
        "blackbox.monitor.adapters.jev_adapter.overall_confidence", return_value=0.90
    ):
        r = check_step(_step(), _run(), [])
    assert r["tier"] == "jev"


def test_escalates_to_llm_when_jev_unavailable():
    laya_low = _fake(0.5, 0.40)
    llm_result = _fake(0.5, 0.70, tier="llm")
    with patch("blackbox.monitor.adapters.laya_adapter.ask", return_value=laya_low), patch(
        "blackbox.monitor.adapters.laya_adapter.overall_confidence", return_value=0.40
    ), patch("blackbox.monitor.adapters.jev_adapter.is_available", return_value=False), patch(
        "blackbox.monitor.adapters.llm_adapter.ask", return_value=llm_result
    ):
        r = check_step(_step(), _run(), [])
    assert r["tier"] == "llm"


# ── output shape ───────────────────────────────────────────────────────────────

def test_required_keys_present():
    fake = _fake(0.8, 0.9)
    with patch("blackbox.monitor.adapters.laya_adapter.ask", return_value=fake), patch(
        "blackbox.monitor.adapters.laya_adapter.overall_confidence", return_value=0.9
    ):
        r = check_step(_step(), _run(), [])
    assert r is not None
    for k in ["consistent", "on_track", "mistake_type", "severity", "tier", "alarm", "alarm_lead_step", "latency_ms", "answers"]:
        assert k in r, f"missing: {k}"
    assert isinstance(r["consistent"]["prob"], float)
    assert isinstance(r["alarm"], bool)
    assert r["tier"] in ("laya", "jev", "llm")
    assert r["answers"]["on_track"]["noul"] == r["on_track"]["prob"]
    assert r["answers"]["mistake_type"]["type"] == "choice"
    assert r["answers"]["severity"]["type"] == "score"


def test_json_serialisable():
    fake = _fake(0.8, 0.9)
    with patch("blackbox.monitor.adapters.laya_adapter.ask", return_value=fake), patch(
        "blackbox.monitor.adapters.laya_adapter.overall_confidence", return_value=0.9
    ):
        r = check_step(_step(), _run(), [])
    assert r is not None
    json.dumps(r)  # must not raise


def test_run_context_integration():
    from blackbox.recorder.context import RunContext

    fake = _fake(0.85, 0.90)
    with patch("blackbox.monitor.adapters.laya_adapter.ask", return_value=fake), patch(
        "blackbox.monitor.adapters.laya_adapter.overall_confidence", return_value=0.90
    ):
        run = _run()
        ctx = RunContext(run=run, initial_state={}, monitor=check_step)
        ctx.record("llm", "agent-small", {"q": "hi"}, lambda req: ({"text": "hello"}, {}))
        ctx.close()
        assert len(ctx.steps) == 1
        assert ctx.steps[0].monitor is not None
        assert ctx.steps[0].monitor["tier"] == "laya"
        assert ctx.steps[0].monitor["on_track"]["prob"] == 0.85


def test_autopilot_integration():
    from blackbox.replay.autopilot import Autopilot

    fake = _fake(0.15, 0.92)
    with patch("blackbox.monitor.adapters.laya_adapter.ask", return_value=fake), patch(
        "blackbox.monitor.adapters.laya_adapter.overall_confidence", return_value=0.92
    ):
        pilot = Autopilot(check=check_step, alarm_below=0.3, min_confidence=0.6)
        s = _step(idx=0, kind="llm")
        rewind = pilot.inspect(s, _run(), [s])
        assert rewind is not None
        assert rewind.step_idx == 0


# ── live (requires `pip install laya`, GPU/MPS) ────────────────────────────────

@pytest.mark.live
def test_laya_live_questions():
    """Verifies question construction doesn't crash — directly catches option_order bugs.
    Run this first before the full inference test (fast, no model weights needed).
    """
    from blackbox.monitor.questions import _build_laya_questions
    qs = _build_laya_questions()
    assert set(qs.keys()) == {"consistent", "on_track", "mistake_type", "severity"}
    # Each question must be a dict with at least "type" and "instructions"
    for name, q in qs.items():
        assert "type" in q, f"{name}: missing 'type'"
        assert "instructions" in q, f"{name}: missing 'instructions'"
    # choice must have criteria
    assert "criteria" in qs["mistake_type"], "mistake_type: missing 'criteria'"
    # score must have criteria
    assert "criteria" in qs["severity"], "severity: missing 'criteria'"
    print(f"\nQuestions OK: {list(qs.keys())}")


@pytest.mark.live
def test_laya_live():
    """Full laya_adapter.ask() with real model weights. Requires MPS/CPU inference."""
    from blackbox.monitor.adapters import laya_adapter

    state = build_state(
        _step(output={"text": "The capital of France is Paris."}),
        _run({"question": "What is the capital of France?"}),
        [],
    )
    r = laya_adapter.ask(state)
    # Must have the required keys — not fabricated 0.5
    assert "on_track" in r, "on_track missing from Laya response"
    assert "consistent" in r, "consistent missing from Laya response"
    assert "prob" in r["on_track"], "on_track.prob missing"
    assert 0.0 <= r["on_track"]["prob"] <= 1.0
    assert r["tier"] == "laya"
    assert r["latency_ms"] > 0
    print(f"\nLaya live result: {r}")


@pytest.mark.live
def test_check_step_live_no_mocks():
    """Runs the FULL cascade end-to-end with ZERO mocks.
    This is the test that would have caught the option_order crash immediately.
    Requires: laya installed + model weights cached. Ollama optional (used as LLM fallback).
    """
    run  = _run({"question": "What year did World War II end?"})
    step = _step(
        idx=1,
        kind="llm",
        output={"text": "World War II ended in 1945 with the surrender of Germany and Japan."},
    )
    # No patches — real Laya, real cascade
    result = check_step(step, run, [])

    # Must return something (Laya should be available)
    assert result is not None, (
        "check_step returned None — check stderr for tier_errors. "
        "Run with -s to see the [monitor] log line."
    )
    assert result["tier"] in ("laya", "jev", "llm"), f"unexpected tier: {result['tier']}"
    assert "alarm" in result
    assert isinstance(result["alarm"], bool)
    # on_track must be a real measured value, not absent
    assert "on_track" in result, "on_track missing — Laya may have partially failed"
    assert "prob" in result["on_track"]
    print(f"\nLive check_step result: tier={result['tier']}, "
          f"on_track={result['on_track'].get('prob'):.3f}, alarm={result['alarm']}, "
          f"latency={result['latency_ms']:.0f}ms")
    if "tier_errors" in result:
        print(f"  tier_errors: {result['tier_errors']}")
