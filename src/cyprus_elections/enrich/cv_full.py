"""Composes a full CV/biography for every candidate.

Strategy: send a single request to the search-capable model
(``OPENROUTER_SEARCH_MODEL``) per candidate. The model is asked to:

1. Look up the candidate via web search (party site, personal page,
   LinkedIn, news).
2. If a published CV/biography exists on a *reputable* page belonging to
   the candidate, return that text **verbatim** (or a faithful
   translation when the page is in a different language) along with the
   source URL and ``is_ai_generated=false``.
3. If no published CV exists, compose a 4-7 sentence biography from the
   structured facts surfaced in the search snippets — and set
   ``is_ai_generated=true`` so the dashboard can clearly mark the entry
   as AI-generated.

The resulting bio_text is persisted at trust 0.92 when scraped (beats
party_site at 0.90) and 0.6 when AI-generated (loses to any real
party-site bio). The actual source URL returned by the model is
registered in `sources` so the dashboard's "Sources" panel still shows
the underlying page.
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

STAGE = "enrich_cv_full"

_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "bio_text": {"type": "string"},
        "language": {"type": "string"},
        "source_url": {"type": ["string", "null"]},
        "source_kind": {"type": "string"},
        "is_ai_generated": {"type": "boolean"},
        "confidence_notes": {"type": ["string", "null"]},
    },
    "required": [
        "bio_text", "language", "source_url",
        "source_kind", "is_ai_generated", "confidence_notes",
    ],
}

_SYSTEM = (
    "You research Cyprus parliamentary candidates for the May 2026 "
    "elections (Βουλευτικές 2026). For ONE candidate you receive their "
    "name, party and district plus any structured facts already on file. "
    "Your job: find or write a full biography (their CV).\n\n"
    "PRIORITY 1 — VERBATIM CV. Search the web for the candidate's bio "
    "page. If you find a published biography on:\n"
    "  • their party's official website (e.g. ekloges.disy.cy, akel.org.cy)\n"
    "  • their personal site\n"
    "  • their LinkedIn profile\n"
    "  • a reputable news outlet's profile of them\n"
    "then return THAT bio verbatim in `bio_text`. Greek source → return Greek. "
    "Set `is_ai_generated=false` and put the page URL in `source_url`.\n\n"
    "PRIORITY 2 — SYNTHESISED CV. If no published biography is available "
    "or you can't confidently identify the right person, compose a 4-7 "
    "sentence biographical paragraph using whatever facts the search "
    "returned (profession, party role, public statements, prior offices). "
    "Set `is_ai_generated=true`. Begin the bio with this Greek prefix:\n"
    "  «Συντάχθηκε από AI με βάση δημόσια διαθέσιμες πληροφορίες — "
    "παρακαλώ επαληθεύστε.» \n"
    "(or in English if the bio is in English: \"AI-generated summary "
    "based on publicly available information — please verify.\")\n"
    "Then write the bio. Use null for `source_url` if no single page backs it.\n\n"
    "STRICT RULES:\n"
    "• Never fabricate biographical facts. If you have only the name + "
    "  party + district and no web hits, return a TWO-sentence neutral "
    "  placeholder ('Είναι υποψήφι@ {party} στην εκλογική περιφέρεια "
    "  {district}.') with `is_ai_generated=true`.\n"
    "• Distinguish ambiguous people: confirm the right person by party + "
    "  district before quoting any web bio.\n"
    "• `language`: 'gr' or 'en' for the bio_text language.\n"
    "• `source_kind`: one of 'party_site' | 'personal_site' | 'linkedin' | "
    "  'news' | 'wikipedia' | 'ai_synthesized'.\n"
)


def _candidate_facts(conn: sqlite3.Connection, candidate_id: int) -> dict[str, str]:
    """Return the current best (field, value) for context fields."""
    out: dict[str, str] = {}
    for r in conn.execute(
        """SELECT field, best_value FROM candidate_current
            WHERE candidate_id = ?
              AND field IN ('age','date_of_birth','profession','sector',
                            'education','career_previous','website',
                            'facebook','linkedin','wikipedia','photo_url',
                            'highlights','bio_text')""",
        (candidate_id,),
    ):
        out[r["field"]] = r["best_value"]
    return out


def _format_facts(facts: dict[str, str]) -> str:
    if not facts:
        return "(no structured facts on file)"
    lines = []
    for k, v in facts.items():
        if v:
            v = (v[:600] + "…") if len(v) > 600 else v
            lines.append(f"  - {k}: {v}")
    return "\n".join(lines) or "(no structured facts on file)"


def _resolve_source(
    conn: sqlite3.Connection, source_url: str | None, source_kind: str, now: str
) -> int | None:
    """Insert/find a sources row for the URL the model returned. Falls back
    to a synthetic entry tagged search_snippet/llm_from_bio."""
    if source_url and source_url.startswith(("http://", "https://")):
        cur = conn.execute(
            """INSERT INTO sources (kind, url, fetched_at, sha256, path)
                 VALUES (?, ?, ?, NULL, NULL)
                 ON CONFLICT (kind, url, fetched_at) DO NOTHING
                 RETURNING id""",
            (source_kind, source_url, now),
        ).fetchone()
        if cur:
            return int(cur["id"])
        cur = conn.execute(
            "SELECT id FROM sources WHERE kind=? AND url=? AND fetched_at=?",
            (source_kind, source_url, now),
        ).fetchone()
        if cur:
            return int(cur["id"])
    # No URL → synthetic placeholder.
    placeholder = (
        "ai_synthesized" if source_kind == "ai_synthesized" else "search_snippet"
    )
    cur = conn.execute(
        """INSERT INTO sources (kind, url, fetched_at, sha256, path)
             VALUES (?, ?, ?, NULL, NULL)
             RETURNING id""",
        (placeholder, f"cv_full:candidate-bio", now),
    ).fetchone()
    return int(cur["id"]) if cur else None


def _persist(
    conn: sqlite3.Connection,
    candidate_id: int,
    parsed: dict,
    citations: list[str],
) -> bool:
    bio = (parsed.get("bio_text") or "").strip()
    if not bio:
        return False
    is_ai = bool(parsed.get("is_ai_generated"))
    lang_hint = (parsed.get("language") or "gr").strip().lower()[:2]
    if is_ai:
        ai_prefix_gr = (
            "Συντάχθηκε από AI με βάση δημόσια διαθέσιμες πληροφορίες — "
            "παρακαλώ επαληθεύστε."
        )
        ai_prefix_en = (
            "AI-generated summary based on publicly available information — "
            "please verify."
        )
        prefix = ai_prefix_en if lang_hint == "en" else ai_prefix_gr
        if not bio.startswith(("Συντάχθηκε από AI", "AI-generated", "AI generated")):
            bio = f"{prefix}\n\n{bio}"
    src_url = (parsed.get("source_url") or "").strip() or None
    raw_kind = (parsed.get("source_kind") or "").strip() or "search_snippet"
    # Map model-reported kind to the schema's allowed source.kind values.
    kind_map = {
        "party_site": "party_site",
        "personal_site": "search_snippet",
        "linkedin": "linkedin_snippet",
        "news": "news",
        "wikipedia": "wikipedia",
        "ai_synthesized": "llm_from_bio",
    }
    kind = kind_map.get(raw_kind, "search_snippet")
    lang = lang_hint or None

    # Trust: high (0.92) when we have a real source URL and it isn't AI-gen;
    # low (0.6) when AI-generated; medium (0.75) when source URL is missing
    # but the model claims it's not AI-gen (fallback safety).
    if is_ai:
        confidence = 0.6
    elif src_url:
        confidence = 0.92
    else:
        confidence = 0.75

    now = datetime.utcnow().isoformat()
    with transaction(conn):
        # Register every citation URL as a search_snippet source so the
        # dashboard's "Sources" panel surfaces them too.
        for url in citations:
            conn.execute(
                """INSERT OR IGNORE INTO sources (kind, url, fetched_at, sha256, path)
                     VALUES ('search_snippet', ?, ?, NULL, NULL)""",
                (url, now),
            )
        primary_src_id = _resolve_source(conn, src_url, kind, now)
        if primary_src_id is None:
            return False
        conn.execute(
            """INSERT INTO field_values
                 (candidate_id, field, value, source_id, extracted_at, confidence, lang)
               VALUES (?, 'bio_text', ?, ?, ?, ?, ?)""",
            (candidate_id, bio, primary_src_id, now, confidence, lang),
        )
    return True


def run(
    cfg: AppConfig,
    conn: sqlite3.Connection,
    *,
    restart: bool = False,
    limit: int | None = None,
) -> dict[str, int]:
    llm = LLMClient(cfg)
    stats = {"checked": 0, "verbatim": 0, "ai_generated": 0, "skipped": 0, "errors": 0}
    if not llm.enabled:
        log.warning("cv_full disabled (no OPENROUTER_API_KEY)")
        return stats
    search_model = cfg.openrouter_search_model() or cfg.openrouter_model()

    rows = conn.execute(
        """SELECT id, canonical_name_gr, canonical_name_en, party_code, district_code
             FROM candidates ORDER BY id"""
    ).fetchall()

    party_label = {p.code: p.name_gr for p in cfg.parties}

    try:
        for cand in rows:
            key = f"candidate={cand['id']}"
            if should_skip(conn, STAGE, key, restart=restart):
                stats["skipped"] += 1
                continue
            if limit is not None and stats["checked"] >= limit:
                break
            stats["checked"] += 1

            facts = _candidate_facts(conn, cand["id"])
            facts_block = _format_facts(facts)
            party = party_label.get(cand["party_code"], cand["party_code"])
            user_msg = (
                f"NAME (Greek): {cand['canonical_name_gr'] or '(unknown)'}\n"
                f"NAME (Latin): {cand['canonical_name_en'] or '(unknown)'}\n"
                f"PARTY: {cand['party_code']} ({party})\n"
                f"DISTRICT: {cand['district_code']}\n"
                f"YEAR: 2026 Cyprus parliamentary elections\n\n"
                f"Already-known facts:\n{facts_block}\n\n"
                "Return JSON with the candidate's full CV as instructed."
            )
            try:
                parsed, citations = llm.chat_json_with_citations(
                    system=_SYSTEM,
                    user=user_msg,
                    cache_key=(
                        f"cv_full|{cand['party_code']}|{cand['district_code']}|"
                        f"{cand['canonical_name_gr']}|{search_model}|v1"
                    ),
                    json_schema=_SCHEMA,
                    model=search_model,
                )
            except Exception as e:  # noqa: BLE001
                log.exception("cv_full failed for candidate %s", cand["id"])
                set_status(conn, STAGE, key, "error", f"{type(e).__name__}: {e}")
                conn.commit()
                stats["errors"] += 1
                continue

            if parsed and _persist(conn, cand["id"], parsed, citations):
                if parsed.get("is_ai_generated"):
                    stats["ai_generated"] += 1
                else:
                    stats["verbatim"] += 1
            set_status(conn, STAGE, key, "ok")
            conn.commit()
    finally:
        llm.close()
    return stats
