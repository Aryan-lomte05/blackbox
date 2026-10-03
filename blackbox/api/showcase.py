"""Ready-made demo cases for the /docs page (Swagger dropdowns).

Each case is a real run picked from the store, with a one-line description
built from its recorded facts (and, when a trained model exists, what the
model says about it). Nothing is invented: if a kind of case does not exist
in the store, it is simply left out of the dropdown.

Cached in data/status/showcase.json; `rebuild` refreshes it.

    py -3 -m blackbox.api.showcase rebuild
"""

from __future__ import annotations

import json
import random
import sys
from typing import Any

from blackbox.core.schema import Change, Trace
from blackbox.core.store import DEFAULT_DIR, Store

CACHE = DEFAULT_DIR / "status" / "showcase.json"
FAULT_NAMES = {
    "F1": "wrong tool argument", "F2": "wrong tool result", "F3": "tool returned nothing",
    "F4": "misleading paragraph", "F5": "missing paragraph", "F6": "wrong fact",
    "F7": "wrong tool", "F8": "lost memory", "F9": "dropped instruction", "F10": "answered too early",
}
FAMILY = {"qa": "QA", "math": "Math", "ops": "Shop", "external": "Who&When"}


def _fault(run) -> str:
    f = run.fault
    return f"planted {f.type} ({FAULT_NAMES.get(f.type, f.type)}) at step {f.step_idx}" if f else "no planted mistake"


def _rank(trace: Trace) -> dict | None:
    try:
        from blackbox.diagnosis import gnn

        return gnn.rank(trace) if gnn.available() else None
    except Exception:  # noqa: BLE001 - the dropdowns work without a model; descriptions just say less
        return None


def _labelled(store: Store, family: str | None, splits: tuple[str, ...], limit: int = 40):
    out = []
    for split in splits:
        out += [r for r in store.list_runs(success=False, has_label=True, split=split, task_family=family, limit=limit)
                if r.status == "done" and r.fault is not None]
    return out


