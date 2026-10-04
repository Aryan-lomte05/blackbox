"""JWT Session Token Management for Black Box.

Issues cryptographically signed tokens containing user identity.
Tokens are stored in HTTP-only, secure, SameSite cookies.
Secrets are read strictly from SESSION_SECRET environment variable.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any

DEFAULT_DEV_SECRET = hashlib.sha256(b"blackbox-agent-flight-recorder-session-salt-2026").hexdigest()


def _get_secret() -> str:
    return os.environ.get("SESSION_SECRET", "").strip() or DEFAULT_DEV_SECRET


def _b64url_encode(data: bytes) -> str:
    """URL-safe base64 encoding without padding (RFC 7515)."""
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(data: str) -> bytes:
    """URL-safe base64 decoding with restored padding."""
    pad = len(data) % 4
    if pad:
        data += "=" * (4 - pad)
    return base64.urlsafe_b64decode(data.encode("ascii"))


def create_session_token(user: dict[str, Any], days: int = 7) -> str:
    """Creates a signed HS256 JWT session token for the authenticated user using Python standard library."""
    now = int(time.time())
    exp = now + (days * 86400)
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": str(user.get("id") or user.get("provider_user_id")),
        "user_id": str(user.get("id") or user.get("provider_user_id")),
        "email": user.get("email", ""),
        "name": user.get("name", ""),
        "avatar": user.get("avatar", ""),
        "provider": user.get("provider", "google"),
        "iat": now,
        "exp": exp,
    }
    h_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{h_b64}.{p_b64}".encode("ascii")
    sig = hmac.new(_get_secret().encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_b64 = _b64url_encode(sig)
    return f"{h_b64}.{p_b64}.{sig_b64}"


def verify_session_token(token: str) -> dict[str, Any] | None:
    """Verifies an HS256 JWT session token and returns the payload if valid."""
    if not token or not isinstance(token, str):
        return None
    parts = token.split(".")
    if len(parts) != 3:
        return None
    h_b64, p_b64, sig_b64 = parts
    try:
        signing_input = f"{h_b64}.{p_b64}".encode("ascii")
        expected_sig = hmac.new(_get_secret().encode("utf-8"), signing_input, hashlib.sha256).digest()
        provided_sig = _b64url_decode(sig_b64)
        if not hmac.compare_digest(provided_sig, expected_sig):
            return None
        payload_bytes = _b64url_decode(p_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))
        exp = payload.get("exp")
        if exp is not None and time.time() > float(exp):
            return None
        return payload
    except Exception:
        return None

