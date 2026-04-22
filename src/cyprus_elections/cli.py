from __future__ import annotations

import logging

import typer
from rich.console import Console
from rich.logging import RichHandler
from rich.table import Table

from cyprus_elections import ingest as ingest_mod
from cyprus_elections import merge as merge_mod
from cyprus_elections import validate as validate_mod
from cyprus_elections.enrich import cv_text as enrich_cv_text
from cyprus_elections.enrich import highlights as enrich_highlights
from cyprus_elections.enrich import llm_extract as enrich_llm_extract
from cyprus_elections.enrich import professions as enrich_professions
from cyprus_elections.enrich import social_discovery as enrich_social
from cyprus_elections.enrich import web_search as enrich_web_search
from cyprus_elections.enrich import wikipedia as enrich_wikipedia
from cyprus_elections.config import load_config
from cyprus_elections.db import connect, init_db
from cyprus_elections.export import airtable as airtable_mod
from cyprus_elections.export import csv as csv_mod
from cyprus_elections.export import dashboard as dashboard_mod
from cyprus_elections.historical import run as historical_run_mod  # noqa: F401
from cyprus_elections.historical import match as historical_match
from cyprus_elections.historical.run import YEARS as HISTORICAL_YEARS, ingest as historical_ingest
from cyprus_elections.state import clear_stage

app = typer.Typer(help="Cyprus 2026 parliamentary elections candidate pipeline.")
console = Console()


def _setup_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(message)s",
        datefmt="[%X]",
        handlers=[RichHandler(rich_tracebacks=True, show_path=False)],
    )


@app.callback()
def _root(
    verbose: bool = typer.Option(False, "--verbose", "-v", help="DEBUG logging."),
):
    _setup_logging(verbose)


@app.command(name="init-db")
def init_db_cmd() -> None:
    """Create the SQLite schema (idempotent)."""
    cfg = load_config()
    init_db(cfg.db_path)
    console.print(f"[green]initialized[/green] {cfg.db_path}")


@app.command()
def ingest(
    only_party: str = typer.Option(None, "--only-party", help="Party code (e.g. VOLT, AKEL)."),
    restart: bool = typer.Option(False, "--restart", help="Re-run even parties marked ok."),
) -> None:
    """Scrape configured party sites into raw_records."""
    cfg = load_config()
    init_db(cfg.db_path)
    with connect(cfg.db_path) as conn:
        stats = ingest_mod.run_sync(cfg, conn, only_party=only_party, restart=restart)

    table = Table(title="Ingested")
    table.add_column("party")
    table.add_column("new raw rows", justify="right")
    for party, count in stats.items():
        table.add_row(party, str(count))
    console.print(table)


@app.command()
def merge(
    restart: bool = typer.Option(False, "--restart"),
) -> None:
    """Dedupe raw_records into candidates and populate field_values + candidate_current."""
    cfg = load_config()
    init_db(cfg.db_path)
    with connect(cfg.db_path) as conn:
        if restart:
            clear_stage(conn, "merge")
            conn.commit()
        stats = merge_mod.run(cfg, conn)
    console.print(f"[green]merge[/green] → {stats}")


@app.command()
def validate(
    report: bool = typer.Option(True, "--report/--no-report"),
) -> None:
    """Run validation rules + compute row confidence."""
    cfg = load_config()
    init_db(cfg.db_path)
    with connect(cfg.db_path) as conn:
        stats = validate_mod.run(cfg, conn)
        path = validate_mod.write_report(cfg, conn) if report else None
    console.print(f"[green]validate[/green] → {stats}")
    if path:
        console.print(f"report: {path}")


