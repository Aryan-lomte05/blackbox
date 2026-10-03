"""Replay and fork recorded runs (SYSTEM.md §4.4, USPs U1, U2, U15).

    replay(trace)                      -> same run again from the recording: 0 provider calls
    fork(trace, k, Change(...))        -> new run: steps < k from the recording,
                                          step k changed, later steps re-used when
                                          unaffected, executed live otherwise
"""

from __future__ import annotations

from blackbox.agents.base import get_agent, run_task, task_from_run
from blackbox.core.schema import Change, Trace
from blackbox.core.store import Store
from blackbox.recorder.context import Monitor, ReplayPlan, StepListener


def replay(trace: Trace, *, store: Store | None = None, on_step: list[StepListener] | None = None) -> Trace:
    """Re-execute the agent with every step served from the recording."""
    plan = ReplayPlan(parent=trace, fork_idx=None)
    return run_task(
        get_agent(trace.run.agent), task_from_run(trace.run), trace.run.model_id,
        store=store, plan=plan, on_step=on_step,
        parent_run_id=trace.run.run_id, split=trace.run.split,
    )


def fork(
    trace: Trace,
    step_idx: int,
    change: Change | None,
    *,
    store: Store | None = None,
    monitor: Monitor | None = None,
    on_step: list[StepListener] | None = None,
    reuse_after_fork: bool = True,
) -> Trace:
    """Run again from step `step_idx` with `change` applied there.

    change=None re-executes step k live with no change, which is how Verify
    checks whether a failure was bad luck or a real bug (U14).
    """
    if not 0 <= step_idx < len(trace.steps):
        raise IndexError(f"run {trace.run.run_id} has {len(trace.steps)} steps; cannot fork at {step_idx}")
    plan = ReplayPlan(parent=trace, fork_idx=step_idx, change=change, reuse_after_fork=reuse_after_fork,
                      ancestors=_ancestors(trace, store) if reuse_after_fork else [])
    child = run_task(
        get_agent(trace.run.agent), task_from_run(trace.run), trace.run.model_id,
        store=store, plan=plan, monitor=monitor, on_step=on_step,  # save-points written as the fork runs
        parent_run_id=trace.run.run_id, fork_step_idx=step_idx, patch=change, split=trace.run.split,
    )
    child.run.stats["full_rerun_steps"] = len(trace.steps)
    child.run.stats["full_rerun_tokens"] = _tokens(trace)
    if store is not None:
        store.save_trace(child)
    return child


def _ancestors(trace: Trace, store: Store | None, depth: int = 4) -> list[Trace]:
    """The runs this one was forked from (nearest first), whose steps the fork may re-use."""
    out: list[Trace] = []
    parent_id = trace.run.parent_run_id
    while store is not None and parent_id and len(out) < depth:
        try:
            parent = store.load_trace(parent_id)
        except KeyError:
            break
        out.append(parent)
        parent_id = parent.run.parent_run_id
    return out


def _tokens(trace: Trace) -> int:
    return sum((s.tokens_in or 0) + (s.tokens_out or 0) for s in trace.steps)


def savings(child: Trace) -> dict:
    """The savings meter (U19): what this fork did not have to redo."""
    st = child.run.stats
    total = st.get("full_rerun_steps") or st.get("n_steps") or 0
    return {
        "steps_total": total,
        "steps_executed": st.get("n_executed", 0),
        "steps_reused": st.get("n_reused", 0),
        "tokens_saved": st.get("tokens_saved", 0),
        "seconds_saved": st.get("seconds_saved", 0.0),
    }
