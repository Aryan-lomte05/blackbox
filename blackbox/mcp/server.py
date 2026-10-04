"""MCP request dispatch and the stdio transport (newline-delimited JSON-RPC 2.0)."""

from __future__ import annotations

import json
import os
import sys
import traceback
from typing import Any, Callable

from blackbox import __version__
from blackbox.mcp import prompts, protocol, registry, resources
from blackbox.mcp import tools as _tools  # noqa: F401 - registers every tool

CAPABILITIES = {"tools": {}, "resources": {}, "prompts": {}, "completions": {}}


def send(message: dict) -> None:
    """Write one message (a reply or a notification) to the client."""
    sys.stdout.write(json.dumps(message, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _progress_sink(token: Any) -> Callable[[str], None]:
    count = 0

    def emit(message: str) -> None:
        nonlocal count
        count += 1
        send(protocol.notification("notifications/progress",
                                   {"progressToken": token, "progress": count, "message": message}))

    return emit


def _call_tool(params: dict) -> dict:
    name, args = params.get("name"), params.get("arguments") or {}
    spec = registry.get(name)
    if spec is None:
        raise LookupError(name)
    token = (params.get("_meta") or {}).get("progressToken")
    scope = registry.progress_scope(_progress_sink(token) if token is not None else None)
    try:
        return protocol.text_content(spec.handler(**args))
    except KeyError as exc:
        return protocol.text_content(f"Not found: {exc}", is_error=True)
    except Exception as exc:  # noqa: BLE001 - reported to the assistant; the server keeps running
        traceback.print_exc(file=sys.stderr)
        return protocol.text_content(f"{type(exc).__name__}: {exc}", is_error=True)
    finally:
        registry.end_progress_scope(scope)


def handle(msg: dict) -> dict | None:
    """One JSON-RPC request -> its reply (None for notifications)."""
    method, mid = msg.get("method"), msg.get("id")
    params = msg.get("params") or {}
    if mid is None:  # a notification, e.g. notifications/initialized
        return None
    if method == "initialize":
        return protocol.result(mid, {"protocolVersion": params.get("protocolVersion", protocol.PROTOCOL_VERSION),
                                     "capabilities": CAPABILITIES,
                                     "serverInfo": {"name": protocol.SERVER_NAME, "version": __version__}})
    if method == "ping":
        return protocol.result(mid, {})
    if method == "tools/list":
        return protocol.result(mid, {"tools": [t.spec() for t in registry.all_tools()]})
    if method == "tools/call":
        try:
            return protocol.result(mid, _call_tool(params))
        except LookupError:
            return protocol.error(mid, protocol.INVALID_PARAMS, f"unknown tool {params.get('name')!r}")
    if method == "resources/list":
        return protocol.result(mid, {"resources": resources.list_resources()})
    if method == "resources/templates/list":
        return protocol.result(mid, {"resourceTemplates": resources.TEMPLATES})
    if method == "resources/read":
        uri = params.get("uri", "")
        try:
            mime, text = resources.read(uri)
        except KeyError:
            return protocol.error(mid, protocol.RESOURCE_NOT_FOUND, f"resource not found: {uri}")
        return protocol.result(mid, {"contents": [{"uri": uri, "mimeType": mime, "text": text}]})
    if method == "prompts/list":
        return protocol.result(mid, {"prompts": prompts.list_prompts()})
    if method == "prompts/get":
        try:
            return protocol.result(mid, {"messages": prompts.get(params.get("name"), params.get("arguments") or {})})
        except KeyError:
            return protocol.error(mid, protocol.INVALID_PARAMS, f"unknown prompt {params.get('name')!r}")
        except ValueError as exc:  # required arguments missing: say which
            return protocol.error(mid, protocol.INVALID_PARAMS, str(exc))
    if method == "completion/complete":
        arg = params.get("argument") or {}
        values = resources.complete(arg.get("name", ""), arg.get("value", ""))
        return protocol.result(mid, {"completion": {"values": values[:100], "total": len(values),
                                                    "hasMore": len(values) > 100}})
    return protocol.error(mid, protocol.METHOD_NOT_FOUND, f"method not found: {method}")


def serve() -> int:
    """Read requests from stdin until it closes; write replies and notifications to stdout."""
    os.environ.setdefault("USE_TF", "0")
    os.environ.setdefault("TRANSFORMERS_NO_TF", "1")
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            reply = handle(json.loads(line))
        except json.JSONDecodeError as exc:
            reply = protocol.error(None, protocol.PARSE_ERROR, f"parse error: {exc}")
        if reply is not None:
            send(reply)
    return 0
