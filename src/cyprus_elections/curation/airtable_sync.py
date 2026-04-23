"""Reverse sync: Airtable curator suggestions → SQLite field_values.

Flow:
    1. Humans file rows in the Airtable "Suggestions" table (candidate link,
       field name, proposed value, notes).
    2. A curator flips status=approved on the rows they want applied.
    3. `pull_approved` fetches those rows, inserts them as a kind='curator'
       source with trust from config, rebuilds candidate_current so the new
       value wins, and flips the Airtable status to 'applied'.

Idempotent: each suggestion is keyed by its Airtable record ID in the sources
table, so re-runs don't double-apply even if the Airtable status update failed.
"""
from __future__ import annotations

import logging
import os
import sqlite3
from datetime import datetime

from cyprus_elections.config import AppConfig
from cyprus_elections.export.csv import WIDE_FIELDS
from cyprus_elections.merge import _rebuild_current

log = logging.getLogger(__name__)

SUGGESTIONS_TABLE_ENV = "AIRTABLE_TABLE_SUGGESTIONS"
DEFAULT_SUGGESTIONS_TABLE = "Suggestions"
STATUS_CHOICES = ("pending", "approved", "rejected", "applied")


def _require_env() -> tuple[str, str]:
    token = os.environ.get("AIRTABLE_TOKEN")
    base_id = os.environ.get("AIRTABLE_BASE_ID")
    if not (token and base_id):
        raise RuntimeError("AIRTABLE_TOKEN and AIRTABLE_BASE_ID must be set in .env")
    return token, base_id


def _suggestions_fields(candidates_table_id: str) -> list[dict]:
    return [
        {
            "name": "candidate",
            "type": "multipleRecordLinks",
            "options": {"linkedTableId": candidates_table_id},
        },
        {
            "name": "field",
            "type": "singleSelect",
            "options": {"choices": [{"name": f} for f in WIDE_FIELDS]},
        },
        {"name": "current_value", "type": "multilineText"},
        {"name": "proposed_value", "type": "multilineText"},
        {"name": "suggester", "type": "singleLineText"},
        {"name": "notes", "type": "multilineText"},
        {
            "name": "status",
            "type": "singleSelect",
            "options": {"choices": [{"name": s} for s in STATUS_CHOICES]},
        },
        {"name": "curator_notes", "type": "multilineText"},
        {"name": "applied_at", "type": "singleLineText"},
    ]


def setup_schema(cfg: AppConfig) -> dict[str, int]:
    """Create any missing fields on the Suggestions table.

    Requires PAT scope `schema.bases:write`. Create the Suggestions table
    itself in the Airtable UI first (any primary field works — autonumber
    is ideal).
    """
    token, base_id = _require_env()

    from pyairtable import Api

    api = Api(token)
    base = api.base(base_id)

    cands_name = os.environ.get(cfg.airtable.table_candidates_env, "Candidates")
    suggs_name = os.environ.get(SUGGESTIONS_TABLE_ENV, DEFAULT_SUGGESTIONS_TABLE)

    schema = base.schema()
    cands = next((t for t in schema.tables if t.name == cands_name), None)
    if cands is None:
        raise RuntimeError(
            f"Candidates table {cands_name!r} not found. Run `airtable-setup` first."
        )
    suggs = next((t for t in schema.tables if t.name == suggs_name), None)
    if suggs is None:
        raise RuntimeError(
            f"Suggestions table {suggs_name!r} not found. Create it in the Airtable "
            f"UI first (any primary field — autonumber is ideal)."
        )

    existing = {f.name for f in suggs.fields}
    live = base.table(suggs.id)
    created = 0
    for spec in _suggestions_fields(cands.id):
        if spec["name"] in existing:
            continue
        live.create_field(
            name=spec["name"],
            field_type=spec["type"],
            options=spec.get("options"),
        )
        created += 1
        log.info("suggestions-setup: created field %s (%s)", spec["name"], spec["type"])
    return {"created": created, "already_present": len(existing)}


def pull_approved(cfg: AppConfig, conn: sqlite3.Connection) -> dict[str, int]:
    """Apply status=approved suggestions to SQLite, mark them applied in Airtable."""
    token, base_id = _require_env()

    from pyairtable import Api

    api = Api(token)
    cands_name = os.environ.get(cfg.airtable.table_candidates_env, "Candidates")
    suggs_name = os.environ.get(SUGGESTIONS_TABLE_ENV, DEFAULT_SUGGESTIONS_TABLE)
    cands_table = api.table(base_id, cands_name)
    suggs_table = api.table(base_id, suggs_name)

    recid_to_cid: dict[str, int] = {}
    for r in cands_table.all(fields=["candidate_id"]):
        cid = r.get("fields", {}).get("candidate_id")
        if cid is None:
            continue
        try:
            recid_to_cid[r["id"]] = int(cid)
        except (TypeError, ValueError):
            continue

    allowed_fields = set(WIDE_FIELDS)
    trust = float(cfg.confidence.source_trust.get("curator", 1.0))
    now = datetime.utcnow().isoformat()

    approved = suggs_table.all(formula="{status}='approved'")
    stats = {
        "fetched": len(approved),
        "applied": 0,
        "already_applied": 0,
        "skipped_no_candidate": 0,
        "skipped_bad_field": 0,
        "skipped_empty": 0,
        "marked_applied": 0,
    }
    to_mark: list[str] = []

    for rec in approved:
        rec_id = rec["id"]
        f = rec.get("fields", {})
        links = f.get("candidate") or []
        if not links:
            stats["skipped_no_candidate"] += 1
            log.warning("suggestion %s: no linked candidate", rec_id)
            continue
        cid = recid_to_cid.get(links[0])
        if cid is None:
            stats["skipped_no_candidate"] += 1
            log.warning("suggestion %s: linked record %s has no candidate_id", rec_id, links[0])
            continue
        field = f.get("field")
        if field not in allowed_fields:
            stats["skipped_bad_field"] += 1
            log.warning("suggestion %s: unknown field %r", rec_id, field)
            continue
        value = (f.get("proposed_value") or "").strip()
        if not value:
            stats["skipped_empty"] += 1
            continue

        url = f"airtable://{suggs_name}/{rec_id}"
        existing = conn.execute(
            "SELECT id FROM sources WHERE kind='curator' AND url=?",
            (url,),
        ).fetchone()
        if existing is not None:
            stats["already_applied"] += 1
            to_mark.append(rec_id)
            continue

        cur = conn.execute(
            "INSERT INTO sources (kind, url, fetched_at) VALUES (?, ?, ?)",
            ("curator", url, now),
        )
        source_id = int(cur.lastrowid)
        conn.execute(
            """INSERT OR IGNORE INTO field_values
               (candidate_id, field, value, source_id, extracted_at, confidence)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (cid, field, value, source_id, now, trust),
        )
        stats["applied"] += 1
        to_mark.append(rec_id)

    if stats["applied"] > 0:
        _rebuild_current(conn)
    conn.commit()

    # Flip Airtable status only after the SQLite commit.
    for rec_id in to_mark:
        suggs_table.update(rec_id, {"status": "applied", "applied_at": now})
        stats["marked_applied"] += 1

    return stats
