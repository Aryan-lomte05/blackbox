"""Google OAuth 2.0 Authorization Code Flow implementation for Black Box.

Handles:
- Building authorization URL with secure signed state (CSRF protection)
- Verifying incoming callback state parameter
- Exchanging authorization code for tokens with Google's token endpoint
- Retrieving verified user profile (email, name, picture, Google sub ID)
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from blackbox.auth.jwt_session import _get_secret

logger = logging.getLogger("blackbox.auth.google")

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def is_google_configured() -> bool:
    """Returns True if Google OAuth credentials are set in environment."""
    cid = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    sec = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
    return bool(cid and sec)


def get_redirect_uri() -> str:
    return os.environ.get(
        "GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback"
    ).strip()


def sanitize_return_to(target: str | None) -> str:
    """Ensure destination path starts with single / and contains no scheme/host for open redirect prevention."""
    if not target or not isinstance(target, str):
        return "/overview"
    target = target.strip()
    if not target.startswith("/") or target.startswith("//") or target.startswith("/\\"):
        return "/overview"
    path_part = target.split("?")[0]
    if ":" in path_part or "\\" in target:
        return "/overview"
    return target


def generate_state(return_to: str = "/") -> str:
    """Generates a signed state parameter containing return_to and timestamp for CSRF defense."""
    safe_return_to = sanitize_return_to(return_to)
    payload = {
        "r": safe_return_to,
        "t": int(time.time()),
        "n": base64.b64encode(os.urandom(12)).decode("ascii"),
    }
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    sig = hmac.new(_get_secret().encode("utf-8"), raw, hashlib.sha256).digest()
    return f"{base64.urlsafe_b64encode(raw).decode('ascii')}.{base64.urlsafe_b64encode(sig).decode('ascii')}"


def verify_state(state: str) -> str | None:
    """Verifies that state parameter was signed by this server and is not expired (15m window).

    Returns return_to path if valid, None if forged or expired.
    """
    if not state or "." not in state:
        return None
    try:
        raw_b64, sig_b64 = state.split(".", 1)
        raw = base64.urlsafe_b64decode(raw_b64.encode("ascii"))
        sig = base64.urlsafe_b64decode(sig_b64.encode("ascii"))
        expected = hmac.new(_get_secret().encode("utf-8"), raw, hashlib.sha256).digest()
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(raw.decode("utf-8"))
        # 15 minutes validity
        if time.time() - payload.get("t", 0) > 900:
            return None
        return sanitize_return_to(payload.get("r", "/overview"))
    except Exception as exc:
        logger.warning(f"Invalid OAuth state parameter: {exc}")
        return None


def get_authorization_url(return_to: str = "/") -> str:
    """Generates the full Google OAuth authorization URL."""
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        raise ValueError("GOOGLE_CLIENT_ID is not configured in environment variables.")

    redirect_uri = get_redirect_uri()
    state = generate_state(return_to)

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"


def _fetch_token_and_user(code: str, client_id: str, client_secret: str, redirect_uri: str) -> dict[str, Any]:
    """Synchronous network requests to Google OAuth endpoints."""
    token_req_data = urllib.parse.urlencode({
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }).encode("utf-8")

    req = urllib.request.Request(
        GOOGLE_TOKEN_URL,
        data=token_req_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10.0) as resp:
            token_data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")
        logger.error(f"Google token exchange failed: {exc.code} - {err_body}")
        raise RuntimeError(f"Google token exchange failed: {err_body}") from exc

    access_token = token_data.get("access_token")
    if not access_token:
        raise RuntimeError("No access_token returned by Google OAuth.")

    user_req = urllib.request.Request(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(user_req, timeout=10.0) as resp:
            user_info = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")
        logger.error(f"Google userinfo query failed: {exc.code} - {err_body}")
        raise RuntimeError(f"Failed to fetch user profile from Google: {err_body}") from exc

    sub = user_info.get("sub")
    email = user_info.get("email")

    if not sub or not email:
        raise RuntimeError("Google user profile missing sub or email.")

    return {
        "provider": "google",
        "provider_user_id": str(sub),
        "email": str(email),
        "name": str(user_info.get("name") or user_info.get("given_name") or email.split("@")[0]),
        "avatar": str(user_info.get("picture") or ""),
    }


async def exchange_code_for_user(code: str) -> dict[str, Any]:
    """Exchanges authorization code for tokens and fetches Google user profile."""
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
    redirect_uri = get_redirect_uri()

    if not client_id or not client_secret:
        raise ValueError("Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) missing.")

    import asyncio

    return await asyncio.to_thread(_fetch_token_and_user, code, client_id, client_secret, redirect_uri)
