"""Airtable mirror. Optional — runs only when AIRTABLE_TOKEN and AIRTABLE_BASE_ID are set.

Idempotent upsert keyed by `candidate_id`.
"""
from __future__ import annotations

import logging
import os
import sqlite3

from cyprus_elections.config import AppConfig
from cyprus_elections.export.csv import WIDE_FIELDS, _sources_for

log = logging.getLogger(__name__)

# Long-text columns: everything else is single-line text.
_LONG_TEXT = {"bio_text", "cv_text"}


def _desired_fields() -> list[dict]:
    """Schema for the Candidates table (field name + Airtable type config)."""
    fields: list[dict] = [
        {"name": "candidate_id", "type": "number", "options": {"precision": 0}},
        {"name": "row_confidence", "type": "number", "options": {"precision": 3}},
        {"name": "sources", "type": "multilineText"},
    ]
    for f in WIDE_FIELDS:
        if f in _LONG_TEXT:
            fields.append({"name": f, "type": "multilineText"})
        else:
            fields.append({"name": f, "type": "singleLineText"})
    for f in WIDE_FIELDS:
        fields.append({"name": f"_conf__{f}", "type": "number", "options": {"precision": 3}})
    return fields


def setup_schema(cfg: AppConfig) -> dict[str, int]:
    """Create any missing fields on the Candidates table via the metadata API.

    Requires the PAT to have `schema.bases:write` scope on the base.
    """
    token = os.environ.get("AIRTABLE_TOKEN")
    base_id = os.environ.get("AIRTABLE_BASE_ID")
    if not (token and base_id):
        raise RuntimeError("AIRTABLE_TOKEN / AIRTABLE_BASE_ID must be set")

    from pyairtable import Api

    api = Api(token)
    base = api.base(base_id)
    table_name = os.environ.get(cfg.airtable.table_candidates_env, "Candidates")

    schema = base.schema()
    table = next((t for t in schema.tables if t.name == table_name), None)
    if table is None:
        raise RuntimeError(
            f"Table {table_name!r} not found in base. Create it in the UI first "
            f"(any primary field is fine; we will add the rest)."
        )

    existing = {f.name for f in table.fields}
    created = 0
    live = base.table(table.id)
    for spec in _desired_fields():
        if spec["name"] in existing:
            continue
        live.create_field(
            name=spec["name"],
            field_type=spec["type"],
            options=spec.get("options"),
        )
        created += 1
        log.info("airtable-setup: created field %s (%s)", spec["name"], spec["type"])
    return {"created": created, "already_present": len(existing)}


def mirror(cfg: AppConfig, conn: sqlite3.Connection) -> dict[str, int]:
    token = os.environ.get("AIRTABLE_TOKEN")
    base_id = os.environ.get("AIRTABLE_BASE_ID")
    if not (token and base_id):
        log.warning("AIRTABLE_TOKEN / AIRTABLE_BASE_ID not set — skipping Airtable mirror")
        return {"pushed": 0, "skipped": 1}

    try:
        from pyairtable import Api
    except ImportError:
        log.warning("pyairtable not installed — skipping Airtable mirror")
        return {"pushed": 0, "skipped": 1}

    api = Api(token)
    table_name = os.environ.get(cfg.airtable.table_candidates_env, "Candidates")
    table = api.table(base_id, table_name)

    records_to_upsert: list[dict] = []
    cand_rows = conn.execute(
        """SELECT c.id, c.canonical_name_gr, c.canonical_name_en, c.party_code, c.district_code,
                  COALESCE(rc.row_confidence, 0.0) AS row_confidence
           FROM candidates c
           LEFT JOIN row_confidence rc ON rc.candidate_id = c.id"""
    ).fetchall()

    for c in cand_rows:
        cid = c["id"]
        field_map = {
            r["field"]: (r["best_value"], r["field_confidence"])
            for r in conn.execute(
                "SELECT field, best_value, field_confidence FROM candidate_current WHERE candidate_id = ?",
                (cid,),
            )
        }
        fields = {"candidate_id": cid, "row_confidence": float(c["row_confidence"])}
        sources_joined = _sources_for(conn, cid)
        if sources_joined:
            fields["sources"] = sources_joined
        for f in WIDE_FIELDS:
            val, conf = field_map.get(f, ("", 0.0))
            if val:
                fields[f] = str(val)
                fields[f"_conf__{f}"] = round(conf, 3)
        records_to_upsert.append(fields)

    # Airtable `batch_upsert` merges by candidate_id if that field is unique-indexed.
    # pyairtable supports upsert via the `batch_upsert` helper (v2.3+).
    pushed = 0
    for i in range(0, len(records_to_upsert), 10):
        batch = records_to_upsert[i : i + 10]
        table.batch_upsert(
            [{"fields": r} for r in batch],
            key_fields=["candidate_id"],
        )
        pushed += len(batch)

    return {"pushed": pushed, "skipped": 0}
