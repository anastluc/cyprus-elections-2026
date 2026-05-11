"""Extract social-media handles by fetching each candidate's citation URLs
and regex-scanning the resulting HTML.

The active-mode LLM probe (``social_discovery.run_active``) frequently
returns ``null`` for social fields even when the search snippets *do*
point at the candidate's official party page — the model is too
conservative to commit to a URL it didn't directly read. This stage
plugs that gap by:

1. Collecting every ``search_snippet`` URL the LLM cited for each
   candidate, plus their existing ``website`` field if any.
2. Fetching each URL (through the polite cached client).
3. Regex-scanning the HTML for canonical Facebook / Instagram /
   Twitter (X) / LinkedIn / YouTube / TikTok / official-website URLs.
4. Persisting any new handles to ``field_values`` with a confidence
   of 0.85 — beats the LLM 0.5 fallback, ties below party-site data.

Citations that already named that exact handle on a known party site
won't be re-fetched if the page is in the cache.
"""
from __future__ import annotations

import asyncio
import logging
import re
import sqlite3
from datetime import datetime
from urllib.parse import urlparse

from cyprus_elections.config import AppConfig
from cyprus_elections.db import transaction
from cyprus_elections.fetch import PoliteClient
from cyprus_elections.state import set_status, should_skip

log = logging.getLogger(__name__)

STAGE = "enrich_social_from_citations"

_PATTERNS: dict[str, re.Pattern[str]] = {
    "facebook": re.compile(
        r"https?://(?:www\.|m\.|web\.)?facebook\.com/(?!sharer|tr|plugins|login|signup|home)([A-Za-z0-9.\-_/]+?)(?:[/?#]|\")",
        re.I,
    ),
    "instagram": re.compile(
        r"https?://(?:www\.)?instagram\.com/(?!p/|reel/|stories/|explore|tags/)([A-Za-z0-9._-]+)(?:[/?#]|\")",
        re.I,
    ),
    "twitter": re.compile(
        r"https?://(?:www\.|mobile\.)?(?:twitter|x)\.com/(?!share|intent|home|search)([A-Za-z0-9_]+)(?:[/?#]|\")",
        re.I,
    ),
    "linkedin": re.compile(
        r"https?://(?:[a-z]{2,3}\.)?linkedin\.com/in/([A-Za-z0-9._%\-À-ſ]+)(?:[/?#]|\")",
        re.I,
    ),
    "youtube": re.compile(
        r"https?://(?:www\.)?youtube\.com/(?:c/|channel/|user/|@)([A-Za-z0-9._\-]+)(?:[/?#]|\")",
        re.I,
    ),
    "tiktok": re.compile(
        r"https?://(?:www\.)?tiktok\.com/@([A-Za-z0-9._\-]+)(?:[/?#]|\")",
        re.I,
    ),
}

# Handles that match the regex but are obviously non-personal (party / share
# widget endpoints / vanity company pages) we don't want to attribute to a
# specific candidate.
_HANDLE_BLOCKLIST = {
    "share", "sharer", "tr", "intent", "company", "school", "login",
    "signup", "home", "watch", "events", "groups", "plugins",
    # Cypriot party / news aggregators that frequently appear in citations.
    "akel.cy", "akelcy", "disy.cy", "ekloges.disy.cy", "cyprusgreens",
    "voltcyprus", "voltcy", "depacyprus", "edekcyprus", "elamcy",
    "dimokratikoparty", "philenews", "cyprusmail", "cyprustimes",
    "politis", "sigmalive", "philenewscom", "philenewscy",
    # Generic "X" links to social-network home pages
    "facebook", "twitter", "instagram", "linkedin", "youtube", "tiktok",
}


def _collect_targets(conn: sqlite3.Connection, candidate_id: int) -> list[str]:
    """URLs we should fetch and scan for social handles for this candidate."""
    urls: list[str] = []
    seen: set[str] = set()

    # 1. Any explicit search_snippet sources tied to this candidate via raw_records
    #    (rare — most are tied via field_values).
    # 2. Sources referenced by any field_value of the candidate.
    rows = conn.execute(
        """SELECT DISTINCT s.url
             FROM field_values fv
             JOIN sources s ON s.id = fv.source_id
            WHERE fv.candidate_id = ?
              AND s.url LIKE 'http%'""",
        (candidate_id,),
    ).fetchall()
    for r in rows:
        u = r["url"]
        if u not in seen:
            seen.add(u)
            urls.append(u)

    # 3. Candidate's own website field — high-value source.
    row = conn.execute(
        """SELECT best_value FROM candidate_current
            WHERE candidate_id = ? AND field='website'""",
        (candidate_id,),
    ).fetchone()
    if row and row["best_value"] and row["best_value"].startswith("http"):
        u = row["best_value"]
        if u not in seen:
            seen.add(u)
            urls.append(u)
    return urls


def _normalize(field: str, url: str) -> str | None:
    """Canonicalise the URL for `field` and reject blocked handles."""
    m = _PATTERNS[field].search(url + '"')  # the trailing " lets the regex's terminator hit
    if not m:
        return None
    handle = m.group(1).rstrip("/").strip(".")
    short = handle.split("/")[0].lower()
    if short in _HANDLE_BLOCKLIST or len(short) < 2:
        return None
    domain_by_field = {
        "facebook": "https://www.facebook.com/",
        "instagram": "https://www.instagram.com/",
        "twitter": "https://x.com/",
        "linkedin": "https://www.linkedin.com/in/",
        "youtube": "https://www.youtube.com/@",
        "tiktok": "https://www.tiktok.com/@",
    }
    return f"{domain_by_field[field]}{handle.rstrip('/')}"


