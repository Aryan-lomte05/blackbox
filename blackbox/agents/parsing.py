"""Reading the short 'LABEL: value' lines our agents ask models for.

Small models wrap output in markdown, repeat the label or add chatter. A
line we cannot parse is a path the agent handles, never an exception.
"""

from __future__ import annotations

import re


def field(text: str, label: str) -> str | None:
    """Value of the last 'LABEL: value' line in `text`, or None."""
    pattern = re.compile(rf"^[\s>*#`-]*\**{re.escape(label)}\**\s*[:=-]\s*(.*)$", re.IGNORECASE | re.MULTILINE)
    matches = pattern.findall(text or "")
    if not matches:
        return None
    value = matches[-1].strip().strip("`*\"' ").strip()
    return value or None


def clip(text: str, limit: int) -> str:
    text = " ".join(str(text).split())
    return text if len(text) <= limit else text[: limit - 3].rstrip() + "..."