@app.command()
def enrich(
    source: str = typer.Option("wikipedia", "--source", help="wikipedia|llm_extract|all."),
    restart: bool = typer.Option(False, "--restart"),
) -> None:
    """Enrich candidates with external data (Wikipedia/Wikidata, etc.)."""
    cfg = load_config()
    init_db(cfg.db_path)
    with connect(cfg.db_path) as conn:
        if source == "wikipedia":
            stats = enrich_wikipedia.run(cfg, conn, restart=restart)
        elif source == "llm_extract":
            stats = enrich_llm_extract.run(cfg, conn, restart=restart)
        elif source == "social":
            stats = enrich_social.run(cfg, conn, restart=restart)
        elif source == "web_search":
            stats = enrich_web_search.run(cfg, conn, restart=restart)
        elif source == "social_active":
            stats = enrich_social.run_active(cfg, conn, restart=restart)
        elif source == "cv_text":
            stats = enrich_cv_text.run(cfg, conn, restart=restart)
        elif source == "professions":
            stats = enrich_professions.run(cfg, conn, restart=restart)
        elif source == "highlights":
            stats = enrich_highlights.run(cfg, conn, restart=restart)
        elif source == "all":
            stats = {
                "wikipedia": enrich_wikipedia.run(cfg, conn, restart=restart),
                "llm_extract": enrich_llm_extract.run(cfg, conn, restart=restart),
                "social": enrich_social.run(cfg, conn, restart=restart),
                "web_search": enrich_web_search.run(cfg, conn, restart=restart),
                "social_active": enrich_social.run_active(cfg, conn, restart=restart),
                "cv_text": enrich_cv_text.run(cfg, conn, restart=restart),
                "professions": enrich_professions.run(cfg, conn, restart=restart),
                "highlights": enrich_highlights.run(cfg, conn, restart=restart),
            }
        else:
            raise typer.BadParameter(f"unknown source: {source}")
    console.print(f"[green]enrich {source}[/green] → {stats}")


@app.command()
def export(
    fmt: str = typer.Option("csv", "--format", help="csv|airtable|dashboard|both|all"),
) -> None:
    """Export to CSV / Airtable / Dashboard JSON bundles."""
    cfg = load_config()
    init_db(cfg.db_path)
    with connect(cfg.db_path) as conn:
        if fmt in ("csv", "both", "all"):
            wide = csv_mod.export_wide(cfg, conn)
            detailed = csv_mod.export_detailed(cfg, conn)
            console.print(f"[green]csv[/green] {wide}")
            console.print(f"[green]csv[/green] {detailed}")
        if fmt in ("airtable", "both", "all"):
            result = airtable_mod.mirror(cfg, conn)
            console.print(f"[green]airtable[/green] {result}")
        if fmt in ("dashboard", "all"):
            out = dashboard_mod.export(cfg, conn)
            console.print(f"[green]dashboard[/green] {out}")


@app.command()
def historical(
    action: str = typer.Argument("ingest", help="ingest | rematch"),
    year: int = typer.Option(None, "--year", help="Single year to fetch (default: all)."),
    restart: bool = typer.Option(False, "--restart", help="Drop existing rows for that year first."),
) -> None:
    """Historical Cyprus parliamentary-election results (2001-2021)."""
    cfg = load_config()
    init_db(cfg.db_path)
    with connect(cfg.db_path) as conn:
        if action == "ingest":
            years = (year,) if year else HISTORICAL_YEARS
            stats = historical_ingest(cfg, conn, years=years, restart=restart)
            console.print(f"[green]historical ingest[/green] {stats}")
        elif action == "rematch":
            stats = historical_match.rematch(conn)
            console.print(f"[green]historical rematch[/green] {stats}")
        else:
            raise typer.BadParameter(f"unknown action: {action}")


@app.command(name="airtable-setup")
def airtable_setup_cmd() -> None:
    """Create the Airtable Candidates-table schema (fields) via metadata API."""
    cfg = load_config()
    result = airtable_mod.setup_schema(cfg)
    console.print(f"[green]airtable-setup[/green] → {result}")


