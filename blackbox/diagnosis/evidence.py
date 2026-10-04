"""Why a step is a suspect, in plain sentences (U12); the contamination trail (U8); and the
suspect-set size that covers the true cause 90% of the time on held-out data (U10).

Sentences are filled only from the step's recorded content and graph features, never generated.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import numpy as np

from blackbox.core.schema import Trace
from blackbox.core.store import DEFAULT_DIR
from blackbox.diagnosis.graph_data import _facts, build, dataflow_parents, output_text

COVERAGE_PATH = DEFAULT_DIR / "models" / "suspect_set.json"
TARGET = 0.90


def trail(trace: Trace, start: int) -> list[int]:
    """Every later step that (directly or indirectly) used the output of `start`: the contamination trail."""
    parents = dataflow_parents(trace)
    hit, out = {start}, []
    for i in range(start + 1, len(trace.steps)):
        if any(p in hit for p in parents[i]):
            hit.add(i)
            out.append(i)
    return out


def sentences(trace: Trace, idx: int) -> list[str]:
    """Plain-language reasons this step is suspicious, from its recorded content and graph position."""
    g = build(trace)
    s = trace.steps[idx]
    parents = dataflow_parents(trace)
    anc: set[int] = set()
    stack = list(parents[idx])
    while stack:
        p = stack.pop()
        if p not in anc and 0 <= p < len(trace.steps):
            anc.add(p)
            stack.extend(parents[p])
    out = []
    if s.error:
        out.append(f"It raised an error: {s.error[:140]}.")
    if s.kind in ("llm", "tool"):
        known = _facts(json.dumps(trace.run.task_input, ensure_ascii=False, default=str))
        for a in anc:
            known |= _facts(g.out_text[a])
        produced = _facts(g.out_text[idx])
        new = sorted(produced - known - _facts(g.req_text[idx]))
        if new:
            out.append(f"Its output states {', '.join(repr(x) for x in new[:4])}, found in none of the "
                       f"{len(anc)} step(s) it used or in the task.")
    out_dict = s.output or {}
    produced_value = out_dict.get("result", out_dict.get("docs"))  # tools return `result`, searches return `docs`
    if not output_text(s).strip() or produced_value in (None, [], {}, ""):
        if s.kind in ("tool", "retrieval"):
            out.append("It returned nothing.")
    downstream = trail(trace, idx)
    finals = [x.idx for x in trace.steps if x.kind == "final"]
    if finals and finals[-1] in downstream:
        out.append(f"The final answer depends on it: its output flowed through {len(downstream)} later step(s).")
    elif downstream:
        out.append(f"{len(downstream)} later step(s) used its output.")
    mon = s.monitor if isinstance(s.monitor, dict) else None
    if mon and (mon.get("consistent") or {}).get("prob") is not None:
        c = mon["consistent"]["prob"]
        if c < 0.5:
            out.append(f"The live checker rated it inconsistent with its inputs ({c:.2f}).")
    if not out:
        out.append("Nothing stands out in its content; it is ranked by its position in the run's graph.")
    return out


@lru_cache(maxsize=1)
def suspect_set_size() -> dict | None:
    """Calibrated on the `calib` split by scripts / gnn: the smallest k whose top-k contained the true
    cause in >= 90% of held-out failures, with the coverage actually measured."""
    if not COVERAGE_PATH.exists():
        return None
    return json.loads(COVERAGE_PATH.read_text(encoding="utf-8"))


def calibrate(ranks: list[int], target: float = TARGET) -> dict:
    """Split-conformal style on ranks: k = the target quantile of the true cause's rank."""
    arr = np.array(sorted(ranks))
    n = len(arr)
    q = min(n - 1, int(np.ceil((n + 1) * target)) - 1)
    k = int(arr[q])
    return {"k": k, "target": target, "n_calib": n, "coverage_on_calib": round(float(np.mean(arr <= k)), 3)}


def save_calibration(info: dict, path: Path = COVERAGE_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(info, indent=2), encoding="utf-8")
    suspect_set_size.cache_clear()
