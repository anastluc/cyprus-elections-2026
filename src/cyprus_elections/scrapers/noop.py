"""No-op scraper for parties whose candidate lists are populated solely from
the philenews aggregator (new minor parties, independents, religious groups
with no party website of their own)."""
from __future__ import annotations

from cyprus_elections.config import AppConfig, PartyConfig
from cyprus_elections.fetch import PoliteClient
from cyprus_elections.models import RawCandidate
from cyprus_elections.scrapers.base import register


class NoopScraper:
    async def discover(
        self, cfg: AppConfig, party: PartyConfig, client: PoliteClient
    ) -> list[RawCandidate]:
        return []


@register("noop")
class _Noop(NoopScraper):
    pass
