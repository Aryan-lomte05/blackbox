"""Canonical JSON and content fingerprints.

The same value must always produce the same fingerprint, on every machine,
or step re-use and blob de-duplication silently stop working.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any


def _default(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, (set, frozenset)):
        return sorted(value, key=repr)
    if isinstance(value, bytes):
        return value.hex()
    return repr(value)


def canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=_default)


def fingerprint(value: Any) -> str:
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def step_input_hash(kind: str, name: str, request: dict, read_values: dict) -> str:
    """The re-use key: same kind, same target, same request, same memory read."""
    return fingerprint({"kind": kind, "name": name, "request": request, "reads": read_values})
