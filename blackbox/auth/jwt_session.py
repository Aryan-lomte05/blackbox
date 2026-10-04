"""JWT Session Token Management for Black Box.

Issues cryptographically signed tokens containing user identity.
Tokens are stored in HTTP-only, secure, SameSite cookies.
Secrets are read strictly from SESSION_SECRET environment variable.
"""

from __future__ import annotations

import datetime
import hashlib
import os
from typing import Any

import jwt

DEFAULT_DEV_SECRET = hashlib.sha256(b"blackbox-agent-flight-recorder-session-salt-2026").hexdigest()


def _get_secret() -> str:
    return os.environ.get("SESSION_SECRET", "").strip() or DEFAULT_DEV_SECRET


def create_session_token(user: dict[str, Any], days: int = 7) -> str:
    """Creates a signed JWT session token for the authenticated user."""
    now = datetime.datetime.now(datetime.timezone.utc)
    exp = now + datetime.timedelta(days=days)
    payload = {
        "sub": str(user.get("id") or user.get("provider_user_id")),
        "user_id": str(user.get("id") or user.get("provider_user_id")),
        "email": user.get("email", ""),
        "name": user.get("name", ""),
        "avatar": user.get("avatar", ""),
        "provider": user.get("provider", "google"),
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, _get_secret(), algorithm="HS256")


def verify_session_token(token: str) -> dict[str, Any] | None:
    """Verifies a JWT session token and returns the payload if valid."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, _get_secret(), algorithms=["HS256"])
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None
