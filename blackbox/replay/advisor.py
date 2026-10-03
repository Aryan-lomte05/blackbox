"""Cheaper-model advisor (USP U18): which model calls in a passing run still pass
when a cheaper model makes them?

For each model call, fork the run with only that call switched to the cheaper
model. If the run still passes, that step is safe to downgrade. Each fork only
pays for the steps the change reaches.

Money is reported only when models.yaml gives prices for both models
(`price_per_mtok: {in: .., out: ..}`); otherwise only tokens are reported.
Nothing is estimated.
"""

from __future__ import annotations

from typing import Any, Callable

from blackbox.core.schema import Change, Trace
from blackbox.core.store import Store
from blackbox.recorder import providers
from blackbox.replay.engine import fork, savings


def _price(model_id: str) -> dict | None:
    try:
        cfg = providers.model_config(model_id)
    except KeyError:
        return None
    price = cfg.params.get("price_per_mtok") if isinstance(cfg.params, dict) else None
    return price if isinstance(price, dict) and {"in", "out"} <= set(price) else None


def advise(
    trace: Trace,
    cheaper_model: str = "agent-local",
    *,
    store: Store | None = None,
    on_event: Callable[[dict], None] | None = None,
) -> dict[str, Any]:
    if trace.run.outcome is None or not trace.run.outcome.success:
        raise ValueError("the advisor needs a passing run to compare against")
    emit = on_event or (lambda e: None)
    rows = []
    for step in trace.steps:
        if step.kind != "llm" or step.request.get("model_id") == cheaper_model:
            continue
        child = fork(trace, step.idx, Change(kind="model", value=cheaper_model, note="advisor"), store=store)
        holds = child.run.status == "done" and child.run.outcome is not None and child.run.outcome.success
        row = {"step": step.idx, "node": step.node, "from_model": step.request.get("model_id"),
               "to_model": cheaper_model, "still_passes": holds, "run_id": child.run.run_id,
               "tokens": (step.tokens_in or 0) + (step.tokens_out or 0), "savings": savings(child)}
        rows.append(row)
        emit({"type": "advice", **row})
    safe = [r for r in rows if r["still_passes"]]
    result: dict[str, Any] = {
        "run_id": trace.run.run_id,
        "cheaper_model": cheaper_model,
        "steps_checked": len(rows),
        "safe_to_downgrade": [r["step"] for r in safe],
        "tokens_movable": sum(r["tokens"] for r in safe),
        "rows": rows,
        "note": "each step was tested alone; downgrading several at once should be confirmed with one more run",
    }
    cheap = _price(cheaper_model)
    if cheap and safe and all(_price(r["from_model"]) for r in safe):
        saved = 0.0
        for r in safe:
            s = trace.steps[r["step"]]
            big = _price(r["from_model"])
            saved += ((s.tokens_in or 0) * (big["in"] - cheap["in"]) + (s.tokens_out or 0) * (big["out"] - cheap["out"])) / 1e6
        result["usd_saved_per_run"] = round(saved, 6)
    return result
