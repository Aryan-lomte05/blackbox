"""Authentication and session management package for Black Box."""

from blackbox.auth.db import get_mongo_status, get_user_by_id, is_mongo_connected, upsert_user
from blackbox.auth.google import exchange_code_for_user, get_authorization_url, is_google_configured, verify_state
from blackbox.auth.jwt_session import create_session_token, verify_session_token

__all__ = [
    "upsert_user",
    "get_user_by_id",
    "is_mongo_connected",
    "get_mongo_status",
    "create_session_token",
    "verify_session_token",
    "is_google_configured",
    "get_authorization_url",
    "verify_state",
    "exchange_code_for_user",
]
