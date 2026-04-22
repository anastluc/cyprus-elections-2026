"""Discover social media handles from existing bio/source text.

This stage does not hit the network. It scans `field_values` of kind bio_text
and any cached raw HTML already persisted (via sources.path) for URLs that
match well-known social patterns, then writes them into field_values with a
moderate confidence.

For richer discovery (Google/Bing search, snippet-based handle extraction)
see `web_search.py` (LLM-powered, costs credits).
"""
from __future__ import annotations

import logging
import re
import sqlite3
from datetime import datetime

from typing import Any

from cyprus_elections.config import AppConfig
from cyprus_elections.db import transaction
from cyprus_elections.llm import LLMClient
from cyprus_elections.state import set_status, should_skip

log = logging.getLogger(__name__)

STAGE = "enrich_social_discovery"
STAGE_ACTIVE = "enrich_social_discovery_active"

_SOCIAL_FIELDS = ("facebook", "instagram", "twitter", "linkedin", "website")

_ACTIVE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "facebook": {"type": ["string", "null"]},
        "instagram": {"type": ["string", "null"]},
        "twitter": {"type": ["string", "null"]},
        "linkedin": {"type": ["string", "null"]},
        "website": {"type": ["string", "null"]},
    },
    "required": ["facebook", "instagram", "twitter", "linkedin", "website"],
}

_ACTIVE_SYSTEM = (
    "You find social-media and website URLs for Cyprus parliamentary candidates "
    "(May 2026 elections) by searching the live web. Return STRICT JSON with the "
    "given schema — one URL per platform or null.\n\n"
    "STRICT RULES:\n"
    "- Return only URLs you can verify belong to THIS exact person "
    "(cross-check party, district, profession mentioned in the profile).\n"
    "- Prefer canonical URLs (facebook.com/username, linkedin.com/in/username, etc.).\n"
    "- Never return party accounts, news outlets, or generic pages as 'website'.\n"
    "- When unsure, use null. Greek names repeat — false positives are worse than gaps."
)

_PATTERNS = {
    "facebook": re.compile(r"https?://(?:www\.)?(?:m\.)?facebook\.com/([A-Za-z0-9._-]+)", re.I),
    "instagram": re.compile(r"https?://(?:www\.)?instagram\.com/([A-Za-z0-9._-]+)", re.I),
    "twitter": re.compile(r"https?://(?:www\.)?(?:twitter|x)\.com/([A-Za-z0-9_]+)", re.I),
    "linkedin": re.compile(r"https?://(?:[a-z]{2,3}\.)?linkedin\.com/in/([A-Za-z0-9._%-]+)", re.I),
}
_GENERIC_HANDLES = {"sharer", "share", "login", "signup", "home", "tr", "plugins"}


