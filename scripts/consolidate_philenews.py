"""Reconcile the candidate set against the philenews 753-roster authority.

Two passes, both safe:

1. **Greek-only name_key merge.** The default ``name_key`` prefers ``name_en``
   when present, which can diverge between sources (party-site human
   transliteration vs philenews auto-transliteration). Re-key both rows
   from the Greek name only — when they collide, merge into the
   philenews-sourced row.

2. **Prune to the philenews authority.** The philenews 6-May-2026 article
   is the canonical list of candidates whose nominations were filed.
   Any candidate that has no raw_record from that article was either a
   stale early-list entry or a name variant the merger could not
   confidently fold. Drop it.

Run after ``cyprus-elections merge`` and before ``cyprus-elections
validate``.
"""
from __future__ import annotations

import sqlite3
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from cyprus_elections.config import load_config  # noqa: E402
from cyprus_elections.merge import _merge_candidates  # noqa: E402
from cyprus_elections.normalize import name_key  # noqa: E402

PHILENEWS_URL_FRAG = "philenews%1716677"


def gr_only_key(name_gr: str | None) -> str:
    return name_key(name_gr, None) if name_gr else ""


def is_philenews_sourced(conn: sqlite3.Connection, candidate_id: int) -> bool:
    return (
        conn.execute(
            f"""SELECT 1 FROM raw_to_candidate r2c
                  JOIN raw_records r ON r.id = r2c.raw_id
                  JOIN sources s ON s.id = r.source_id
                 WHERE r2c.candidate_id = ?
                   AND s.url LIKE '%{PHILENEWS_URL_FRAG}%'
                 LIMIT 1""",
            (candidate_id,),
        ).fetchone()
        is not None
    )


def pass1_merge_gr_collisions(conn: sqlite3.Connection) -> int:
    rows = conn.execute(
        """SELECT id, party_code, district_code, canonical_name_gr
             FROM candidates"""
    ).fetchall()

    buckets: dict[tuple[str, str, str], list[sqlite3.Row]] = defaultdict(list)
    for r in rows:
        key = gr_only_key(r["canonical_name_gr"])
        if not key:
            continue
        buckets[(r["party_code"], r["district_code"], key)].append(r)

    merges = 0
    for members in buckets.values():
        if len(members) < 2:
            continue
        phil = [m for m in members if is_philenews_sourced(conn, m["id"])]
        keeper = phil[0] if phil else members[0]
        keep_id = int(keeper["id"])
        for m in members:
            drop_id = int(m["id"])
            if drop_id == keep_id:
                continue
            print(
                f"merge {m['party_code']}/{m['district_code']}  "
                f"drop={m['canonical_name_gr']!r}  →  "
                f"keep={keeper['canonical_name_gr']!r}"
            )
            _merge_candidates(conn, keep_id=keep_id, drop_id=drop_id)
            merges += 1
        conn.execute(
            "UPDATE candidates SET updated_at=? WHERE id=?",
            (datetime.utcnow().isoformat(), keep_id),
        )
    return merges


def pass2_prune_non_philenews(conn: sqlite3.Connection) -> int:
    rows = conn.execute("SELECT id, party_code, district_code, canonical_name_gr FROM candidates").fetchall()
    drops = []
    for r in rows:
        if not is_philenews_sourced(conn, r["id"]):
            drops.append(r)
    for r in drops:
        cid = int(r["id"])
        print(
            f"drop {r['party_code']}/{r['district_code']}  {r['canonical_name_gr']!r} "
            f"(no philenews source — not on official slate)"
        )
        # Cascade: cleanup dependents then delete the candidate.
        conn.execute("UPDATE historical_results SET candidate_id=NULL WHERE candidate_id=?", (cid,))
        conn.execute("DELETE FROM raw_to_candidate WHERE candidate_id=?", (cid,))
        conn.execute("DELETE FROM field_values WHERE candidate_id=?", (cid,))
        conn.execute("DELETE FROM candidate_current WHERE candidate_id=?", (cid,))
        conn.execute("DELETE FROM row_confidence WHERE candidate_id=?", (cid,))
        conn.execute("DELETE FROM validation_issues WHERE candidate_id=?", (cid,))
        conn.execute("DELETE FROM candidates WHERE id=?", (cid,))
    return len(drops)


def main() -> None:
    cfg = load_config()
    conn = sqlite3.connect(cfg.db_path)
    conn.row_factory = sqlite3.Row

    n_before = conn.execute("SELECT COUNT(*) FROM candidates").fetchone()[0]
    print(f"\nBefore: {n_before} candidates\n")

    print("Pass 1: merge Greek-only name_key collisions")
    print("-" * 60)
    n_merge = pass1_merge_gr_collisions(conn)
    conn.commit()
    print(f"  → {n_merge} merges")
    n_after_pass1 = conn.execute("SELECT COUNT(*) FROM candidates").fetchone()[0]
    print(f"  candidates: {n_after_pass1}\n")

    print("Pass 2: prune candidates not in philenews 753-roster")
    print("-" * 60)
    n_drop = pass2_prune_non_philenews(conn)
    conn.commit()
    print(f"  → {n_drop} drops")

    n_after = conn.execute("SELECT COUNT(*) FROM candidates").fetchone()[0]
    print(f"\nAfter: {n_after} candidates")
    conn.close()


if __name__ == "__main__":
    main()
