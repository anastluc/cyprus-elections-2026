from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

SCHEMA = """
CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    url TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    sha256 TEXT,
    path TEXT,
    UNIQUE (kind, url, fetched_at)
);

CREATE TABLE IF NOT EXISTS raw_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL REFERENCES sources(id),
    party_code TEXT NOT NULL,
    district_code TEXT,
    name_gr TEXT,
    name_en TEXT,
    bio_text TEXT,
    payload_json TEXT NOT NULL,
    dedupe_key TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    canonical_name_gr TEXT,
    canonical_name_en TEXT,
    party_code TEXT NOT NULL,
    district_code TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_candidates_party_district
    ON candidates(party_code, district_code);

CREATE TABLE IF NOT EXISTS raw_to_candidate (
    raw_id INTEGER PRIMARY KEY REFERENCES raw_records(id),
    candidate_id INTEGER NOT NULL REFERENCES candidates(id)
);

CREATE TABLE IF NOT EXISTS field_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL REFERENCES candidates(id),
    field TEXT NOT NULL,
    value TEXT NOT NULL,
    source_id INTEGER NOT NULL REFERENCES sources(id),
    extracted_at TEXT NOT NULL,
    confidence REAL NOT NULL,
    lang TEXT,
    UNIQUE (candidate_id, field, value, source_id)
);

CREATE INDEX IF NOT EXISTS idx_field_values_candidate_field
    ON field_values(candidate_id, field);

CREATE TABLE IF NOT EXISTS candidate_current (
    candidate_id INTEGER NOT NULL REFERENCES candidates(id),
    field TEXT NOT NULL,
    best_value TEXT NOT NULL,
    best_source_id INTEGER NOT NULL REFERENCES sources(id),
    field_confidence REAL NOT NULL,
    best_lang TEXT,
    PRIMARY KEY (candidate_id, field)
);

CREATE TABLE IF NOT EXISTS run_state (
    stage TEXT NOT NULL,
    key TEXT NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (stage, key)
);

CREATE TABLE IF NOT EXISTS validation_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER REFERENCES candidates(id),
    severity TEXT NOT NULL,
    rule TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS row_confidence (
    candidate_id INTEGER PRIMARY KEY REFERENCES candidates(id),
    row_confidence REAL NOT NULL,
    computed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS historical_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_key TEXT NOT NULL,
    candidate_id INTEGER REFERENCES candidates(id),
    name_gr TEXT,
    name_en TEXT,
    year INTEGER NOT NULL,
    party_code TEXT NOT NULL,
    party_label TEXT,
    district_code TEXT,
    votes INTEGER,
    elected INTEGER NOT NULL DEFAULT 0,
    source_url TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    UNIQUE (candidate_key, year, party_code)
);
CREATE INDEX IF NOT EXISTS idx_hist_cand ON historical_results(candidate_id, year);
CREATE INDEX IF NOT EXISTS idx_hist_year ON historical_results(year);
"""


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn


def init_db(db_path: Path) -> None:
    with connect(db_path) as conn:
        conn.executescript(SCHEMA)
        _migrate(conn)
        conn.commit()


def _migrate(conn: sqlite3.Connection) -> None:
    """Apply in-place schema migrations that can't be expressed as CREATE IF NOT EXISTS.

    Each block is idempotent: it checks the current shape first and only adds
    what's missing. Safe to run on every init_db() call.
    """
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(field_values)")}
    if "lang" not in cols:
        conn.execute("ALTER TABLE field_values ADD COLUMN lang TEXT")
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(candidate_current)")}
    if "best_lang" not in cols:
        conn.execute("ALTER TABLE candidate_current ADD COLUMN best_lang TEXT")


@contextmanager
def transaction(conn: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
