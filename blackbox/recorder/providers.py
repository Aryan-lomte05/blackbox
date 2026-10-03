"""One OpenAI-style client for Groq, OpenRouter and Ollama.

Only models.yaml names a model (CLAUDE.md hard rule 1). Code passes registry
ids such as "agent-small"; this module turns them into provider + tag.

    py -3 -m blackbox.recorder.providers verify     # every models.yaml tag exists
"""

from __future__ import annotations

import itertools
import json
import os
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

import yaml

try:  # .env is optional; real env vars always win
    from dotenv import load_dotenv

    load_dotenv(override=False)
except ImportError:  # pragma: no cover
    pass

REGISTRY_PATH = Path(os.environ.get("BLACKBOX_MODELS", "models.yaml"))


@dataclass(frozen=True)
class ProviderSpec:
    base_url_env: str
    default_base_url: str
    key_env: str  # may hold several comma-separated keys (rotated on 429)
    key_optional: bool = False


PROVIDERS: dict[str, ProviderSpec] = {
    "groq": ProviderSpec("GROQ_BASE_URL", "https://api.groq.com/openai/v1", "GROQ_API_KEYS"),
    "openrouter": ProviderSpec("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1", "OPENROUTER_API_KEY"),
    "ollama": ProviderSpec("OLLAMA_BASE_URL", "http://localhost:11434/v1", "OLLAMA_API_KEY", key_optional=True),
}


@dataclass(frozen=True)
class ModelConfig:
    id: str
    provider: str
    model: str
    params: dict = field(default_factory=dict)
    fallback: str | None = None  # registry id used when this one is out of quota / unreachable


@dataclass
class LLMResult:
    text: str
    tool_calls: list[dict]  # [{"id", "name", "arguments": dict}]
    finish_reason: str | None
    tokens_in: int | None
    tokens_out: int | None
    provider: str
    model_tag: str

    def as_output(self) -> dict:
        return {"text": self.text, "tool_calls": self.tool_calls, "finish_reason": self.finish_reason}

    @classmethod
    def from_output(cls, output: dict, *, provider: str = "replay", model_tag: str = "") -> "LLMResult":
        return cls(
            text=output.get("text", ""),
            tool_calls=output.get("tool_calls", []),
            finish_reason=output.get("finish_reason"),
            tokens_in=None,
            tokens_out=None,
            provider=provider,
            model_tag=model_tag,
        )


# ---- registry ---------------------------------------------------------------
_registry: dict[str, ModelConfig] | None = None


def load_registry(path: Path | None = None) -> dict[str, ModelConfig]:
    global _registry
    if path is None and _registry is not None:
        return _registry
    entries = yaml.safe_load(Path(path or REGISTRY_PATH).read_text(encoding="utf-8")) or []
    reg: dict[str, ModelConfig] = {}
    for e in entries:
        if e["provider"] not in PROVIDERS and e["provider"] != "fake":
            raise ValueError(f"models.yaml: {e['id']} uses unknown provider {e['provider']!r}")
        if e["id"] in reg:
            raise ValueError(f"models.yaml: duplicate id {e['id']!r}")
        reg[e["id"]] = ModelConfig(e["id"], e["provider"], e["model"], e.get("params") or {}, e.get("fallback"))
    if path is None:
        _registry = reg
    return reg


def model_config(model_id: str) -> ModelConfig:
    reg = load_registry()
    if model_id not in reg:
        raise KeyError(f"No model id {model_id!r} in models.yaml. Known: {', '.join(sorted(reg))}")
    return reg[model_id]


# ---- fakes (tests only) -----------------------------------------------------
FakeFn = Callable[[list[dict], list[dict] | None, dict], LLMResult]
_fakes: dict[str, FakeFn] = {}


def register_fake(model_id: str, fn: FakeFn) -> None:
    """Route a registry id to a Python function. For tests; never used in farm or demo."""
    _fakes[model_id] = fn


def clear_fakes() -> None:
    _fakes.clear()


# ---- clients ----------------------------------------------------------------
class _KeyRing:
    def __init__(self, keys: list[str]):
        self.keys = keys
        self._cycle = itertools.cycle(range(len(keys)))
        self._lock = threading.Lock()
        self.current = next(self._cycle)

    def rotate(self) -> str:
        with self._lock:
            self.current = next(self._cycle)
            return self.keys[self.current]

    def key(self) -> str:
        return self.keys[self.current]


_rings: dict[str, _KeyRing] = {}
_exhausted: dict[str, set[int]] = {}  # provider -> key indexes whose daily quota is used up (this process)
_clients: dict[tuple[str, str], Any] = {}


def _keys_for(provider: str) -> _KeyRing:
    if provider not in _rings:
        spec = PROVIDERS[provider]
        raw = os.environ.get(spec.key_env, "")
        keys = [k.strip() for k in raw.split(",") if k.strip()]
        if not keys:
            if not spec.key_optional:
                raise RuntimeError(f"{spec.key_env} is not set (see .env.example)")
            keys = ["ollama"]
        _rings[provider] = _KeyRing(keys)
    return _rings[provider]


def _client(provider: str, key: str):
    from openai import OpenAI

    spec = PROVIDERS[provider]
    cache_key = (provider, key)
    if cache_key not in _clients:
        _clients[cache_key] = OpenAI(
            base_url=os.environ.get(spec.base_url_env, spec.default_base_url),
            api_key=key,
            max_retries=0,  # we retry ourselves so we can rotate keys
            timeout=float(os.environ.get("BLACKBOX_LLM_TIMEOUT", "90")),
        )
    return _clients[cache_key]


