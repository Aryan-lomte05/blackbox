from __future__ import annotations

from blackbox.agents.base import run_task
from blackbox.core.privacy import redact
from blackbox.core.store import Store
from blackbox.recorder import providers
from blackbox.recorder.providers import LLMResult
from blackbox.replay.advisor import advise
from tests.test_verify_autopilot_repair import TASK, CapitalAgent, model


def test_advisor_finds_safe_and_unsafe_downgrades(tmp_path):
    providers.register_fake("agent-strong", model("Paris"))
    providers.register_fake("agent-weak", model("Lyon"))
    try:
        store = Store(tmp_path)
        tr = run_task(CapitalAgent(), TASK, "agent-strong", store=store)
        assert tr.run.outcome.success
        out = advise(tr, "agent-weak", store=store)
        assert out["steps_checked"] == 1 and out["safe_to_downgrade"] == []  # weak model breaks it
        providers.register_fake("agent-cheap", model("Paris"))
        out = advise(tr, "agent-cheap", store=store)
        assert out["safe_to_downgrade"] == [0] and out["tokens_movable"] == 7
        assert "usd_saved_per_run" not in out  # no prices configured: nothing invented
    finally:
        providers.clear_fakes()


def test_redaction_masks_pii_and_keys_but_keeps_ordinary_numbers():
    text = ("mail aryan@example.com, call +91 98765 43210, card 4111 1111 1111 1111, "
            "key gsk_abcdefghijklmnopqrstuvwxyz123456, order 12345, year 2026")
    masked, n = redact({"m": [text]})
    out = masked["m"][0]
    assert "[EMAIL]" in out and "[PHONE]" in out and "[CARD]" in out and "[API_KEY]" in out
    assert "12345" in out and "2026" in out and n == 4


def test_store_redacts_what_it_saves(tmp_path):
    providers.register_fake("agent-strong", lambda m, t, p: LLMResult("reach me at a.b@corp.io", [], "stop", 1, 1, "f", "x"))
    try:
        store = Store(tmp_path, redact=True)
        tr = run_task(CapitalAgent(), TASK, "agent-strong", store=store)
        saved = store.load_trace(tr.run.run_id)
        assert "a.b@corp.io" not in saved.model_dump_json() and saved.run.stats["privacy_masks"] >= 1
        assert saved.steps[0].input_hash == tr.steps[0].input_hash
    finally:
        providers.clear_fakes()
