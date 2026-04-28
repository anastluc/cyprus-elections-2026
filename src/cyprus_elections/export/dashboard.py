"""Emit JSON bundles that the React dashboard loads at startup.

Four files land in `dashboard/public/data/`:
- candidates.json : per-candidate record with every field + provenance
- stats.json      : pre-aggregated slices (coverage, party x platform, etc.)
- history.json    : every historical-results row joined to a 2026 candidate
- meta.json       : generated_at, counts, disclaimer text
"""
from __future__ import annotations

import json
import logging
import sqlite3
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

from cyprus_elections.config import AppConfig

log = logging.getLogger(__name__)

DASHBOARD_DATA_DIR = "dashboard/public/data"
DASHBOARD_DIST_DATA_DIR = "dashboard/dist/data"

# Fields we surface in each candidate record (alongside party/district/name).
_FIELD_ORDER = [
    "gender", "age", "date_of_birth",
    "profession", "sector", "profession_cluster",
    "education", "career_previous",
    "bio_text", "highlights",
    "photo_url", "cv_url", "cv_text",
    "facebook", "twitter", "instagram", "linkedin",
    "website", "wikipedia", "wikidata_qid",
]

_SOCIAL_FIELDS = ("facebook", "twitter", "instagram", "linkedin", "website", "wikipedia")

DISCLAIMER = (
    "Some of this data was collected and enriched using automated web scraping "
    "and AI language models. Individual values may be incomplete or inaccurate. "
    "Every field shows its source URL — please verify before citing."
)


def _current_fields(conn: sqlite3.Connection, candidate_id: int) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for r in conn.execute(
        """SELECT cc.field, cc.best_value, cc.field_confidence, cc.best_lang,
                  s.url AS source_url, s.kind AS source_kind
             FROM candidate_current cc
             JOIN sources s ON s.id = cc.best_source_id
            WHERE cc.candidate_id = ?""",
        (candidate_id,),
    ):
        entry: dict[str, Any] = {
            "value": r["best_value"],
            "confidence": round(r["field_confidence"], 3),
            "source_url": r["source_url"],
            "source_kind": r["source_kind"],
        }
        if r["best_lang"]:
            entry["lang"] = r["best_lang"]
        out[r["field"]] = entry
    return out


def _all_sources(conn: sqlite3.Connection, candidate_id: int) -> list[str]:
    rows = conn.execute(
        """SELECT DISTINCT s.url FROM field_values fv
             JOIN sources s ON s.id = fv.source_id
            WHERE fv.candidate_id = ? AND s.url LIKE 'http%'
            ORDER BY s.url""",
        (candidate_id,),
    ).fetchall()
    return [r["url"] for r in rows]


def _parse_highlights(raw: dict | None) -> list[str] | None:
    if not raw:
        return None
    try:
        payload = json.loads(raw["value"])
    except (json.JSONDecodeError, TypeError):
        return None
    items = payload.get("items") if isinstance(payload, dict) else payload
    if not isinstance(items, list):
        return None
    return [s for s in items if isinstance(s, str)]


def _extract_age(field: dict | None) -> int | None:
    if not field:
        return None
    try:
        return int(float(field["value"]))
    except (TypeError, ValueError):
        return None


def _age_from_dob(field: dict | None, today: datetime | None = None) -> int | None:
    """Derive age from a date_of_birth field. Accepts ISO YYYY-MM-DD,
    YYYY-MM, or just YYYY (year-only is common in scraped sources).
    """
    if not field:
        return None
    raw = (field.get("value") or "").strip()
    if not raw:
        return None
    today = today or datetime.utcnow()
    parts = raw.split("-")
    try:
        year = int(parts[0])
    except ValueError:
        return None
    # Sanity-check: birth year must be within a plausible range
    if year < 1900 or year > today.year:
        return None
    month = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 1
    day = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 1
    age = today.year - year - ((today.month, today.day) < (month, day))
    if age < 0 or age > 130:
        return None
    return age


