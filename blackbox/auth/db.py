"""MongoDB User Persistence Layer for Black Box.

Handles connection to MongoDB via MONGODB_URI environment variable.
Persists authenticated OAuth users according to the required schema:
  - provider: str
  - provider_user_id: str
  - email: str
  - name: str
  - avatar: str
  - created_at: str (ISO 8601)
  - last_login_at: str (ISO 8601)

If MONGODB_URI is not set or the cluster is temporarily unreachable,
a thread-safe in-memory store is used as a fallback so that offline
development and automated testing run without interruption.
"""

from __future__ import annotations

import datetime
import logging
import os
import threading
from typing import Any

logger = logging.getLogger("blackbox.auth.db")

_mongo_client: Any = None
_mongo_db: Any = None
_mongo_lock = threading.Lock()
_fallback_users: dict[str, dict[str, Any]] = {}


def _get_utc_now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def get_mongo_client():
    """Lazily initializes and caches the MongoDB client using MONGODB_URI."""
    global _mongo_client, _mongo_db
    uri = os.environ.get("MONGODB_URI", "").strip()
    if not uri:
        return None

    if _mongo_client is not None:
        return _mongo_client

    with _mongo_lock:
        if _mongo_client is not None:
            return _mongo_client
        try:
            from pymongo import MongoClient

            # 2.5 second timeout so a blocked network doesn't freeze the API
            client = MongoClient(uri, serverSelectionTimeoutMS=2500, connectTimeoutMS=2500)
            # Test connection
            client.admin.command("ping")
            db_name = os.environ.get("MONGODB_DB_NAME", "blackbox")
            _mongo_db = client[db_name]
            # Ensure unique compound index on provider + provider_user_id
            _mongo_db.users.create_index([("provider", 1), ("provider_user_id", 1)], unique=True)
            _mongo_db.users.create_index([("email", 1)])
            _mongo_client = client
            logger.info("Connected to MongoDB successfully for user persistence.")
            return _mongo_client
        except Exception as exc:
            logger.warning(f"MongoDB connection failed: {type(exc).__name__}: {exc}. Using fallback in-memory store.")
            _mongo_client = None
            _mongo_db = None
            return None


def is_mongo_connected() -> bool:
    """Checks whether the MongoDB client is active and reachable."""
    try:
        client = get_mongo_client()
        if client is not None:
            client.admin.command("ping")
            return True
    except Exception:
        pass
    return False


def get_mongo_status() -> dict[str, Any]:
    """Returns connectivity status and metadata for diagnostics."""
    uri_configured = bool(os.environ.get("MONGODB_URI", "").strip())
    connected = is_mongo_connected()
    return {
        "configured": uri_configured,
        "connected": connected,
        "mode": "mongodb" if connected else ("unreachable_fallback" if uri_configured else "memory_fallback"),
    }


def upsert_user(
    provider: str,
    provider_user_id: str,
    email: str,
    name: str = "",
    avatar: str = "",
) -> dict[str, Any]:
    """Inserts or updates a user upon successful authentication."""
    client = get_mongo_client()
    now_iso = _get_utc_now_iso()

    if client is not None and _mongo_db is not None:
        try:
            users_col = _mongo_db.users
            existing = users_col.find_one({"provider": provider, "provider_user_id": provider_user_id})

            if existing:
                users_col.update_one(
                    {"_id": existing["_id"]},
                    {
                        "$set": {
                            "email": email,
                            "name": name or existing.get("name", ""),
                            "avatar": avatar or existing.get("avatar", ""),
                            "last_login_at": now_iso,
                        }
                    },
                )
                updated = users_col.find_one({"_id": existing["_id"]})
                updated["id"] = str(updated["_id"])
                updated.pop("_id", None)
                return updated
            else:
                user_doc = {
                    "provider": provider,
                    "provider_user_id": provider_user_id,
                    "email": email,
                    "name": name,
                    "avatar": avatar,
                    "created_at": now_iso,
                    "last_login_at": now_iso,
                }
                res = users_col.insert_one(user_doc)
                user_doc["id"] = str(res.inserted_id)
                user_doc.pop("_id", None)
                return user_doc
        except Exception as exc:
            logger.error(f"Error persisting user to MongoDB: {exc}. Falling back to memory store.")

    # Fallback in-memory store
    key = f"{provider}:{provider_user_id}"
    with _mongo_lock:
        if key in _fallback_users:
            u = _fallback_users[key]
            u["email"] = email
            if name:
                u["name"] = name
            if avatar:
                u["avatar"] = avatar
            u["last_login_at"] = now_iso
            return dict(u)
        else:
            user_doc = {
                "id": f"usr_{key}",
                "provider": provider,
                "provider_user_id": provider_user_id,
                "email": email,
                "name": name,
                "avatar": avatar,
                "created_at": now_iso,
                "last_login_at": now_iso,
            }
            _fallback_users[key] = user_doc
            return dict(user_doc)


def get_user_by_id(user_id: str) -> dict[str, Any] | None:
    """Finds a user by internal ID."""
    client = get_mongo_client()
    if client is not None and _mongo_db is not None:
        try:
            from bson import ObjectId

            try:
                oid = ObjectId(user_id)
                doc = _mongo_db.users.find_one({"_id": oid})
                if doc:
                    doc["id"] = str(doc["_id"])
                    doc.pop("_id", None)
                    return doc
            except Exception:
                pass
            # Try matching string id field if stored
            doc = _mongo_db.users.find_one({"id": user_id})
            if doc:
                doc["id"] = str(doc.get("_id", user_id))
                doc.pop("_id", None)
                return doc
        except Exception as exc:
            logger.error(f"Error querying user by ID in MongoDB: {exc}")

    # Fallback check
    with _mongo_lock:
        for u in _fallback_users.values():
            if u.get("id") == user_id:
                return dict(u)
    return None


def get_user_by_provider_id(provider: str, provider_user_id: str) -> dict[str, Any] | None:
    """Finds a user by provider and provider's unique ID."""
    client = get_mongo_client()
    if client is not None and _mongo_db is not None:
        try:
            doc = _mongo_db.users.find_one({"provider": provider, "provider_user_id": provider_user_id})
            if doc:
                doc["id"] = str(doc["_id"])
                doc.pop("_id", None)
                return doc
        except Exception as exc:
            logger.error(f"Error querying user by provider ID in MongoDB: {exc}")

    key = f"{provider}:{provider_user_id}"
    with _mongo_lock:
        if key in _fallback_users:
            return dict(_fallback_users[key])
    return None
