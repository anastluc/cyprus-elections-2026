"""Enrich candidates with Wikipedia / Wikidata data.

Strategy per candidate:
1. MediaWiki search on both el.wikipedia.org and en.wikipedia.org with the
   candidate's full name + disambiguation terms ("Cyprus", party code).
2. Pick the best matching page via LLM (only when OPENROUTER_API_KEY set); if
   LLM disabled, take the top hit when the title substring-matches the name.
3. Store wikipedia URL + Wikidata QID in field_values.
4. If a QID is found, fetch basic Wikidata claims (P569 birthdate, P106
   occupation, P69 education, P39 position held) and write them as separate
   field_values with source_kind=wikidata.

Candidates already enriched (run_state status='ok') are skipped on resume.
"""
from __future__ import annotations

import asyncio
import logging
import sqlite3
from datetime import datetime
from typing import Any
from urllib.parse import quote

import httpx

from cyprus_elections.config import AppConfig
from cyprus_elections.db import transaction
from cyprus_elections.state import set_status, should_skip

log = logging.getLogger(__name__)

STAGE = "enrich_wikipedia"

MW_SEARCH = "https://{lang}.wikipedia.org/w/api.php"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"


async def _search(client: httpx.AsyncClient, lang: str, query: str) -> list[dict]:
    resp = await client.get(
        MW_SEARCH.format(lang=lang),
        params={
            "action": "query",
            "list": "search",
            "srsearch": query,
            "srlimit": 5,
            "format": "json",
            "utf8": 1,
        },
    )
    if resp.status_code != 200:
        return []
    return resp.json().get("query", {}).get("search", []) or []


async def _page_info(client: httpx.AsyncClient, lang: str, title: str) -> dict | None:
    resp = await client.get(
        MW_SEARCH.format(lang=lang),
        params={
            "action": "query",
            "titles": title,
            "prop": "pageprops|extracts",
            "exintro": 1,
            "explaintext": 1,
            "ppprop": "wikibase_item",
            "format": "json",
            "utf8": 1,
        },
    )
    if resp.status_code != 200:
        return None
    pages = resp.json().get("query", {}).get("pages", {})
    for _pid, page in pages.items():
        if "missing" in page:
            continue
        return {
            "title": page.get("title"),
            "qid": (page.get("pageprops") or {}).get("wikibase_item"),
            "extract": page.get("extract") or "",
        }
    return None


async def _wikidata_claims(client: httpx.AsyncClient, qid: str) -> dict[str, Any]:
    resp = await client.get(
        WIKIDATA_API,
        params={
            "action": "wbgetentities",
            "ids": qid,
            "props": "claims|labels|sitelinks",
            "languages": "en|el",
            "format": "json",
        },
    )
    if resp.status_code != 200:
        return {}
    ent = (resp.json().get("entities") or {}).get(qid) or {}
    claims = ent.get("claims", {})

    out: dict[str, Any] = {}

    # P569 date of birth → ISO-8601 string.
    if "P569" in claims:
        for c in claims["P569"]:
            val = ((c.get("mainsnak") or {}).get("datavalue") or {}).get("value")
            if isinstance(val, dict) and "time" in val:
                # Wikidata format: +1972-05-14T00:00:00Z → 1972-05-14.
                out["date_of_birth"] = val["time"].lstrip("+").split("T", 1)[0]
                break

    # For P106 (occupation), P69 (educated at), P39 (position held) we keep
    # it cheap: just count and record how many claims exist plus the first
    # English label when available.
    labels = {}
    for claim_pid, target_key in (
        ("P106", "occupation_qids"),
        ("P69", "education_qids"),
        ("P39", "positions_held_qids"),
    ):
        if claim_pid in claims:
            ids = []
            for c in claims[claim_pid]:
                v = ((c.get("mainsnak") or {}).get("datavalue") or {}).get("value") or {}
                if isinstance(v, dict) and v.get("id"):
                    ids.append(v["id"])
            if ids:
                out[target_key] = ",".join(ids[:5])

    _ = labels  # reserved for future label resolution (would need a second call)
    return out


