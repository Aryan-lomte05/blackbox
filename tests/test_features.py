"""Unit tests for diagnosis/features.py — no GPU, no models needed."""
import math

from blackbox.core.schema import Run, Step
from blackbox.diagnosis.features import (
    FEATURE_NAMES_STRUCTURAL_ONLY,
    FEATURE_NAMES_WITH_MONITOR,
    build_downstream_map,
    extract_features,
    unsupported_facts,
)


def _step(idx, kind="llm", output=None, parents=None, writes=None, error=None):
    s = Step(
        run_id="r1",
        idx=idx,
        kind=kind,
        name="a",
        node="n",
        request={"question": "what is 42?"},
        output=output or {"text": "answer"},
        input_hash="h",
        parents=parents or [],
        writes=writes or [],
    )
    if error:
        s.error = error
    return s


def _run():
    return Run(
        run_id="r1",
        task_family="qa",
        task_id="t1",
        task_input={"question": "q"},
        agent="a@v1",
        model_id="m",
    )


def test_unsupported_facts_number_not_in_input():
    s = _step(0, output={"text": "The answer is 1912."})
    # "1912" is not in the request "what is 42?"
    assert unsupported_facts(s) >= 1


def test_unsupported_facts_number_in_input():
    s = _step(0, output={"text": "42 is the answer."})
    # "42" IS in request "what is 42?"
    assert unsupported_facts(s) == 0


def test_downstream_map():
    s0 = _step(0)
    s1 = _step(1, parents=[0])
    s2 = _step(2, parents=[0, 1])
    dm = build_downstream_map([s0, s1, s2])
    assert 1 in dm[0] and 2 in dm[0]
    assert 2 in dm[1]


def test_extract_features_length_no_monitor():
    s = _step(0)
    row = extract_features(s, _run(), [s], include_monitor=False)
    assert len(row) == len(FEATURE_NAMES_STRUCTURAL_ONLY)


def test_extract_features_length_with_monitor():
    s = _step(0)
    s.monitor = {
        "on_track": {"prob": 0.8},
        "consistent": {"prob": 0.9},
        "mistake_type": {"none": 0.7},
        "severity": {"will_derail": 0.1},
        "mistake_type_confidence": 0.8,
    }
    row = extract_features(s, _run(), [s], include_monitor=True)
    assert len(row) == len(FEATURE_NAMES_WITH_MONITOR)


def test_error_step_has_has_error_1():
    s = _step(0, error="timeout")
    row = extract_features(s, _run(), [s], include_monitor=False)
    # has_error is index 7
    assert row[7] == 1.0


def test_features_are_finite():
    s = _step(0, output={"text": "The year 1945 saw the end of WWII."})
    row = extract_features(s, _run(), [s], include_monitor=False)
    assert all(math.isfinite(v) for v in row)
