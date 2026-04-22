"""OpenRouter-backed LLM client with JSON-mode, disk cache, and per-run call cap."""
from __future__ import annotations

import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from cyprus_elections.config import AppConfig

log = logging.getLogger(__name__)


class LLMError(RuntimeError):
    pass


class LLMClient:
    def __init__(self, cfg: AppConfig):
        self.cfg = cfg
        self.api_key = cfg.openrouter_key()
        self.model = cfg.openrouter_model()
        self.base_url = cfg.llm.base_url.rstrip("/")
        self.cache_dir = cfg.root / cfg.llm.cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._calls = 0
        self._client = httpx.Client(timeout=120.0)

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "LLMClient":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    def _cache_path(self, cache_key: str) -> Path:
        digest = hashlib.sha256(cache_key.encode("utf-8")).hexdigest()[:48]
        return self.cache_dir / f"{digest}.json"

    def chat_json(
        self,
        *,
        system: str,
        user: str,
        cache_key: str | None = None,
        json_schema: dict | None = None,
        model: str | None = None,
    ) -> dict:
        """Send a chat completion request and parse the response as JSON.

        Returns an empty dict if LLM is disabled (no API key). Reads/writes
        disk cache keyed by cache_key (defaults to the full prompt hash) so
        reruns are free.
        """
        if not self.enabled:
            log.info("LLM disabled (no OPENROUTER_API_KEY); returning {}")
            return {}

        model_used = model or self.model
        key = cache_key or (system + "|" + user + "|" + model_used)
        path = self._cache_path(key)
        if path.exists():
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                path.unlink(missing_ok=True)

        if self._calls >= self.cfg.llm.max_calls_per_run:
            log.warning("LLM call cap reached (%d); skipping", self.cfg.llm.max_calls_per_run)
            return {}

        payload = {
            "model": model_used,
            "temperature": self.cfg.llm.temperature,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
        }
        if json_schema is not None:
            payload["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": "response", "schema": json_schema, "strict": True},
            }

        data = self._post(payload)
        self._calls += 1
        content = data["choices"][0]["message"]["content"]
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as e:
            raise LLMError(f"non-JSON response: {content[:400]}") from e

        path.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
        return parsed

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=20), reraise=True)
    def _post(self, payload: dict) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/polismetrics/cyprus-elections-2026",
            "X-Title": "cyprus-elections-research",
        }
        resp = self._client.post(
            f"{self.base_url}/chat/completions", headers=headers, json=payload
        )
        if resp.status_code >= 400:
            raise LLMError(f"OpenRouter HTTP {resp.status_code}: {resp.text[:400]}")
        return resp.json()
