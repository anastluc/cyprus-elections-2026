"""Match historical candidate names to 2026 candidates.id.

The 2026 candidate set is the join key — the timeline viz only cares
about people who are standing again. Unmatched rows stay in the table
with candidate_id=NULL and remain joinable later.
"""
from __future__ import annotations

import logging
import sqlite3

from cyprus_elections.normalize import (
    fuzzy_name_key,
    name_key,
    normalize_name,
    transliterate_gr_to_en,
)

log = logging.getLogger(__name__)


def _candidate_index(conn: sqlite3.Connection) -> dict[str, int]:
    """Map every plausible name variant -> candidates.id for the 2026 set.

    Keys:
    - exact `name_key(gr, en)`
    - fuzzy `fuzzy_name_key(gr, en)`
    - transliterated Greek name (lowercase, normalized)
    - plain lowercased english name
    """
    idx: dict[str, int] = {}
    rows = conn.execute(
        "SELECT id, canonical_name_gr, canonical_name_en FROM candidates"
    ).fetchall()
    for row in rows:
        cid = int(row["id"])
        gr = row["canonical_name_gr"] or ""
        en = row["canonical_name_en"] or ""

        for key in (
            name_key(gr, en),
            fuzzy_name_key(gr, en),
            normalize_name(gr) if gr else "",
            normalize_name(en) if en else "",
            normalize_name(transliterate_gr_to_en(gr)) if gr else "",
        ):
            if key and key not in idx:
                idx[key] = cid
    return idx


def resolve_candidate_id(
    index: dict[str, int],
    name_gr: str | None,
    name_en: str | None,
) -> int | None:
    """Try exact/fuzzy/transliterated matches against the pre-built index."""
    if not (name_gr or name_en):
        return None
    candidates = [
        name_key(name_gr, name_en),
        fuzzy_name_key(name_gr, name_en),
        normalize_name(name_gr or ""),
        normalize_name(name_en or ""),
        normalize_name(transliterate_gr_to_en(name_gr or "")),
    ]
    for k in candidates:
        if k and k in index:
            return index[k]
    return None


def rematch(conn: sqlite3.Connection) -> dict[str, int]:
    """Re-run matching for all historical rows. Useful after new 2026 ingest."""
    idx = _candidate_index(conn)
    matched = 0
    unmatched = 0
    for row in conn.execute(
        "SELECT id, name_gr, name_en FROM historical_results"
    ).fetchall():
        cid = resolve_candidate_id(idx, row["name_gr"], row["name_en"])
        if cid is not None:
            conn.execute(
                "UPDATE historical_results SET candidate_id = ? WHERE id = ?",
                (cid, row["id"]),
            )
            matched += 1
        else:
            unmatched += 1
    conn.commit()
    return {"matched": matched, "unmatched": unmatched}
