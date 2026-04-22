from __future__ import annotations

import sqlite3
from datetime import datetime


def get_status(conn: sqlite3.Connection, stage: str, key: str) -> str | None:
    row = conn.execute(
        "SELECT status FROM run_state WHERE stage = ? AND key = ?",
        (stage, key),
    ).fetchone()
    return row["status"] if row else None


def set_status(
    conn: sqlite3.Connection,
    stage: str,
    key: str,
    status: str,
    error: str | None = None,
) -> None:
    now = datetime.utcnow().isoformat()
    conn.execute(
        """
        INSERT INTO run_state (stage, key, status, attempts, last_error, updated_at)
        VALUES (?, ?, ?, 1, ?, ?)
        ON CONFLICT (stage, key) DO UPDATE SET
            status = excluded.status,
            attempts = run_state.attempts + 1,
            last_error = excluded.last_error,
            updated_at = excluded.updated_at
        """,
        (stage, key, status, error, now),
    )


def should_skip(
    conn: sqlite3.Connection, stage: str, key: str, *, restart: bool
) -> bool:
    if restart:
        return False
    return get_status(conn, stage, key) == "ok"


def pending_keys(
    conn: sqlite3.Connection, stage: str, all_keys: list[str], *, restart: bool
) -> list[str]:
    if restart:
        return list(all_keys)
    done = {
        r["key"]
        for r in conn.execute(
            "SELECT key FROM run_state WHERE stage = ? AND status = 'ok'", (stage,)
        )
    }
    return [k for k in all_keys if k not in done]


def clear_stage(conn: sqlite3.Connection, stage: str) -> int:
    cur = conn.execute("DELETE FROM run_state WHERE stage = ?", (stage,))
    return cur.rowcount