def build(store: Store, scan: int = 40) -> dict[str, Any]:
    cases: dict[str, Any] = {"runs": {}, "fork_bodies": {}, "compare": {}, "live": {}}
    runs = cases["runs"]

    # 1-2. model finds it / model misses it (test sets only: the model never saw these)
    found = missed = None
    for run in _labelled(store, None, ("test_known", "test_new_tasks"))[:scan]:
        tr = store.load_trace(run.run_id)
        d = _rank(tr)
        if d is None:
            break
        guilty = run.label.root_cause_step
        top = d["suspects"]
        p = next((s["p"] for s in d["scores"] if s["idx"] == top[0]), None)
        if found is None and top and top[0] == guilty:
            found = (run, p)
        if missed is None and guilty not in top:
            missed = (run, top)
        if found and missed:
            break
    if found:
        run, p = found
        runs["model_finds_it"] = {
            "run_id": run.run_id, "summary": f"{FAMILY.get(run.task_family)} failure: model's #1 suspect is the guilty step",
            "description": f"{_fault(run)}; the trained model ranks step {run.label.root_cause_step} first (p={p}). Test set {run.split}: never seen in training.",
            "guilty": run.label.root_cause_step}
    if missed:
        run, top = missed
        runs["model_misses_it"] = {
            "run_id": run.run_id, "summary": f"{FAMILY.get(run.task_family)} failure the model gets wrong (honest case)",
            "description": f"{_fault(run)}; the model's top 3 are {top}. Shown on purpose: Verify still finds the cause if it is tested.",
            "guilty": run.label.root_cause_step}

    # 3. Shop: a task type never trained on (a typical case: prefer one where the model's top 3 hit)
    shop = _labelled(store, "ops", ("test_new_tasks",))[:scan]
    pick, hit_top = None, None
    for run in shop:
        d = _rank(store.load_trace(run.run_id))
        if d is None or run.label.root_cause_step in d["suspects"][:3]:
            pick, hit_top = run, (d["suspects"][:3] if d else None)
            break
    if pick is None and shop:
        pick = shop[0]
    if pick is not None:
        found_txt = f" The model's top 3 are {hit_top}: the guilty step is among them." if hit_top else ""
        runs["shop_new_task_type"] = {
            "run_id": pick.run_id, "summary": "Shop failure: a task type the model never trained on",
            "description": f"{_fault(pick)}. Shop runs are only ever test data.{found_txt}",
            "guilty": pick.label.root_cause_step}

    # 4. Math
    for run in _labelled(store, "math", ("test_known", "val", "calib"))[:1]:
        runs["math_failure"] = {
            "run_id": run.run_id, "summary": "Math failure with a planted mistake",
            "description": f"{_fault(run)}.", "guilty": run.label.root_cause_step}

    # 5. a real failure labelled by experiment, else an unlabelled natural failure
    verified = [r for r in store.list_runs(success=False, has_label=True, limit=500)
                if r.label and r.label.source == "verified"]
    if verified:
        r = verified[0]
        runs["real_failure_verified"] = {
            "run_id": r.run_id, "summary": "Real failure (nothing planted), cause proven by experiment",
            "description": f"The model failed on its own; Verify proved step {r.label.root_cause_step} is the cause ({r.label.notes}).",
            "guilty": r.label.root_cause_step}
    natural = next((r for r in store.list_runs(success=False, has_label=False, limit=3000)
                    if r.status == "done" and r.fault is None and r.parent_run_id is None), None)
    if natural:
        runs["real_failure_unlabelled"] = {
            "run_id": natural.run_id, "summary": "Real failure nobody has diagnosed yet (try Verify on it)",
            "description": f"{FAMILY.get(natural.task_family)} run that failed on its own; the guilty step is unknown until Verify proves it.",
            "guilty": None}

    # 6. a passing run (replay, advisor, plant a mistake)
    passing = next((r for r in store.list_runs(success=True, task_family="qa", limit=200)
                    if r.status == "done" and r.fault is None and r.parent_run_id is None), None)
    if passing:
        runs["passing_run"] = {"run_id": passing.run_id, "summary": "Passing QA run (for replay, advisor, planting a mistake)",
                               "description": f"{len(store.load_trace(passing.run_id).steps)} steps, answered correctly.",
                               "guilty": None}

    # 7. fork bodies: undo the planted mistake; plant one in the passing run
    base = runs.get("model_finds_it") or next(iter(v for k, v in runs.items() if v.get("guilty") is not None), None)
    if base:
        child = store.load_trace(base["run_id"])
        if child.run.parent_run_id and child.run.fault and child.run.fault.params.get("change_kind") == "output":
            parent = store.load_trace(child.run.parent_run_id)
            k = child.run.fault.step_idx
            if k < len(parent.steps):
                cases["fork_bodies"]["undo_planted_mistake"] = {
                    "run_id": child.run.run_id,
                    "summary": f"Undo the planted mistake at step {k}: the run should pass again",
                    "description": "Puts back the step's original output. Steps before it come from the recording; later steps are re-used when unaffected.",
                    "value": {"step_idx": k, "change": {"kind": "output", "value": parent.steps[k].output,
                                                       "note": "undo the planted mistake"}}}
            cases["compare"]["planted_vs_original"] = {
                "a": parent.run.run_id, "b": child.run.run_id,
                "summary": "Original passing run vs the copy with a planted mistake",
                "description": f"First difference should be at step {k}; outcome flips pass → fail."}
    # plant: replay a mistake that is KNOWN to break its passing run (taken from a recorded planted fork)
    for run in _labelled(store, "qa", ("test_known", "val", "calib", "train"))[:scan]:
        if run.parent_run_id and run.patch is not None and run.fault is not None:
            cases["fork_bodies"]["plant_a_mistake"] = {
                "run_id": run.parent_run_id,
                "summary": f"Plant {run.fault.type} ({FAULT_NAMES.get(run.fault.type, run.fault.type)}) at step "
                           f"{run.fork_step_idx} of a passing QA run: it should now fail",
                "description": "A what-if on a run that passed: put one mistake in and watch the answer change. "
                               "Only the affected steps re-run.",
                "value": {"step_idx": run.fork_step_idx, "change": run.patch.model_dump(mode="json")}}
            break

    # 8. live runs: fresh tasks, outside the ranges the farms used
    try:
        from blackbox.data.tasks import load_tasks

        for family, agent, offset, label in (("qa", "qa_agent@v1", 6000, "QA"), ("math", "math_agent@v1", 1250, "Math"),
                                             ("ops", "shop_agent@v1", 195, "Shop")):
            t = load_tasks(family, 1, offset)
            if t:
                t = t[0]
                cases["live"][family] = {
                    "summary": f"Live {label} task on the local 7B model",
                    "description": f"A task the farm never ran ({t.task_id}). Steps stream at /api/runs/{{run_id}}/events.",
                    "value": {"agent": agent, "task_family": family, "task_id": t.task_id, "task_input": t.input,
                              "expected": t.expected, "model_id": "agent-local-7b", "autopilot": False}}
    except Exception:  # noqa: BLE001 - optional example
        pass
    return cases


def load_or_build(store: Store) -> dict[str, Any]:
    if CACHE.exists():
        try:
            cases = json.loads(CACHE.read_text(encoding="utf-8"))
            if all(_exists(store, c["run_id"]) for c in cases.get("runs", {}).values()):
                return cases
        except (ValueError, KeyError):
            pass
    cases = build(store)
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(cases, indent=2, default=str), encoding="utf-8")
    return cases


def _exists(store: Store, run_id: str) -> bool:
    try:
        store.load_trace(run_id)
        return True
    except KeyError:
        return False


# ---- shapes for FastAPI's openapi_examples (Swagger dropdowns) ---------------------------
def run_id_examples(cases: dict, keys: tuple[str, ...] | None = None) -> dict:
    runs = cases.get("runs", {})
    return {k: {"summary": v["summary"], "description": v["description"], "value": v["run_id"]}
            for k, v in runs.items() if keys is None or k in keys}


def body_examples(items: dict) -> dict:
    return {k: {"summary": v["summary"], "description": v.get("description", ""), "value": v["value"]}
            for k, v in items.items()}


if __name__ == "__main__":
    if sys.argv[1:] == ["rebuild"]:
        CACHE.unlink(missing_ok=True)
        c = load_or_build(Store())
        for section, items in c.items():
            for k, v in items.items():
                print(f"{section:12} {k:28} {v.get('summary', '')}")
    else:
        print("usage: py -3 -m blackbox.api.showcase rebuild")
