# Diagnosis GNN: scope

> **Decision (3 Oct, after grouped CV, see AUDIT.md entry 16):** the shipped
> model is the graph-feature variant *without* learned message passing and
> without text embeddings. Graph-derived features are worth +16 points Top-1
> in CV (lower in all 5 folds without them); the message-passing layer added
> nothing measurable at 224 labelled failures. The GNN path stays in the code
> (`--variant full`) for when there is more data. Final: test_known Top-1
> 0.607 [0.43, 0.79] / Top-3 0.929; unseen Shop tasks Top-1 0.626 [0.53, 0.71].

Owner: **Aryan** (requested by the lead). Aditya owns the GBM ranker, the step
checker, the suspect list (conformal) and the explanations. The GNN is a
second learned model: its scores are an input to his ranker, and the eval
compares both. Neither blocks the other.

## 1. What it predicts

Input: one recorded run as a graph, where nodes are steps and edges are "who
used whose output" plus step order.

| head | output | trained on |
|---|---|---|
| **Root cause** (main) | a probability over the run's steps: P(step i is the guilty step) | failed runs with a known guilty step (`label.source` ∈ injected, verified) |
| Run fails (auxiliary) | P(this run fails) | every finished run (outcome is always known) |
| Odd step (auxiliary) | P(step looks wrong) | guilty steps = 1; a planted mistake the agent recovered from = 1; all other steps of passing runs = 0 |

The auxiliary heads help with little data, and they are what lets the model
learn the "suspicious vs failure-causing" distinction the PS asks for.

## 2. The graph

- **Nodes:** every step. The `final` step is a node, so the answer is in the
  graph, but it is never a candidate.
- **Edge types (4):** data-flow forward (parent → child), data-flow backward,
  order forward (i → i+1), order backward. Data flow says who consumed a
  mistake; order covers agents whose memory use is coarse.

## 3. Node features, and what is forbidden

| group | features |
|---|---|
| Structure | step kind (one-hot), agent node name (hashed), relative position, in/out degree, depth, distance to the final step, whether the answer depends on it |
| Execution | error flag, empty output, output length (log) |
| Content | text embedding of what was asked and what came back (all-MiniLM-L6-v2, 384 → 64); cosine(asked, answered); **unsupported facts** (numbers/names in the output found in no ancestor's output nor the task input); overlap of the output with the final answer |
| Checker (later) | Laya/Jev answers from Aditya's `check_step`, when present |

**Forbidden (leak guard, enforced by a test):** `cached`, `latency_ms`,
`tokens_in/out`, `meta`, `run.fault`, `run.patch`, `fork_step_idx` and
anything that differs between a step that ran live and the same step
replayed. In a planted-mistake fork the steps before the planted one are
replayed (latency 0, no tokens) and the planted one runs live, so any of
these would give the answer away. The test checks that **a step's features
are identical whether it was executed or replayed**.

## 4. Model

Relational message passing in plain PyTorch (no torch-geometric: fewer
installs on Windows/Mac and a smaller package):

- 3 layers, hidden size 128, a separate weight per edge type, GRU update,
  dropout 0.2, layer norm;
- root-cause head: an MLP gives a logit per node; softmax over the run's
  candidate nodes; cross-entropy against the guilty step;
- run head: mean + max pooling → MLP. Odd-step head: per node → sigmoid.
- Loss = root-cause CE + 0.3 × run BCE + 0.3 × odd-step BCE. AdamW,
  early-stopping on `val` Top-1.

Trains in about a minute on the 4060; weights under 5 MB (shipped with the
package later).

## 5. Data and splits

Splits come from Radhesh's `data/splits.py` (by task id): train / val / calib
/ test_known; test_new_tasks = Shop. Anything that learns "normal" is fit on
`train` only.

| set | contents | today (3 Oct, 18:25) | target |
|---|---|---|---|
| train | labelled failures (F1–F6) + passing + recovered | 40 labelled | ≥ 600 |
| val / calib / test_known | same, held-out tasks | 5 / 11 / 7 | ≥ 80 each |
| test_new_mistakes | F7–F10 (never trained) | 0 | ≥ 100 |
| test_natural | real failures labelled by Verify | 0 | ≥ 150 |
| external | Who&When (order edges only: it has no data flow) | — | stretch |

To get there: the 4060 farm is running (QA, then Math); merge Radhesh's
first 446 runs (his shards); run the natural-failure labeller.

## 6. Evaluation (`eval/` harness, Radhesh)

- **Metrics:** Top-1, Top-3, ±1 step, MRR, each with a bootstrap 95%
  confidence interval (test sets are small; an interval keeps us honest).
- **Breakdowns:** per mistake type, per task family, per step position.
- **Baselines:** random; last model call; the fallback order; LLM judge;
  Aditya's GBM.
- **Ablations:** no message passing (an MLP on the same features); order
  edges only (no data flow); no text embeddings; no auxiliary heads. If data
  flow does not help, we say so.
- **Position check:** a model that sees only the step position. If it is
  close to the GNN, the planted positions are biased.

## 7. Done means

1. The leak test passes.
2. On `test_known` the GNN beats the fallback order and the last-model-call
   baseline outside the confidence interval.
3. The ablation table is reported whatever it shows.
4. `GET /api/runs/{id}/diagnosis` returns GNN scores when no trained GBM is
   installed (order: Aditya's `predict` → GNN → fallback).
5. The demo's suspect list comes from the GNN, so Verify tests the right
   steps (it missed the step-0 cause with the fallback order).

## 8. Files

```
blackbox/diagnosis/graph_data.py   trace -> node features + edges (+ leak test)
blackbox/diagnosis/gnn.py          model, train, evaluate, rank(trace)
data/models/gnn.pt, gnn_metrics.json
tests/test_gnn.py
```