def _parse_tool_calls(message) -> list[dict]:
    calls = []
    for c in getattr(message, "tool_calls", None) or []:
        raw = c.function.arguments or "{}"
        try:
            args = json.loads(raw)
        except json.JSONDecodeError:
            args = {"__unparsed__": raw}  # kept verbatim: a malformed call is evidence, not noise
        calls.append({"id": c.id, "name": c.function.name, "arguments": args})
    return calls


def chat(model_id: str, messages: list[dict], tools: list[dict] | None = None, **params) -> LLMResult:
    """Call a registry model. If it is out of quota or unreachable and models.yaml names a `fallback`,
    the fallback answers; LLMResult.provider / model_tag always say which model really answered."""
    if model_id in _fakes:
        return _fakes[model_id](messages, tools, params)
    cfg = model_config(model_id)
    try:
        return _chat_one(cfg, model_id, messages, tools, params)
    except RuntimeError as exc:
        if not cfg.fallback or cfg.fallback == model_id:
            raise
        print(f"[providers] {model_id} unavailable ({exc}); using fallback {cfg.fallback}", file=sys.stderr)
        return chat(cfg.fallback, messages, tools, **params)


def _chat_one(cfg: ModelConfig, model_id: str, messages: list[dict], tools: list[dict] | None, params: dict) -> LLMResult:
    merged = {**cfg.params, **params}
    ring = _keys_for(cfg.provider)
    deadline = time.monotonic() + float(os.environ.get("BLACKBOX_LLM_DEADLINE", "45"))
    tried_keys: set[int] = set()
    last_exc: Exception | None = None
    attempt = 0
    while True:
        usable = [i for i in range(len(ring.keys)) if i not in _exhausted.get(cfg.provider, set())]
        if not usable:
            raise RuntimeError(f"{model_id}: every {cfg.provider} key is out of its daily quota") from last_exc
        if ring.current not in usable:
            ring.current = usable[0]
        if time.monotonic() > deadline:
            raise RuntimeError(f"{model_id}: no answer within the deadline ({len(tried_keys)} keys tried)") from last_exc
        attempt += 1
        client = _client(cfg.provider, ring.key())
        try:
            kwargs: dict[str, Any] = {"model": cfg.model, "messages": messages, **merged}
            if tools:
                kwargs["tools"] = tools
            resp = client.chat.completions.create(**kwargs)
        except Exception as exc:  # noqa: BLE001 - classified below, re-raised if not transient
            status = getattr(exc, "status_code", None)
            rate_limited = status == 429 or type(exc).__name__ == "RateLimitError"
            if rate_limited or status in (500, 502, 503, 504) or type(exc).__name__ in (
                "APITimeoutError", "APIConnectionError",
            ):
                last_exc = exc
                if rate_limited:
                    if "per-day" in str(exc) or "per day" in str(exc).lower():  # quota gone until tomorrow: skip key
                        _exhausted.setdefault(cfg.provider, set()).add(ring.current)
                    tried_keys.add(ring.current)
                    ring.rotate()
                    # short pause per key; a longer one only after every key has been tried
                    time.sleep(1 if len(tried_keys) < len(usable) else min(2 ** min(attempt, 4), 15))
                else:
                    time.sleep(min(2 ** min(attempt, 4), 15))
                continue
            raise
        choice = resp.choices[0]
        usage = getattr(resp, "usage", None)
        return LLMResult(
            text=choice.message.content or "",
            tool_calls=_parse_tool_calls(choice.message),
            finish_reason=choice.finish_reason,
            tokens_in=getattr(usage, "prompt_tokens", None) if usage else None,
            tokens_out=getattr(usage, "completion_tokens", None) if usage else None,
            provider=cfg.provider,
            model_tag=cfg.model,
        )


def verify() -> list[tuple[str, str, str]]:
    """Check every models.yaml tag exists at its provider. Returns (id, status, detail)."""
    report = []
    available: dict[str, set[str] | Exception] = {}
    for cfg in load_registry().values():
        if cfg.provider == "fake":
            continue
        if cfg.provider not in available:
            try:
                client = _client(cfg.provider, _keys_for(cfg.provider).key())
                available[cfg.provider] = {m.id for m in client.models.list().data}
            except Exception as exc:  # noqa: BLE001
                available[cfg.provider] = exc
        got = available[cfg.provider]
        if isinstance(got, Exception):
            report.append((cfg.id, "ERROR", f"{cfg.provider}: {type(got).__name__}: {got}"))
        elif cfg.model in got or f"{cfg.model}:latest" in got:
            report.append((cfg.id, "OK", f"{cfg.provider}/{cfg.model}"))
        else:
            report.append((cfg.id, "MISSING", f"{cfg.provider} has no {cfg.model!r}"))
    return report


if __name__ == "__main__":
    if sys.argv[1:] == ["verify"]:
        rows = verify()
        for mid, status, detail in rows:
            print(f"{status:8} {mid:16} {detail}")
        sys.exit(0 if all(s == "OK" for _, s, _ in rows) else 1)
    print("usage: py -3 -m blackbox.recorder.providers verify")
    sys.exit(2)
