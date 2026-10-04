"""The fine-tuned checker head: features, prediction, opt-in switch."""

from __future__ import annotations

import json

from blackbox.monitor import cascade, finetune


def _monitor(on_track=0.2, consistent=0.3):
    return {"consistent": {"prob": consistent, "confidence": 0.9}, "on_track": {"prob": on_track, "confidence": 0.9},
            "mistake_type": {"empty_result": 0.8}}


def test_features_are_laya_answers_and_step_kind_only():
    x = finetune.features(_monitor(), "tool")
    assert len(x) == len(finetune.feature_names()) and x[:4] == [0.3, 0.9, 0.2, 0.9]
    assert finetune.features({"on_track": {"prob": 0.5}}, "tool") is None  # no fabricated answers


def test_the_head_is_off_unless_switched_on(tmp_path, monkeypatch):
    names = finetune.feature_names()
    head = {"coef": [0.0] * len(names), "intercept": 2.0, "mean": [0.0] * len(names), "scale": [1.0] * len(names),
            "threshold": 0.5, "beats_rule": False}
    path = tmp_path / "head.json"
    path.write_text(json.dumps(head), encoding="utf-8")
    monkeypatch.setattr(finetune, "HEAD_PATH", path)
    monkeypatch.delenv("BLACKBOX_CHECKER_HEAD", raising=False)
    assert cascade._checker_head() is None
    monkeypatch.setenv("BLACKBOX_CHECKER_HEAD", "1")
    loaded = cascade._checker_head()
    assert loaded is not None and finetune.predict(loaded, finetune.features(_monitor(), "tool")) > 0.85
