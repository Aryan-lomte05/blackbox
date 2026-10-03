"""Integration test for blackbox/diagnosis/ranker.py and diagnose.py."""
import lightgbm as lgb

from blackbox.core.schema import Run, Step, Trace
from blackbox.diagnosis.conformal import calibrate
from blackbox.diagnosis.dataset import build_arrays
from blackbox.diagnosis.diagnose import diagnose
from blackbox.diagnosis.features import FEATURE_NAMES_STRUCTURAL_ONLY
from blackbox.diagnosis.ranker import top_k_accuracy, train_variant


def _create_mock_trace(run_id: str, guilty_step: int, n_steps: int = 5) -> Trace:
    run = Run(
        run_id=run_id,
        task_family="qa",
        task_id=f"t_{run_id}",
        task_input={"question": "Find the capital"},
        agent="agent@v1",
        model_id="agent-small",
    )
    run.outcome = {"success": False, "final_answer": "Wrong"}
    run.label = {"root_cause_step": guilty_step, "source": "injected"}

    steps = []
    for i in range(n_steps):
        s = Step(
            run_id=run_id,
            idx=i,
            kind="tool" if i % 2 == 1 else "llm",
            name="tool_call" if i % 2 == 1 else "llm_call",
            node="exec",
            request={"q": "capital of France"},
            output={"text": "found 1945" if i != guilty_step else "error occurred in query"},
            input_hash="hash",
            parents=[i - 1] if i > 0 else [],
            error="bad_argument" if i == guilty_step else None,
        )
        steps.append(s)

    # Final step
    steps.append(
        Step(
            run_id=run_id,
            idx=n_steps,
            kind="final",
            name="answer",
            node="end",
            request={},
            output={"text": "Wrong"},
            input_hash="h_final",
            parents=[n_steps - 1],
        )
    )

    return Trace(run=run, steps=steps)


def test_build_arrays_and_train_mock():
    # 5 mock failed traces with known guilty steps
    traces = [
        _create_mock_trace("r1", guilty_step=1, n_steps=4),
        _create_mock_trace("r2", guilty_step=2, n_steps=5),
        _create_mock_trace("r3", guilty_step=0, n_steps=3),
        _create_mock_trace("r4", guilty_step=1, n_steps=4),
        _create_mock_trace("r5", guilty_step=3, n_steps=5),
    ]

    X, y, groups = build_arrays(traces, include_monitor=False)
    assert len(groups) == 5
    assert len(X) == sum(groups)
    assert y.sum() == 5  # exactly one guilty step per trace

    # Train a fast booster on mock data
    model = train_variant(
        X,
        y,
        groups,
        X,
        y,
        groups,
        FEATURE_NAMES_STRUCTURAL_ONLY,
        variant="test_mock",
    )
    assert isinstance(model, lgb.Booster)

    # Top-1 or Top-3 accuracy should be positive
    acc1 = top_k_accuracy(X, y, groups, model, 1)
    acc3 = top_k_accuracy(X, y, groups, model, 3)
    assert acc3 >= acc1
    assert acc3 > 0.0

    # Test calibrate
    k = calibrate(model, X, y, groups, target_coverage=0.80)
    assert 1 <= k <= 5


def test_diagnose_fallback_without_model():
    trace = _create_mock_trace("rf", guilty_step=2, n_steps=4)
    res = diagnose(trace)
    assert "scores" in res
    assert "suspects" in res
    assert "evidence" in res
    assert len(res["suspects"]) > 0
