"""Import Who&When: other people's agent failures with the guilty step marked
by hand (SYSTEM.md §3). Used for testing only, never for training.

    py -3 -m blackbox.data.importers.who_and_when        # -> data/blackbox.db, split test_outside

Each conversation turn becomes one step. There is no save-point to replay
from, so these runs support diagnosis only (no verify, no repair).
"""

from __future__ import annotations

import argparse
import sys

from blackbox.core.hashing import fingerprint, step_input_hash
from blackbox.core.schema import Label, Outcome, Run, Step, Trace
from blackbox.core.store import DEFAULT_DIR, Store

DATASET = "Kevin355/Who_and_When"
CONFIGS = ("Algorithm-Generated", "Hand-Crafted")
SPLIT = "test_outside"


def to_trace(row: dict, config: str) -> Trace | None:
    """One Who&When record as a Trace, or None if its marked step is not a step of the run."""
    history = row.get("history") or []
    try:
        guilty = int(row.get("mistake_step"))
    except (TypeError, ValueError):
        return None
    if not 0 <= guilty < len(history):
        return None
    run_id = "ww" + fingerprint([config, row["question_ID"]])[:14]
    expected = row.get("ground_truth", row.get("groundtruth"))
    steps: list[Step] = []
    for idx, turn in enumerate(history):
        who = str(turn.get("name") or turn.get("role") or "agent")
        request = {"messages": [], "speaker": who}
        steps.append(Step(
            run_id=run_id, idx=idx, kind="llm", name=who, node=who, request=request,
            output={"text": str(turn.get("content") or "")},
            parents=[idx - 1] if idx else [],  # a conversation: each turn follows the one before
            input_hash=step_input_hash("llm", who, request, {"turn": idx}),
        ))
    run = Run(
        run_id=run_id, task_family="external", task_id=f"ww-{row['question_ID']}",
        task_input={"question": row.get("question", "")}, task_expected=expected,
        agent=f"who_and_when/{config}", model_id="external",
        outcome=Outcome(success=False, score=0.0, final_answer=None, expected=expected, checker="imported"),
        label=Label(root_cause_step=guilty, source="imported",
                    notes=f"{row.get('mistake_agent', '')}: {row.get('mistake_reason', '')}"[:500]),
        split=SPLIT, status="done", machine="who_and_when",
        stats={"n_steps": len(steps)},
    )
    return Trace(run=run, steps=steps)


def import_all(store: Store, configs: tuple[str, ...] = CONFIGS) -> dict:
    from datasets import load_dataset

    added = skipped = 0
    for config in configs:
        for row in load_dataset(DATASET, config, split="train"):
            trace = to_trace(row, config)
            if trace is None:
                skipped += 1  # reported below, never silently dropped
                continue
            store.save_trace(trace)
            added += 1
    return {"imported": added, "skipped_bad_step": skipped, "split": SPLIT}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Import Who&When into the local store as split test_outside.")
    ap.add_argument("--data", default=str(DEFAULT_DIR))
    args = ap.parse_args()
    store = Store(args.data)
    try:
        print(import_all(store))
    finally:
        store.close()
    sys.exit(0)
