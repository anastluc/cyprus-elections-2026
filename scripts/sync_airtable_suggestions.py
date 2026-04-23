#!/usr/bin/env python3
"""Airtable → SQLite curation sync.

Subcommands:
    setup   Create Suggestions-table fields in Airtable (run once).
    pull    Pull approved suggestions into SQLite, rebuild exports, mark applied.

Examples:
    uv run python scripts/sync_airtable_suggestions.py setup
    uv run python scripts/sync_airtable_suggestions.py pull
    uv run python scripts/sync_airtable_suggestions.py pull --skip-exports
"""
from __future__ import annotations

import argparse
import logging
import sys

from cyprus_elections.config import load_config
from cyprus_elections.curation.airtable_sync import pull_approved, setup_schema
from cyprus_elections.db import connect, init_db
from cyprus_elections.export import airtable as airtable_mod
from cyprus_elections.export import csv as csv_mod
from cyprus_elections.export import dashboard as dashboard_mod


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("setup", help="Create Suggestions table fields in Airtable.")
    p_pull = sub.add_parser("pull", help="Pull approved suggestions into SQLite.")
    p_pull.add_argument(
        "--skip-exports",
        action="store_true",
        help="Skip CSV / dashboard / Airtable mirror regeneration.",
    )
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s  %(levelname)s  %(message)s",
        datefmt="%H:%M:%S",
    )

    cfg = load_config()

    if args.cmd == "setup":
        result = setup_schema(cfg)
        print(f"setup: {result}")
        return 0

    if args.cmd == "pull":
        init_db(cfg.db_path)
        with connect(cfg.db_path) as conn:
            stats = pull_approved(cfg, conn)
            print(f"pull: {stats}")
            if not args.skip_exports and stats["applied"] > 0:
                print(f"csv wide:     {csv_mod.export_wide(cfg, conn)}")
                print(f"csv detailed: {csv_mod.export_detailed(cfg, conn)}")
                print(f"dashboard:    {dashboard_mod.export(cfg, conn)}")
                print(f"airtable:     {airtable_mod.mirror(cfg, conn)}")
        return 0

    return 2


if __name__ == "__main__":
    sys.exit(main())
