"""Fetch elected MPs + (best-effort) per-candidate votes for past Cyprus
parliamentary elections (2001–2021), using an LLM with web search.

Strategy: one chat-JSON call per year against OPENROUTER_SEARCH_MODEL, asking
for the full list of elected MPs that year with party, district, and — where
known — vote totals. Results cached to disk so reruns are free.

2026 non-elected candidates are *not* modelled here; the timeline represents
"elected MPs" only for past years (plus each 2026 candidate gets an implicit
'running' marker for 2026 in the dashboard layer).
"""
from __future__ import annotations

import logging
import sqlite3
from datetime import datetime
from typing import Any

from cyprus_elections.config import AppConfig
from cyprus_elections.db import transaction
from cyprus_elections.historical.match import _candidate_index, resolve_candidate_id
from cyprus_elections.llm import LLMClient
from cyprus_elections.normalize import fuzzy_name_key, name_key

log = logging.getLogger(__name__)

YEARS: tuple[int, ...] = (2001, 2006, 2011, 2016, 2021)

# Canonical party codes used across the dashboard.
_PARTY_CANON = {
    "disy": "DISY",
    "democratic rally": "DISY",
    "δημοκρατικός συναγερμός": "DISY",
    "akel": "AKEL",
    "progressive party of working people": "AKEL",
    "ανορθωτικό κόμμα εργαζόμενου λαού": "AKEL",
    "diko": "DIKO",
    "democratic party": "DIKO",
    "δημοκρατικό κόμμα": "DIKO",
    "edek": "EDEK",
    "movement for social democracy": "EDEK",
    "κίνημα σοσιαλδημοκρατών": "EDEK",
    "elam": "ELAM",
    "national popular front": "ELAM",
    "εθνικό λαϊκό μέτωπο": "ELAM",
    "kosp": "KOSP",
    "movement of ecologists": "KOSP",
    "ecologists": "KOSP",
    "κίνημα οικολόγων": "KOSP",
    "dipa": "DIPA",
    "democratic front": "DIPA",
    "δημοκρατική παράταξη": "DIPA",
    "depa": "DIPA",
    "volt": "VOLT",
    "volt cyprus": "VOLT",
    "volt κύπρος": "VOLT",
    "alma": "ALMA",
    "citizens for cyprus": "ALMA",
    "adem": "ADEM",
    "direct democracy": "ADEM",
    "άμεση δημοκρατία": "ADEM",
    "evroko": "EVROKO",
    "european party": "EVROKO",
    "european democracy": "EVROKO",
    "ευρωπαϊκό κόμμα": "EVROKO",
    "diko-edek-evroko": "EDEK",  # 2016 συνεργασία fallback
    "symmachia": "SP",
    "citizens alliance": "SP",
    "συμμαχία πολιτών": "SP",
    "allileggyi": "ALLIL",
    "solidarity": "ALLIL",
    "αλληλεγγύη": "ALLIL",
    "independent": "IND",
    "ανεξάρτητος": "IND",
    "ανεξάρτητη": "IND",
    "symp olitwn": "SP",
}

_DISTRICT_ALIASES = {
    "nicosia": "NIC",
    "lefkosia": "NIC",
    "λευκωσία": "NIC",
    "λευκωσίας": "NIC",
    "limassol": "LIM",
    "lemesos": "LIM",
    "λεμεσός": "LIM",
    "λεμεσού": "LIM",
    "famagusta": "FAM",
    "ammochostos": "FAM",
    "αμμόχωστος": "FAM",
    "αμμοχώστου": "FAM",
    "larnaca": "LAR",
    "larnaka": "LAR",
    "λάρνακα": "LAR",
    "λάρνακας": "LAR",
    "paphos": "PAF",
    "pafos": "PAF",
    "πάφος": "PAF",
    "πάφου": "PAF",
    "kyrenia": "KYR",
    "keryneia": "KYR",
    "κερύνεια": "KYR",
    "κερύνειας": "KYR",
}


def _canon_party(label: str) -> str:
    if not label:
        return "OTHER"
    key = label.strip().lower()
    for k, v in _PARTY_CANON.items():
        if k in key:
            return v
    return "OTHER"


def _canon_district(label: str) -> str | None:
    if not label:
        return None
    key = label.strip().lower()
    for k, v in _DISTRICT_ALIASES.items():
        if k in key:
            return v
    return None


_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "year": {"type": "integer"},
        "source_urls": {"type": "array", "items": {"type": "string"}},
        "candidates": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "name_en": {"type": "string"},
                    "name_gr": {"type": "string"},
                    "party": {"type": "string"},
                    "district": {"type": "string"},
                    "votes": {"type": ["integer", "null"]},
                    "elected": {"type": "boolean"},
                },
                "required": ["name_en", "name_gr", "party", "district", "votes", "elected"],
            },
        },
    },
    "required": ["year", "source_urls", "candidates"],
}


