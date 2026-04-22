"""Extract up to 4 "remarkable mentions" per candidate as a JSON list.

Input priority: cv_text > bio_text > career_previous.

Output: field_values[field='highlights'] = JSON array of short strings.
Never invents. If nothing notable is stated, writes nothing.
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

STAGE = "enrich_highlights"

_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "highlights": {
            "type": "array",
            "items": {"type": "string"},
        },
        "derived_from": {"type": "string"},
    },
    "required": ["highlights", "derived_from"],
}

_SYSTEM = (
    "You extract up to four short, factual 'remarkable mentions' about a Cyprus "
    "parliamentary candidate from the provided text.\n\n"
    "Rules:\n"
    "- Each highlight: a single sentence, <= 140 chars, no opinion, no adjectives "
    "like 'renowned' unless the source says so.\n"
    "- Examples of good highlights: 'Elected MP for Nicosia 2016-2021.', "
    "'Founded the NGO X in 2012.', 'Published book Y on constitutional law.', "
    "'Won national bar-association award 2019.'.\n"
    "- Do NOT repeat the candidate's current profession (that lives in a separate field).\n"
    "- If nothing notable is stated, return an empty list.\n"
    "- derived_from: 'cv' if the text came from a CV, 'bio' if from a short bio, "
    "'career' if only prior-roles text was available.\n"
    "- Return strict JSON matching the schema; English only."
)


def _collect(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT c.id AS id,
               c.canonical_name_en AS name_en,
               c.canonical_name_gr AS name_gr,
               c.party_code AS party_code,
               COALESCE(cv.best_value, '') AS cv_text,
               COALESCE(bio.best_value, '') AS bio_text,
               COALESCE(car.best_value, '') AS career_previous
          FROM candidates c
          LEFT JOIN candidate_current cv ON cv.candidate_id = c.id AND cv.field = 'cv_text'
          LEFT JOIN candidate_current bio ON bio.candidate_id = c.id AND bio.field = 'bio_text'
          LEFT JOIN candidate_current car ON car.candidate_id = c.id AND car.field = 'career_previous'
        """
    ).fetchall()


def _pick_source(row: sqlite3.Row) -> tuple[str, str]:
    if row["cv_text"].strip():
        return "cv", row["cv_text"][:8000]
    if row["bio_text"].strip():
        return "bio", row["bio_text"][:4000]
    if row["career_previous"].strip():
        return "career", row["career_previous"][:2000]
    return "", ""


def run(cfg: AppConfig, conn: sqlite3.Connection, *, restart: bool = False) -> dict[str, int]:
    stats = {"checked": 0, "written": 0, "skipped": 0, "errors": 0, "no_text": 0}
    llm = LLMClient(cfg)
    if not llm.enabled:
        log.warning("highlights: LLM disabled (no OPENROUTER_API_KEY)")
        return stats

    now = datetime.utcnow().isoformat()
    with transaction(conn):
        cur = conn.execute(
            """INSERT INTO sources (kind, url, fetched_at, sha256, path)
               VALUES ('llm_from_bio', ?, ?, NULL, NULL)
               ON CONFLICT (kind, url, fetched_at) DO NOTHING
               RETURNING id""",
            (f"enrich_highlights:{now}", now),
        ).fetchone()
        if cur is None:
            cur = conn.execute(
                "SELECT id FROM sources WHERE kind='llm_from_bio' AND url=? AND fetched_at=?",
                (f"enrich_highlights:{now}", now),
            ).fetchone()
    src_id = int(cur["id"])

    try:
        for cand in _collect(conn):
            key = f"candidate={cand['id']}"
            if should_skip(conn, STAGE, key, restart=restart):
                stats["skipped"] += 1
                continue
            kind, text = _pick_source(cand)
            if not text.strip():
                stats["no_text"] += 1
                set_status(conn, STAGE, key, "ok")
                conn.commit()
                continue
            stats["checked"] += 1
            name = cand["name_en"] or cand["name_gr"] or f"candidate-{cand['id']}"
            try:
                parsed = llm.chat_json(
                    system=_SYSTEM,
                    user=(
                        f"CANDIDATE: {name} ({cand['party_code']})\n"
                        f"SOURCE KIND: {kind}\n\nTEXT:\n{text}"
                    ),
                    cache_key=f"highlights|{cand['party_code']}|{name}|{kind}|{llm.model}|v1",
                    json_schema=_SCHEMA,
                )
            except Exception as e:  # noqa: BLE001
                log.warning("highlights failed for candidate %s: %s", cand["id"], e)
                set_status(conn, STAGE, key, "error", f"{type(e).__name__}: {e}")
                conn.commit()
                stats["errors"] += 1
                continue
            highlights = parsed.get("highlights") or []
            if not isinstance(highlights, list):
                highlights = []
            highlights = [h.strip() for h in highlights if isinstance(h, str) and h.strip()]
            if not highlights:
                set_status(conn, STAGE, key, "ok")
                conn.commit()
                continue
            payload = {
                "items": highlights[:4],
                "derived_from": parsed.get("derived_from") or kind,
            }
            conn.execute(
                """INSERT OR IGNORE INTO field_values
                   (candidate_id, field, value, source_id, extracted_at, confidence)
                   VALUES (?, 'highlights', ?, ?, ?, ?)""",
                (
                    cand["id"],
                    json.dumps(payload, ensure_ascii=False),
                    src_id,
                    now,
                    0.6 if kind == "cv" else 0.5,
                ),
            )
            set_status(conn, STAGE, key, "ok")
            conn.commit()
            stats["written"] += 1
    finally:
        llm.close()
    return stats
