from __future__ import annotations

import csv
import logging
import sqlite3
from pathlib import Path

from cyprus_elections.config import AppConfig

log = logging.getLogger(__name__)

WIDE_FIELDS = [
    "name_gr", "name_en", "party", "district",
    "gender", "age", "date_of_birth",
    "profession", "sector", "education", "career_previous",
    "cv_text", "cv_url", "photo_url", "bio_text",
    "facebook", "twitter", "instagram", "linkedin",
    "website", "wikipedia", "wikidata_qid",
]


def _sources_for(conn: sqlite3.Connection, candidate_id: int) -> str:
    """Distinct provenance URLs (real web URLs only) for a candidate, pipe-joined."""
    rows = conn.execute(
        """SELECT DISTINCT s.url
           FROM field_values fv JOIN sources s ON s.id = fv.source_id
           WHERE fv.candidate_id = ?
             AND s.url LIKE 'http%'
           ORDER BY s.url""",
        (candidate_id,),
    ).fetchall()
    return " | ".join(r["url"] for r in rows)


def export_wide(cfg: AppConfig, conn: sqlite3.Connection) -> Path:
    path = cfg.exports_dir / "candidates.csv"
    cand_rows = conn.execute(
        """SELECT c.id, c.canonical_name_gr, c.canonical_name_en, c.party_code, c.district_code,
                  COALESCE(rc.row_confidence, 0.0) AS row_confidence
           FROM candidates c
           LEFT JOIN row_confidence rc ON rc.candidate_id = c.id
           ORDER BY c.party_code, c.district_code, c.canonical_name_en"""
    ).fetchall()

    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            ["candidate_id", "row_confidence", *WIDE_FIELDS]
            + [f"_conf__{field}" for field in WIDE_FIELDS]
            + ["sources"]
        )
        for c in cand_rows:
            cid = c["id"]
            field_map = {
                r["field"]: (r["best_value"], r["field_confidence"])
                for r in conn.execute(
                    "SELECT field, best_value, field_confidence FROM candidate_current WHERE candidate_id = ?",
                    (cid,),
                )
            }
            # Fall back to candidates table values for name/party/district if missing.
            field_map.setdefault("name_gr", (c["canonical_name_gr"] or "", 0.0))
            field_map.setdefault("name_en", (c["canonical_name_en"] or "", 0.0))
            field_map.setdefault("party", (c["party_code"], 0.0))
            field_map.setdefault("district", (c["district_code"] or "", 0.0))

            values = [field_map.get(f, ("", 0.0))[0] for f in WIDE_FIELDS]
            confs = [f"{field_map.get(f, ('', 0.0))[1]:.3f}" for f in WIDE_FIELDS]
            writer.writerow(
                [cid, f"{c['row_confidence']:.3f}", *values, *confs, _sources_for(conn, cid)]
            )

    return path


def export_detailed(cfg: AppConfig, conn: sqlite3.Connection) -> Path:
    path = cfg.exports_dir / "candidates_detailed.csv"
    rows = conn.execute(
        """SELECT c.id AS candidate_id,
                  c.canonical_name_en, c.canonical_name_gr,
                  c.party_code, c.district_code,
                  fv.field, fv.value, fv.confidence,
                  s.kind AS source_kind, s.url AS source_url, s.fetched_at
           FROM field_values fv
           JOIN candidates c ON c.id = fv.candidate_id
           JOIN sources s ON s.id = fv.source_id
           ORDER BY c.id, fv.field, fv.confidence DESC"""
    ).fetchall()

    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "candidate_id", "name_en", "name_gr", "party", "district",
                "field", "value", "confidence", "source_kind", "source_url", "fetched_at",
            ]
        )
        for r in rows:
            writer.writerow(
                [
                    r["candidate_id"],
                    r["canonical_name_en"] or "",
                    r["canonical_name_gr"] or "",
                    r["party_code"],
                    r["district_code"] or "",
                    r["field"],
                    r["value"],
                    f"{r['confidence']:.3f}",
                    r["source_kind"],
                    r["source_url"],
                    r["fetched_at"],
                ]
            )
    return path
