"""Web-search enrichment via OpenRouter's search-capable model.

For candidates whose existing data is sparse (few structured fields, no bio),
we send a targeted query to OPENROUTER_SEARCH_MODEL (default perplexity/sonar)
and ask it to return a JSON object with biographical fields gathered from
the live web. Results persist as source_kind=search_snippet (low trust: 0.45)
so party-site data still wins when both are present.

Skipped when either the search model isn't configured or the candidate
already has good coverage (configurable threshold).
"""
from __future__ import annotations

import logging
import sqlite3
from datetime import datetime
from typing import Any

from cyprus_elections.config import AppConfig
from cyprus_elections.db import transaction
from cyprus_elections.llm import LLMClient
from cyprus_elections.state import set_status, should_skip

log = logging.getLogger(__name__)

STAGE = "enrich_web_search"

# Key target fields — we only skip the web search when *every* one of these
# already has a value. Previously we skipped as soon as 3-of-7 rich fields
# were set, which meant candidates with a bio but no social links were
# never topped up.
_TARGET_FIELDS = (
    "education", "career_previous", "profession",
    "facebook", "linkedin", "website",
)

_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "bio_text": {"type": ["string", "null"]},
        "education": {"type": ["string", "null"]},
        "career_previous": {"type": ["string", "null"]},
        "profession": {"type": ["string", "null"]},
        "sector": {"type": ["string", "null"]},
        "date_of_birth": {"type": ["string", "null"]},
        "age": {"type": ["integer", "null"]},
        "facebook": {"type": ["string", "null"]},
        "linkedin": {"type": ["string", "null"]},
        "twitter": {"type": ["string", "null"]},
        "instagram": {"type": ["string", "null"]},
        "website": {"type": ["string", "null"]},
        "photo_url": {"type": ["string", "null"]},
        "cv_url": {"type": ["string", "null"]},
    },
    "required": [
        "bio_text", "education", "career_previous", "profession", "sector",
        "date_of_birth", "age", "facebook", "linkedin", "twitter",
        "instagram", "website", "photo_url", "cv_url",
    ],
}

_SYSTEM = (
    "You research Cyprus parliamentary candidates (May 2026 elections) by "
    "searching the live web. Return STRICT JSON matching the given schema.\n\n"
    "Fill only values you find in reputable sources (party site, news, "
    "LinkedIn, Wikipedia). Do NOT hallucinate. Use null when unknown.\n\n"
    "Fields:\n"
    "- bio_text: 2-4 sentence biography summary from reputable sources.\n"
    "- education: highest qualification + institution, else null.\n"
    "- career_previous: prior roles (comma-separated), else null.\n"
    "- profession: current primary profession, else null.\n"
    "- sector: one short label ('law', 'medicine', 'engineering', "
    "'education', 'business', 'public sector', 'journalism', etc.).\n"
    "- date_of_birth: ISO YYYY-MM-DD if found, else null.\n"
    "- age: integer if explicitly stated, else null.\n"
    "- facebook / linkedin / twitter / instagram / website / photo_url / cv_url: "
    "absolute URLs only if verifiable as belonging to THIS SPECIFIC person, else null.\n"
    "Be conservative: if unsure whether a URL/photo/bio belongs to this person "
    "(common Greek names are ambiguous), prefer null.\n"
)


def _missing_targets(conn: sqlite3.Connection, candidate_id: int) -> list[str]:
    row = conn.execute(
        f"""SELECT GROUP_CONCAT(field, ',') AS fields
             FROM candidate_current
            WHERE candidate_id = ?
              AND field IN ({','.join('?' * len(_TARGET_FIELDS))})""",
        (candidate_id, *_TARGET_FIELDS),
    ).fetchone()
    have = set((row["fields"] or "").split(",")) if row and row["fields"] else set()
    return [f for f in _TARGET_FIELDS if f not in have]


