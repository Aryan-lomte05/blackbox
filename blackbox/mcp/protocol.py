"""Model Context Protocol wire format: JSON-RPC 2.0 messages, error codes, protocol version."""

from __future__ import annotations

from typing import Any

PROTOCOL_VERSION = "2025-06-18"
SERVER_NAME = "blackbox"

# JSON-RPC 2.0 error codes (plus the MCP "resource not found" code)
PARSE_ERROR = -32700
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
RESOURCE_NOT_FOUND = -32002


def result(msg_id: Any, payload: dict) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "result": payload}


def error(msg_id: Any, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": code, "message": message}}


def notification(method: str, params: dict) -> dict:
    return {"jsonrpc": "2.0", "method": method, "params": params}


def text_content(text: str, is_error: bool = False) -> dict:
    return {"content": [{"type": "text", "text": text}], "isError": is_error}
