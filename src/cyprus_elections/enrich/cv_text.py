"""Download each candidate's cv_url and persist the raw text as cv_text.

The source URL of the CV is preserved as a new `sources` row (kind='cv_doc',
url=<cv_url>), so downstream consumers can trace cv_text back to its origin
via field_values.source_id.

PDFs are parsed with pypdf; HTML is stripped to visible body text via
selectolax. Binaries are cached under data/raw/cvs/ keyed by URL digest so
re-runs don't re-download.
"""
from __future__ import annotations

import hashlib
import logging
import sqlite3
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import httpx
from selectolax.parser import HTMLParser

from cyprus_elections.config import AppConfig
from cyprus_elections.db import transaction
from cyprus_elections.state import set_status, should_skip

log = logging.getLogger(__name__)

STAGE = "enrich_cv_text"

_MAX_BYTES = 20 * 1024 * 1024  # 20 MB hard cap per document
_MAX_TEXT_CHARS = 100_000       # truncate extracted text to keep rows sane


def run(cfg: AppConfig, conn: sqlite3.Connection, *, restart: bool = False) -> dict[str, int]:
    stats = {"checked": 0, "extracted": 0, "skipped": 0, "errors": 0, "empty": 0}
    cache_dir = cfg.raw_dir / "cvs"
    cache_dir.mkdir(parents=True, exist_ok=True)

    rows = conn.execute(
        """SELECT candidate_id, best_value AS cv_url
             FROM candidate_current
            WHERE field = 'cv_url'
              AND best_value <> ''
              AND lower(best_value) NOT IN ('null', 'none')
              AND (best_value LIKE 'http://%' OR best_value LIKE 'https://%')"""
    ).fetchall()

    have_text = {
        r["candidate_id"]
        for r in conn.execute(
            "SELECT DISTINCT candidate_id FROM field_values WHERE field = 'cv_text'"
        )
    }

    headers = {"User-Agent": cfg.fetch.user_agent}
    with httpx.Client(timeout=cfg.fetch.timeout_seconds, follow_redirects=True, headers=headers) as client:
        for row in rows:
            cand_id = int(row["candidate_id"])
            url = row["cv_url"].strip()
            if not url:
                continue
            key = f"candidate={cand_id}|url={url}"
            if should_skip(conn, STAGE, key, restart=restart):
                stats["skipped"] += 1
                continue
            if cand_id in have_text and not restart:
                set_status(conn, STAGE, key, "ok")
                conn.commit()
                stats["skipped"] += 1
                continue
            stats["checked"] += 1
            try:
                text = _fetch_and_extract(client, url, cache_dir)
            except Exception as e:  # noqa: BLE001
                log.warning("cv_text fetch failed for candidate %s (%s): %s", cand_id, url, e)
                set_status(conn, STAGE, key, "error", f"{type(e).__name__}: {e}")
                conn.commit()
                stats["errors"] += 1
                continue

            if not text:
                stats["empty"] += 1
                set_status(conn, STAGE, key, "ok")
                conn.commit()
                continue

            _persist(conn, cand_id, url, text[:_MAX_TEXT_CHARS])
            stats["extracted"] += 1
            set_status(conn, STAGE, key, "ok")
            conn.commit()
    return stats


def _fetch_and_extract(client: httpx.Client, url: str, cache_dir: Path) -> str:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:40]
    path_hint = urlparse(url).path.lower()
    ext_guess = ".pdf" if path_hint.endswith(".pdf") else (
        ".doc" if path_hint.endswith(".doc") else
        ".docx" if path_hint.endswith(".docx") else ".bin"
    )
    cached = next(iter(cache_dir.glob(f"{digest}.*")), None)
    if cached is not None:
        content = cached.read_bytes()
        ctype = _guess_ctype(cached.suffix, content)
    else:
        resp = client.get(url)
        resp.raise_for_status()
        content = resp.content[:_MAX_BYTES]
        ctype = (resp.headers.get("content-type") or "").lower()
        if "pdf" in ctype or path_hint.endswith(".pdf"):
            ext_guess = ".pdf"
        elif "html" in ctype:
            ext_guess = ".html"
        (cache_dir / f"{digest}{ext_guess}").write_bytes(content)

    if "pdf" in ctype or content[:4] == b"%PDF":
        return _extract_pdf(content)
    if "html" in ctype or content[:15].lstrip().lower().startswith((b"<!doctype", b"<html")):
        return _extract_html(content)
    # Last resort: try as text.
    try:
        return content.decode("utf-8", errors="replace").strip()
    except Exception:
        return ""


def _guess_ctype(suffix: str, content: bytes) -> str:
    suffix = suffix.lower()
    if suffix == ".pdf" or content[:4] == b"%PDF":
        return "application/pdf"
    if suffix in (".html", ".htm"):
        return "text/html"
    return "application/octet-stream"


def _extract_pdf(content: bytes) -> str:
    from io import BytesIO

    from pypdf import PdfReader

    reader = PdfReader(BytesIO(content))
    parts: list[str] = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception as e:  # noqa: BLE001
            log.debug("pypdf page extract failed: %s", e)
    text = "\n".join(p for p in parts if p).strip()
    return text


def _extract_html(content: bytes) -> str:
    tree = HTMLParser(content.decode("utf-8", errors="replace"))
    for sel in ("script", "style", "noscript", "nav", "footer", "header"):
        for node in tree.css(sel):
            node.decompose()
    body = tree.body or tree.root
    if body is None:
        return ""
    return body.text(separator="\n", strip=True)


def _persist(conn: sqlite3.Connection, candidate_id: int, cv_url: str, text: str) -> None:
    now = datetime.utcnow().isoformat()
    with transaction(conn):
        cur = conn.execute(
            """INSERT INTO sources (kind, url, fetched_at, sha256, path)
               VALUES ('cv_doc', ?, ?, ?, NULL)
               ON CONFLICT (kind, url, fetched_at) DO NOTHING
               RETURNING id""",
            (cv_url, now, hashlib.sha256(text.encode("utf-8")).hexdigest()),
        ).fetchone()
        if cur is None:
            cur = conn.execute(
                "SELECT id FROM sources WHERE kind='cv_doc' AND url=? AND fetched_at=?",
                (cv_url, now),
            ).fetchone()
        src_id = int(cur["id"])
        conn.execute(
            """INSERT OR IGNORE INTO field_values
               (candidate_id, field, value, source_id, extracted_at, confidence)
               VALUES (?, 'cv_text', ?, ?, ?, ?)""",
            (candidate_id, text, src_id, now, 0.9),
        )