def _scan_html(html: str) -> dict[str, str]:
    found: dict[str, str] = {}
    for field in _PATTERNS:
        matches = _PATTERNS[field].finditer(html)
        for m in matches:
            url = _normalize(field, m.group(0))
            if url:
                found.setdefault(field, url)
                break
    return found


def _name_matches_page(html: str, name_gr: str | None, name_en: str | None) -> bool:
    """Cheap relevance guard: the page must mention the candidate's name."""
    needles: list[str] = []
    if name_gr:
        # Drop leading particles to match better (e.g. ΧΑΓΟΥΙΛΑ vs Χαγουίλα).
        tokens = [t for t in re.split(r"\s+", name_gr.strip()) if len(t) >= 4]
        needles.extend(tokens[:2])
    if name_en:
        tokens = [t for t in re.split(r"\s+", name_en.strip()) if len(t) >= 4]
        needles.extend(tokens[:2])
    if not needles:
        return True  # can't verify → don't block
    hay = html.lower()
    return any(n.lower() in hay for n in needles)


async def _arun(cfg: AppConfig, conn: sqlite3.Connection, *, restart: bool) -> dict[str, int]:
    stats = {"checked": 0, "fetched": 0, "matched": 0, "skipped": 0, "errors": 0}

    cands = conn.execute(
        """SELECT id, canonical_name_gr, canonical_name_en
             FROM candidates ORDER BY id"""
    ).fetchall()

    async with PoliteClient(cfg) as client:
        for cand in cands:
            key = f"candidate={cand['id']}"
            if should_skip(conn, STAGE, key, restart=restart):
                stats["skipped"] += 1
                continue
            stats["checked"] += 1

            # Skip if we already have all 4 main social fields.
            have = {
                r["field"]
                for r in conn.execute(
                    """SELECT field FROM candidate_current
                        WHERE candidate_id=?
                          AND field IN ('facebook','instagram','twitter','linkedin')""",
                    (cand["id"],),
                )
            }
            missing = {"facebook", "instagram", "twitter", "linkedin"} - have
            if not missing:
                set_status(conn, STAGE, key, "ok")
                conn.commit()
                continue

            urls = _collect_targets(conn, cand["id"])
            # Score URLs: candidate-own party pages first, then everything else.
            # Crude heuristic: prefer URLs containing the candidate's surname
            # (Latin or Greek) — those are the per-candidate party pages.
            surnames: list[str] = []
            for n in (cand["canonical_name_gr"], cand["canonical_name_en"]):
                if n:
                    surnames.extend(
                        t.lower() for t in re.split(r"\s+", n.strip()) if len(t) >= 4
                    )

            def url_score(u: str) -> int:
                ul = u.lower()
                if any(s in ul for s in surnames):
                    return 0
                return 1

            urls.sort(key=url_score)
            urls = urls[:6]  # cap to avoid runaway fetches

            found: dict[str, str] = {}
            for url in urls:
                if not missing - set(found):
                    break
                if any(host in url for host in (
                    "facebook.com", "instagram.com", "twitter.com",
                    "x.com", "linkedin.com", "youtube.com", "tiktok.com",
                )):
                    continue
                try:
                    res = await client.get(url, bucket="enrich/social_pages")
                except Exception as e:  # noqa: BLE001
                    log.debug("fetch fail %s: %s", url, e)
                    continue
                stats["fetched"] += 1
                if not _name_matches_page(
                    res.text, cand["canonical_name_gr"], cand["canonical_name_en"]
                ):
                    continue
                hits = _scan_html(res.text)
                for f, v in hits.items():
                    if f in missing and f not in found:
                        found[f] = v

            if found:
                _persist(conn, cand["id"], found)
                stats["matched"] += 1

            set_status(conn, STAGE, key, "ok")
            conn.commit()
    return stats


def _persist(
    conn: sqlite3.Connection, candidate_id: int, fields: dict[str, str]
) -> None:
    now = datetime.utcnow().isoformat()
    placeholder = f"social_from_citations:candidate={candidate_id}"
    with transaction(conn):
        cur = conn.execute(
            """INSERT INTO sources (kind, url, fetched_at, sha256, path)
                 VALUES ('search_snippet', ?, ?, NULL, NULL)
                 ON CONFLICT (kind, url, fetched_at) DO NOTHING
                 RETURNING id""",
            (placeholder, now),
        ).fetchone()
        if cur is None:
            cur = conn.execute(
                "SELECT id FROM sources WHERE kind='search_snippet' AND url=? AND fetched_at=?",
                (placeholder, now),
            ).fetchone()
        if cur is None:
            return
        src_id = int(cur["id"])
        for field, url in fields.items():
            conn.execute(
                """INSERT OR IGNORE INTO field_values
                     (candidate_id, field, value, source_id, extracted_at, confidence, lang)
                   VALUES (?, ?, ?, ?, ?, 0.85, NULL)""",
                (candidate_id, field, url, src_id, now),
            )


def run(cfg: AppConfig, conn: sqlite3.Connection, *, restart: bool = False) -> dict[str, int]:
    return asyncio.run(_arun(cfg, conn, restart=restart))