@app.command()
def run(
    only_party: str = typer.Option(None, "--only-party"),
    restart: bool = typer.Option(False, "--restart"),
    airtable: bool = typer.Option(False, "--airtable", help="Also mirror to Airtable."),
    skip_enrich: bool = typer.Option(
        False, "--skip-enrich", help="Skip Wikipedia/LLM/web-search/social enrichment stages."
    ),
) -> None:
    """Run the full pipeline: ingest → merge → enrich → validate → export."""
    cfg = load_config()
    init_db(cfg.db_path)
    with connect(cfg.db_path) as conn:
        stats_ingest = ingest_mod.run_sync(cfg, conn, only_party=only_party, restart=restart)
        console.print(f"[cyan]ingest[/cyan] {stats_ingest}")
        if restart:
            clear_stage(conn, "merge")
            conn.commit()
        stats_merge = merge_mod.run(cfg, conn)
        console.print(f"[cyan]merge[/cyan] {stats_merge}")

        if not skip_enrich:
            console.print(
                f"[cyan]enrich:wikipedia[/cyan] "
                f"{enrich_wikipedia.run(cfg, conn, restart=restart)}"
            )
            console.print(
                f"[cyan]enrich:llm_extract[/cyan] "
                f"{enrich_llm_extract.run(cfg, conn, restart=restart)}"
            )
            console.print(
                f"[cyan]enrich:social[/cyan] "
                f"{enrich_social.run(cfg, conn, restart=restart)}"
            )
            console.print(
                f"[cyan]enrich:web_search[/cyan] "
                f"{enrich_web_search.run(cfg, conn, restart=restart)}"
            )
            console.print(
                f"[cyan]enrich:social_active[/cyan] "
                f"{enrich_social.run_active(cfg, conn, restart=restart)}"
            )
            # Re-run social discovery (bio-scan) after web_search may have added bios/urls.
            console.print(
                f"[cyan]enrich:social (re-scan)[/cyan] "
                f"{enrich_social.run(cfg, conn, restart=True)}"
            )
            # Rebuild candidate_current so cv_text sees cv_urls added by
            # llm_extract / web_search (they write field_values directly).
            merge_mod._rebuild_current(conn)
            conn.commit()
            console.print(
                f"[cyan]enrich:cv_text[/cyan] "
                f"{enrich_cv_text.run(cfg, conn, restart=restart)}"
            )
            console.print(
                f"[cyan]enrich:professions[/cyan] "
                f"{enrich_professions.run(cfg, conn, restart=restart)}"
            )
            console.print(
                f"[cyan]enrich:highlights[/cyan] "
                f"{enrich_highlights.run(cfg, conn, restart=restart)}"
            )
            console.print(
                f"[cyan]historical[/cyan] "
                f"{historical_ingest(cfg, conn, restart=False)}"
            )
            # Merge rebuilds candidate_current as it writes, but enrichment
            # inserts new field_values directly — nudge the current table so
            # validate and exports see them.
            merge_mod._rebuild_current(conn)
            conn.commit()

        stats_val = validate_mod.run(cfg, conn)
        console.print(f"[cyan]validate[/cyan] {stats_val}")
        validate_mod.write_report(cfg, conn)
        wide = csv_mod.export_wide(cfg, conn)
        detailed = csv_mod.export_detailed(cfg, conn)
        console.print(f"[cyan]csv[/cyan] {wide} / {detailed}")
        dash_out = dashboard_mod.export(cfg, conn)
        console.print(f"[cyan]dashboard[/cyan] {dash_out}")
        if airtable:
            console.print(f"[cyan]airtable[/cyan] {airtable_mod.mirror(cfg, conn)}")


@app.command()
def status() -> None:
    """Show counts and run-state for debugging."""
    cfg = load_config()
    init_db(cfg.db_path)
    with connect(cfg.db_path) as conn:
        for table_name in ("sources", "raw_records", "candidates", "field_values",
                           "candidate_current", "validation_issues", "row_confidence"):
            n = conn.execute(f"SELECT COUNT(*) AS n FROM {table_name}").fetchone()["n"]
            console.print(f"{table_name:20} {n}")
        console.print("")
        console.print("[bold]run_state[/bold]")
        for row in conn.execute("SELECT stage, key, status, attempts, updated_at FROM run_state ORDER BY stage, key"):
            console.print(
                f"  {row['stage']:8}  {row['key']:16}  {row['status']:6}  a={row['attempts']}  {row['updated_at']}"
            )


if __name__ == "__main__":
    app()
