"""Generic LLM-based scraper.

Used for party sites whose HTML varies too much to justify a custom parser, and
for news-aggregator pages that list candidates from multiple parties.

Strategy:
1. Fetch each seed URL (cached via PoliteClient).
2. Strip boilerplate (scripts, styles, nav, footer) and convert to readable text.
3. Ask OpenRouter to return a strict JSON list of candidates with
   {name_gr, name_en, party_code, district, profession, bio, social, cv_url}.
4. Map district names/codes via the config and emit RawCandidate rows.

Falls back silently to zero results when OPENROUTER_API_KEY is not configured.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from selectolax.parser import HTMLParser

from cyprus_elections.config import AppConfig, PartyConfig
from cyprus_elections.fetch import PoliteClient
from cyprus_elections.llm import LLMClient
from cyprus_elections.models import RawCandidate
from cyprus_elections.scrapers.base import register

log = logging.getLogger(__name__)

# Anthropic (via OpenRouter) limits schemas to ≤16 nullable/union-typed
# parameters. We keep strings as plain "string" and treat "" as "not found";
# only `age` remains a union because there's no sensible integer sentinel.
_STR_FIELDS = (
    "name_gr", "name_en", "party_code", "district_code", "district_name",
    "profession", "sector", "education", "career_previous",
    "date_of_birth", "gender", "bio",
    "facebook", "twitter", "instagram", "linkedin",
    "website", "cv_url", "photo_url",
)

_EXTRACT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "candidates": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    **{k: {"type": "string"} for k in _STR_FIELDS},
                    "age": {"type": ["integer", "null"]},
                },
                "required": [*_STR_FIELDS, "age"],
            },
        },
    },
    "required": ["candidates"],
}


def _clean_html_to_text(html: str, max_chars: int = 60_000) -> str:
    tree = HTMLParser(html)
    for sel in (
        "script", "style", "noscript", "nav", "footer", "header",
        "form", "iframe", "svg", ".menu", ".nav", ".navbar", ".cookie",
    ):
        for node in tree.css(sel):
            node.decompose()
    # Preserve structure enough for the LLM to find district headings.
    text = tree.body.text(separator="\n", strip=True) if tree.body else tree.text(strip=True)
    # Collapse runs of blank lines.
    lines = [ln.strip() for ln in text.splitlines()]
    compact: list[str] = []
    blank = False
    for ln in lines:
        if not ln:
            if blank:
                continue
            blank = True
        else:
            blank = False
        compact.append(ln)
    text = "\n".join(compact)
    return text[:max_chars]


def _collect_anchors(html: str, max_anchors: int = 200) -> list[tuple[str, str]]:
    """Return [(anchor_text, href), ...] pairs. Helps the LLM find social/CV URLs
    when they are behind icons or image-only links that don't survive text cleaning.
    """
    tree = HTMLParser(html)
    out: list[tuple[str, str]] = []
    for a in tree.css("a"):
        href = (a.attributes.get("href") or "").strip()
        if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
            continue
        label = a.text(separator=" ", strip=True) or (a.attributes.get("aria-label") or "").strip()
        out.append((label[:80], href[:300]))
        if len(out) >= max_anchors:
            break
    return out


def _system_prompt(party: PartyConfig | None, known_parties: list[str], districts: list[dict]) -> str:
    party_desc = (
        f"You are extracting candidates of party {party.code} ({party.name_gr} / {party.name_en})."
        if party and party.code != "NEWS"
        else "You are extracting candidates across any parties mentioned in the text."
    )
    parties_csv = ", ".join(known_parties)
    district_lines = "\n".join(
        f"- {d['code']}: {d['name_en']} / {d['name_gr']}" for d in districts
    )
    return (
        f"{party_desc}\n\n"
        "You receive cleaned text from a web page. Extract ONLY candidates for the May 2026 "
        "Cyprus parliamentary elections (Βουλευτικές 2026).\n\n"
        "Output JSON with a single top-level key `candidates` (a list). For each candidate:\n"
        "- name_gr: full name in Greek if present, else null.\n"
        "- name_en: full name in Latin/English if present, else null.\n"
        f"- party_code: one of [{parties_csv}] or null if unclear.\n"
        "- district_code: one of [NIC, LIM, FAM, LAR, PAF, KYR] or null.\n"
        "- district_name: raw district label as written (Greek OK).\n"
        "- profession: short professional title if stated.\n"
        "- sector: high-level sector (e.g. law, healthcare, academia, business, civil society).\n"
        "- education: degrees / universities / studies if mentioned.\n"
        "- career_previous: notable past roles / positions held, comma-separated.\n"
        "- age: integer, only if explicitly stated.\n"
        "- date_of_birth: ISO date (YYYY-MM-DD) if stated, else null.\n"
        "- gender: 'M' or 'F' if evident from the text or name.\n"
        "- bio: short bio sentence(s) if present.\n"
        "- facebook / twitter / instagram / linkedin / website / cv_url / photo_url: "
        "absolute URLs only if present in the text OR in the anchor list below. "
        "If an anchor label identifies a social network (e.g. 'Facebook', icon alt text), use its href.\n\n"
        "District reference:\n"
        f"{district_lines}\n\n"
        "STRICT RULES:\n"
        "1. Only extract people explicitly presented as 2026 parliamentary (βουλευτές/βουλεύτριες) candidates. "
        "SKIP municipal candidates, school-board candidates, party officials who are not standing.\n"
        "2. If the same person appears twice, include them once.\n"
        "3. Do NOT invent fields. For string fields, use an EMPTY STRING (\"\") when the text does not state a value. "
        "For `age`, use null when unknown.\n"
        "4. Return only the JSON object — no prose.\n"
    )


class LLMGenericScraper:
    """Runs the generic LLM extraction against each seed URL of a party."""

    async def discover(
        self, cfg: AppConfig, party: PartyConfig, client: PoliteClient
    ) -> list[RawCandidate]:
        llm = LLMClient(cfg)
        if not llm.enabled:
            log.warning(
                "scraper %s: OPENROUTER_API_KEY not set — LLM extraction disabled, 0 candidates",
                party.code,
            )
            return []

        results: list[RawCandidate] = []
        known_parties = [p.code for p in cfg.parties if p.code not in {"OFFICIAL", "NEWS"}]
        districts = [d.model_dump() for d in cfg.districts]
        sys_prompt = _system_prompt(party, known_parties, districts)

        try:
            for url in party.seed_urls:
                try:
                    res = await client.get(
                        url,
                        bucket=f"parties/{party.code.lower()}",
                        render_js=party.js_render,
                    )
                except ImportError as e:
                    log.warning("llm_generic %s: JS rendering requested but unavailable (%s); skipping %s",
                                party.code, e, url)
                    continue
                text = _clean_html_to_text(res.text)
                if not text.strip():
                    continue
                anchors = _collect_anchors(res.text)
                anchor_block = "\n".join(f"- [{label}] {href}" for label, href in anchors)
                log.info("llm_generic: %s extracting from %s (%d chars, %d anchors)",
                         party.code, url, len(text), len(anchors))
                parsed = llm.chat_json(
                    system=sys_prompt,
                    user=(
                        f"SOURCE URL: {url}\n\nPAGE TEXT:\n{text}\n\n"
                        f"ANCHOR LINKS (label → href):\n{anchor_block or '(none)'}"
                    ),
                    cache_key=f"llm_generic|{party.code}|{url}|{llm.model}|v2",
                    json_schema=_EXTRACT_SCHEMA,
                )
                candidates = parsed.get("candidates") or []
                for item in candidates:
                    raw = self._to_raw(cfg, party, url, item)
                    if raw is not None:
                        results.append(raw)
        finally:
            llm.close()
        return results

    def _to_raw(
        self,
        cfg: AppConfig,
        party: PartyConfig,
        url: str,
        item: dict,
    ) -> RawCandidate | None:
        name_gr = (item.get("name_gr") or "").strip() or None
        name_en = (item.get("name_en") or "").strip() or None
        if not (name_gr or name_en):
            return None
        # Trust the LLM's party_code only for aggregator scrapers (party.code == NEWS),
        # otherwise force the configured party code.
        party_code = item.get("party_code") if party.code == "NEWS" else party.code
        if party.code == "NEWS" and (not party_code or party_code not in {p.code for p in cfg.parties}):
            return None  # aggregator item lacking party mapping → skip

        district_code = item.get("district_code")
        if not district_code and item.get("district_name"):
            district_code = cfg.district_code(item["district_name"])
        if district_code and district_code not in {d.code for d in cfg.districts}:
            district_code = None

        fields: dict[str, Any] = {}
        for k in (
            "profession", "sector", "education", "career_previous",
            "age", "date_of_birth", "gender",
            "facebook", "twitter", "instagram", "linkedin",
            "website", "cv_url", "photo_url",
        ):
            v = item.get(k)
            if v not in (None, ""):
                fields[k] = v

        is_news = party.code == "NEWS"
        source_kind = "news" if is_news else "party_site"

        return RawCandidate(
            source_kind=source_kind,
            source_url=url,
            party_code=party_code,
            district_code=district_code,
            name_gr=name_gr,
            name_en=name_en,
            bio_text=item.get("bio") or None,
            fields=fields,
        )


# Register under several codes — any party with `scraper: llm_generic` (or news/etc.)
# routes to the same implementation.
for _code in ("llm_generic", "news", "disy", "diko", "dipa", "elam", "edek", "kosp", "alma", "direct_democracy"):
    @register(_code)
    class _Instance(LLMGenericScraper):  # noqa: D401 — per-code subclass just for registry
        pass
