from __future__ import annotations

import asyncio
import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urlparse

import httpx
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from cyprus_elections.config import AppConfig

log = logging.getLogger(__name__)


@dataclass
class FetchResult:
    url: str
    status_code: int
    text: str
    path: Path
    fetched_at: datetime
    from_cache: bool


class PoliteClient:
    """httpx-based client with per-host rate limiting and on-disk caching.

    Re-running the pipeline does not re-hit upstream as long as the cache
    is warm and within TTL.
    """

    def __init__(self, cfg: AppConfig):
        self.cfg = cfg
        self.cache_root = cfg.raw_dir
        self._client = httpx.AsyncClient(
            timeout=cfg.fetch.timeout_seconds,
            headers={"User-Agent": cfg.fetch.user_agent},
            follow_redirects=True,
        )
        self._host_locks: dict[str, asyncio.Lock] = {}
        self._host_last: dict[str, float] = {}

    async def aclose(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> "PoliteClient":
        return self

    async def __aexit__(self, *exc) -> None:
        await self.aclose()

    # ----- caching -----

    def _cache_path(self, url: str, bucket: str) -> Path:
        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:40]
        host = urlparse(url).netloc or "unknown"
        today = datetime.utcnow().strftime("%Y-%m-%d")
        target = self.cache_root / bucket / host / today
        target.mkdir(parents=True, exist_ok=True)
        return target / f"{digest}.html"

    def _latest_cached(self, url: str, bucket: str) -> Path | None:
        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:40]
        host = urlparse(url).netloc or "unknown"
        root = self.cache_root / bucket / host
        if not root.exists():
            return None
        cutoff = datetime.utcnow() - timedelta(days=self.cfg.fetch.cache_ttl_days)
        best: tuple[datetime, Path] | None = None
        for dated in root.iterdir():
            if not dated.is_dir():
                continue
            try:
                d = datetime.strptime(dated.name, "%Y-%m-%d")
            except ValueError:
                continue
            if d < cutoff:
                continue
            candidate = dated / f"{digest}.html"
            if candidate.exists():
                if best is None or d > best[0]:
                    best = (d, candidate)
        return best[1] if best else None

    # ----- rate limit -----

    async def _throttle(self, host: str) -> None:
        lock = self._host_locks.setdefault(host, asyncio.Lock())
        interval = 1.0 / max(self.cfg.fetch.per_host_rate_limit_per_second, 0.001)
        async with lock:
            loop = asyncio.get_running_loop()
            last = self._host_last.get(host, 0.0)
            wait = last + interval - loop.time()
            if wait > 0:
                await asyncio.sleep(wait)
            self._host_last[host] = loop.time()

    # ----- fetch -----

    async def get(
        self,
        url: str,
        *,
        bucket: str = "misc",
        use_cache: bool = True,
        extra_headers: dict[str, str] | None = None,
        render_js: bool = False,
    ) -> FetchResult:
        # JS-rendered pages use a separate cache bucket so rendered and raw
        # responses don't collide.
        effective_bucket = f"{bucket}/js" if render_js else bucket
        if use_cache:
            cached = self._latest_cached(url, effective_bucket)
            if cached is not None:
                text = cached.read_text(encoding="utf-8", errors="replace")
                return FetchResult(
                    url=url,
                    status_code=200,
                    text=text,
                    path=cached,
                    fetched_at=datetime.utcnow(),
                    from_cache=True,
                )

        host = urlparse(url).netloc
        await self._throttle(host)

        if render_js:
            from cyprus_elections import fetch_js

            text = await fetch_js.fetch_rendered(
                url,
                user_agent=self.cfg.fetch.user_agent,
                timeout_seconds=self.cfg.fetch.timeout_seconds,
            )
            status_code = 200
        else:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(self.cfg.fetch.max_retries),
                wait=wait_exponential(multiplier=1, min=1, max=30),
                retry=retry_if_exception_type(
                    (httpx.TransportError, httpx.HTTPStatusError, httpx.ReadTimeout)
                ),
                reraise=True,
            ):
                with attempt:
                    resp = await self._client.get(url, headers=extra_headers or {})
                    if resp.status_code >= 500:
                        resp.raise_for_status()
                    text = resp.text
            status_code = resp.status_code

        path = self._cache_path(url, effective_bucket)
        path.write_text(text, encoding="utf-8")
        return FetchResult(
            url=url,
            status_code=status_code,
            text=text,
            path=path,
            fetched_at=datetime.utcnow(),
            from_cache=False,
        )


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