def _system_prompt() -> str:
    return (
        "You are an expert on Cyprus politics compiling historical parliamentary-"
        "election results. Return strict JSON matching the schema.\n\n"
        "For the given election year, list every elected Member of Parliament you "
        "know by name. The House of Representatives has 56 seats (+3 community "
        "representatives). Include each MP's name in Latin script (`name_en`) AND "
        "in Greek (`name_gr`) — never leave both empty. For MPs you are certain "
        "about, include the party they stood with *that year* (parties merged or "
        "rebranded across elections) and their electoral district — one of: "
        "Nicosia, Limassol, Famagusta, Larnaca, Paphos, Kyrenia.\n\n"
        "Set `elected: true`. Use `votes` only if you have a reliable specific "
        "vote count; otherwise null.\n\n"
        "Include `source_urls` with the Wikipedia pages (English and Greek) you "
        "are drawing on, e.g. "
        "https://en.wikipedia.org/wiki/<year>_Cypriot_legislative_election or "
        "https://el.wikipedia.org/wiki/Βουλευτικές_εκλογές_στην_Κύπρο_<year>.\n\n"
        "Do NOT emit rows with empty names. If you are unsure, return fewer rows. "
        "Quality over quantity."
    )


def _query_year(llm: LLMClient, year: int, model: str) -> dict:
    user = (
        f"Year: {year} Cypriot parliamentary election (Βουλευτικές εκλογές {year}).\n"
        "Return the JSON with every elected MP you can confidently name — Greek "
        "and Latin spellings, party, district."
    )
    return llm.chat_json(
        system=_system_prompt(),
        user=user,
        cache_key=f"historical|{year}|{model}|v2",
        json_schema=_SCHEMA,
        model=model,
    )


def ingest(
    cfg: AppConfig,
    conn: sqlite3.Connection,
    *,
    years: tuple[int, ...] = YEARS,
    restart: bool = False,
) -> dict[str, Any]:
    stats: dict[str, Any] = {"years": {}, "matched_total": 0}
    llm = LLMClient(cfg)
    if not llm.enabled:
        log.warning("historical ingest disabled (no OPENROUTER_API_KEY)")
        return stats
    model = cfg.openrouter_model()

    idx = _candidate_index(conn)
    try:
        for year in years:
            if restart:
                conn.execute("DELETE FROM historical_results WHERE year = ?", (year,))
                conn.commit()
            log.info("historical: fetching year=%d via model=%s", year, model)
            try:
                parsed = _query_year(llm, year, model)
            except Exception as e:  # noqa: BLE001
                log.exception("historical year %s fetch failed", year)
                stats["years"][year] = {"error": f"{type(e).__name__}: {e}"}
                continue
            rows = parsed.get("candidates") or []
            source_urls = parsed.get("source_urls") or []
            primary_url = source_urls[0] if source_urls else f"llm-search:historical/{year}"
            y_stats = {"fetched": len(rows), "inserted": 0, "matched": 0}
            now = datetime.utcnow().isoformat()
            with transaction(conn):
                for item in rows:
                    name_gr = (item.get("name_gr") or "").strip()
                    name_en = (item.get("name_en") or "").strip()
                    if not (name_gr or name_en):
                        continue
                    party_code = _canon_party(item.get("party") or "")
                    district_code = _canon_district(item.get("district") or "")
                    votes = item.get("votes")
                    if not isinstance(votes, int):
                        votes = None
                    elected = 1 if item.get("elected", True) else 0
                    cand_key = name_key(name_gr, name_en) or fuzzy_name_key(name_gr, name_en)
                    if not cand_key:
                        continue
                    cid = resolve_candidate_id(idx, name_gr, name_en)
                    conn.execute(
                        """INSERT OR IGNORE INTO historical_results
                           (candidate_key, candidate_id, name_gr, name_en, year,
                            party_code, party_label, district_code, votes, elected,
                            source_url, source_kind, fetched_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'historical_wiki', ?)""",
                        (
                            cand_key, cid, name_gr or None, name_en or None, year,
                            party_code, item.get("party") or None,
                            district_code, votes, elected,
                            primary_url, now,
                        ),
                    )
                    y_stats["inserted"] += 1
                    if cid is not None:
                        y_stats["matched"] += 1
            stats["years"][year] = y_stats
            stats["matched_total"] += y_stats["matched"]
    finally:
        llm.close()
    return stats


# Alias so `cyprus_elections.historical.run` imports cleanly.
run = ingest