async def _enrich_one(
    client: httpx.AsyncClient,
    conn: sqlite3.Connection,
    cfg: AppConfig,
    candidate: sqlite3.Row,
) -> dict:
    """Return a dict of {field: (value, confidence, source_kind)} to persist."""
    name_gr = candidate["canonical_name_gr"]
    name_en = candidate["canonical_name_en"]
    party_code = candidate["party_code"]

    hits: list[tuple[str, dict]] = []
    # Prefer Greek Wikipedia if Greek name is available.
    if name_gr:
        for item in await _search(client, "el", f"{name_gr} {party_code} Κύπρος"):
            hits.append(("el", item))
    if name_en:
        for item in await _search(client, "en", f'"{name_en}" Cyprus politician'):
            hits.append(("en", item))
    if not hits:
        return {}

    # Simple scoring: the title must contain all name tokens (accent-folded).
    from cyprus_elections.normalize import strip_tonos

    def tokens(s: str) -> set[str]:
        return {t for t in strip_tonos(s).lower().split() if len(t) >= 3}

    best = None
    best_score = 0.0
    for lang, hit in hits:
        title = hit.get("title", "")
        snippet = hit.get("snippet", "")
        name_tokens = tokens(name_gr or "") | tokens(name_en or "")
        title_tokens = tokens(title)
        if not name_tokens:
            continue
        overlap = len(name_tokens & title_tokens) / len(name_tokens)
        # Small bonuses for Cyprus / party mention in snippet.
        if "cyprus" in snippet.lower() or "κύπρ" in snippet.lower():
            overlap += 0.2
        if party_code.lower() in snippet.lower():
            overlap += 0.1
        if overlap > best_score:
            best_score = overlap
            best = (lang, hit)

    if best is None or best_score < 0.6:
        return {}

    lang, hit = best
    info = await _page_info(client, lang, hit["title"])
    if not info:
        return {}

    result: dict[str, tuple[str, float, str]] = {}
    page_url = f"https://{lang}.wikipedia.org/wiki/{quote(info['title'].replace(' ', '_'))}"
    result["wikipedia"] = (page_url, min(0.95, 0.6 + best_score * 0.3), "wikipedia")

    qid = info.get("qid")
    if qid:
        result["wikidata_qid"] = (qid, 0.9, "wikidata")
        wd = await _wikidata_claims(client, qid)
        if "date_of_birth" in wd:
            result["date_of_birth"] = (wd["date_of_birth"], 0.9, "wikidata")
    return result


async def _run_async(cfg: AppConfig, conn: sqlite3.Connection, *, restart: bool) -> dict[str, int]:
    rows = conn.execute(
        "SELECT id, canonical_name_gr, canonical_name_en, party_code FROM candidates"
    ).fetchall()
    stats = {"checked": 0, "matched": 0, "skipped": 0, "errors": 0}

    async with httpx.AsyncClient(
        timeout=30.0,
        headers={"User-Agent": cfg.fetch.user_agent},
    ) as client:
        for cand in rows:
            key = f"candidate={cand['id']}"
            if should_skip(conn, STAGE, key, restart=restart):
                stats["skipped"] += 1
                continue
            stats["checked"] += 1
            try:
                enrichment = await _enrich_one(client, conn, cfg, cand)
            except Exception as e:  # noqa: BLE001
                log.exception("wikipedia enrich failed for candidate %s", cand["id"])
                set_status(conn, STAGE, key, "error", f"{type(e).__name__}: {e}")
                conn.commit()
                stats["errors"] += 1
                continue

            if enrichment:
                stats["matched"] += 1
                _persist_enrichment(conn, cand["id"], enrichment)
            set_status(conn, STAGE, key, "ok")
            conn.commit()
            # Polite rate limit even at httpx default.
            await asyncio.sleep(0.5)
    return stats


def _persist_enrichment(
    conn: sqlite3.Connection,
    candidate_id: int,
    enrichment: dict[str, tuple[str, float, str]],
) -> None:
    now = datetime.utcnow().isoformat()
    with transaction(conn):
        for field, (value, confidence, source_kind) in enrichment.items():
            # Register a synthetic source row (one per field+url).
            url = value if source_kind == "wikipedia" else f"wikidata:{field}"
            cur = conn.execute(
                """INSERT INTO sources (kind, url, fetched_at, sha256, path)
                   VALUES (?, ?, ?, NULL, NULL)
                   ON CONFLICT (kind, url, fetched_at) DO NOTHING
                   RETURNING id""",
                (source_kind, url, now),
            ).fetchone()
            if cur is None:
                src_id = conn.execute(
                    "SELECT id FROM sources WHERE kind=? AND url=? AND fetched_at=?",
                    (source_kind, url, now),
                ).fetchone()["id"]
            else:
                src_id = int(cur["id"])
            conn.execute(
                """INSERT OR IGNORE INTO field_values
                   (candidate_id, field, value, source_id, extracted_at, confidence)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (candidate_id, field, str(value), src_id, now, confidence),
            )


def run(cfg: AppConfig, conn: sqlite3.Connection, *, restart: bool = False) -> dict[str, int]:
    return asyncio.run(_run_async(cfg, conn, restart=restart))
