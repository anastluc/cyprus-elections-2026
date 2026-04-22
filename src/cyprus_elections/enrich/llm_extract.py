"""LLM-driven structured extraction from free-text bios.

Some scrapers (AKEL, news aggregators) capture a paragraph of biographical
text but no structured fields. This stage sends each candidate's bio through
OpenRouter and asks for a JSON object with {education, career_previous,
profession, sector, gender, age, date_of_birth} — whichever are stated.

Skipped candidates (no bio, LLM disabled, or already processed) are no-ops.
"""
from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime
from typing import Any

from cyprus_elections.config import AppConfig
from cyprus_elections.db import transaction
from cyprus_elections.llm import LLMClient
from cyprus_elections.state import set_status, should_skip

log = logging.getLogger(__name__)

STAGE = "enrich_llm_extract"

_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "education": {"type": ["string", "null"]},
        "career_previous": {"type": ["string", "null"]},
        "profession": {"type": ["string", "null"]},
        "sector": {"type": ["string", "null"]},
        "gender": {"type": ["string", "null"]},
        "age": {"type": ["integer", "null"]},
        "date_of_birth": {"type": ["string", "null"]},
        "facebook": {"type": ["string", "null"]},
        "twitter": {"type": ["string", "null"]},
        "instagram": {"type": ["string", "null"]},
        "linkedin": {"type": ["string", "null"]},
        "website": {"type": ["string", "null"]},
        "cv_url": {"type": ["string", "null"]},
    },
    "required": [
        "education", "career_previous", "profession",
        "sector", "gender", "age", "date_of_birth",
        "facebook", "twitter", "instagram", "linkedin", "website", "cv_url",
    ],
}

_SYSTEM = (
    "You extract structured biographical fields about Cyprus parliamentary "
    "candidates from short free-text bios. Return strict JSON matching the "
    "schema.\n\n"
    "- education: highest qualification + institution, or null.\n"
    "- career_previous: prior roles (comma-separated), or null.\n"
    "- profession: current primary profession, or null.\n"
    "- sector: one short label (e.g. 'law', 'medicine', 'engineering', "
    "'education', 'business', 'public sector', 'journalism', 'agriculture'). null if unclear.\n"
    "- gender: 'M' or 'F' only if explicitly inferable from the text (pronouns, "
    "titles, grammatical gender of name). Otherwise null.\n"
    "- age: integer, only if explicitly stated.\n"
    "- date_of_birth: ISO date (YYYY-MM-DD) only if explicitly stated.\n"
    "- facebook / twitter / instagram / linkedin / website / cv_url: extract any "
    "absolute URL for that platform that appears in the bio text; otherwise null.\n\n"
    "Never invent values. Use null when the text does not state something."
)


def _candidates_with_bios(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        """SELECT c.id AS id,
                  c.canonical_name_gr AS name_gr,
                  c.canonical_name_en AS name_en,
                  c.party_code AS party_code,
                  GROUP_CONCAT(fv.value, ' || ') AS bios
             FROM candidates c
             JOIN field_values fv ON fv.candidate_id = c.id
            WHERE fv.field = 'bio_text'
         GROUP BY c.id"""
    ).fetchall()


def run(cfg: AppConfig, conn: sqlite3.Connection, *, restart: bool = False) -> dict[str, int]:
    llm = LLMClient(cfg)
    stats = {"checked": 0, "extracted": 0, "skipped": 0, "errors": 0, "no_bio": 0}
    if not llm.enabled:
        log.warning("llm_extract disabled (no OPENROUTER_API_KEY)")
        return stats

    rows = _candidates_with_bios(conn)
    try:
        for cand in rows:
            key = f"candidate={cand['id']}"
            if should_skip(conn, STAGE, key, restart=restart):
                stats["skipped"] += 1
                continue
            bios = (cand["bios"] or "").strip()
            if not bios:
                stats["no_bio"] += 1
                set_status(conn, STAGE, key, "ok")
                conn.commit()
                continue
            stats["checked"] += 1
            try:
                name = cand["name_en"] or cand["name_gr"] or ""
                parsed = llm.chat_json(
                    system=_SYSTEM,
                    user=f"CANDIDATE: {name} ({cand['party_code']})\n\nBIO:\n{bios[:4000]}",
                    cache_key=f"llm_extract|{cand['party_code']}|{name}|{llm.model}|v2",
                    json_schema=_SCHEMA,
                )
            except Exception as e:  # noqa: BLE001
                log.exception("llm_extract failed for candidate %s", cand["id"])
                set_status(conn, STAGE, key, "error", f"{type(e).__name__}: {e}")
                conn.commit()
                stats["errors"] += 1
                continue

            if parsed:
                written = _persist(conn, cand["id"], parsed)
                if written:
                    stats["extracted"] += 1
            set_status(conn, STAGE, key, "ok")
            conn.commit()
    finally:
        llm.close()
    return stats


def _persist(conn: sqlite3.Connection, candidate_id: int, parsed: dict) -> int:
    now = datetime.utcnow().isoformat()
    url = f"llm_extract:candidate={candidate_id}"
    written = 0
    with transaction(conn):
        cur = conn.execute(
            """INSERT INTO sources (kind, url, fetched_at, sha256, path)
               VALUES ('llm_from_bio', ?, ?, NULL, NULL)
               ON CONFLICT (kind, url, fetched_at) DO NOTHING
               RETURNING id""",
            (url, now),
        ).fetchone()
        if cur is None:
            cur = conn.execute(
                "SELECT id FROM sources WHERE kind='llm_from_bio' AND url=? AND fetched_at=?",
                (url, now),
            ).fetchone()
        src_id = int(cur["id"])

        for field in ("education", "career_previous", "profession", "sector",
                      "gender", "age", "date_of_birth",
                      "facebook", "twitter", "instagram", "linkedin",
                      "website", "cv_url"):
            v = parsed.get(field)
            if v in (None, ""):
                continue
            conn.execute(
                """INSERT OR IGNORE INTO field_values
                   (candidate_id, field, value, source_id, extracted_at, confidence)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (candidate_id, field, str(v), src_id, now, 0.6),
            )
            written += 1
    _ = json  # keep import for potential future raw-payload store
    return written
