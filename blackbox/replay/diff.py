"""Line up two runs step by step, the way `diff` lines up two files (SYSTEM.md §4.5, U7).

Global alignment (Needleman–Wunsch). Two steps match well when they are the
same kind and target and their outputs are similar.
"""

from __future__ import annotations

from difflib import SequenceMatcher
from typing import Any, Literal

from blackbox.core.hashing import canonical
from blackbox.core.schema import Step, Trace

GAP = -0.6
PairStatus = Literal["same", "changed", "only_a", "only_b"]


def _text(step: Step) -> str:
    return canonical(step.output if step.error is None else {"error": step.error})[:2000]


def _score(a: Step, b: Step) -> float:
    if a.kind != b.kind:
        return -1.0
    base = 0.5 if a.name == b.name else 0.1
    if a.input_hash == b.input_hash and _text(a) == _text(b):
        return base + 1.0
    return base + SequenceMatcher(None, _text(a), _text(b)).ratio()


def align(a: list[Step], b: list[Step]) -> list[tuple[int | None, int | None]]:
    n, m = len(a), len(b)
    dp = [[0.0] * (m + 1) for _ in range(n + 1)]
    back = [[0] * (m + 1) for _ in range(n + 1)]  # 0 diag, 1 up (only a), 2 left (only b)
    for i in range(1, n + 1):
        dp[i][0], back[i][0] = dp[i - 1][0] + GAP, 1
    for j in range(1, m + 1):
        dp[0][j], back[0][j] = dp[0][j - 1] + GAP, 2
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            options = (dp[i - 1][j - 1] + _score(a[i - 1], b[j - 1]), dp[i - 1][j] + GAP, dp[i][j - 1] + GAP)
            best = max(range(3), key=lambda k: options[k])
            dp[i][j], back[i][j] = options[best], best
    pairs: list[tuple[int | None, int | None]] = []
    i, j = n, m
    while i > 0 or j > 0:
        move = back[i][j] if i > 0 and j > 0 else (1 if i > 0 else 2)
        if move == 0:
            pairs.append((i - 1, j - 1))
            i, j = i - 1, j - 1
        elif move == 1:
            pairs.append((i - 1, None))
            i -= 1
        else:
            pairs.append((None, j - 1))
            j -= 1
    return pairs[::-1]


def _state_diff(a: Step, b: Step) -> dict:
    keys = set(a.state_diff) | set(b.state_diff)
    out = {}
    for k in sorted(keys):
        va = a.state_diff.get(k, {}).get("after")
        vb = b.state_diff.get(k, {}).get("after")
        if canonical(va) != canonical(vb):
            out[k] = {"a": va, "b": vb}
    return out


def compare(a: Trace, b: Trace) -> dict[str, Any]:
    pairs = []
    first_divergence: int | None = None
    for pos, (i, j) in enumerate(align(a.steps, b.steps)):
        if i is not None and j is not None:
            sa, sb = a.steps[i], b.steps[j]
            same = sa.kind == sb.kind and sa.name == sb.name and _text(sa) == _text(sb) \
                and canonical(sa.request) == canonical(sb.request)
            status: PairStatus = "same" if same else "changed"
            entry = {"a": i, "b": j, "status": status}
            if not same:
                entry["state_diff"] = _state_diff(sa, sb)
        else:
            status = "only_a" if i is not None else "only_b"
            entry = {"a": i, "b": j, "status": status}
        if status != "same" and first_divergence is None:
            first_divergence = pos
        pairs.append(entry)
    oa, ob = a.run.outcome, b.run.outcome
    return {
        "a": a.run.run_id,
        "b": b.run.run_id,
        "pairs": pairs,
        "first_divergence": first_divergence,
        "n_changed": sum(p["status"] != "same" for p in pairs),
        "outcome": {
            "a": oa.model_dump(mode="json") if oa else None,
            "b": ob.model_dump(mode="json") if ob else None,
            "flipped": bool(oa and ob and oa.success != ob.success),
        },
    }
