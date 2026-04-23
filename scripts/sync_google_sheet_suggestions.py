#!/usr/bin/env python3
"""Google Sheets → SQLite curation sync.

Model: the Candidates tab in the Google Sheet is the source of truth. Humans
leave cell comments; a curator approves changes by editing the cell values.
This script diffs every (candidate_id, field) cell against the SQLite DB and
writes every curator-edited cell back as a high-trust kind='curator' source
so it wins in candidate_current. Then it regenerates the CSV, dashboard JSON
bundle, and (if enabled) the Airtable mirror.

Edits to name_gr / name_en / party / district also update the canonical
columns on the `candidates` table so the dashboard fallback picks them up.

Empty cells are left alone (no automatic deletion). Rows with a
candidate_id not present in SQLite are skipped with a warning.

Prereqs: service account JSON key + sheet shared with the SA email as Editor
+ GOOGLE_SERVICE_ACCOUNT_JSON in .env + google_sheets section in config.yaml.

Usage:
    uv run python scripts/sync_google_sheet_suggestions.py
    uv run python scripts/sync_google_sheet_suggestions.py --skip-exports
"""
from __future__ import annotations

import argparse
import logging
import sys

from cyprus_elections.config import load_config
from cyprus_elections.curation.gsheet_sync import pull_candidates_edits
from cyprus_elections.db import connect, init_db
from cyprus_elections.export import airtable as airtable_mod
from cyprus_elections.export import csv as csv_mod
from cyprus_elections.export import dashboard as dashboard_mod


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--skip-exports",
        action="store_true",
        help="Skip regenerating CSV / dashboard / Airtable mirror after pulling.",
    )
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s  %(levelname)s  %(message)s",
        datefmt="%H:%M:%S",
    )

    cfg = load_config()
    init_db(cfg.db_path)
    with connect(cfg.db_path) as conn:
        stats = pull_candidates_edits(cfg, conn)
        print(f"pull: {stats}")
        if not args.skip_exports and stats["updated_fields"] > 0:
            print(f"csv wide:     {csv_mod.export_wide(cfg, conn)}")
            print(f"csv detailed: {csv_mod.export_detailed(cfg, conn)}")
            print(f"dashboard:    {dashboard_mod.export(cfg, conn)}")
            if cfg.airtable.enabled:
                print(f"airtable:     {airtable_mod.mirror(cfg, conn)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
