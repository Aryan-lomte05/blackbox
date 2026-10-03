#!/usr/bin/env bash
# Overnight pipeline on Aryan's 4060: balanced data -> checker backfill -> retrain + evaluate.
# Each stage logs to data/logs/overnight_<stage>.log and updates data/status/queue.json.
set -u
cd "$(dirname "$0")/.."
export PYTHONUNBUFFERED=1 PYTHONIOENCODING=utf-8 USE_TF=0 TRANSFORMERS_NO_TF=1
mark() {  # mark "<name>" <state> "<note>"
  py -3 - "$1" "$2" "$3" <<'PY'
import json, sys
from pathlib import Path
p = Path("data/status/queue.json"); q = json.loads(p.read_text(encoding="utf-8")) if p.exists() else []
name, state, note = sys.argv[1:4]
for j in q:
    if j["name"] == name:
        j.update(state=state, note=note); break
else:
    q.append({"name": name, "state": state, "note": note})
p.write_text(json.dumps(q, indent=2), encoding="utf-8")
PY
}
run() {  # run "<name>" <log> <cmd...>
  local name="$1" log="data/logs/overnight_$2.log"; shift 2
  mark "$name" running "log: $log"
  if "$@" > "$log" 2>&1; then mark "$name" done "$(tail -n 3 "$log" | tr '\n' ' ' | cut -c1-220)";
  else mark "$name" failed "exit $? - see $log"; fi
}
run "Overnight 1: farm Math, balanced tool mistakes (offset 1100-1319)" farm_math \
  py -3 -m blackbox.data.farm --family math --n 219 --offset 1100 --model agent-local-7b --forks 4 --workers 2 --seed 11 --faults F1,F2,F3,F6
run "Overnight 2: farm QA, balanced search mistakes (offset 2300-2550)" farm_qa \
  py -3 -m blackbox.data.farm --family qa --n 250 --offset 2300 --model agent-local-7b --forks 4 --workers 2 --seed 11 --faults F4,F5,F6
run "Overnight 3: checker (Laya) backfill on every recorded step" backfill \
  py -3 scripts/backfill_monitor.py
run "Overnight 4: retrain diagnosis model (CV-chosen variant) + evaluate" retrain \
  py -3 -m blackbox.diagnosis.gnn train --variant with_real_failures
run "Overnight 5: dataset export for the team" export \
  py -3 -m blackbox.data.dataset export --out data/dataset/blackbox-3k
