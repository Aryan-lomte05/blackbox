"""Tools that explain a failure: diagnosis, proof by experiment, causal analysis, visual maps."""

from __future__ import annotations

from blackbox.mcp.registry import RUN_ID, clip, report_progress, store, tool


def _diagnose(trace):
    from blackbox.api.main import diagnose

    return diagnose(trace)


@tool("diagnose", "Which steps most likely caused this failed run, with plain-language reasons.",
      category="diagnosis", properties=RUN_ID, required=("run_id",))
def diagnose(run_id: str) -> str:
    tr = store().load_trace(run_id)
    d = _diagnose(tr)
    out = [f"Top suspects for {run_id}: {d.get('suspects')} (model: {d.get('source')})"]
    for ev in d.get("evidence", []) or []:
        out.append(f"- step {ev['idx']}: " + " ".join(ev.get("sentences", [])))
    if tr.run.label and tr.run.label.root_cause_step is not None:
        out.append(f"Known guilty step: {tr.run.label.root_cause_step} ({tr.run.label.source}).")
    return "\n".join(out)


@tool("investigate", "Full investigation of a failed run: diagnose, prove the cause by replay, compare. 10-60 s.",
      category="diagnosis", properties=RUN_ID, required=("run_id",))
def investigate(run_id: str) -> str:
    import blackbox.agents.builtin  # noqa: F401 - registers the agents so they can be re-run
    from blackbox.api.investigate import case_file
    from blackbox.api.main import diagnose as diagnose_fn

    s = store()
    out = case_file(s.load_trace(run_id), s, diagnose_fn, repeats=1)
    return "\n".join(out["story"])


@tool("verify", "Prove which suspect step caused a failure by re-running with one step repaired at a time.",
      category="diagnosis", properties=RUN_ID, required=("run_id",))
def verify(run_id: str) -> str:
    import blackbox.agents.builtin  # noqa: F401
    from blackbox.replay.verify import verify as verify_run

    s = store()
    tr = s.load_trace(run_id)
    suspects = list(_diagnose(tr).get("suspects", []))[:3]
    report_progress(f"suspects {suspects}: repairing one at a time")

    def on_event(e: dict) -> None:
        if e.get("type") == "verdict":
            report_progress(f"step {e['step']}: {e['verdict']}")

    rep = verify_run(tr, suspects, store=s, repeats=1, on_event=on_event)
    head = (f"Proven cause: step {rep['verified_step']}." if rep["verified_step"] is not None
            else "No single suspect's repair fixed the run.")
    return head + "\n" + "\n".join(f"step {x['step']}: {x['verdict']} (causal effect {x['causal_effect']})"
                                   for x in rep["suspects"])


@tool("causal_report", "Necessary vs sufficient for each suspect, joint causes when no single step explains it, "
      "every verified recovery path, and the blast radius (money-moving tools flagged).", category="diagnosis",
      properties={**RUN_ID, "suspects": {"type": "array", "items": {"type": "integer"}}}, required=("run_id",))
def causal_report(run_id: str, suspects: list[int] | None = None) -> str:
    import blackbox.agents.builtin  # noqa: F401
    from blackbox.replay.causal import causal_report as build

    s = store()
    tr = s.load_trace(run_id)
    picked = [int(x) for x in suspects] if suspects else list(_diagnose(tr)["suspects"])[:3]
    report_progress(f"testing steps {picked}: necessary? sufficient?")

    def on_event(e: dict) -> None:
        if e.get("type") == "verdict":
            report_progress(f"step {e['step']}: {e['verdict']}")
        elif e.get("type") == "sufficiency":
            report_progress(f"step {e['step']} sufficient: {e.get('sufficient')}")
        elif e.get("type") == "pair":
            report_progress(f"steps {e['steps']} together: {'PASS' if e['passed'] else 'fail'}")

    rep = build(tr, s, picked, on_event=on_event)
    paths = "\n".join(f"  recover via step {p['step']} ({p['how']}) -> run {p['run']}" for p in rep["recovery_paths"])
    return rep["summary"] + ("\n" + paths if paths else "")


@tool("similar_failures", "Have we seen this failure before? Its fingerprint, the most similar past failures and "
      "what caused them, whether it is a NOVEL kind of failure, and fixes already approved for look-alikes.",
      category="diagnosis", properties={**RUN_ID, "k": {"type": "integer", "default": 5}}, required=("run_id",))
def similar_failures(run_id: str, k: int = 5) -> str:
    from blackbox.diagnosis.fingerprint import similar

    tr = store().load_trace(run_id)
    rep = similar(store(), tr, None if tr.run.label else _diagnose(tr), k=int(k))
    fp = rep["fingerprint"]
    out = [f"Fingerprint {fp['id']}: {', '.join(fp['tokens'])}",
           f"{rep['same_fingerprint']} of {rep['library_size']} labelled failures share it"
           + (f" (causes: {rep['same_fingerprint_causes']})" if rep["same_fingerprint"] else "") + ".",
           "NOVEL: nothing in the library looks like this failure." if rep["novel"]
           else f"Closest similarity {rep['best_similarity']}."]
    out += [f"  {c['run_id']} sim {c['similarity']} cause step {c['cause']} ({c['fault'] or c['source']}, {c['family']})"
            for c in rep["closest"]]
    out += [f"Known fix (approved, fixed {f['fixed']}/{f['of']}): {f['rule'] or f['model']}" for f in rep["known_fixes"]]
    return "\n".join(out)


