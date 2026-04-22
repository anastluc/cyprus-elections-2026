from __future__ import annotations

from typing import Protocol

from cyprus_elections.config import AppConfig, PartyConfig
from cyprus_elections.fetch import PoliteClient
from cyprus_elections.models import RawCandidate


class Scraper(Protocol):
    code: str

    async def discover(
        self, cfg: AppConfig, party: PartyConfig, client: PoliteClient
    ) -> list[RawCandidate]: ...


SCRAPERS: dict[str, Scraper] = {}


def register(code: str):
    def decorator(cls):
        instance = cls()
        instance.code = code
        SCRAPERS[code] = instance
        return cls

    return decorator


def load_all() -> None:
    """Import every scraper module so its @register runs."""
    # Importing here keeps load_all() import-cheap unless called explicitly.
    from cyprus_elections.scrapers import akel, llm_generic, volt  # noqa: F401

    # Optional future modules — guarded so missing ones don't crash.
    for name in ("official_moi",):
        try:
            __import__(f"cyprus_elections.scrapers.{name}")
        except ModuleNotFoundError:
            continue


def get(code: str) -> Scraper | None:
    return SCRAPERS.get(code)
