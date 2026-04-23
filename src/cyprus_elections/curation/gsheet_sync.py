"""Google Sheets: forward export (SQLite → Candidates tab) and reverse sync
(Candidates tab → SQLite).

Model: the Candidates tab is the source of truth. Humans leave Google Sheets
comments on cells; a curator edits cell values to apply approved changes.
`pull_candidates_edits` reads the tab, diffs every (candidate_id, field) cell
against the DB, and writes any curator-edited cell back as a high-trust
kind='curator' source so it wins in candidate_current.

Authentication: a Google service account JSON key. Share the sheet with the
service account's email (…@…iam.gserviceaccount.com) as an Editor. Path to
the key file comes from the env var named in `google_sheets.service_account_env`
(default `GOOGLE_SERVICE_ACCOUNT_JSON`).
"""
from __future__ import annotations

import hashlib
import logging
import os
import sqlite3
from datetime import datetime
from typing import Any

from cyprus_elections.config import AppConfig
from cyprus_elections.export.csv import WIDE_FIELDS, _sources_for
from cyprus_elections.merge import _rebuild_current

log = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

CANDIDATES_HEADERS = (
    ["candidate_id", "row_confidence"]
    + list(WIDE_FIELDS)
    + [f"_conf__{f}" for f in WIDE_FIELDS]
    + ["sources"]
)

# Fields where a curator edit also needs to update the canonical columns on
# the `candidates` table, so the dashboard (which falls back to canonical)
# reflects the rename/re-party.
_CANONICAL_UPDATES = {
    "name_gr": "canonical_name_gr",
    "name_en": "canonical_name_en",
    "party": "party_code",
    "district": "district_code",
}


def _require(cfg: AppConfig) -> tuple[str, str]:
    """Validate config + resolve service-account key path."""
    if not cfg.google_sheets.enabled:
        raise RuntimeError(
            "google_sheets.enabled is false in config.yaml — set it to true."
        )
    sheet_id = cfg.google_sheets.sheet_id.strip()
    if not sheet_id:
        raise RuntimeError(
            "google_sheets.sheet_id is empty in config.yaml — paste the sheet ID."
        )
    key_path = os.environ.get(cfg.google_sheets.service_account_env, "").strip()
    if not key_path:
        raise RuntimeError(
            f"${cfg.google_sheets.service_account_env} not set — point it at the "
            f"service-account JSON key file."
        )
    if not os.path.isfile(key_path):
        raise RuntimeError(f"Service-account key not found at {key_path}")
    return sheet_id, key_path


def _service(key_path: str):
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    creds = service_account.Credentials.from_service_account_file(key_path, scopes=SCOPES)
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def _ensure_tabs(svc, sheet_id: str, tab_names: list[str]) -> dict[str, int]:
    """Create any missing tabs. Returns {tab_name: sheetId}."""
    meta = svc.spreadsheets().get(spreadsheetId=sheet_id).execute()
    existing = {s["properties"]["title"]: s["properties"]["sheetId"] for s in meta["sheets"]}
    requests = [
        {"addSheet": {"properties": {"title": t}}}
        for t in tab_names
        if t not in existing
    ]
    if requests:
        resp = svc.spreadsheets().batchUpdate(
            spreadsheetId=sheet_id, body={"requests": requests}
        ).execute()
        for r in resp.get("replies", []):
            props = r["addSheet"]["properties"]
            existing[props["title"]] = props["sheetId"]
    return existing


def _write_values(svc, sheet_id: str, rng: str, values: list[list[Any]]) -> None:
    svc.spreadsheets().values().update(
        spreadsheetId=sheet_id,
        range=rng,
        valueInputOption="RAW",
        body={"values": values},
    ).execute()


def _clear_range(svc, sheet_id: str, rng: str) -> None:
    svc.spreadsheets().values().clear(spreadsheetId=sheet_id, range=rng, body={}).execute()


def _read_values(svc, sheet_id: str, rng: str) -> list[list[Any]]:
    resp = svc.spreadsheets().values().get(spreadsheetId=sheet_id, range=rng).execute()
    return resp.get("values", [])


def _content_hash(candidate_id: int, field: str, value: str) -> str:
    return hashlib.sha1(f"{candidate_id}|{field}|{value}".encode("utf-8")).hexdigest()[:16]


# ---------------------------------------------------------------------------
# Export: SQLite → Candidates tab.
# ---------------------------------------------------------------------------


