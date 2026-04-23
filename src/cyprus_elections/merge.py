from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime

from cyprus_elections.config import AppConfig
from cyprus_elections.db import transaction
from cyprus_elections.normalize import (
    detect_lang,
    fuzzy_name_key,
    infer_gender_from_greek,
    name_key,
    similar_name_keys,
    transliterate_gr_to_en,
)

# Fields where we never try to detect language from the value itself:
# - Structured identifiers (party/district codes, URLs, numbers, booleans).
# - "_gr" / "_en" name fields where the language is implied by the field name.
# Callers can still override by passing an explicit `lang` argument.
_STRUCTURED_FIELDS = {
    "party", "district", "age", "date_of_birth", "gender",
    "photo_url", "cv_url", "wikidata_qid",
    "facebook", "twitter", "instagram", "linkedin", "website", "wikipedia",
    "highlights",  # JSON blob; localize at extraction time, not here.
}
from cyprus_elections.state import set_status

log = logging.getLogger(__name__)

STAGE = "merge"


def _find_or_create_candidate(
    conn: sqlite3.Connection,
    party_code: str,
    district_code: str | None,
    name_gr: str | None,
    name_en: str | None,
) -> int:
    key = name_key(name_gr, name_en)
    if not key:
        raise ValueError("Cannot merge record with no name")
    fkey = fuzzy_name_key(name_gr, name_en)

    # Blocking: same party + (same district OR either side NULL).
    # The NULL-side match lets a district-less raw (e.g. a party post that
    # didn't announce by district) merge into an existing district-tagged
    # candidate, instead of spawning a duplicate.
    rows = conn.execute(
        """SELECT id, canonical_name_gr, canonical_name_en, district_code
           FROM candidates
           WHERE party_code = ?
             AND (district_code IS ?
                  OR district_code = ?
                  OR district_code IS NULL
                  OR ? IS NULL)""",
        (party_code, district_code, district_code, district_code),
    ).fetchall()
    fuzzy_match = None
    for row in rows:
        existing_key = name_key(row["canonical_name_gr"], row["canonical_name_en"])
        existing_fkey = fuzzy_name_key(row["canonical_name_gr"], row["canonical_name_en"])
        exact = existing_key == key
        fuzzy = (
            (existing_fkey == fkey)
            or similar_name_keys(existing_fkey, fkey, max_edits=2)
        ) and not exact
        if fuzzy and fuzzy_match is None:
            fuzzy_match = row
        if exact:
            # Backfill the missing language and district where possible.
            updates = []
            params: list[object] = []
            if name_gr and not row["canonical_name_gr"]:
                updates.append("canonical_name_gr = ?")
                params.append(name_gr)
            if name_en and not row["canonical_name_en"]:
                updates.append("canonical_name_en = ?")
                params.append(name_en)
            if district_code and not row["district_code"]:
                updates.append("district_code = ?")
                params.append(district_code)
            if updates:
                params.extend([datetime.utcnow().isoformat(), row["id"]])
                conn.execute(
                    f"UPDATE candidates SET {', '.join(updates)}, updated_at = ? WHERE id = ?",
                    params,
                )
            return int(row["id"])

    if fuzzy_match is not None:
        row = fuzzy_match
        updates = []
        params: list[object] = []
        if name_gr and not row["canonical_name_gr"]:
            updates.append("canonical_name_gr = ?")
            params.append(name_gr)
        if name_en and not row["canonical_name_en"]:
            updates.append("canonical_name_en = ?")
            params.append(name_en)
        if district_code and not row["district_code"]:
            updates.append("district_code = ?")
            params.append(district_code)
        if updates:
            params.extend([datetime.utcnow().isoformat(), row["id"]])
            conn.execute(
                f"UPDATE candidates SET {', '.join(updates)}, updated_at = ? WHERE id = ?",
                params,
            )
        return int(row["id"])

    # Insert new.
    # Derive a latinized name if only Greek is available.
    derived_en = name_en or (transliterate_gr_to_en(name_gr) if name_gr else None)
    now = datetime.utcnow().isoformat()
    cur = conn.execute(
        """INSERT INTO candidates
           (canonical_name_gr, canonical_name_en, party_code, district_code, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (name_gr, derived_en, party_code, district_code, now, now),
    )
    return int(cur.lastrowid)


def _trust(cfg: AppConfig, source_kind: str) -> float:
    return cfg.confidence.source_trust.get(source_kind, 0.5)


def _write_field(
    conn: sqlite3.Connection,
    candidate_id: int,
    field: str,
    value: str,
    source_id: int,
    confidence: float,
    lang: str | None = None,
) -> None:
    if value is None or value == "":
        return
    if lang is None:
        if field == "name_gr":
            lang = "gr"
        elif field == "name_en":
            lang = "en"
        elif field not in _STRUCTURED_FIELDS:
            lang = detect_lang(str(value))
    now = datetime.utcnow().isoformat()
    conn.execute(
        """INSERT OR IGNORE INTO field_values
           (candidate_id, field, value, source_id, extracted_at, confidence, lang)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (candidate_id, field, str(value), source_id, now, confidence, lang),
    )