def _scan(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for field, rx in _PATTERNS.items():
        for m in rx.finditer(text):
            handle = m.group(1).lower().rstrip("/")
            if handle in _GENERIC_HANDLES or len(handle) < 2:
                continue
            out.setdefault(field, m.group(0).rstrip("/"))
    return out


def run(cfg: AppConfig, conn: sqlite3.Connection, *, restart: bool = False) -> dict[str, int]:
    stats = {"checked": 0, "matched": 0, "skipped": 0}
    rows = conn.execute(
        """SELECT c.id AS id,
                  GROUP_CONCAT(fv.value, ' ') AS bios
             FROM candidates c
             JOIN field_values fv ON fv.candidate_id = c.id
            WHERE fv.field IN ('bio_text', 'website', 'facebook', 'linkedin')
         GROUP BY c.id"""
    ).fetchall()

    existing_pairs = {
        (r["candidate_id"], r["field"])
        for r in conn.execute(
            "SELECT candidate_id, field FROM field_values WHERE field IN ('facebook','instagram','twitter','linkedin')"
        )
    }

    now = datetime.utcnow().isoformat()
    for cand in rows:
        key = f"candidate={cand['id']}"
        if should_skip(conn, STAGE, key, restart=restart):
            stats["skipped"] += 1
            continue
        stats["checked"] += 1
        found = _scan(cand["bios"] or "")
        if found:
            with transaction(conn):
                src = conn.execute(
                    """INSERT INTO sources (kind, url, fetched_at, sha256, path)
                       VALUES ('search_snippet', ?, ?, NULL, NULL)
                       ON CONFLICT (kind, url, fetched_at) DO NOTHING
                       RETURNING id""",
                    (f"social_discovery:candidate={cand['id']}", now),
                ).fetchone()
                if src is None:
                    src = conn.execute(
                        "SELECT id FROM sources WHERE kind='search_snippet' AND url=? AND fetched_at=?",
                        (f"social_discovery:candidate={cand['id']}", now),
                    ).fetchone()
                src_id = int(src["id"])
                any_new = False
                for field, url in found.items():
                    if (cand["id"], field) in existing_pairs:
                        continue
                    conn.execute(
                        """INSERT OR IGNORE INTO field_values
                           (candidate_id, field, value, source_id, extracted_at, confidence)
                           VALUES (?, ?, ?, ?, ?, ?)""",
                        (cand["id"], field, url, src_id, now, 0.5),
                    )
                    any_new = True
                if any_new:
                    stats["matched"] += 1
        set_status(conn, STAGE, key, "ok")
        conn.commit()
    return stats


def run_active(
    cfg: AppConfig,
    conn: sqlite3.Connection,
    *,
    restart: bool = False,
    limit: int | None = None,
) -> dict[str, int]:
    """Second-pass: for candidates still missing social URLs, hit the search LLM."""
    stats = {"checked": 0, "matched": 0, "skipped": 0, "skipped_covered": 0, "errors": 0}
    llm = LLMClient(cfg)
    if not llm.enabled:
        log.warning("social_discovery active-mode disabled (no OPENROUTER_API_KEY)")
        return stats
    search_model = cfg.openrouter_search_model()
    if not search_model:
        log.warning("social_discovery active-mode disabled (OPENROUTER_SEARCH_MODEL unset)")
        return stats

    rows = conn.execute(
        """SELECT id, canonical_name_gr, canonical_name_en, party_code, district_code
             FROM candidates ORDER BY id"""
    ).fetchall()

    try:
        for cand in rows:
            key = f"candidate={cand['id']}"
            if should_skip(conn, STAGE_ACTIVE, key, restart=restart):
                stats["skipped"] += 1
                continue
            have = {
                r["field"] for r in conn.execute(
                    f"""SELECT field FROM candidate_current
                        WHERE candidate_id = ?
                          AND field IN ({','.join('?' * len(_SOCIAL_FIELDS))})""",
                    (cand["id"], *_SOCIAL_FIELDS),
                )
            }
            missing = [f for f in _SOCIAL_FIELDS if f not in have]
            if not missing:
                stats["skipped_covered"] += 1
                set_status(conn, STAGE_ACTIVE, key, "ok")
                conn.commit()
                continue
            if limit is not None and stats["checked"] >= limit:
                break
            stats["checked"] += 1

            name_gr = cand["canonical_name_gr"] or ""
            name_en = cand["canonical_name_en"] or ""
            query = (
                f"Find social-media and personal website URLs for "
                f"{name_gr} / {name_en} — candidate for party {cand['party_code']} "
                f"in district {cand['district_code'] or 'unknown'}, "
                f"Cyprus 2026 parliamentary elections (Βουλευτικές 2026). "
                f"Specifically need: {', '.join(missing)}."
            )
            try:
                parsed = llm.chat_json(
                    system=_ACTIVE_SYSTEM,
                    user=query,
                    cache_key=(
                        f"social_discovery_active|{cand['party_code']}|"
                        f"{name_gr or name_en}|{search_model}"
                    ),
                    json_schema=_ACTIVE_SCHEMA,
                    model=search_model,
                )
            except Exception as e:  # noqa: BLE001
                log.exception("social_discovery active failed for candidate %s", cand["id"])
                set_status(conn, STAGE_ACTIVE, key, "error", f"{type(e).__name__}: {e}")
                conn.commit()
                stats["errors"] += 1
                continue

            new = {
                f: parsed.get(f)
                for f in missing
                if parsed and parsed.get(f) not in (None, "")
            }
            if new:
                _write_active(conn, cand["id"], new)
                stats["matched"] += 1
            set_status(conn, STAGE_ACTIVE, key, "ok")
            conn.commit()
    finally:
        llm.close()
    return stats


def _write_active(conn: sqlite3.Connection, candidate_id: int, fields: dict[str, str]) -> None:
    now = datetime.utcnow().isoformat()
    url = f"social_discovery_active:candidate={candidate_id}"
    with transaction(conn):
        src = conn.execute(
            """INSERT INTO sources (kind, url, fetched_at, sha256, path)
               VALUES ('search_snippet', ?, ?, NULL, NULL)
               ON CONFLICT (kind, url, fetched_at) DO NOTHING
               RETURNING id""",
            (url, now),
        ).fetchone()
        if src is None:
            src = conn.execute(
                "SELECT id FROM sources WHERE kind='search_snippet' AND url=? AND fetched_at=?",
                (url, now),
            ).fetchone()
        src_id = int(src["id"])
        for field, val in fields.items():
            conn.execute(
                """INSERT OR IGNORE INTO field_values
                   (candidate_id, field, value, source_id, extracted_at, confidence)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (candidate_id, field, str(val), src_id, now, 0.5),
            )
