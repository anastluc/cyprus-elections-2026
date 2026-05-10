"""Authoritative roster scraper for the philenews 753-candidate article.

Philenews published the official list of all 753 candidates on
6 May 2026, the day after nomination filings closed. The article has a
deterministic structure:

  Επαρχία <Name>
  Κομματικοί συνδυασμοί: <N> υποψήφιοι
  <PARTY HEADER ALL CAPS>
  1. ΣΟΥΦΟΣ Νικόλας
  ...
  Ανεξάρτητοι
  Firstname Lastname
  ...
  Οι υποψηφιότητες των Θρησκευτικών Ομάδων
  Θρησκευτική ομάδα Μαρωνιτών
  ...

This deterministic Python parser is preferred over an LLM extraction for
this source: it's free, fast, exhaustive, and reproducible. We tag each
extracted row with `source_kind="news"` and party_code → our internal code.
For each candidate the bio_text records both the synoptic district + party
provenance and the full source URL, so the dashboard's `description` /
`sources` panel surfaces them clearly.
"""
from __future__ import annotations

import logging
import re
import unicodedata as ud

from selectolax.parser import HTMLParser

from cyprus_elections.config import AppConfig, PartyConfig
from cyprus_elections.fetch import PoliteClient
from cyprus_elections.models import RawCandidate
from cyprus_elections.scrapers.base import register

log = logging.getLogger(__name__)


def _fold(s: str) -> str:
    """Uppercase + strip Greek diacritics for tolerant header matching."""
    s = s.upper()
    nfd = ud.normalize("NFD", s)
    return "".join(c for c in nfd if not ud.combining(c))


_DISTRICT_MAP = {
    "ΛΕΥΚΩΣΙΑΣ": "NIC",
    "ΛΕΜΕΣΟΥ": "LIM",
    "ΛΑΡΝΑΚΑΣ": "LAR",
    "ΠΑΦΟΥ": "PAF",
    "ΑΜΜΟΧΩΣΤΟΥ": "FAM",
    "ΚΕΡΥΝΕΙΑΣ": "KYR",
}

_PARTY_MAP = {
    _fold(k): v
    for k, v in {
        "ΑΓΡΟΝΟΜΟΣ ΑΓΡΟΤΙΚΟ ΕΡΓΑΤΙΚΟ ΚΟΜΜΑ": "AGRO",
        "ΑΚΕΛ": "AKEL",
        "ΑΚΡΟ": "AKRO",
        "ΑΛΜΑ": "ALMA",
        "ΑΜΕΣΗ ΔΗΜΟΚΡΑΤΙΑ": "ADEM",
        "ΒΟΛΤ": "VOLT",
        "ΔΗΜΟΚΡΑΤΙΚΗ ΑΛΛΑΓΗ": "DALL",
        "ΔΗΜΟΚΡΑΤΙΚΗ ΠΑΡΑΤΑΞΗ": "DIPA",
        "ΔΗΜΟΚΡΑΤΙΚΟ ΕΘΝΙΚΟ ΚΙΝΗΜΑ": "DEK",
        "ΔΗΜΟΚΡΑΤΙΚΟ ΚΟΜΜΑ": "DIKO",
        "ΔΗΜΟΚΡΑΤΙΚΟΣ ΣΥΝΑΓΕΡΜΟΣ": "DISY",
        "ΕΔΕΚ": "EDEK",
        "ΕΘΝΙΚΟ ΛΑΪΚΟ ΜΕΤΩΠΟ": "ELAM",
        "Ε.ΛΑ.Μ.": "ELAM",
        "ΕΝΕΡΓΟΙ ΠΟΛΙΤΕΣ": "ENPK",
        "ΚΙΝΗΜΑ ΟΙΚΟΛΟΓΩΝ": "KOSP",
        "ΛΑΪΚΟΣ ΑΓΩΝΑΣ ΕΛΕΥΘΕΡΙΑ": "LAEL",
        "ΠΑΤΡΙΩΤΙΚΟ ΜΕΤΩΠΟ": "PMLAK",
        "ΣΗΚΟΥ ΠΑΝΩ": "SIKOU",
        "ΤΟ ΠΡΑΣΙΝΟ ΚΟΜΜΑ": "PRAS",
    }.items()
}

_INDEP = "Ανεξάρτητοι"
_RELIG_SECTION = "Οι υποψηφιότητες των Θρησκευτικών"
_RELIG_GROUP = "Θρησκευτική"

_NUM_PREFIX = re.compile(r"^\s*\d+\s*\.\s*")


def _district_of(line: str) -> str | None:
    m = re.match(r"^Επαρχία\s+(\S+)", line.strip())
    if not m:
        return None
    return _DISTRICT_MAP.get(_fold(m.group(1)))


def _party_of(line: str) -> str | None:
    folded = _fold(line)
    folded = re.sub(r"\(.*?\)", "", folded).strip(" -–—")
    folded = re.sub(r"\s+", " ", folded)
    for key, code in _PARTY_MAP.items():
        if folded.startswith(key):
            return code
    return None


