"""Privacy guard (USP X9): mask personal data and secrets before a recording is saved.

On with `BLACKBOX_REDACT=1` or `Store(redact=True)`. Masks emails, phone
numbers, card numbers (Luhn-checked) and common API-key shapes, everywhere
inside requests, outputs and save-points.

Trade-off, stated plainly: a replay serves what was stored, so a step whose
recorded output was masked replays with the masked text.
"""

from __future__ import annotations

import re
from typing import Any

_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("API_KEY", re.compile(r"\b(?:sk-[A-Za-z0-9_\-]{16,}|gsk_[A-Za-z0-9]{20,}|sk-or-v1-[A-Za-z0-9]{20,}"
                           r"|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|hf_[A-Za-z0-9]{30,})\b")),
    ("EMAIL", re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")),
    ("CARD", re.compile(r"\b(?:\d[ \-]?){13,19}\b")),
    ("PHONE", re.compile(r"(?<![\w.])\+?\(?\d[\d \-()]{8,}\d(?![\w.])")),  # >= 10 digits checked below
]


def _luhn(digits: str) -> bool:
    nums = [int(c) for c in digits if c.isdigit()]
    if not 13 <= len(nums) <= 19:
        return False
    total = 0
    for i, n in enumerate(reversed(nums)):
        if i % 2:
            n = n * 2 - 9 if n > 4 else n * 2
        total += n
    return total % 10 == 0


def redact_text(text: str) -> tuple[str, int]:
    count = 0
    for label, pattern in _PATTERNS:
        def sub(m: re.Match, label=label) -> str:
            nonlocal count
            if label == "CARD" and not _luhn(m.group(0)):
                return m.group(0)
            if label == "PHONE" and sum(c.isdigit() for c in m.group(0)) < 10:
                return m.group(0)
            count += 1
            return f"[{label}]"

        text = pattern.sub(sub, text)
    return text, count


def redact(value: Any) -> tuple[Any, int]:
    """Recursively mask strings inside dicts/lists. Returns (masked value, number of masks)."""
    if isinstance(value, str):
        return redact_text(value)
    if isinstance(value, dict):
        total, out = 0, {}
        for k, v in value.items():
            out[k], n = redact(v)
            total += n
        return out, total
    if isinstance(value, list):
        total, out_list = 0, []
        for v in value:
            masked, n = redact(v)
            out_list.append(masked)
            total += n
        return out_list, total
    return value, 0
