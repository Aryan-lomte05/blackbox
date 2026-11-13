from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from blackbox.api.main import create_app
from blackbox.auth.db import get_mongo_status, get_user_by_id, is_mongo_connected, upsert_user
from blackbox.auth.google import generate_state, is_google_configured, verify_state
from blackbox.auth.jwt_session import create_session_token, verify_session_token
from blackbox.core.store import Store


@pytest.fixture
def auth_client(tmp_path):
    store = Store(tmp_path)
    app = create_app(store)
    client = TestClient(app)
    yield client
    store.close()


def test_jwt_session_token_lifecycle():
    user = {
        "id": "usr_test_123",
        "email": "agent@blackbox.ai",
        "name": "Black Box Operator",
        "avatar": "https://example.com/avatar.png",
        "provider": "google",
    }
    token = create_session_token(user, days=1)
    assert isinstance(token, str) and len(token) > 20

    payload = verify_session_token(token)
    assert payload is not None
    assert payload["email"] == "agent@blackbox.ai"
    assert payload["user_id"] == "usr_test_123"

    # Bad token
    assert verify_session_token("invalid.token.here") is None
    assert verify_session_token("") is None


def test_oauth_state_tamper_proofing():
    state = generate_state("/runs/run-abc")
    assert state and "." in state

    # Verifies cleanly
    return_to = verify_state(state)
    assert return_to == "/runs/run-abc"

    # Tampered state
    raw, sig = state.split(".", 1)
    tampered_sig = sig[:-4] + "xxxx"
    assert verify_state(f"{raw}.{tampered_sig}") is None
    assert verify_state("tampered_state_without_period") is None


def test_user_persistence_layer():
    user = upsert_user(
        provider="test_provider",
        provider_user_id="puid_456",
        email="developer@test.org",
        name="Test Dev",
    )
    assert user["email"] == "developer@test.org"
    assert user["provider_user_id"] == "puid_456"
    uid = user["id"]

    found = get_user_by_id(uid)
    assert found is not None
    assert found["email"] == "developer@test.org"

    # Check status helper
    status = get_mongo_status()
    assert "configured" in status and "mode" in status


def test_auth_api_endpoints(auth_client: TestClient, monkeypatch):
    monkeypatch.setenv("BLACKBOX_DEV_LOGIN", "1")
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    # 1. Status endpoint
    status_res = auth_client.get("/api/auth/status")
    assert status_res.status_code == 200
    data = status_res.json()
    assert "google_configured" in data
    assert "mongodb" in data

    # 2. Unauthenticated /api/auth/me
    me_res = auth_client.get("/api/auth/me")
    assert me_res.status_code == 200
    assert me_res.json()["authenticated"] is False

    # 3. Dev login
    login_res = auth_client.post(
        "/api/auth/dev-login",
        json={"name": "Alice Tester", "email": "alice@blackbox.ai", "avatar": ""},
    )
    assert login_res.status_code == 200
    assert login_res.json()["authenticated"] is True
    assert login_res.json()["user"]["email"] == "alice@blackbox.ai"
    assert "blackbox_session" in login_res.cookies

    # 4. Authenticated /api/auth/me using returned cookie
    auth_client.cookies.set("blackbox_session", login_res.cookies["blackbox_session"])
    me_auth = auth_client.get("/api/auth/me")
    assert me_auth.status_code == 200
    assert me_auth.json()["authenticated"] is True
    assert me_auth.json()["user"]["name"] == "Alice Tester"

    # 5. Logout
    logout_res = auth_client.post("/api/auth/logout")
    assert logout_res.status_code == 200
    assert logout_res.json()["ok"] is True

    # 6. /api/auth/me is unauthenticated after cookie deletion
    # Clear client cookie locally as well to mirror browser cookie expiration
    auth_client.cookies.delete("blackbox_session")
    me_after = auth_client.get("/api/auth/me")
    assert me_after.json()["authenticated"] is False


def test_google_login_unconfigured_error(auth_client: TestClient, monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("GOOGLE_CLIENT_SECRET", raising=False)

    res = auth_client.get("/api/auth/google/login", follow_redirects=False)
    assert res.status_code == 400
    assert "Google OAuth is not configured" in res.json()["detail"]


def test_open_redirect_prevention():
    from blackbox.auth.google import sanitize_return_to

    # Valid internal paths
    assert sanitize_return_to("/overview") == "/overview"
    assert sanitize_return_to("/runs/run-123?tab=timeline") == "/runs/run-123?tab=timeline"

    # Malicious external redirects blocked and normalized to /overview
    assert sanitize_return_to("https://evil.com") == "/overview"
    assert sanitize_return_to("http://attacker.com/steal") == "/overview"
    assert sanitize_return_to("//evil.com") == "/overview"
    assert sanitize_return_to("/\\evil.com") == "/overview"
    assert sanitize_return_to("javascript:alert(1)") == "/overview"
    assert sanitize_return_to("") == "/overview"
    assert sanitize_return_to(None) == "/overview"



def test_dev_login_disabled_by_default(auth_client: TestClient, monkeypatch):
    monkeypatch.delenv("BLACKBOX_DEV_LOGIN", raising=False)
    res = auth_client.post("/api/auth/dev-login", json={"email": "anyone@evil.com"})
    assert res.status_code == 404
    assert "blackbox_session" not in res.cookies
    assert auth_client.get("/api/auth/status").json()["dev_login_enabled"] is False


def test_dev_login_refused_in_production_even_when_flag_set(auth_client: TestClient, monkeypatch):
    monkeypatch.setenv("BLACKBOX_DEV_LOGIN", "1")
    monkeypatch.setenv("ENVIRONMENT", "production")
    res = auth_client.post("/api/auth/dev-login", json={"email": "anyone@evil.com"})
    assert res.status_code == 404


def test_token_signed_with_old_public_default_secret_is_rejected(monkeypatch):
    import base64
    import hashlib
    import hmac
    import json

    monkeypatch.delenv("SESSION_SECRET", raising=False)
    public_secret = hashlib.sha256(b"blackbox-agent-flight-recorder-session-salt-2026").hexdigest()

    def b64(d: bytes) -> str:
        return base64.urlsafe_b64encode(d).decode().rstrip("=")

    h = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    p = b64(json.dumps({"sub": "x", "email": "victim@x.com", "exp": 9999999999}).encode())
    sig = b64(hmac.new(public_secret.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest())
    assert verify_session_token(f"{h}.{p}.{sig}") is None


def test_explicit_session_secret_is_used(monkeypatch):
    monkeypatch.setenv("SESSION_SECRET", "a" * 64)
    token = create_session_token({"id": "u1", "email": "e@x.com"})
    assert verify_session_token(token) is not None
    monkeypatch.setenv("SESSION_SECRET", "b" * 64)
    assert verify_session_token(token) is None


def test_oauth_callback_error_does_not_leak_exception_text(auth_client: TestClient, monkeypatch):
    import blackbox.api.auth as auth_api

    async def boom(code):
        raise RuntimeError("SECRET-INTERNAL-DETAIL client_secret=xyz")

    monkeypatch.setattr(auth_api, "exchange_code_for_user", boom)
    state = generate_state("/overview")
    res = auth_client.get(f"/api/auth/google/callback?code=c&state={state}", follow_redirects=False)
    assert res.status_code in (302, 303, 307)
    assert "SECRET-INTERNAL-DETAIL" not in res.headers["location"]
    assert "client_secret" not in res.headers["location"]