def _is_caps_header(line: str) -> bool:
    s = line.strip()
    if len(s) < 4 or _NUM_PREFIX.match(s):
        return False
    upper = sum(1 for c in s if c.isalpha() and c.upper() == c)
    lower = sum(1 for c in s if c.isalpha() and c.lower() == c)
    return upper >= 6 and lower < upper / 2


def _looks_like_meta(line: str) -> bool:
    s = line.strip()
    if re.match(r"^\d+\s+υποψηφι", s):
        return True
    return any(s.startswith(p) for p in ("Έχουν υποβληθεί", "Πρόκειται για", "Ρεκόρ"))


def _clean_name(line: str) -> str:
    s = _NUM_PREFIX.sub("", line.strip())
    s = re.sub(r"\s+", " ", s).strip()
    s = s.rstrip(",.;")
    return s


def _html_to_text(html: str) -> str:
    tree = HTMLParser(html)
    for sel in ("script", "style", "noscript", "nav", "footer", "header", "form"):
        for node in tree.css(sel):
            node.decompose()
    return tree.body.text(separator="\n", strip=True) if tree.body else tree.text(strip=True)


def parse_text(text: str) -> list[dict]:
    """Return list of {name_gr, party_code, district_code, section}."""
    end_idx = text.find("Εγγραφή στο Newsletter")
    if end_idx > 0:
        text = text[:end_idx]
    start_idx = text.find("Επαρχία Λευκωσίας")
    if start_idx > 0:
        text = text[start_idx:]

    # Repair section headers that the article splits across <wbr>-style
    # soft breaks ("Ανεξάρτητο\nι"). Only target the specific known prefixes
    # so we don't accidentally glue candidate names together.
    text = re.sub(r"\bΑνεξάρτητο\s*\n\s*ι\b", "Ανεξάρτητοι", text)

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    out: list[dict] = []
    district = None
    party = None
    state = "outside"  # outside | candidates | independents | religious
    relig_group = None

    for line in lines:
        d = _district_of(line)
        if d:
            district, party, state = d, None, "outside"
            continue
        if line.startswith(_RELIG_SECTION):
            district, party, state = None, None, "religious"
            relig_group = None
            continue
        if state == "religious":
            if line.startswith(_RELIG_GROUP):
                relig_group = line.strip()
                continue
            name = _clean_name(line)
            if name and not _looks_like_meta(name):
                out.append({
                    "name_gr": name,
                    "party_code": "RELIG",
                    "district_code": None,
                    "section": relig_group or "Θρησκευτική Ομάδα",
                })
            continue
        if line.startswith(_INDEP):
            party, state = "INDEP", "independents"
            continue
        if re.match(r"Κομματικοί\s+συνδυασμοί", line):
            state, party = "candidates", None
            continue
        if _looks_like_meta(line):
            continue
        new_party = _party_of(line)
        if new_party and _is_caps_header(line):
            party, state = new_party, "candidates"
            continue
        if state in ("candidates", "independents") and party and district:
            name = _clean_name(line)
            if not name or _looks_like_meta(name):
                continue
            if name.startswith(("Επαρχία", "Ανεξάρτητοι")):
                continue
            out.append({
                "name_gr": name,
                "party_code": party,
                "district_code": district,
                "section": "Independents" if state == "independents" else None,
            })
    return out


class PhilenewsFullScraper:
    """Deterministic parser for the philenews 753-candidate roster.

    Only emits identity fields (name/party/district) plus the "Independent
    candidate" hint where applicable. No bio_text — the article only
    publishes a name list per district per party, so writing a synoptic
    "Source: philenews" line as the bio would clobber real CVs at merge
    time. Source provenance is preserved via the raw_record's source_url
    and is surfaced in the dashboard's per-candidate `sources` array.
    """

    async def discover(
        self, cfg: AppConfig, party: PartyConfig, client: PoliteClient
    ) -> list[RawCandidate]:
        results: list[RawCandidate] = []
        for url in party.seed_urls:
            try:
                res = await client.get(
                    url, bucket=f"parties/{party.code.lower()}", render_js=party.js_render
                )
            except Exception as e:
                log.warning("philenews_full: fetch failed for %s: %s", url, e)
                continue
            text = _html_to_text(res.text)
            rows = parse_text(text)
            log.info("philenews_full: parsed %d candidates from %s", len(rows), url)
            for item in rows:
                fields: dict = {}
                if item.get("section") == "Independents":
                    fields["profession"] = "Independent candidate"
                results.append(
                    RawCandidate(
                        source_kind="news",
                        source_url=url,
                        party_code=item["party_code"],
                        district_code=item["district_code"],
                        name_gr=item["name_gr"],
                        name_en=None,
                        bio_text=None,
                        fields=fields,
                    )
                )
        return results


@register("philenews_full")
class _Philenews(PhilenewsFullScraper):
    pass
