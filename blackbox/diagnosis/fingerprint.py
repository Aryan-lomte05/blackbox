"""Failure fingerprints: "have we seen this failure before?"

A fingerprint is a small set of readable tokens describing HOW a run failed: where the cause sits (kind,
tool, position), what the cause looked like (empty result, tool error, repeated query, answered early),
and how far it spread. Two failures with similar fingerprints failed the same way, even on different
questions. Over the labelled failures this gives:
  - similar past failures (Jaccard similarity), and what caused them;
  - NOVEL failures: nothing in the library looks like this one (a failure mode nobody taught us);
  - known fixes: rules the fleet firewall APPROVED for look-alike failures (data/fleet/*.json).
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from blackbox.core.schema import Trace
from blackbox.core.store import Store
from blackbox.diagnosis.evidence import trail

CACHE_NAME = "fingerprints.json"
FLEET_DIR = "fleet"
NOVEL_BELOW = 0.45


def _empty(out: Any) -> bool:
    if not isinstance(out, dict):
        return out in (None, "", [], {})
    val = out.get("result", out.get("docs", out.get("text", out)))
    return val in (None, "", [], {}, 0) or (isinstance(val, str) and val.strip().lower() in ("none", "null", "unknown"))


def cause_of(trace: Trace, diagnosis: dict | None = None) -> int | None:
    if trace.run.label and trace.run.label.root_cause_step is not None:
        return trace.run.label.root_cause_step
    sus = (diagnosis or {}).get("suspects") or []
    return sus[0] if sus else None


def fingerprint(trace: Trace, cause: int | None) -> dict:
    steps = trace.steps
    toks = {f"family:{trace.run.task_family}"}
    if cause is None or not 0 <= cause < len(steps):
        toks.add("cause:unknown")
        return {"id": "FP-" + hashlib.sha1("|".join(sorted(toks)).encode()).hexdigest()[:6], "tokens": sorted(toks),
                "cause": None}
    st = steps[cause]
    name = "llm" if st.kind == "llm" else st.name
    pos = cause / max(1, len(steps) - 1)
    toks |= {f"cause:{st.kind}", f"cause_name:{name}",
             f"position:{'start' if cause == 0 else 'early' if pos < 0.34 else 'middle' if pos < 0.67 else 'late'}"}
    if st.error:
        toks.add("signal:error")
    if st.kind in ("tool", "retrieval") and _empty(st.output):
        toks.add("signal:empty_result")
    args = json.dumps(st.request.get("args"), sort_keys=True, default=str) if st.kind != "llm" else None
    if args and any(p.kind == st.kind and json.dumps(p.request.get("args"), sort_keys=True, default=str) == args
                    for p in steps[:cause]):
        toks.add("signal:repeated_call")
    if st.kind == "llm":
        text = str((st.output or {}).get("text") or "")
        if text.upper().startswith("ANSWER") and cause <= 2:
            toks.add("signal:answered_early")
        if (st.output or {}).get("tool_calls"):
            toks.add("signal:chose_tool")
    hit = trail(trace, cause)
    toks.add(f"spread:{'none' if not hit else 'some' if len(hit) < 3 else 'wide'}")
    if any(steps[i].kind == "final" for i in hit):
        toks.add("spread:reaches_answer")
    downstream = "→".join(dict.fromkeys(("llm" if steps[i].kind == "llm" else steps[i].kind) for i in hit[:4]))
    if downstream:
        toks.add(f"path:{downstream}")
    core = sorted(t for t in toks if t.startswith(("cause:", "cause_name:", "signal:", "position:")))
    return {"id": "FP-" + hashlib.sha1("|".join(core).encode()).hexdigest()[:6], "tokens": sorted(toks), "cause": cause}


def _jaccard(a: set, b: set) -> float:
    return len(a & b) / len(a | b) if a or b else 0.0


def library(store: Store, rebuild: bool = False) -> dict[str, dict]:
    """Fingerprints of every labelled failure, cached in the data folder."""
    path = Path(store.root) / CACHE_NAME
    lib: dict[str, dict] = {}
    if path.exists() and not rebuild:
        lib = json.loads(path.read_text(encoding="utf-8"))
    runs = store.list_runs(success=False, has_label=True, limit=100_000)
    missing = [r for r in runs if r.run_id not in lib]
    for r in missing:
        fp = fingerprint(store.load_trace(r.run_id), r.label.root_cause_step)
        lib[r.run_id] = {**fp, "family": r.task_family, "fault": r.fault.type if r.fault else None,
                         "source": r.label.source}
    if missing:
        path.write_text(json.dumps(lib), encoding="utf-8")
    return lib


def known_fixes(store: Store, fp_id: str, tokens: set[str]) -> list[dict]:
    out = []
    for f in sorted((Path(store.root) / FLEET_DIR).glob("*.json")):
        rep = json.loads(f.read_text(encoding="utf-8"))
        src = rep.get("fingerprint") or {}
        sim = 1.0 if src.get("id") == fp_id else _jaccard(tokens, set(src.get("tokens", [])))
        if rep.get("decision") == "APPROVE" and sim >= 0.6:
            out.append({"rule": rep["change"].get("instruction"), "model": rep["change"].get("model"),
                        "fixed": rep["counts"]["fixed"], "of": rep["failures_tested"], "similarity": round(sim, 2),
                        "report": f.name})
    return sorted(out, key=lambda x: (-x["similarity"], -x["fixed"]))


def similar(store: Store, trace: Trace, diagnosis: dict | None = None, k: int = 5) -> dict:
    fp = fingerprint(trace, cause_of(trace, diagnosis))
    mine = set(fp["tokens"])
    lib = library(store)
    scored = sorted(((_jaccard(mine, set(v["tokens"])), rid, v) for rid, v in lib.items()
                     if rid != trace.run.run_id), key=lambda x: -x[0])
    top = [{"run_id": rid, "similarity": round(sim, 2), "fingerprint": v["id"], "cause": v["cause"],
            "fault": v["fault"], "family": v["family"], "source": v["source"]} for sim, rid, v in scored[:k]]
    same_id = [v for _, _, v in scored if v["id"] == fp["id"]]
    best = scored[0][0] if scored else 0.0
    faults: dict[str, int] = {}
    for v in same_id:
        faults[v["fault"] or "natural"] = faults.get(v["fault"] or "natural", 0) + 1
    return {"run_id": trace.run.run_id, "fingerprint": fp, "same_fingerprint": len(same_id),
            "same_fingerprint_causes": faults, "library_size": len(lib), "closest": top,
            "best_similarity": round(best, 2), "novel": best < NOVEL_BELOW,
            "known_fixes": known_fixes(store, fp["id"], mine)}


def save_fleet_report(store: Store, report: dict, trace: Trace) -> Path:
    """Remember a fleet result under the source failure's fingerprint (feeds known_fixes)."""
    d = Path(store.root) / FLEET_DIR
    d.mkdir(parents=True, exist_ok=True)
    report = {**report, "fingerprint": fingerprint(trace, cause_of(trace))}
    path = d / f"{trace.run.run_id}-{hashlib.sha1(json.dumps(report['change'], sort_keys=True).encode()).hexdigest()[:6]}.json"
    path.write_text(json.dumps(report, default=str, indent=1), encoding="utf-8")
    return path
