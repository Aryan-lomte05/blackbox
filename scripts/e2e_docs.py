"""End-to-end check of every /docs use case against a running server.

    blackbox ui --port 8001            (in another terminal)
    py -3 scripts/e2e_docs.py --base http://127.0.0.1:8001

Calls every endpoint with every example from its Swagger dropdown (read from
/openapi.json, so it tests exactly what a presenter would click), checks the
answer makes sense, and writes data/reports/e2e_docs.md. Exit code 1 if any
case fails.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

RESULTS: list[dict] = []


def call(base, method, path, body=None, timeout=900):
    req = urllib.request.Request(base + path, method=method,
                                 data=None if body is None else json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    t = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b"null"), time.perf_counter() - t
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")[:300], time.perf_counter() - t


def record(endpoint, case, ok, seconds, detail):
    RESULTS.append({"endpoint": endpoint, "case": case, "ok": bool(ok), "s": round(seconds, 1), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}  {endpoint:34} {case:28} {seconds:6.1f}s  {detail}", flush=True)


def wait_job(base, job_id, limit=900):
    t = time.perf_counter()
    while time.perf_counter() - t < limit:
        code, body, _ = call(base, "GET", f"/api/jobs/{job_id}")
        if code == 200 and body["finished"]:
            return body, time.perf_counter() - t
        time.sleep(2)
    return None, time.perf_counter() - t


def examples(spec, path, method, where, name=None):
    op = spec["paths"][path][method]
    if where == "body":
        return op.get("requestBody", {}).get("content", {}).get("application/json", {}).get("examples", {})
    for p in op.get("parameters", []):
        if p["name"] == name:
            return p.get("examples", {})
    return {}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8001")
    ap.add_argument("--skip-repair", action="store_true", help="skip GenAI repair (uses the rate-limited big model)")
    ap.add_argument("--skip-lab", action="store_true", help="skip the Live Lab (several minutes)")
    args = ap.parse_args()
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")
    B = args.base
    _, spec, _ = call(B, "GET", "/openapi.json")

    # Status, dataset, health
    for path, check in (("/api/health", lambda b: b["db"]["runs"] > 0),
                        ("/api/status", lambda b: "queue" in b and b["counts"]["runs"] > 0),
                        ("/api/dataset", lambda b: b["summary"]["labelled_failures"] > 0)):
        code, body, s = call(B, "GET", path)
        record(path, "-", code == 200 and check(body), s, f"HTTP {code}")

    # 1 List runs: every enum filter value
    for outcome in ("pass", "fail"):
        code, body, s = call(B, "GET", f"/api/runs?outcome={outcome}&limit=5")
        record("1 list runs", f"outcome={outcome}", code == 200 and body["runs"] and all(
            (r["outcome"] or {}).get("success") == (outcome == "pass") for r in body["runs"]), s, f"{len(body['runs'])} runs")
    for fam in ("qa", "math", "ops"):
        code, body, s = call(B, "GET", f"/api/runs?family={fam}&labelled=true&limit=5")
        record("1 list runs", f"family={fam} labelled", code == 200 and all(r["task_family"] == fam for r in body["runs"]), s,
               f"{len(body['runs'])} runs")

    run_ex = examples(spec, "/api/runs/{run_id}", "get", "param", "run_id")
    # 2 Open a run + one step
    for k, ex in run_ex.items():
        code, body, s = call(B, "GET", f"/api/runs/{ex['value']}")
        record("2 open run", k, code == 200 and body["steps"], s, f"{len(body['steps'])} steps" if code == 200 else body)
        code, body, s = call(B, "GET", f"/api/runs/{ex['value']}/steps/0")
        record("   step 0 + save-point", k, code == 200 and body["state_after"] is not None, s, f"HTTP {code}")

    # 3 Diagnose every failed example
    diag_ex = examples(spec, "/api/runs/{run_id}/diagnosis", "get", "param", "run_id")
    for k, ex in diag_ex.items():
        code, body, s = call(B, "GET", f"/api/runs/{ex['value']}/diagnosis")
        ok = code == 200 and len(body.get("suspects", [])) >= 1
        record("3 diagnose", k, ok, s, f"top3 {body.get('suspects')} guilty {body.get('known_guilty_step')} in top3 {body.get('guilty_in_top3')}" if ok else body)

    # 4 Verify + 5 job result (each failed example, quick body)
    v_ex = examples(spec, "/api/runs/{run_id}/verify", "post", "param", "run_id")
    for k, ex in v_ex.items():
        code, body, s = call(B, "POST", f"/api/runs/{ex['value']}/verify", {"suspects": None, "repeats": 1})
        if code != 200:
            record("4 verify", k, False, s, body)
            continue
        job, js = wait_job(B, body["job_id"])
        res = (job or {}).get("result") or {}
        ok = job is not None and "suspects" in res
        record("4 verify + 5 job result", k, ok, s + js,
               f"verified step {res.get('verified_step')}, suspects tested {len(res.get('suspects', []))}" if ok else (job or "timeout"))

    # 6 Fork: each body with its matching run (same example name)
    f_runs = examples(spec, "/api/runs/{run_id}/fork", "post", "param", "run_id")
    f_bodies = examples(spec, "/api/runs/{run_id}/fork", "post", "body")
    for k, ex in f_bodies.items():
        rid = f_runs[k]["value"]
        code, body, s = call(B, "POST", f"/api/runs/{rid}/fork", ex["value"])
        ok = code == 200 and body["status"] == "done"
        expect = {"undo_planted_mistake": True, "plant_a_mistake": False}.get(k)
        passed = (body.get("outcome") or {}).get("success") if ok else None
        sv = body.get("savings", {}) if ok else {}
        record("6 fork", k, ok and (expect is None or passed == expect), s,
               f"passed={passed} (expected {expect}); re-ran {sv.get('steps_executed')}/{sv.get('steps_total')}, re-used {sv.get('steps_reused')}, saved {sv.get('tokens_saved')} tokens" if ok else body)

    # 7 Compare
    a = examples(spec, "/api/compare", "get", "param", "a")
    b = examples(spec, "/api/compare", "get", "param", "b")
    for k in a:
        code, body, s = call(B, "GET", f"/api/compare?a={a[k]['value']}&b={b[k]['value']}")
        record("7 compare", k, code == 200 and body["outcome"]["flipped"], s,
               f"first difference {body.get('first_divergence')}, flipped {body['outcome']['flipped']}" if code == 200 else body)

    # 8 Replay every example run: 0 model calls, same outcome
    r_ex = examples(spec, "/api/runs/{run_id}/replay", "post", "param", "run_id")
    for k, ex in r_ex.items():
        code, body, s = call(B, "POST", f"/api/runs/{ex['value']}/replay")
        ok = code == 200 and body["model_calls_made"] == 0
        record("8 replay", k, ok, s, f"model calls {body.get('model_calls_made')}" if code == 200 else body)

    # 9 Repair (one case: uses the big model)
    if not args.skip_repair:
        rp_runs = examples(spec, "/api/runs/{run_id}/repair", "post", "param", "run_id")
        rp_bodies = examples(spec, "/api/runs/{run_id}/repair", "post", "body")
        k = next(iter(rp_bodies))
        code, body, s = call(B, "POST", f"/api/runs/{rp_runs[k]['value']}/repair", rp_bodies[k]["value"])
        job, js = wait_job(B, body["job_id"]) if code == 200 else (None, 0)
        res = (job or {}).get("result") or {}
        record("9 repair", k, job is not None and "cards" in res, s + js,
               f"{len(res.get('cards', []))} fixes tried, {sum(c['passed'] for c in res.get('cards', []))} passed" if res else (job or body))

    # 10 Advisor
    ad = examples(spec, "/api/runs/{run_id}/advise", "post", "param", "run_id")
    for k, ex in ad.items():
        code, body, s = call(B, "POST", f"/api/runs/{ex['value']}/advise?cheaper_model=agent-local")
        job, js = wait_job(B, body["job_id"]) if code == 200 else (None, 0)
        res = (job or {}).get("result") or {}
        record("10 advisor", k, job is not None and "rows" in res, s + js,
               f"{res.get('steps_checked')} model calls checked, safe to downgrade {res.get('safe_to_downgrade')}" if res else (job or body))

    # 11 Live runs: every family example, then open the run it recorded
    live = examples(spec, "/api/runs", "post", "body")
    for k, ex in live.items():
        code, body, s = call(B, "POST", "/api/runs", ex["value"])
        job, js = wait_job(B, body["job_id"]) if code == 200 else (None, 0)
        res = (job or {}).get("result") or {}
        ok = res.get("status") == "done"
        if ok:
            c2, run, _ = call(B, "GET", f"/api/runs/{res['run_id']}")
            ok = c2 == 200 and len(run["steps"]) > 1
        record("11 live run", k, ok, s + js,
               f"status {res.get('status')}, passed {(res.get('outcome') or {}).get('success')}, error {res.get('error')}" if res else (job or body))

    # SSE stream of a finished job replays its full history
    if RESULTS and call(B, "GET", "/api/runs?limit=1")[0] == 200:
        code, body, s = call(B, "POST", f"/api/runs/{v_ex[next(iter(v_ex))]['value']}/verify", {"suspects": [0], "repeats": 1})
        if code == 200:
            wait_job(B, body["job_id"])
            with urllib.request.urlopen(f"{B}/api/jobs/{body['job_id']}/events", timeout=60) as r:
                text = r.read().decode()
            record("jobs SSE stream", "verify history", "event: done" in text, s, f"{text.count('event:')} events")

    # ★ Investigate every case (+ repair once)
    for case in ("model_finds_it", "model_misses_it", "shop_new_task_type", "math_failure", "real_failure_verified",
                 "real_failure_unlabelled"):
        code, body, s = call(B, "POST", f"/api/investigate/{case}")
        ok = code == 200 and len(body.get("story", [])) >= 5
        record("★ investigate", case, ok, s,
               f"cause {body['verification']['verified_cause']}, known {body['case']['known_guilty_step']}, top3 {body['diagnosis']['top3']}" if ok else body)
    if not args.skip_repair:
        code, body, s = call(B, "POST", "/api/investigate/model_finds_it?repair=true")
        ok = code == 200 and (body.get("repair") is not None or body["verification"]["verified_cause"] is None)
        record("★ investigate +repair", "model_finds_it", ok, s,
               f"repairs {body['repair']['passed']}/{body['repair']['tried']} passed" if ok and body.get("repair") else body if not ok else "no verified cause, no repair")

    # UI platform endpoints
    fr = examples(spec, "/api/runs/{run_id}/diagnosis", "get", "param", "run_id")
    rid = next(iter(fr.values()))["value"] if fr else None
    for path, check, label in (
        ("/api/ui/overview", lambda b: b["kpis"]["runs"] > 0 and b["recent_runs"], "overview"),
        (f"/api/runs/{rid}/graph", lambda b: b["nodes"] and all({"id", "position", "data"} <= set(n) for n in b["nodes"]), "graph"),
        ("/api/atlas", lambda b: b["total_failures"] > 0 and b["patterns"], "atlas"),
        (f"/api/runs/{rid}/diagnosis?model=ranker", lambda b: b.get("suspects") is not None, "diagnosis via ranker"),
    ):
        code, body, sec = call(B, "GET", path)
        record("UI " + label, "-", code == 200 and check(body), sec, f"HTTP {code}")
    for path, needle, label in ((f"/api/runs/{rid}/report", "case file", "report"),
                                (f"/api/runs/{rid}/export-test", "def test_run_", "export-test")):
        t = time.perf_counter()
        with urllib.request.urlopen(B + path, timeout=120) as r:
            body = r.read().decode()
        record("UI " + label, "-", needle in body, time.perf_counter() - t, f"{len(body)} chars")

    # Guardian: raise an incident from a failed example, then decide on it
    code, inc, sec = call(B, "POST", f"/api/incidents/from-run/{rid}")
    record("G3 raise incident", "model_finds_it", code == 200 and inc.get("incident_id"), sec,
           f"{inc.get('severity')} {inc.get('title')}" if code == 200 else inc)
    if code == 200:
        code2, dec, sec2 = call(B, "POST", f"/api/incidents/{inc['incident_id']}/decision",
                                {"approve": False, "by": "e2e", "note": "keep paused"})
        record("G4 decision", "reject", code2 == 200 and dec.get("status") == "rejected", sec2, f"HTTP {code2}")

    # Live Lab: one math question, streamed to the end
    if not args.skip_lab:
        code, body, sec = call(B, "POST", "/api/lab", {"question": "A bakery bakes 24 muffins per tray. It bakes 6 trays "
                                                                   "and sells 97 muffins. How many muffins are left?",
                                                       "mistake": "F6"})
        job, js = wait_job(B, body["job_id"], limit=1800) if code == 200 else (None, 0)
        stages = sorted({e.get("n") for e in (job or {}).get("events", []) if e.get("type") == "stage"})
        res = (job or {}).get("result") or {}
        record("★ Live Lab", "math F6", job is not None and res.get("planted") is not None, sec + js,
               f"stages seen {stages[:3]}..{stages[-3:] if stages else []}; planted {res.get('planted')}; "
               f"diagnosis hit {res.get('diagnosis_hit')}; verified {res.get('verified_cause')}" if res else (job or body))

    # Inspector page
    with urllib.request.urlopen(B + "/", timeout=30) as r:
        record("inspector page /", "-", r.status == 200 and b"Black Box Inspector" in r.read(), 0.0, "HTTP 200")

    n_ok = sum(r["ok"] for r in RESULTS)
    lines = [f"# /docs end-to-end check · {time.strftime('%Y-%m-%d %H:%M')} · {n_ok}/{len(RESULTS)} passed", "",
             "| | endpoint | case | seconds | detail |", "|---|---|---|---|---|"]
    lines += [f"| {'✅' if r['ok'] else '❌'} | {r['endpoint']} | {r['case']} | {r['s']} | {str(r['detail'])[:160]} |" for r in RESULTS]
    out = Path("data/reports/e2e_docs.md")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\n{n_ok}/{len(RESULTS)} passed -> {out}")
    return 0 if n_ok == len(RESULTS) else 1


if __name__ == "__main__":
    sys.exit(main())
