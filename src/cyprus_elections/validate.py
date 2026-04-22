from __future__ import annotations

import logging
import re
import sqlite3
from datetime import datetime

from cyprus_elections.config import AppConfig
from cyprus_elections.db import transaction

log = logging.getLogger(__name__)

STAGE = "validate"

_URL_RE = re.compile(r"^https?://[^\s<>\"]+$")
_SOCIAL_HOSTS = {
    "facebook": "facebook.com",
    "twitter": ("twitter.com", "x.com"),
    "instagram": "instagram.com",
    "linkedin": "linkedin.com",
}


def _log_issue(
    conn: sqlite3.Connection, candidate_id: int | None, severity: str, rule: str, message: str
) -> None:
    conn.execute(
        "INSERT INTO validation_issues (candidate_id, severity, rule, message, created_at) VALUES (?, ?, ?, ?, ?)",
        (candidate_id, severity, rule, message, datetime.utcnow().isoformat()),
    )


def _plausible_age(value: str) -> tuple[bool, str | None]:
    try:
        age = int(float(value))
    except (TypeError, ValueError):
        return False, "age not numeric"
    if not (21 <= age <= 100):
        return False, f"age {age} out of plausible range 21–100"
    return True, None


def _plausible_url(value: str) -> bool:
    return bool(_URL_RE.match(value))


def _plausible_social(field: str, value: str) -> bool:
    if not _plausible_url(value):
        return False
    expected = _SOCIAL_HOSTS.get(field)
    if expected is None:
        return True
    value_l = value.lower()
    if isinstance(expected, tuple):
        return any(h in value_l for h in expected)
    return expected in value_l


def run(cfg: AppConfig, conn: sqlite3.Connection) -> dict[str, int]:
    stats = {"issues": 0, "candidates": 0, "low_confidence": 0}
    known_districts = {d.code for d in cfg.districts}
    known_parties = {p.code for p in cfg.parties}

    with transaction(conn):
        conn.execute("DELETE FROM validation_issues")
        conn.execute("DELETE FROM row_confidence")

        cand_rows = conn.execute("SELECT id, party_code, district_code FROM candidates").fetchall()
        stats["candidates"] = len(cand_rows)

        for cand in cand_rows:
            cid = cand["id"]

            if cand["party_code"] not in known_parties:
                _log_issue(conn, cid, "error", "unknown_party", f"party_code={cand['party_code']}")
                stats["issues"] += 1
            if cand["district_code"] and cand["district_code"] not in known_districts:
                _log_issue(
                    conn,
                    cid,
                    "error",
                    "unknown_district",
                    f"district_code={cand['district_code']}",
                )
                stats["issues"] += 1

            fields = {
                r["field"]: (r["best_value"], r["field_confidence"])
                for r in conn.execute(
                    "SELECT field, best_value, field_confidence FROM candidate_current WHERE candidate_id = ?",
                    (cid,),
                )
            }

            if "name_gr" not in fields and "name_en" not in fields:
                _log_issue(conn, cid, "error", "missing_name", "no name_gr or name_en")
                stats["issues"] += 1

            if "age" in fields:
                ok, msg = _plausible_age(fields["age"][0])
                if not ok:
                    _log_issue(conn, cid, "warning", "implausible_age", msg or "")
                    stats["issues"] += 1

            for social in ("facebook", "twitter", "instagram", "linkedin", "website", "cv_url"):
                if social in fields:
                    val = fields[social][0]
                    if social in _SOCIAL_HOSTS:
                        if not _plausible_social(social, val):
                            _log_issue(
                                conn,
                                cid,
                                "warning",
                                "implausible_social_url",
                                f"{social}={val}",
                            )
                            stats["issues"] += 1
                    else:
                        if not _plausible_url(val):
                            _log_issue(conn, cid, "warning", "bad_url", f"{social}={val}")
                            stats["issues"] += 1

            # Row confidence: weighted mean over logical buckets, where each
            # bucket maps to one or more actual stored fields. Highest-confidence
            # value among aliases counts.
            alias_groups: dict[str, list[str]] = {
                "name": ["name_gr", "name_en"],
                "party": ["party"],
                "district": ["district"],
                "gender": ["gender"],
                "age": ["age", "date_of_birth"],
                "education": ["education"],
                "career": ["career_previous", "profession"],
                "sector": ["sector"],
                "cv": ["cv_url", "cv_text"],
                "facebook": ["facebook"],
                "twitter": ["twitter"],
                "instagram": ["instagram"],
                "linkedin": ["linkedin"],
                "website": ["website"],
                "wikipedia": ["wikipedia", "wikidata_qid"],
            }
            weights = cfg.confidence.row_weights
            weighted_sum = 0.0
            weight_total = 0.0
            for bucket, weight in weights.items():
                aliases = alias_groups.get(bucket, [bucket])
                best_conf = 0.0
                for alias in aliases:
                    if alias in fields:
                        best_conf = max(best_conf, fields[alias][1])
                weighted_sum += weight * best_conf
                weight_total += weight
            row_conf = (weighted_sum / weight_total) if weight_total else 0.0
            conn.execute(
                "INSERT INTO row_confidence (candidate_id, row_confidence, computed_at) VALUES (?, ?, ?)",
                (cid, round(row_conf, 4), datetime.utcnow().isoformat()),
            )
            if row_conf < cfg.confidence.low_confidence_threshold:
                stats["low_confidence"] += 1
                _log_issue(
                    conn,
                    cid,
                    "info",
                    "low_row_confidence",
                    f"row_confidence={row_conf:.3f} < {cfg.confidence.low_confidence_threshold}",
                )
                stats["issues"] += 1

    conn.commit()
    return stats


def write_report(cfg: AppConfig, conn: sqlite3.Connection) -> str:
    path = cfg.exports_dir / "validation_report.md"
    lines: list[str] = []
    lines.append("# Validation report")
    lines.append("")
    lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
    lines.append("")

    counts = dict(
        conn.execute(
            "SELECT severity, COUNT(*) AS n FROM validation_issues GROUP BY severity"
        ).fetchall()
    )
    lines.append("## Issues by severity")
    for sev in ("error", "warning", "info"):
        lines.append(f"- {sev}: {int(counts.get(sev, 0))}")
    lines.append("")

    lines.append("## Row-confidence distribution")
    buckets = [(0.0, 0.2), (0.2, 0.4), (0.4, 0.6), (0.6, 0.8), (0.8, 1.01)]
    for lo, hi in buckets:
        n = conn.execute(
            "SELECT COUNT(*) AS n FROM row_confidence WHERE row_confidence >= ? AND row_confidence < ?",
            (lo, hi),
        ).fetchone()["n"]
        lines.append(f"- [{lo:.1f}, {hi:.2f}): {int(n)}")
    lines.append("")

    lines.append("## Low-confidence candidates (<0.6)")
    rows = conn.execute(
        """SELECT c.id, c.canonical_name_gr, c.canonical_name_en, c.party_code, c.district_code, rc.row_confidence
           FROM row_confidence rc
           JOIN candidates c ON c.id = rc.candidate_id
           WHERE rc.row_confidence < 0.6
           ORDER BY rc.row_confidence ASC"""
    ).fetchall()
    if not rows:
        lines.append("- none")
    for row in rows:
        name = row["canonical_name_en"] or row["canonical_name_gr"]
        lines.append(
            f"- [{row['row_confidence']:.2f}] #{row['id']} {name} — {row['party_code']}/{row['district_code']}"
        )

    path.write_text("\n".join(lines), encoding="utf-8")
    return str(path)
