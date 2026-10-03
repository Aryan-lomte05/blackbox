"""Suite-wide test settings."""

from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _no_real_verify_model(monkeypatch, request):
    """Verify's default model is a real local model (BLACKBOX_VERIFY_MODEL, default agent-local-7b). Tests must never
    call it: point the default at an id no registry has, so an accidental use fails fast instead of calling Ollama.
    Tests that verify pass their fake model explicitly. Live tests (-m live) keep the real setting."""
    if request.node.get_closest_marker("live") is None:
        monkeypatch.setenv("BLACKBOX_VERIFY_MODEL", "test-no-verify-model")