def _blob(s, digest: str | None):
    return s.get_blob(digest) if digest and s.has_blob(digest) else None


@tool("time_travel", "Stand inside a run at step k: what the agent had seen, what it remembered (state before and "
      "after), what it did, and which later steps this step went on to affect.", category="diagnosis",
      properties={**RUN_ID, "step_idx": {"type": "integer"}}, required=("run_id", "step_idx"))
def time_travel(run_id: str, step_idx: int) -> str:
    from blackbox.diagnosis.evidence import trail

    s = store()
    tr = s.load_trace(run_id)
    k = int(step_idx)
    if not 0 <= k < len(tr.steps):
        raise KeyError(f"step {k} (run has {len(tr.steps)} steps)")
    step = tr.steps[k]
    before = next((_blob(s, p.state_hash_after) for p in reversed(tr.steps[:k]) if p.state_hash_after), None)
    after = _blob(s, step.state_hash_after)
    changed = ({key: after.get(key) for key in after if before.get(key) != after.get(key)}
               if isinstance(before, dict) and isinstance(after, dict) else {})
    later = trail(tr, k)
    out = [f"Run {run_id}, step {k} of {len(tr.steps) - 1}: {step.kind} `{step.name}`",
           f"It used the results of steps {step.parents or 'none (it started from the task)'}."]
    out += [f"  saw from step {p} ({tr.steps[p].name}): {clip(tr.steps[p].error or tr.steps[p].output, 140)}"
            for p in step.parents]
    out.append(f"Asked: {clip(step.request, 300)}")
    out.append(f"Did: {clip(step.error or step.output, 300)}" + ("  [ERROR]" if step.error else ""))
    out.append(f"Memory before: {clip(before, 300) if before is not None else '(empty)'}")
    out.append(f"Memory changes here: {clip(changed, 300) if changed else 'none'}")
    out.append(f"Later steps that used this, directly or indirectly: {later or 'none'}"
               + (f" ({len(later)} of {len(tr.steps) - k - 1} later steps)" if later else ""))
    if tr.run.label and tr.run.label.root_cause_step == k:
        out.append("This is the known guilty step.")
    out.append(f"To change history here: call fork(run_id={run_id!r}, step_idx={k}, new_output_json=...).")
    return "\n".join(out)


def _mermaid_label(step) -> str:
    text = f"#{step.idx} {step.kind}: {step.name}<br/>{clip(step.error or step.output, 40)}"
    return text.replace('"', "'").replace("[", "(").replace("]", ")")


@tool("blame_map", "A Mermaid diagram of how information flowed through a run: guilty step red, the steps it "
      "contaminated orange, other suspects yellow. Render it for the user.", category="diagnosis",
      properties=RUN_ID, required=("run_id",))
def blame_map(run_id: str) -> str:
    from blackbox.diagnosis.evidence import trail
    from blackbox.diagnosis.graph_data import dataflow_parents

    tr = store().load_trace(run_id)
    failed = bool(tr.run.outcome and not tr.run.outcome.success)
    suspects = list(_diagnose(tr).get("suspects", [])) if failed else []
    guilty = tr.run.label.root_cause_step if tr.run.label else (suspects[0] if suspects else None)
    hit = set(trail(tr, guilty)) if guilty is not None else set()
    lines = ["flowchart TD"]
    lines += [f'  s{st.idx}["{_mermaid_label(st)}"]' for st in tr.steps]
    for i, parents in enumerate(dataflow_parents(tr)):
        lines += [f"  s{p} --> s{i}" for p in parents]
    lines += ["  classDef guilty fill:#fee2e2,stroke:#dc2626,stroke-width:3px",
              "  classDef hit fill:#ffedd5,stroke:#ea580c",
              "  classDef suspect fill:#fef9c3,stroke:#ca8a04"]
    if guilty is not None:
        lines.append(f"  class s{guilty} guilty")
    if hit:
        lines.append(f"  class {','.join(f's{i}' for i in sorted(hit))} hit")
    others = [i for i in suspects if i != guilty and i not in hit]
    if others:
        lines.append(f"  class {','.join(f's{i}' for i in others)} suspect")
    head = (f"Run {run_id} ({'FAIL' if failed else 'PASS'}). Guilty step: {guilty}; it contaminated "
            f"{sorted(hit) or 'nothing'}; model suspects {suspects}.")
    return head + "\n\n```mermaid\n" + "\n".join(lines) + "\n```"
