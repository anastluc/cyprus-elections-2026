#!/usr/bin/env python3
"""Export SQLite candidates → Google Sheets.

Writes the "Candidates" tab (cleared and rewritten each run) and ensures the
"Suggestions" tab exists with the right headers (existing suggestion rows are
preserved).

Prereqs:
    1. Create a Google Cloud service account, enable Sheets API, download the
       JSON key.
    2. Share the spreadsheet with the service account's email as Editor.
    3. Set GOOGLE_SERVICE_ACCOUNT_JSON in .env to the key file path.
    4. Fill google_sheets.sheet_id + set enabled=true in config/config.yaml.

Usage:
    uv run python scripts/export_to_google_sheet.py
"""
from __future__ import annotations

import argparse
import logging
import sys

from cyprus_elections.config import load_config
from cyprus_elections.curation.gsheet_sync import push_candidates
from cyprus_elections.db import connect, init_db


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
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
        stats = push_candidates(cfg, conn)
    print(f"export: {stats}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
