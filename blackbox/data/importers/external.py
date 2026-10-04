"""Import traces an agent already produces: OpenTelemetry (GenAI semantic conventions) and Langfuse.

No code change in the agent: give Black Box the trace files it already exports, and it can diagnose them,
fingerprint them, and show them in the atlas next to its own recordings.

    blackbox import otel traces.json         # OTLP JSON export, or a list of spans
    blackbox import langfuse trace.json      # a Langfuse trace export (with its observations)

Mapping:
  OpenTelemetry: gen_ai.operation.name chat / text_completion / generate_content -> llm step (model from
    gen_ai.request.model), execute_tool -> tool step (gen_ai.tool.name, arguments, result), retrieval -> retrieval
    step; span status ERROR -> step error. Container spans (invoke_agent, workflow) are not steps.
  Langfuse: GENERATION -> llm, SPAN named like retrieve / search -> retrieval, other SPAN -> tool, EVENT skipped;
    level ERROR -> step error.
Steps are ordered by start time; which step used which is inferred from content, as for wrapped agents.
Imported runs have no save-points, so they support diagnosis, fingerprints and the atlas, not replay.
"""

from __future__ import annotations

import json
from typing import Any, Iterable

from blackbox.core.hashing import fingerprint, step_input_hash
from blackbox.core.schema import Outcome, Run, Step, Trace
from blackbox.recorder.context import infer_parents

LLM_OPS = {"chat", "text_completion", "generate_content", "completion"}
RETRIEVAL_WORDS = ("retriev", "search", "vector", "rag")


def _text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False, default=str)


