"""Unit tests for diagnosis/conformal.py."""
from unittest.mock import MagicMock

import numpy as np

from blackbox.diagnosis.conformal import calibrate, evaluate_coverage


def test_calibrate_and_evaluate():
    # 10 runs with 4 steps each (total 40 samples)
    # Mock model predicting scores
    groups = [4] * 10
    y = np.zeros(40, dtype=np.int32)
    # In each group, guilty step is step 0 (index 0, 4, 8, ...)
    for i in range(10):
        y[i * 4] = 1

    # Scores where guilty step is ranked 1st in 8 runs, 2nd in 2 runs
    scores = np.zeros(40, dtype=np.float32)
    for i in range(8):
        scores[i * 4] = 0.9  # 1st
        scores[i * 4 + 1] = 0.5
        scores[i * 4 + 2] = 0.3
        scores[i * 4 + 3] = 0.1
    for i in range(8, 10):
        scores[i * 4] = 0.7  # 2nd
        scores[i * 4 + 1] = 0.9  # 1st
        scores[i * 4 + 2] = 0.3
        scores[i * 4 + 3] = 0.1

    mock_model = MagicMock()
    mock_model.predict.return_value = scores
    X_dummy = np.zeros((40, 14), dtype=np.float32)

    # 8/10 = 80% at k=1, 10/10 = 100% at k=2
    # Target 90% should yield k=2
    k = calibrate(mock_model, X_dummy, y, groups, target_coverage=0.90)
    assert k == 2

    # Target 70% should yield k=1
    k1 = calibrate(mock_model, X_dummy, y, groups, target_coverage=0.70)
    assert k1 == 1

    # Evaluate coverage at k=2
    cov = evaluate_coverage(mock_model, X_dummy, y, groups, k=2, split_name="test")
    assert cov == 1.0

    # Evaluate coverage at k=1
    cov1 = evaluate_coverage(mock_model, X_dummy, y, groups, k=1, split_name="test")
    assert cov1 == 0.8