def push_candidates(cfg: AppConfig, conn: sqlite3.Connection) -> dict[str, int]:
    sheet_id, key_path = _require(cfg)
    svc = _service(key_path)

    cands_tab = cfg.google_sheets.candidates_tab
    _ensure_tabs(svc, sheet_id, [cands_tab])

    # Candidates: header + rows.
    cand_rows = conn.execute(
        """SELECT c.id, c.canonical_name_gr, c.canonical_name_en, c.party_code, c.district_code,
                  COALESCE(rc.row_confidence, 0.0) AS row_confidence
             FROM candidates c
             LEFT JOIN row_confidence rc ON rc.candidate_id = c.id
            ORDER BY c.party_code, c.district_code, c.canonical_name_en"""
    ).fetchall()

    rows: list[list[Any]] = [CANDIDATES_HEADERS]
    for c in cand_rows:
        cid = c["id"]
        field_map = {
            r["field"]: (r["best_value"], r["field_confidence"])
            for r in conn.execute(
                "SELECT field, best_value, field_confidence FROM candidate_current WHERE candidate_id = ?",
                (cid,),
            )
        }
        field_map.setdefault("name_gr", (c["canonical_name_gr"] or "", 0.0))
        field_map.setdefault("name_en", (c["canonical_name_en"] or "", 0.0))
        field_map.setdefault("party", (c["party_code"], 0.0))
        field_map.setdefault("district", (c["district_code"] or "", 0.0))

        values = [field_map.get(f, ("", 0.0))[0] for f in WIDE_FIELDS]
        confs = [round(field_map.get(f, ("", 0.0))[1], 3) for f in WIDE_FIELDS]
        rows.append(
            [cid, round(c["row_confidence"], 3), *values, *confs, _sources_for(conn, cid)]
        )

    _clear_range(svc, sheet_id, f"{cands_tab}!A:ZZ")
    _write_values(svc, sheet_id, f"{cands_tab}!A1", rows)

    return {"candidates_rows": len(rows) - 1}


# ---------------------------------------------------------------------------
# Import: Candidates tab → SQLite. Sheet is truth; any cell that differs from
# the DB's current best is applied as a curator source.
# ---------------------------------------------------------------------------


def pull_candidates_edits(cfg: AppConfig, conn: sqlite3.Connection) -> dict[str, int]:
    sheet_id, key_path = _require(cfg)
    svc = _service(key_path)

    cands_tab = cfg.google_sheets.candidates_tab
    data = _read_values(svc, sheet_id, f"{cands_tab}!A1:ZZ")
    if not data:
        return {"fetched_rows": 0, "updated_fields": 0}

    header = [c.strip() for c in data[0]]
    idx = {h: i for i, h in enumerate(header)}
    if "candidate_id" not in idx:
        raise RuntimeError(
            f"Candidates tab missing 'candidate_id' column. Found: {header}"
        )

    editable_fields = [f for f in WIDE_FIELDS if f in idx]
    trust = float(cfg.confidence.source_trust.get("curator", 1.0))
    now = datetime.utcnow().isoformat()

    stats = {
        "fetched_rows": len(data) - 1,
        "updated_fields": 0,
        "already_matches": 0,
        "skipped_empty_cells": 0,
        "skipped_unknown_candidate": 0,
        "skipped_bad_candidate_id": 0,
    }

    for row in data[1:]:
        cid_cell = row[idx["candidate_id"]] if idx["candidate_id"] < len(row) else ""
        try:
            cid = int(str(cid_cell).strip())
        except (TypeError, ValueError):
            stats["skipped_bad_candidate_id"] += 1
            continue
        if conn.execute("SELECT 1 FROM candidates WHERE id=?", (cid,)).fetchone() is None:
            stats["skipped_unknown_candidate"] += 1
            log.warning("row candidate_id=%s not in SQLite; skipping", cid)
            continue

        current = {
            r["field"]: r["best_value"]
            for r in conn.execute(
                "SELECT field, best_value FROM candidate_current WHERE candidate_id=?",
                (cid,),
            )
        }

        for field in editable_fields:
            j = idx[field]
            sheet_val = str(row[j]).strip() if j < len(row) and row[j] is not None else ""
            if not sheet_val:
                stats["skipped_empty_cells"] += 1
                continue
            if sheet_val == (current.get(field) or "").strip():
                stats["already_matches"] += 1
                continue

            url = (
                f"gsheet://{sheet_id}/{cands_tab}"
                f"#{cid}|{field}|{_content_hash(cid, field, sheet_val)}"
            )
            conn.execute(
                "INSERT OR IGNORE INTO sources (kind, url, fetched_at) VALUES (?, ?, ?)",
                ("curator", url, now),
            )
            source_id = int(conn.execute(
                "SELECT id FROM sources WHERE kind='curator' AND url=? AND fetched_at=?",
                (url, now),
            ).fetchone()["id"])
            conn.execute(
                """INSERT OR IGNORE INTO field_values
                   (candidate_id, field, value, source_id, extracted_at, confidence)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (cid, field, sheet_val, source_id, now, trust),
            )

            canonical_col = _CANONICAL_UPDATES.get(field)
            if canonical_col:
                conn.execute(
                    f"UPDATE candidates SET {canonical_col}=?, updated_at=? WHERE id=?",
                    (sheet_val, now, cid),
                )

            stats["updated_fields"] += 1

    if stats["updated_fields"] > 0:
        _rebuild_current(conn)
    conn.commit()
    return stats