def _parse_json(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except ValueError:
            return value
    return value


def _build(source: str, trace_id: str, raw_steps: list[dict], *, failed: bool | None, name: str,
           answer: Any = None) -> Trace:
    """raw_steps: [{kind, name, request, output, error}] in execution order."""
    run_id = "ex" + fingerprint([source, trace_id])[:14]
    steps: list[Step] = []
    for idx, raw in enumerate(raw_steps):
        request = raw["request"]
        steps.append(Step(run_id=run_id, idx=idx, kind=raw["kind"], name=raw["name"] or raw["kind"], node=raw["kind"],
                          request=request, output=raw["output"], error=raw.get("error"),
                          parents=infer_parents(request, steps),
                          input_hash=step_input_hash(raw["kind"], raw["name"] or raw["kind"], request, {"i": idx})))
    if failed is None:
        failed = any(s.error for s in steps) or None
    outcome = (Outcome(success=not failed, score=float(not failed), final_answer=answer, expected=None,
                       checker=f"imported:{source}") if failed is not None else None)
    run = Run(run_id=run_id, task_family="external", task_id=f"{source}-{trace_id}"[:60],
              task_input={"name": name}, task_expected=None, agent=f"{source}/{name}"[:80], model_id="external",
              outcome=outcome, split="imported", status="done", machine=source, stats={"n_steps": len(steps)})
    return Trace(run=run, steps=steps)


# ---- OpenTelemetry -----------------------------------------------------------------------------------
def _otel_value(v: dict) -> Any:
    for key in ("stringValue", "intValue", "doubleValue", "boolValue"):
        if key in v:
            return v[key]
    if "arrayValue" in v:
        return [_otel_value(x) for x in v["arrayValue"].get("values", [])]
    return None


def _otel_attrs(span: dict) -> dict:
    attrs = span.get("attributes") or {}
    if isinstance(attrs, list):  # OTLP JSON: [{key, value: {stringValue: ...}}]
        return {a["key"]: _otel_value(a.get("value") or {}) for a in attrs}
    return dict(attrs)


def _otel_spans(doc: Any) -> list[dict]:
    if isinstance(doc, list):
        return doc
    spans = []
    for rs in doc.get("resourceSpans", []):
        for ss in rs.get("scopeSpans", rs.get("instrumentationLibrarySpans", [])):
            spans += ss.get("spans", [])
    return spans or doc.get("spans", [])


def _otel_step(span: dict) -> dict | None:
    a = _otel_attrs(span)
    op = str(a.get("gen_ai.operation.name") or "").lower()
    status = span.get("status") or {}
    error = (status.get("message") or "error") if str(status.get("code")) in ("2", "STATUS_CODE_ERROR") else None
    if op in LLM_OPS:
        messages = _parse_json(a.get("gen_ai.input.messages") or a.get("gen_ai.prompt") or [])
        out = _parse_json(a.get("gen_ai.output.messages") or a.get("gen_ai.completion") or "")
        model = a.get("gen_ai.request.model") or a.get("gen_ai.response.model") or "model"
        return {"kind": "llm", "name": str(model), "error": error,
                "request": {"model_id": str(model), "messages": messages if isinstance(messages, list) else [messages]},
                "output": {"text": _text(out)}}
    if op == "execute_tool":
        return {"kind": "tool", "name": str(a.get("gen_ai.tool.name") or span.get("name")), "error": error,
                "request": {"args": _parse_json(a.get("gen_ai.tool.call.arguments") or {})},
                "output": {"result": _parse_json(a.get("gen_ai.tool.call.result"))}}
    if op == "retrieval" or any(w in str(span.get("name", "")).lower() for w in RETRIEVAL_WORDS):
        return {"kind": "retrieval", "name": "search", "error": error,
                "request": {"args": {"query": a.get("gen_ai.retrieval.query") or a.get("db.query.text") or ""}},
                "output": {"docs": _parse_json(a.get("gen_ai.retrieval.documents") or [])}}
    return None  # a container span (agent, workflow, http): not a step


def from_otel(doc: Any, *, failed: bool | None = None) -> list[Trace]:
    by_trace: dict[str, list[dict]] = {}
    for span in _otel_spans(doc):
        by_trace.setdefault(str(span.get("traceId") or span.get("trace_id") or "t"), []).append(span)
    traces = []
    for trace_id, spans in by_trace.items():
        spans.sort(key=lambda s: int(s.get("startTimeUnixNano") or s.get("start_time") or 0))
        roots = [s for s in spans if not s.get("parentSpanId")]
        name = str(roots[0].get("name") if roots else spans[0].get("name") or "agent")
        root_failed = any(str((s.get("status") or {}).get("code")) in ("2", "STATUS_CODE_ERROR") for s in roots)
        steps = [st for st in (_otel_step(s) for s in spans) if st is not None]
        if steps:
            traces.append(_build("otel", trace_id, steps, failed=failed if failed is not None else (root_failed or None),
                                 name=name))
    return traces


# ---- Langfuse ----------------------------------------------------------------------------------------
def _langfuse_step(obs: dict) -> dict | None:
    typ, name = str(obs.get("type") or "").upper(), str(obs.get("name") or "")
    error = obs.get("statusMessage") or "error" if str(obs.get("level")).upper() == "ERROR" else None
    if typ == "GENERATION":
        model = obs.get("model") or name or "model"
        inp = obs.get("input")
        return {"kind": "llm", "name": str(model), "error": error,
                "request": {"model_id": str(model), "messages": inp if isinstance(inp, list) else [{"role": "user",
                                                                                                   "content": _text(inp)}]},
                "output": {"text": _text(obs.get("output"))}}
    if typ == "SPAN":
        if any(w in name.lower() for w in RETRIEVAL_WORDS):
            return {"kind": "retrieval", "name": "search", "error": error,
                    "request": {"args": {"query": _text(obs.get("input"))}}, "output": {"docs": obs.get("output") or []}}
        return {"kind": "tool", "name": name or "tool", "error": error,
                "request": {"args": obs.get("input") if isinstance(obs.get("input"), dict) else {"input": obs.get("input")}},
                "output": {"result": obs.get("output")}}
    return None


def from_langfuse(doc: Any, *, failed: bool | None = None) -> list[Trace]:
    docs: Iterable[dict] = doc if isinstance(doc, list) else doc.get("data", [doc]) if isinstance(doc, dict) else []
    traces = []
    for tr in docs:
        obs = sorted(tr.get("observations") or [], key=lambda o: str(o.get("startTime") or ""))
        steps = [st for st in (_langfuse_step(o) for o in obs) if st is not None]
        if steps:
            traces.append(_build("langfuse", str(tr.get("id") or "t"), steps, failed=failed,
                                 name=str(tr.get("name") or "agent"), answer=tr.get("output")))
    return traces


IMPORTERS = {"otel": from_otel, "langfuse": from_langfuse}


def import_file(store, fmt: str, path: str, *, failed: bool | None = None) -> list[Trace]:
    """Read one export file, convert it, save every trace. Returns the imported traces."""
    if fmt not in IMPORTERS:
        raise KeyError(f"unknown format {fmt!r}; known: {', '.join(IMPORTERS)}")
    with open(path, encoding="utf-8") as fh:
        traces = IMPORTERS[fmt](json.load(fh), failed=failed)
    for tr in traces:
        store.save_trace(tr)
    return traces


def main(argv: list[str] | None = None) -> int:
    import argparse

    from blackbox.core.store import DEFAULT_DIR, Store

    ap = argparse.ArgumentParser(description="Import OpenTelemetry / Langfuse traces into the Black Box store.")
    ap.add_argument("format", choices=sorted(IMPORTERS))
    ap.add_argument("files", nargs="+")
    ap.add_argument("--failed", action="store_true", help="mark the imported runs as failed (when the export has no verdict)")
    ap.add_argument("--data", default=str(DEFAULT_DIR))
    args = ap.parse_args(argv)
    store = Store(args.data)
    try:
        for path in args.files:
            for tr in import_file(store, args.format, path, failed=True if args.failed else None):
                verdict = "no verdict" if tr.run.outcome is None else ("pass" if tr.run.outcome.success else "FAIL")
                print(f"imported {tr.run.run_id}: {len(tr.steps)} steps, {verdict}  ({path})")
    finally:
        store.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