def export(cfg: AppConfig, conn: sqlite3.Connection) -> Path:
    out_dir = cfg.root / DASHBOARD_DATA_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    candidates: list[dict[str, Any]] = []
    cand_rows = conn.execute(
        """SELECT c.id, c.canonical_name_gr, c.canonical_name_en,
                  c.party_code, c.district_code,
                  COALESCE(rc.row_confidence, 0.0) AS row_confidence
             FROM candidates c
             LEFT JOIN row_confidence rc ON rc.candidate_id = c.id
            ORDER BY c.party_code, c.district_code, c.canonical_name_en"""
    ).fetchall()

    for c in cand_rows:
        fields = _current_fields(conn, c["id"])
        record: dict[str, Any] = {
            "id": c["id"],
            "name_en": c["canonical_name_en"] or fields.get("name_en", {}).get("value", ""),
            "name_gr": c["canonical_name_gr"] or fields.get("name_gr", {}).get("value", ""),
            "party": c["party_code"],
            "district": c["district_code"],
            "row_confidence": round(c["row_confidence"] or 0.0, 3),
            "fields": {k: fields[k] for k in _FIELD_ORDER if k in fields},
            "sources": _all_sources(conn, c["id"]),
        }
        hl = _parse_highlights(fields.get("highlights"))
        if hl:
            record["highlights"] = hl
            record["highlights_source"] = fields["highlights"].get("source_url")
        age = _extract_age(fields.get("age"))
        if age is None:
            age = _age_from_dob(fields.get("date_of_birth"))
            if age is not None:
                record["age_derived_from_dob"] = True
        if age is not None:
            record["age"] = age
        candidates.append(record)

    # ---------- stats ----------
    stats: dict[str, Any] = {}
    stats["total_candidates"] = len(candidates)
    stats["coverage"] = {}
    coverage_fields = set(_FIELD_ORDER) | {"name_en", "name_gr"}
    for field in coverage_fields:
        n = sum(1 for c in candidates if c["fields"].get(field, {}).get("value"))
        stats["coverage"][field] = {
            "count": n,
            "percentage": round(100 * n / max(1, len(candidates)), 1),
        }

    by_party = Counter(c["party"] for c in candidates)
    by_district = Counter(c["district"] or "UNKNOWN" for c in candidates)
    by_gender: Counter[str] = Counter()
    for c in candidates:
        g = c["fields"].get("gender", {}).get("value") or "?"
        by_gender[g.upper()[:1] or "?"] += 1
    stats["by_party"] = dict(by_party)
    stats["by_district"] = dict(by_district)
    stats["by_gender"] = dict(by_gender)

    cluster_counter: Counter[str] = Counter()
    for c in candidates:
        lab = c["fields"].get("profession_cluster", {}).get("value")
        if lab:
            cluster_counter[lab] += 1
    stats["by_cluster"] = dict(cluster_counter)

    ages = [c["age"] for c in candidates if "age" in c]
    if ages:
        bins = [(20, 29), (30, 39), (40, 49), (50, 59), (60, 69), (70, 89)]
        buckets = []
        for lo, hi in bins:
            count = sum(1 for a in ages if lo <= a <= hi)
            buckets.append({"range": f"{lo}–{hi}", "count": count})
        stats["age_histogram"] = {
            "buckets": buckets,
            "median": sorted(ages)[len(ages) // 2],
            "mean": round(sum(ages) / len(ages), 1),
            "n": len(ages),
        }
    else:
        stats["age_histogram"] = {"buckets": [], "n": 0}

    # party × platform digital-footprint heatmap
    platforms = list(_SOCIAL_FIELDS)
    heatmap: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    party_totals: Counter[str] = Counter()
    for c in candidates:
        party_totals[c["party"]] += 1
        for p in platforms:
            if c["fields"].get(p, {}).get("value"):
                heatmap[c["party"]][p] += 1
    stats["digital_footprint"] = {
        "platforms": platforms,
        "parties": sorted(party_totals.keys()),
        "matrix": {p: dict(v) for p, v in heatmap.items()},
        "party_totals": dict(party_totals),
    }

    # avg age by party
    age_by_party: dict[str, list[int]] = defaultdict(list)
    for c in candidates:
        if "age" in c:
            age_by_party[c["party"]].append(c["age"])
    stats["avg_age_by_party"] = {
        p: round(sum(v) / len(v), 1) for p, v in age_by_party.items() if v
    }

    # district × party (for per-party district-coverage heatmap)
    district_party: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for c in candidates:
        district_party[c["party"]][c["district"] or "UNKNOWN"] += 1
    stats["district_party_matrix"] = {p: dict(v) for p, v in district_party.items()}

    # source-kind distribution across all field_values
    stats["source_kinds"] = {
        r["kind"]: r["n"]
        for r in conn.execute(
            """SELECT s.kind AS kind, COUNT(*) AS n
                 FROM field_values fv JOIN sources s ON s.id = fv.source_id
             GROUP BY s.kind ORDER BY n DESC"""
        )
    }

    # row-confidence histogram
    conf_buckets = [(0.0, 0.3, "low"), (0.3, 0.6, "mid"), (0.6, 0.85, "good"), (0.85, 1.01, "high")]
    conf_hist = []
    for lo, hi, label in conf_buckets:
        n = sum(1 for c in candidates if lo <= c["row_confidence"] < hi)
        conf_hist.append({"label": label, "range": f"{lo}–{hi}", "count": n})
    stats["row_confidence_histogram"] = conf_hist

    # ---------- history ----------
    history: list[dict[str, Any]] = []
    for r in conn.execute(
        """SELECT candidate_id, name_en, name_gr, year, party_code, party_label,
                  district_code, votes, elected, source_url
             FROM historical_results
            ORDER BY candidate_id NULLS LAST, year"""
    ):
        history.append({
            "candidate_id": r["candidate_id"],
            "name_en": r["name_en"],
            "name_gr": r["name_gr"],
            "year": r["year"],
            "party_code": r["party_code"],
            "party_label": r["party_label"],
            "district_code": r["district_code"],
            "votes": r["votes"],
            "elected": bool(r["elected"]),
            "source_url": r["source_url"],
        })

    # ---------- meta ----------
    total_sources = conn.execute("SELECT COUNT(*) AS n FROM sources").fetchone()["n"]
    last_fetch = conn.execute(
        "SELECT MAX(fetched_at) AS f FROM sources"
    ).fetchone()["f"]

    party_labels = {
        p.code: {"en": p.name_en, "gr": p.name_gr} for p in cfg.parties
    }
    district_labels = {
        d.code: {"en": d.name_en, "gr": d.name_gr} for d in cfg.districts
    }

    meta = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "total_candidates": len(candidates),
        "total_sources": total_sources,
        "last_ingest_at": last_fetch,
        "disclaimer": DISCLAIMER,
        "election_date": "2026-05-24",
        "field_order": _FIELD_ORDER,
        "party_codes": sorted(by_party.keys()),
        "district_codes": sorted(set(by_district.keys()) - {"UNKNOWN"}),
        "party_labels": party_labels,
        "district_labels": district_labels,
    }
    if cfg.google_sheets.enabled and cfg.google_sheets.sheet_id:
        meta["correction_sheet_url"] = (
            f"https://docs.google.com/spreadsheets/d/{cfg.google_sheets.sheet_id}/edit"
        )

    payloads = {
        "candidates.json": json.dumps(candidates, ensure_ascii=False, indent=1),
        "stats.json": json.dumps(stats, ensure_ascii=False, indent=2),
        "history.json": json.dumps(history, ensure_ascii=False, indent=1),
        "meta.json": json.dumps(meta, ensure_ascii=False, indent=2),
    }
    for name, body in payloads.items():
        (out_dir / name).write_text(body, encoding="utf-8")

    # Also mirror into the built dashboard bundle (dashboard/dist/data) if it
    # exists, so a DB refresh is reflected without rebuilding the frontend.
    dist_dir = cfg.root / DASHBOARD_DIST_DATA_DIR
    if dist_dir.parent.exists():
        dist_dir.mkdir(parents=True, exist_ok=True)
        for name, body in payloads.items():
            (dist_dir / name).write_text(body, encoding="utf-8")
        log.info("dashboard export: mirrored → %s", dist_dir)

    log.info(
        "dashboard export: %d candidates, %d history rows → %s",
        len(candidates), len(history), out_dir,
    )
    return out_dir