def run(cfg: AppConfig, conn: sqlite3.Connection, *, restart: bool = False,
        limit: int | None = None) -> dict[str, int]:
    llm = LLMClient(cfg)
    stats = {"checked": 0, "enriched": 0, "skipped_rich": 0, "skipped": 0, "errors": 0}
    if not llm.enabled:
        log.warning("web_search disabled (no OPENROUTER_API_KEY)")
        return stats
    search_model = cfg.openrouter_search_model()
    if not search_model:
        log.warning("web_search disabled (OPENROUTER_SEARCH_MODEL unset)")
        return stats

    rows = conn.execute(
        """SELECT id, canonical_name_gr, canonical_name_en, party_code, district_code
             FROM candidates ORDER BY id"""
    ).fetchall()

    try:
        for cand in rows:
            key = f"candidate={cand['id']}"
            if should_skip(conn, STAGE, key, restart=restart):
                stats["skipped"] += 1
                continue
            missing = _missing_targets(conn, cand["id"])
            if not missing:
                stats["skipped_rich"] += 1
                set_status(conn, STAGE, key, "ok")
                conn.commit()
                continue
            if limit is not None and stats["checked"] >= limit:
                break
            stats["checked"] += 1

            name_for_search = cand["canonical_name_gr"] or cand["canonical_name_en"] or ""
            name_latin = cand["canonical_name_en"] or ""
            district = cand["district_code"] or ""
            query = (
                f"Find biographical information about {name_for_search} "
                f"({name_latin}), candidate for party {cand['party_code']} "
                f"in district {district}, 2026 Cyprus parliamentary elections "
                f"(Βουλευτικές 2026). Return structured data.\n"
                f"Priority fields still missing for this person: {', '.join(missing)}."
            )
            try:
                parsed, citations = llm.chat_json_with_citations(
                    system=_SYSTEM,
                    user=query,
                    # v3 cache key: bumped from v2 so cached responses (which
                    # had no citations recorded) get re-fetched and we keep
                    # the URLs the search model used.
                    cache_key=f"web_search|{cand['party_code']}|{name_for_search}|{search_model}|v3",
                    json_schema=_SCHEMA,
                    model=search_model,
                )
            except Exception as e:  # noqa: BLE001
                log.exception("web_search failed for candidate %s", cand["id"])
                set_status(conn, STAGE, key, "error", f"{type(e).__name__}: {e}")
                conn.commit()
                stats["errors"] += 1
                continue

            if parsed and _persist(conn, cand["id"], parsed, citations):
                stats["enriched"] += 1
            set_status(conn, STAGE, key, "ok")
            conn.commit()
    finally:
        llm.close()
    return stats


def _persist(
    conn: sqlite3.Connection,
    candidate_id: int,
    parsed: dict,
    citations: list[str],
) -> int:
    """Persist extracted fields, attaching them to a real citation URL when
    one is available. Falls back to the legacy `web_search:candidate=N`
    placeholder only when the search model returned no citations at all
    (so old behaviour is preserved as a worst case)."""
    now = datetime.utcnow().isoformat()
    written = 0
    with transaction(conn):
        # Register every citation URL as its own source row, then pick the
        # first as the "primary" source for the extracted fields. The LLM
        # doesn't tell us which citation backed which field, so attaching
        # all fields to citation #1 is the closest honest approximation —
        # but we still record the rest in `sources` so the candidate's
        # "All sources" list surfaces them.
        primary_src_id: int | None = None
        for url in citations:
            cur = conn.execute(
                """INSERT INTO sources (kind, url, fetched_at, sha256, path)
                   VALUES ('search_snippet', ?, ?, NULL, NULL)
                   ON CONFLICT (kind, url, fetched_at) DO NOTHING
                   RETURNING id""",
                (url, now),
            ).fetchone()
            if cur is None:
                cur = conn.execute(
                    "SELECT id FROM sources WHERE kind='search_snippet' AND url=? AND fetched_at=?",
                    (url, now),
                ).fetchone()
            sid = int(cur["id"])
            if primary_src_id is None:
                primary_src_id = sid

        if primary_src_id is None:
            # No citations: fall back to the placeholder so the field
            # attribution still has *some* row pointing at it.
            placeholder = f"web_search:candidate={candidate_id}"
            cur = conn.execute(
                """INSERT INTO sources (kind, url, fetched_at, sha256, path)
                   VALUES ('search_snippet', ?, ?, NULL, NULL)
                   ON CONFLICT (kind, url, fetched_at) DO NOTHING
                   RETURNING id""",
                (placeholder, now),
            ).fetchone()
            if cur is None:
                cur = conn.execute(
                    "SELECT id FROM sources WHERE kind='search_snippet' AND url=? AND fetched_at=?",
                    (placeholder, now),
                ).fetchone()
            primary_src_id = int(cur["id"])

        for field, value in parsed.items():
            if value in (None, ""):
                continue
            conn.execute(
                """INSERT OR IGNORE INTO field_values
                   (candidate_id, field, value, source_id, extracted_at, confidence)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (candidate_id, field, str(value), primary_src_id, now, 0.45),
            )
            written += 1
    return written
