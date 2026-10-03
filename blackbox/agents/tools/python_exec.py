"""Run a short Python snippet in a separate process with a hard timeout."""

from __future__ import annotations

import subprocess
import sys

from blackbox.agents.tools.registry import tool

TIMEOUT_S = 5
MAX_OUTPUT_CHARS = 2000


@tool("python_exec", "Run a short Python snippet and return what it prints.", category="math")
def python_exec(code: str) -> str:
    """Run Python code and return its stdout.

    Args:
        code: a short, self-contained snippet that print()s its result.
    """
    try:
        # -I: isolated mode, so the snippet cannot import from the working directory
        proc = subprocess.run(
            [sys.executable, "-I", "-c", code],
            capture_output=True, text=True, timeout=TIMEOUT_S, stdin=subprocess.DEVNULL, check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise TimeoutError(f"python_exec exceeded {TIMEOUT_S} s") from exc
    if proc.returncode != 0:
        last = (proc.stderr.strip().splitlines() or ["unknown error"])[-1]
        raise RuntimeError(f"python_exec failed: {last[:300]}")
    return proc.stdout.strip()[:MAX_OUTPUT_CHARS]
