"""Cluster free-text professions into a fixed taxonomy via LLM.

Purpose: candidates report their profession as free text ("Δικηγόρος",
"lawyer", "attorney at law", "νομικός σύμβουλος"). For the dashboard we
need a small stable set of cluster labels so treemap / bar charts make
sense.

Strategy: collect every distinct (profession, sector) pair, ask the LLM to
assign each to one of the labels below, write the result as a new
`profession_cluster` field on every candidate sharing that pair.
"""
from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime
from typing import Any

from cyprus_elections.config import AppConfig
from cyprus_elections.db import transaction
from cyprus_elections.llm import LLMClient
from cyprus_elections.state import set_status, should_skip

log = logging.getLogger(__name__)

STAGE = "enrich_professions"

CLUSTERS: tuple[str, ...] = (
    "Law",
    "Medicine",
    "Engineering",
    "Education",
    "Business",
    "Civil society",
    "Public sector",
    "Media",
    "Agriculture",
    "Military/Police",
    "Arts",
    "Research",
    "Technology",
    "Finance",
    "Other",
)

_SYSTEM = (
    "You classify Cyprus parliamentary candidates' professions into a small "
    "taxonomy. Return STRICT JSON of shape {\"cluster\": \"<one label>\"}.\n\n"
    "Allowed labels (choose exactly one): "
    + ", ".join(CLUSTERS)
    + ".\n\n"
    "Guidance:\n"
    "- Lawyer/attorney/advocate/legal counsel → Law\n"
    "- Doctor/physician/nurse/pharmacist → Medicine\n"
    "- Engineer/architect/construction → Engineering\n"
    "- Teacher/professor/lecturer (when teaching) → Education\n"
    "- Researcher/scientist/academic (research-first) → Research\n"
    "- Entrepreneur/owner/manager/consultant → Business\n"
    "- Economist/banker/accountant/auditor → Finance\n"
    "- NGO/activist/trade unionist → Civil society\n"
    "- Civil servant/diplomat/local government → Public sector\n"
    "- Journalist/editor/broadcaster → Media\n"
    "- Farmer/agronomist/fisher → Agriculture\n"
    "- Military officer/police officer → Military/Police\n"
    "- Actor/musician/writer/director → Arts\n"
    "- Software engineer / IT / startup tech → Technology\n"
    "- Use Other only when truly none of the above fits.\n"
    "Never invent; respond with a single label from the list."
)

_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {"cluster": {"type": "string"}},
    "required": ["cluster"],
}


def _distinct_pairs(conn: sqlite3.Connection) -> list[tuple[str, str]]:
    """Return distinct (profession, sector) pairs present in candidate_current."""
    rows = conn.execute(
        """
        SELECT DISTINCT COALESCE(p.best_value, '') AS profession,
                        COALESCE(s.best_value, '') AS sector
          FROM candidates c
          LEFT JOIN candidate_current p ON p.candidate_id = c.id AND p.field = 'profession'
          LEFT JOIN candidate_current s ON s.candidate_id = c.id AND s.field = 'sector'
         WHERE COALESCE(p.best_value, '') <> '' OR COALESCE(s.best_value, '') <> ''
        """
    ).fetchall()
    return [(r["profession"], r["sector"]) for r in rows]


def _classify(llm: LLMClient, profession: str, sector: str) -> str | None:
    cache_key = f"profession_cluster|v1|{profession.lower()}|{sector.lower()}|{llm.model}"
    try:
        parsed = llm.chat_json(
            system=_SYSTEM,
            user=(
                f"PROFESSION: {profession or '(none)'}\n"
                f"SECTOR: {sector or '(none)'}\n\n"
                "Return the cluster."
            ),
            cache_key=cache_key,
            json_schema=_SCHEMA,
        )
    except Exception as e:  # noqa: BLE001
        log.warning("professions classify failed for %r / %r: %s", profession, sector, e)
        return None
    label = (parsed or {}).get("cluster")
    if not isinstance(label, str):
        return None
    label = label.strip()
    return label if label in CLUSTERS else "Other"