def _consolidate_duplicates(conn: sqlite3.Connection) -> int:
    """Collapse near-duplicate candidates in the same party+district.

    Two candidates merge if either their fuzzy_name_keys match exactly or
    differ by ≤2 edits (Levenshtein over tokens). The surviving row keeps
    the longer/richer name pair and inherits all field_values and raw
    mappings from the other.

    Returns the number of merges performed.
    """
    merges = 0
    rows = conn.execute(
        """SELECT id, canonical_name_gr, canonical_name_en, party_code, district_code
           FROM candidates"""
    ).fetchall()
    # Group by party only; allow cross-district merges when at least one
    # side has NULL district (the other side wins as the authoritative row).
    groups: dict[str, list[sqlite3.Row]] = {}
    for r in rows:
        groups.setdefault(r["party_code"], []).append(r)

    seen: set[int] = set()
    for _, members in groups.items():
        # Compute fkey per member.
        keys = {
            int(m["id"]): fuzzy_name_key(m["canonical_name_gr"], m["canonical_name_en"])
            for m in members
        }
        for i, a in enumerate(members):
            if int(a["id"]) in seen:
                continue
            for b in members[i + 1 :]:
                if int(b["id"]) in seen:
                    continue
                da, db = a["district_code"], b["district_code"]
                # Merge only if districts agree or one side is unknown.
                if da and db and da != db:
                    continue
                ka = keys[int(a["id"])]
                kb = keys[int(b["id"])]
                if not ka or not kb:
                    continue
                if ka == kb or similar_name_keys(ka, kb, max_edits=2):
                    keep, drop = a, b
                    # Prefer the row that has a district set, then the one
                    # that has both languages — else default to `a`.
                    if not da and db:
                        keep, drop = b, a
                    elif bool(da) == bool(db):
                        ab_langs = bool(a["canonical_name_gr"]) + bool(a["canonical_name_en"])
                        bb_langs = bool(b["canonical_name_gr"]) + bool(b["canonical_name_en"])
                        if bb_langs > ab_langs:
                            keep, drop = b, a
                    _merge_candidates(conn, keep_id=int(keep["id"]), drop_id=int(drop["id"]))
                    seen.add(int(drop["id"]))
                    merges += 1
    return merges


def _merge_candidates(conn: sqlite3.Connection, *, keep_id: int, drop_id: int) -> None:
    # Backfill missing languages on the keeper.
    keep = conn.execute(
        "SELECT canonical_name_gr, canonical_name_en, district_code FROM candidates WHERE id=?",
        (keep_id,),
    ).fetchone()
    drop = conn.execute(
        "SELECT canonical_name_gr, canonical_name_en, district_code FROM candidates WHERE id=?",
        (drop_id,),
    ).fetchone()
    updates, params = [], []
    if drop["canonical_name_gr"] and not keep["canonical_name_gr"]:
        updates.append("canonical_name_gr=?")
        params.append(drop["canonical_name_gr"])
    if drop["canonical_name_en"] and not keep["canonical_name_en"]:
        updates.append("canonical_name_en=?")
        params.append(drop["canonical_name_en"])
    if drop["district_code"] and not keep["district_code"]:
        updates.append("district_code=?")
        params.append(drop["district_code"])
    if updates:
        params.extend([datetime.utcnow().isoformat(), keep_id])
        conn.execute(
            f"UPDATE candidates SET {', '.join(updates)}, updated_at=? WHERE id=?",
            params,
        )

    # Re-parent raw_records and move field_values / row_confidence / historical rows.
    conn.execute(
        "UPDATE OR IGNORE raw_to_candidate SET candidate_id=? WHERE candidate_id=?",
        (keep_id, drop_id),
    )
    conn.execute(
        "DELETE FROM raw_to_candidate WHERE candidate_id=?",
        (drop_id,),
    )
    conn.execute(
        "UPDATE OR IGNORE field_values SET candidate_id=? WHERE candidate_id=?",
        (keep_id, drop_id),
    )
    conn.execute("DELETE FROM field_values WHERE candidate_id=?", (drop_id,))
    conn.execute("DELETE FROM candidate_current WHERE candidate_id=?", (drop_id,))
    # row_confidence has a UNIQUE(candidate_id) — drop the losing row; it will
    # be recomputed by the validate stage.
    conn.execute("DELETE FROM row_confidence WHERE candidate_id=?", (drop_id,))
    conn.execute(
        "UPDATE historical_results SET candidate_id=? WHERE candidate_id=?",
        (keep_id, drop_id),
    )
    conn.execute(
        "UPDATE validation_issues SET candidate_id=? WHERE candidate_id=?",
        (keep_id, drop_id),
    )
    conn.execute("DELETE FROM candidates WHERE id=?", (drop_id,))


