"""The diagnosis GNN: leak guard first, then that it can learn and rank."""

from __future__ import annotations

import numpy as np
import pytest

torch = pytest.importorskip("torch")

from blackbox.agents.base import run_task  # noqa: E402
from blackbox.core.schema import Change, Label  # noqa: E402
from blackbox.core.store import Store  # noqa: E402
from blackbox.diagnosis.graph_data import build  # noqa: E402
from blackbox.recorder import providers  # noqa: E402
from blackbox.replay.engine import fork, replay  # noqa: E402
from tests.test_core_replay import DOCS, ToyAgent, _task, fake_model  # noqa: E402


@pytest.fixture(autouse=True)
def _fake():
    providers.register_fake("fake-model", fake_model)
    yield
    providers.clear_fakes()


def test_leak_guard_replayed_run_has_identical_features(tmp_path):
    """Replayed steps have latency 0, no tokens and cached=True. If any of that
    reached the features, the model could spot the planted step for free."""
    tr = run_task(ToyAgent(), _task(), "fake-model", store=Store(tmp_path))
    again = replay(tr)
    assert all(s.cached for s in again.steps if s.kind != "final")
    g1, g2 = build(tr), build(again)
    np.testing.assert_array_equal(g1.x, g2.x)
    assert g1.req_text == g2.req_text and g1.out_text == g2.out_text and g1.edges == g2.edges


def test_leak_guard_fork_prefix_features_match_original(tmp_path):
    tr = run_task(ToyAgent(), _task(), "fake-model", store=Store(tmp_path))
    child = fork(tr, 1, Change(kind="output", value={"docs": DOCS["japan"]}))
    g, gc = build(tr), build(child)
    # step 0 is replayed in the fork and ran live in the original: same features
    np.testing.assert_array_equal(g.x[0], gc.x[0])


def test_graph_shape_and_targets(tmp_path):
    tr = run_task(ToyAgent(), _task(), "fake-model", store=Store(tmp_path))
    child = fork(tr, 1, Change(kind="output", value={"docs": DOCS["japan"]}))
    child.run.label = Label(root_cause_step=1, source="injected")
    g = build(child)
    assert g.root == 1 and g.failed == 1.0 and g.odd[1] == 1.0
    assert not g.candidates[-1]  # the final step is never blamed
    assert (0, 1, 3) in g.edges  # data flow: retrieval (1) -> answer call (3)
    assert (0, 3, 4) in g.edges  # the final step depends on the step before it


def test_model_learns_a_planted_signal():
    """Smoke: on synthetic graphs where the guilty node carries a marker in one
    feature, the GNN learns to find it (training loop, masking, softmax wired right)."""
    from blackbox.diagnosis.gnn import Config, Prepared, _top1, train_one
    from blackbox.diagnosis.graph_data import GraphExample, feature_dim

    rng = np.random.default_rng(0)

    def example(i):
        n = int(rng.integers(5, 10))
        x = rng.normal(0, 0.1, (n, feature_dim())).astype(np.float32)
        root = int(rng.integers(0, n - 1))
        x[root, 31] += 2.0  # "facts from nowhere" (share of unsupported facts)
        cand = np.array([True] * (n - 1) + [False])
        ex = GraphExample(f"r{i}", x, [""] * n, [""] * n, [(2, j, j + 1) for j in range(n - 1)], cand, root,
                          np.full(n, np.nan, np.float32), 1.0, "train", "toy", "F6")
        z = np.zeros((n, 384), np.float32)
        return Prepared(ex, z, z)

    data = [example(i) for i in range(120)]
    cfg = Config(epochs=60, patience=60, seeds=1, use_text=False, n_features=feature_dim())
    model = train_one(data[:100], data[100:], cfg, seed=0, device=torch.device("cpu"))
    assert _top1([model], data[100:], cfg, torch.device("cpu")) >= 0.8