def _heuristic(profession: str, sector: str) -> str | None:
    """Cheap fallback so the pipeline still produces labels when the LLM is off."""
    blob = f"{profession} {sector}".lower()
    if not blob.strip():
        return None
    rules = [
        (("lawyer", "attorney", "δικηγόρ", "νομικ"), "Law"),
        (("doctor", "physician", "γιατρ", "ιατρ", "nurse", "νοσηλ", "pharma", "φαρμακ"), "Medicine"),
        (("engineer", "μηχανικ", "architect", "αρχιτέκτ"), "Engineering"),
        (("teacher", "professor", "lecturer", "εκπαιδευτικ", "καθηγητ", "δάσκαλ"), "Education"),
        (("research", "επιστήμον", "ερευνητ"), "Research"),
        (("econom", "οικονομολ", "accountant", "λογιστ", "bank", "τραπεζ", "financ"), "Finance"),
        (("journal", "δημοσιογρ", "editor", "εκδότ", "broadcast"), "Media"),
        (("farmer", "αγρότ", "γεωπόν", "agric"), "Agriculture"),
        (("army", "police", "αστυνομ", "στρατ"), "Military/Police"),
        (("actor", "musician", "artist", "καλλιτέχν", "ηθοποι", "συγγραφ", "author"), "Arts"),
        (("software", "developer", "πληροφορικ", "tech", "it ", "startup"), "Technology"),
        (("ngo", "activist", "ακτιβιστ", "αλληλεγγύ", "trade union", "συνδικ"), "Civil society"),
        (("civil servant", "δημόσι", "διπλωμ", "municipal"), "Public sector"),
        (("entrepreneur", "owner", "business", "manager", "επιχειρημ", "διευθυντ", "σύμβουλ"), "Business"),
    ]
    for needles, label in rules:
        if any(n in blob for n in needles):
            return label
    return "Other"


def run(cfg: AppConfig, conn: sqlite3.Connection, *, restart: bool = False) -> dict[str, int]:
    stats = {"pairs": 0, "classified": 0, "written": 0, "skipped": 0, "fallback": 0}
    pairs = _distinct_pairs(conn)
    stats["pairs"] = len(pairs)
    if not pairs:
        return stats

    llm = LLMClient(cfg)
    mapping: dict[tuple[str, str], str] = {}
    try:
        for profession, sector in pairs:
            key = (profession, sector)
            if llm.enabled:
                label = _classify(llm, profession, sector)
            else:
                label = None
            if label is None:
                label = _heuristic(profession, sector)
                if label is not None:
                    stats["fallback"] += 1
            if label:
                mapping[key] = label
                stats["classified"] += 1
    finally:
        llm.close()

    now = datetime.utcnow().isoformat()
    # One sources row per run, reused for every field_value we write.
    with transaction(conn):
        cur = conn.execute(
            """INSERT INTO sources (kind, url, fetched_at, sha256, path)
               VALUES ('llm_from_bio', ?, ?, NULL, NULL)
               ON CONFLICT (kind, url, fetched_at) DO NOTHING
               RETURNING id""",
            (f"enrich_professions:{now}", now),
        ).fetchone()
        if cur is None:
            cur = conn.execute(
                "SELECT id FROM sources WHERE kind='llm_from_bio' AND url=? AND fetched_at=?",
                (f"enrich_professions:{now}", now),
            ).fetchone()
        src_id = int(cur["id"])

        rows = conn.execute(
            """
            SELECT c.id AS candidate_id,
                   COALESCE(p.best_value, '') AS profession,
                   COALESCE(s.best_value, '') AS sector
              FROM candidates c
              LEFT JOIN candidate_current p ON p.candidate_id = c.id AND p.field = 'profession'
              LEFT JOIN candidate_current s ON s.candidate_id = c.id AND s.field = 'sector'
            """
        ).fetchall()
        for r in rows:
            key = f"candidate={r['candidate_id']}"
            if should_skip(conn, STAGE, key, restart=restart):
                stats["skipped"] += 1
                continue
            pair = (r["profession"], r["sector"])
            label = mapping.get(pair)
            if not label:
                set_status(conn, STAGE, key, "ok")
                continue
            conn.execute(
                """INSERT OR IGNORE INTO field_values
                   (candidate_id, field, value, source_id, extracted_at, confidence)
                   VALUES (?, 'profession_cluster', ?, ?, ?, 0.7)""",
                (r["candidate_id"], label, src_id, now),
            )
            set_status(conn, STAGE, key, "ok")
            stats["written"] += 1
    _ = json  # keep import for symmetry; future-proof for raw payload logging
    return stats
