"""A value recomputed in the background, so a request never waits for a slow probe.

The live status (process scan, GPU / Ollama probe, data totals) takes seconds to compute, and the dashboard
polls it from every page. A Snapshot recomputes it on a daemon thread every `every` seconds; requests get the
latest value at once (the first request waits for the first computation). A failed refresh keeps the last
good value and is reported in it.
"""

from __future__ import annotations

import atexit
import threading
import time
import traceback
from typing import Any, Callable


class Snapshot:
    def __init__(self, compute: Callable[[], dict], every: float = 10.0):
        self._compute = compute
        self._every = every
        self._value: dict | None = None
        self._lock = threading.Lock()
        self._ready = threading.Event()
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()

    def _refresh(self) -> None:
        try:
            value = self._compute()
            value = {**value, "snapshot_age_s": 0.0, "_computed_at": time.time()}
        except Exception as exc:  # noqa: BLE001 - keep serving the last good value; say why it is stale
            traceback.print_exc()
            with self._lock:
                if self._value is not None:
                    self._value = {**self._value, "snapshot_error": f"{type(exc).__name__}: {exc}"}
                    self._ready.set()
                    return
            value = {"snapshot_error": f"{type(exc).__name__}: {exc}", "_computed_at": time.time()}
        with self._lock:
            self._value = value
        self._ready.set()

    def _loop(self) -> None:
        while not self._stop.is_set():
            self._refresh()
            self._stop.wait(self._every)

    def stop(self) -> None:
        """End the refresh thread. Also runs at interpreter exit: a refresh that writes to stderr while Python is
        shutting down aborts the process (seen in CI: exit 134)."""
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=5)

    def get(self, timeout: float = 60.0) -> dict[str, Any]:
        if self._thread is None:
            with self._lock:
                if self._thread is None:
                    self._thread = threading.Thread(target=self._loop, name="status-snapshot", daemon=True)
                    self._thread.start()
                    atexit.register(self.stop)
        self._ready.wait(timeout)
        with self._lock:
            value = dict(self._value or {"snapshot_error": "status not computed yet"})
        computed = value.pop("_computed_at", None)
        if computed is not None:
            value["snapshot_age_s"] = round(time.time() - computed, 1)
        return value
