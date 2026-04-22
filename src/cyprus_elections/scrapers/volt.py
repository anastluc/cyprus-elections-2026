from __future__ import annotations

import re

from selectolax.parser import HTMLParser

from cyprus_elections.config import AppConfig, PartyConfig
from cyprus_elections.fetch import PoliteClient
from cyprus_elections.models import RawCandidate
from cyprus_elections.normalize import transliterate_gr_to_en
from cyprus_elections.scrapers.base import register
from cyprus_elections.scrapers.links import extract_links_from_html

_DISTRICT_RE = re.compile(r"επαρχίας\s+([Α-Ωα-ωΆ-Ώά-ώ]+)", re.IGNORECASE)


@register("volt")
class VoltScraper:
    async def discover(
        self, cfg: AppConfig, party: PartyConfig, client: PoliteClient
    ) -> list[RawCandidate]:
        results: list[RawCandidate] = []
        for url in party.seed_urls:
            res = await client.get(url, bucket=f"parties/{party.code.lower()}")
            for cand in self._parse(cfg, party, url, res.text):
                # Follow each candidate's profile page for the richer bio text
                # Volt hides behind a SPA but the server still ships static HTML
                # with a usable intro paragraph.
                profile_url = cand.fields.get("profile_url")
                if profile_url:
                    try:
                        pres = await client.get(profile_url, bucket=f"parties/{party.code.lower()}")
                        bio = self._extract_bio(pres.text)
                        if bio:
                            cand = cand.model_copy(update={"bio_text": bio})
                        # Scan the profile page for social/website/cv_url links.
                        links = extract_links_from_html(pres.text, base_url=profile_url)
                        if links:
                            merged = dict(cand.fields)
                            for k, v in links.items():
                                merged.setdefault(k, v)
                            cand = cand.model_copy(update={"fields": merged})
                    except Exception:  # noqa: BLE001 — one bad profile shouldn't kill the scraper
                        pass
                results.append(cand)
        return results

    def _extract_bio(self, html: str) -> str | None:
        tree = HTMLParser(html)
        # Drop noise.
        for sel in ("script", "style", "nav", "header", "footer", "form", "iframe", "svg"):
            for n in tree.css(sel):
                n.decompose()
        body = tree.body or tree.root
        if body is None:
            return None
        # The profile page has the full name in h1 and paragraphs below.
        paragraphs = [p.text(separator=" ", strip=True) for p in body.css("p")]
        paragraphs = [p for p in paragraphs if p and len(p) > 40]
        text = "\n\n".join(paragraphs).strip()
        return text[:4000] or None

    def _parse(
        self, cfg: AppConfig, party: PartyConfig, url: str, html: str
    ) -> list[RawCandidate]:
        tree = HTMLParser(html)
        out: list[RawCandidate] = []

        # Strategy: walk the document in order; track the current district
        # whenever we see an <h2>, then pick up candidates under it.
        current_district: str | None = None

        body = tree.body or tree.root
        if body is None:
            return out

        for node in body.traverse(include_text=False):
            if node.tag == "h2":
                text = node.text(strip=True)
                m = _DISTRICT_RE.search(text)
                if m:
                    current_district = cfg.district_code(m.group(1)) or cfg.district_code(
                        self._genitive_to_nom(m.group(1))
                    )
            elif node.tag == "a":
                href = node.attributes.get("href", "") or ""
                classes = node.attributes.get("class", "") or ""
                # The desktop card uses "hidden sm:block"; mobile uses "sm:hidden".
                # Dedupe by taking only the desktop card.
                if not href.startswith("/people/"):
                    continue
                if "hidden sm:block" not in classes:
                    continue

                name_node = node.css_first("h5 span")
                # Profession sits in a <div> with box-decoration-clone; the name is in a <span>.
                prof_node = node.css_first("div.box-decoration-clone")
                img = node.css_first("img")

                name_gr = name_node.text(strip=True) if name_node else None
                profession = prof_node.text(strip=True) if prof_node else None

                photo = img.attributes.get("src") if img else None
                profile_url = f"https://voltcyprus.org{href}"

                if not name_gr:
                    continue

                fields: dict[str, object] = {}
                if profession:
                    fields["profession"] = profession
                if photo:
                    fields["photo_url"] = (
                        photo if photo.startswith("http") else f"https://voltcyprus.org{photo}"
                    )
                fields["profile_url"] = profile_url

                # Transliterate Greek name → English fallback.
                # Gender heuristic is applied in merge.py so we don't duplicate it here.
                name_en = transliterate_gr_to_en(name_gr) or None

                out.append(
                    RawCandidate(
                        source_kind="party_site",
                        source_url=url,
                        party_code=party.code,
                        district_code=current_district,
                        name_gr=name_gr,
                        name_en=name_en,
                        fields=fields,
                    )
                )
        return out

    @staticmethod
    def _genitive_to_nom(word: str) -> str:
        """Volt uses genitive 'Λευκωσίας' etc. Map common endings back."""
        mapping = {
            "Λευκωσίας": "Λευκωσία",
            "Λεμεσού": "Λεμεσός",
            "Αμμοχώστου": "Αμμόχωστος",
            "Λάρνακας": "Λάρνακα",
            "Πάφου": "Πάφος",
            "Κερύνειας": "Κερύνεια",
        }
        return mapping.get(word, word)
