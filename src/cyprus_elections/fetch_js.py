"""Optional Playwright-based fetcher for JavaScript-rendered pages.

Kept separate from `fetch.py` because it requires a heavy optional dependency
(`playwright` + a headless Chromium install). Callers should check
`is_available()` before using, or catch ImportError gracefully.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

log = logging.getLogger(__name__)


def is_available() -> bool:
    try:
        import playwright.async_api  # noqa: F401
        return True
    except ImportError:
        return False


class _JSBrowser:
    """Lazy singleton wrapping a shared Playwright Chromium context."""

    def __init__(self) -> None:
        self._playwright: Any = None
        self._browser: Any = None
        self._context: Any = None
        self._lock = asyncio.Lock()

    async def _ensure(self, user_agent: str) -> None:
        if self._context is not None:
            return
        async with self._lock:
            if self._context is not None:
                return
            from playwright.async_api import async_playwright

            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(headless=True)
            self._context = await self._browser.new_context(user_agent=user_agent)

    async def fetch(self, url: str, *, user_agent: str, timeout_seconds: int) -> str:
        await self._ensure(user_agent)
        page = await self._context.new_page()
        try:
            await page.goto(url, wait_until="networkidle", timeout=timeout_seconds * 1000)
            return await page.content()
        finally:
            await page.close()

    async def aclose(self) -> None:
        if self._context is not None:
            await self._context.close()
            self._context = None
        if self._browser is not None:
            await self._browser.close()
            self._browser = None
        if self._playwright is not None:
            await self._playwright.stop()
            self._playwright = None


_browser = _JSBrowser()


async def fetch_rendered(url: str, *, user_agent: str, timeout_seconds: int = 30) -> str:
    """Return fully-rendered HTML for `url`. Raises ImportError if Playwright is missing."""
    if not is_available():
        raise ImportError(
            "playwright is not installed — run `uv pip install playwright` "
            "and `playwright install chromium`"
        )
    return await _browser.fetch(url, user_agent=user_agent, timeout_seconds=timeout_seconds)


async def aclose() -> None:
    await _browser.aclose()