def run(cfg: AppConfig, conn: sqlite3.Connection) -> dict[str, int]:
    stats = {"candidates": 0, "fields": 0, "skipped": 0, "consolidated": 0}
    with transaction(conn):
        # Only process raw records not yet mapped.
        rows = conn.execute(
            """SELECT r.id, r.source_id, r.party_code, r.district_code,
                      r.name_gr, r.name_en, r.bio_text, r.payload_json, s.kind AS source_kind
               FROM raw_records r
               JOIN sources s ON s.id = r.source_id
               LEFT JOIN raw_to_candidate m ON m.raw_id = r.id
               WHERE m.raw_id IS NULL"""
        ).fetchall()

        for row in rows:
            try:
                payload = json.loads(row["payload_json"])
            except json.JSONDecodeError:
                payload = {}

            name_gr = row["name_gr"]
            name_en = row["name_en"]
            if not (name_gr or name_en):
                stats["skipped"] += 1
                continue

            cand_id = _find_or_create_candidate(
                conn,
                row["party_code"],
                row["district_code"],
                name_gr,
                name_en,
            )
            conn.execute(
                "INSERT OR IGNORE INTO raw_to_candidate (raw_id, candidate_id) VALUES (?, ?)",
                (row["id"], cand_id),
            )
            stats["candidates"] += 1  # unique increments handled below; this counts mappings

            base_trust = _trust(cfg, row["source_kind"])
            # Core identity fields.
            if name_gr:
                _write_field(conn, cand_id, "name_gr", name_gr, row["source_id"], base_trust)
                stats["fields"] += 1
            if name_en:
                _write_field(conn, cand_id, "name_en", name_en, row["source_id"], base_trust)
                stats["fields"] += 1
            _write_field(conn, cand_id, "party", row["party_code"], row["source_id"], base_trust)
            stats["fields"] += 1
            if row["district_code"]:
                _write_field(
                    conn, cand_id, "district", row["district_code"], row["source_id"], base_trust
                )
                stats["fields"] += 1

            # Bio / payload-driven fields.
            fields_payload = payload.get("fields", {}) or {}
            for field_name, value in fields_payload.items():
                if value in (None, ""):
                    continue
                _write_field(conn, cand_id, field_name, value, row["source_id"], base_trust)
                stats["fields"] += 1

            # Gender heuristic (Greek-name ending).
            if name_gr:
                inferred = infer_gender_from_greek(name_gr)
                if inferred is not None:
                    gender, conf = inferred
                    heuristic_trust = cfg.confidence.source_trust.get("heuristic", 0.5) * conf
                    _write_field(
                        conn, cand_id, "gender", gender, row["source_id"], heuristic_trust
                    )
                    stats["fields"] += 1

            # Bio text is stored as a special candidate attribute source for later extraction.
            if row["bio_text"]:
                _write_field(
                    conn, cand_id, "bio_text", row["bio_text"], row["source_id"], base_trust
                )
                stats["fields"] += 1

        # Post-merge pass: consolidate any near-duplicate candidates that
        # slipped through (e.g. spelling variants introduced before the
        # stricter fuzzy matcher was in place).
        stats["consolidated"] = _consolidate_duplicates(conn)
        # Rebuild candidate_current (materialize best pick per field).
        _rebuild_current(conn)

    # De-duplicate candidates stat — count distinct IDs touched.
    distinct = conn.execute("SELECT COUNT(*) AS n FROM candidates").fetchone()["n"]
    stats["candidates"] = int(distinct)
    set_status(conn, STAGE, "all", "ok")
    conn.commit()
    return stats


def _rebuild_current(conn: sqlite3.Connection) -> None:
    """Pick best value per (candidate, field) and apply agreement boost.

    Boost: +0.05 per additional independent source agreeing on the same
    value (case-insensitive, whitespace-collapsed), capped at 1.0.
    """
    conn.execute("DELETE FROM candidate_current")
    conn.execute(
        """INSERT INTO candidate_current
               (candidate_id, field, best_value, best_source_id, field_confidence, best_lang)
           SELECT t.candidate_id, t.field, t.value, t.source_id,
                  MIN(1.0, t.confidence * (1.0 + 0.05 * (COALESCE(a.agreement, 1) - 1))),
                  t.lang
           FROM (
               SELECT candidate_id, field, value, source_id, confidence, lang,
                      ROW_NUMBER() OVER (
                          PARTITION BY candidate_id, field
                          ORDER BY confidence DESC, extracted_at DESC
                      ) AS rnk
               FROM field_values
           ) t
           LEFT JOIN (
               SELECT candidate_id, field, LOWER(TRIM(value)) AS vkey,
                      COUNT(DISTINCT source_id) AS agreement
               FROM field_values
               GROUP BY candidate_id, field, LOWER(TRIM(value))
           ) a
             ON a.candidate_id = t.candidate_id
            AND a.field = t.field
            AND a.vkey = LOWER(TRIM(t.value))
           WHERE t.rnk = 1"""
    )
