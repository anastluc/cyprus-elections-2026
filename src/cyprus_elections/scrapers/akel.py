from __future__ import annotations

import re
from datetime import date

from selectolax.parser import HTMLParser

from cyprus_elections.config import AppConfig, PartyConfig
from cyprus_elections.fetch import PoliteClient
from cyprus_elections.models import RawCandidate
from cyprus_elections.scrapers.base import register
from cyprus_elections.scrapers.links import extract_links

_DISTRICT_EN = {
    "Nicosia": "NIC",
    "Limassol": "LIM",
    "Famagusta": "FAM",
    "Larnaca": "LAR",
    "Larnaka": "LAR",
    "Paphos": "PAF",
    "Kyrenia": "KYR",
}
_DISTRICT_LINE_RE = re.compile(
    r"\b(" + "|".join(_DISTRICT_EN) + r")\s+District\b", re.IGNORECASE
)

# Multiple age patterns: English, Greek, birth-year.
_AGE_EN_RE = re.compile(
    r"\b(?:is\s+)?(\d{2})\s*(?:-?\s*years?\s*(?:-?\s*old)?|yrs?\.?)\b", re.IGNORECASE
)
_AGE_GR_RE = re.compile(r"(\d{2})\s*(?:ετών|χρονών|χρόνων|ετ\.)", re.IGNORECASE)
_BORN_EN_RE = re.compile(r"\bborn\s+(?:in\s+)?(\d{4})\b", re.IGNORECASE)
_BORN_GR_RE = re.compile(r"γεν(?:νήθηκε|\.)\s*(?:το\s+)?(\d{4})", re.IGNORECASE)


def _derive_age(bio: str) -> int | None:
    for rx in (_AGE_EN_RE, _AGE_GR_RE):
        m = rx.search(bio)
        if m:
            val = int(m.group(1))
            if 21 <= val <= 100:
                return val
    for rx in (_BORN_EN_RE, _BORN_GR_RE):
        m = rx.search(bio)
        if m:
            year = int(m.group(1))
            age = date.today().year - year
            if 21 <= age <= 100:
                return age
    return None


def _name_from_li(li) -> str | None:
    """Try strong, then b, then em, then the first bold-ish child inline."""
    for sel in ("strong", "b", "em"):
        node = li.css_first(sel)
        if node is not None:
            t = node.text(strip=True).strip(":").strip()
            if t and len(t) >= 3:
                return t
    # Fallback: take text up to first ":" or "—" boundary if it looks like a name.
    raw = li.text(strip=True)
    m = re.match(r"^([A-ZΑ-ΩΆ-Ώ][^\n:—–-]{2,60}?)(?:\s*[:—–-]\s+)", raw)
    if m:
        return m.group(1).strip()
    return None


@register("akel")
class AkelScraper:
    async def discover(
        self, cfg: AppConfig, party: PartyConfig, client: PoliteClient
    ) -> list[RawCandidate]:
        results: list[RawCandidate] = []
        for url in party.seed_urls:
            res = await client.get(url, bucket=f"parties/{party.code.lower()}")
            results.extend(self._parse(cfg, party, url, res.text))
        return results

    def _parse(
        self, cfg: AppConfig, party: PartyConfig, url: str, html: str
    ) -> list[RawCandidate]:
        tree = HTMLParser(html)
        out: list[RawCandidate] = []
        current_district: str | None = None

        # AKEL's list uses <p><strong><u>X District</u></strong></p> followed by
        # one or more <ul><li><strong>Name</strong>: bio...</li></ul> siblings.
        body = tree.body or tree.root
        if body is None:
            return out

        for node in body.traverse(include_text=False):
            if node.tag == "p":
                t = node.text(strip=True)
                m = _DISTRICT_LINE_RE.search(t)
                if m:
                    key = m.group(1).title()
                    current_district = _DISTRICT_EN.get(key) or _DISTRICT_EN.get(
                        key.replace("Larnaka", "Larnaca")
                    )
                    continue
            if node.tag == "li" and current_district:
                name_en = _name_from_li(node)
                if not name_en:
                    continue
                full_text = node.text(strip=True)
                bio = full_text
                if bio.startswith(name_en):
                    bio = bio[len(name_en) :].lstrip(" :\u00a0").strip()

                fields: dict[str, object] = {}
                age = _derive_age(bio)
                if age is not None:
                    fields["age"] = age

                # Link scan: social/website/cv_url from anchors inside the <li>.
                for k, v in extract_links([node], base_url=url).items():
                    fields[k] = v

                # Gender hint from transliterated English name → Greek endings
                # don't apply here (name is already Latin). Skip gender inference.

                out.append(
                    RawCandidate(
                        source_kind="party_site",
                        source_url=url,
                        party_code=party.code,
                        district_code=current_district,
                        name_en=name_en,
                        bio_text=bio or None,
                        fields=fields,
                    )
                )
        return out
