"""FastAPI authentication routes for Google OAuth, sessions, and MongoDB integration.

Endpoints:
- GET  /api/auth/status          - Connectivity & configuration health check
- GET  /api/auth/google/login    - Initiates Google OAuth authorization redirect
- GET  /api/auth/google/callback - Exchanges authorization code, upserts user to MongoDB, issues HTTP-only session cookie
- GET  /api/auth/me              - Returns current authenticated user profile
- POST /api/auth/logout          - Destroys active session and clears auth cookie
- POST /api/auth/dev-login       - Seamless dev login for testing protected states when Google OAuth keys are pending
"""

from __future__ import annotations

import logging
import os
import urllib.parse
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel

from blackbox.auth.db import get_mongo_status, upsert_user
from blackbox.auth.google import exchange_code_for_user, get_authorization_url, is_google_configured, sanitize_return_to, verify_state
from blackbox.auth.jwt_session import create_session_token, verify_session_token

logger = logging.getLogger("blackbox.api.auth")

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

COOKIE_NAME = "blackbox_session"
COOKIE_MAX_AGE = 7 * 24 * 3600  # 7 days


def _get_frontend_base() -> str:
    """Returns the base URL for the frontend application."""
    cors = os.environ.get("BLACKBOX_CORS", "")
    if cors:
        origins = [o.strip() for o in cors.split(",") if o.strip()]
        if origins:
            return origins[0]
    return "http://localhost:5173"


def dev_login_enabled() -> bool:
    """Dev login signs in as any caller-chosen identity, so it is opt-in and never on in production."""
    if os.environ.get("ENVIRONMENT", "dev").strip().lower() in ("prod", "production"):
        return False
    return os.environ.get("BLACKBOX_DEV_LOGIN", "").strip() == "1"


class DevLoginRequest(BaseModel):
    name: str = "Demo Operator"
    email: str = "operator@localhost"
    avatar: str = ""


@router.get("/status", summary="OAuth and MongoDB status")
def auth_status() -> dict[str, Any]:
    """Provides configuration status for Google OAuth and MongoDB persistence."""
    return {
        "google_configured": is_google_configured(),
        "dev_login_enabled": dev_login_enabled(),
        "mongodb": get_mongo_status(),
    }


@router.get("/google/login", summary="Initiate Google OAuth redirect")
def google_login(
    return_to: str = Query("/", description="Destination route after successful login"),
    json_mode: bool = Query(False, description="Return URL as JSON instead of 307 redirect"),
):
    """Initiates Google OAuth 2.0 authorization code flow."""
    if not is_google_configured():
        raise HTTPException(
            status_code=400,
            detail="Google OAuth is not configured on this server. Please define GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.",
        )

    try:
        auth_url = get_authorization_url(return_to=return_to)
        if json_mode:
            return {"url": auth_url}
        return RedirectResponse(url=auth_url, status_code=307)
    except Exception as exc:
        logger.error(f"Failed to create Google OAuth authorization URL: {exc}")
        raise HTTPException(status_code=500, detail="Could not build the Google sign-in URL.")


@router.get("/google/callback", summary="Google OAuth callback handler")
async def google_callback(
    request: Request,
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
):
    """Receives OAuth authorization code from Google, verifies state, fetches profile,

    persists user to MongoDB, and sets HTTP-only session cookie.
    """
    frontend_base = _get_frontend_base()

    # User cancelled or OAuth provider returned an error
    if error:
        err_msg = urllib.parse.quote(f"Google OAuth cancelled or denied: {error}")
        return RedirectResponse(f"{frontend_base}/?auth_error={err_msg}")

    if not code or not state:
        err_msg = urllib.parse.quote("Missing code or state in OAuth callback.")
        return RedirectResponse(f"{frontend_base}/?auth_error={err_msg}")

    # Verify state signature & expiration (CSRF defense)
    return_to = verify_state(state)
    if return_to is None:
        err_msg = urllib.parse.quote("Invalid or expired OAuth state parameter.")
        return RedirectResponse(f"{frontend_base}/?auth_error={err_msg}")

    try:
        user_info = await exchange_code_for_user(code)
    except Exception as exc:
        logger.error(f"Failed to exchange Google OAuth code: {exc}")
        err_msg = urllib.parse.quote("Authentication with Google failed. Please try again.")
        return RedirectResponse(f"{frontend_base}/?auth_error={err_msg}")

    # Persist or update user in MongoDB
    try:
        user_record = upsert_user(
            provider="google",
            provider_user_id=user_info["provider_user_id"],
            email=user_info["email"],
            name=user_info.get("name", ""),
            avatar=user_info.get("avatar", ""),
        )
    except Exception as exc:
        logger.error(f"Failed to persist user in MongoDB: {exc}")
        err_msg = urllib.parse.quote("Database error saving authenticated profile.")
        return RedirectResponse(f"{frontend_base}/?auth_error={err_msg}")

    # Create signed session token
    token = create_session_token(user_record)

    # Clean target return URL (ensure leading slash, avoid external open redirect)
    safe_target = sanitize_return_to(return_to)
    final_redirect_url = f"{frontend_base}{safe_target}"

    is_prod = os.environ.get("ENVIRONMENT", "dev").lower() in ("prod", "production")
    response = RedirectResponse(url=final_redirect_url, status_code=303)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=is_prod,
        path="/",
    )
    return response


@router.get("/me", summary="Get currently authenticated session user")
def get_current_user(request: Request) -> dict[str, Any]:
    """Validates session token from cookie or Authorization header and returns user profile."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        # Also check Authorization: Bearer <token>
        auth_hdr = request.headers.get("Authorization", "")
        if auth_hdr.lower().startswith("bearer "):
            token = auth_hdr[7:].strip()

    if not token:
        return {"authenticated": False, "user": None}

    payload = verify_session_token(token)
    if not payload:
        return {"authenticated": False, "user": None}

    user = {
        "id": payload.get("user_id") or payload.get("sub"),
        "email": payload.get("email"),
        "name": payload.get("name"),
        "avatar": payload.get("avatar"),
        "provider": payload.get("provider", "google"),
    }
    return {"authenticated": True, "user": user}


@router.post("/logout", summary="Log out and destroy session")
def logout(response: Response) -> dict[str, bool]:
    """Destroys active session cookie."""
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"ok": True}


@router.post("/dev-login", summary="Development/Demo operator login")
def dev_login(response: Response, body: DevLoginRequest = DevLoginRequest()) -> dict[str, Any]:
    """Creates a local developer/operator session for testing protected UI and workflows.

    Only available when BLACKBOX_DEV_LOGIN=1 and ENVIRONMENT is not production.
    """
    if not dev_login_enabled():
        raise HTTPException(status_code=404, detail="Not Found")
    user_record = upsert_user(
        provider="developer",
        provider_user_id="dev_operator_001",
        email=body.email,
        name=body.name,
        avatar=body.avatar or "https://api.dicebear.com/7.x/bottts/svg?seed=BlackBoxOperator",
    )
    token = create_session_token(user_record)
    is_prod = os.environ.get("ENVIRONMENT", "dev").lower() in ("prod", "production")

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=is_prod,
        path="/",
    )
    return {
        "authenticated": True,
        "user": {
            "id": user_record.get("id"),
            "email": user_record.get("email"),
            "name": user_record.get("name"),
            "avatar": user_record.get("avatar"),
            "provider": user_record.get("provider"),
        },
    }
