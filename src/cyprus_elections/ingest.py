from __future__ import annotations

import asyncio
import json
import logging
import sqlite3
from datetime import datetime
from typing import Iterable

from cyprus_elections.config import AppConfig
from cyprus_elections.db import transaction
from cyprus_elections.fetch import PoliteClient, sha256_hex
from cyprus_elections.models import RawCandidate
from cyprus_elections.scrapers import base as scraper_registry
from cyprus_elections.state import set_status, should_skip

log = logging.getLogger(__name__)

STAGE = "ingest"


def _insert_source(conn: sqlite3.Connection, raw: RawCandidate, sha: str) -> int:
    fetched = raw.fetched_at.isoformat()
    row = conn.execute(
        "SELECT id FROM sources WHERE kind = ? AND url = ? AND fetched_at = ?",
        (raw.source_kind, raw.source_url, fetched),
    ).fetchone()
    if row:
        return row["id"]
    cur = conn.execute(
        """INSERT INTO sources (kind, url, fetched_at, sha256, path)
           VALUES (?, ?, ?, ?, NULL)""",
        (raw.source_kind, raw.source_url, fetched, sha),
    )
    return int(cur.lastrowid)


def _insert_raw_record(
    conn: sqlite3.Connection, raw: RawCandidate, source_id: int
) -> int | None:
    payload = raw.model_dump(mode="json")
    key = raw.key()
    try:
        cur = conn.execute(
            """INSERT INTO raw_records
               (source_id, party_code, district_code, name_gr, name_en, bio_text, payload_json, dedupe_key)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                source_id,
                raw.party_code,
                raw.district_code,
                raw.name_gr,
                raw.name_en,
                raw.bio_text,
                json.dumps(payload, ensure_ascii=False),
                key,
            ),
        )
        return int(cur.lastrowid)
    except sqlite3.IntegrityError:
        return None  # already ingested


def _persist(conn: sqlite3.Connection, raws: Iterable[RawCandidate]) -> int:
    count = 0
    with transaction(conn):
        for r in raws:
            sha = sha256_hex(r.source_url + r.fetched_at.isoformat())
            src_id = _insert_source(conn, r, sha)
            if _insert_raw_record(conn, r, src_id) is not None:
                count += 1
    return count


async def run(
    cfg: AppConfig,
    conn: sqlite3.Connection,
    *,
    only_party: str | None = None,
    restart: bool = False,
) -> dict[str, int]:
    scraper_registry.load_all()
    stats: dict[str, int] = {}

    parties = [p for p in cfg.parties if p.enabled]
    if only_party:
        parties = [p for p in parties if p.code == only_party.upper()]
    if not parties:
        log.warning("No enabled parties match filter only_party=%s", only_party)

    async with PoliteClient(cfg) as client:
        for party in parties:
            key = party.code
            if should_skip(conn, STAGE, key, restart=restart):
                log.info("ingest: skipping %s (already ok)", key)
                stats[key] = 0
                continue
            scraper = scraper_registry.get(party.scraper)
            if scraper is None:
                log.warning("ingest: no scraper registered for %s", party.scraper)
                set_status(conn, STAGE, key, "error", f"no scraper: {party.scraper}")
                conn.commit()
                continue
            try:
                log.info("ingest: %s via %s", party.code, party.scraper)
                raws = await scraper.discover(cfg, party, client)
                new_rows = _persist(conn, raws)
                stats[key] = new_rows
                set_status(conn, STAGE, key, "ok")
                conn.commit()
                log.info("ingest: %s → %d new raw records (total %d)", party.code, new_rows, len(raws))
            except Exception as e:  # noqa: BLE001
                log.exception("ingest failed for %s", party.code)
                set_status(conn, STAGE, key, "error", f"{type(e).__name__}: {e}")
                conn.commit()
                stats[key] = 0
    return stats


def run_sync(cfg: AppConfig, conn: sqlite3.Connection, **kwargs) -> dict[str, int]:
    return asyncio.run(run(cfg, conn, **kwargs))
