# Cyprus May 2026 Parliamentary Elections — Candidate Database

Re-runnable, resumable pipeline that builds a single database of all candidates
for the Cyprus parliamentary elections on **24 May 2026** with per-field
provenance and a per-row confidence score. Storage: SQLite (source of truth)
plus optional Airtable mirror and CSV exports.

Full plan: `/Users/la6387/.claude/plans/go-out-there-and-wise-knuth.md`.

## Quick start

```bash
cd /Users/la6387/PolisMetrics/cyprus-elections-May-2026
cp .env.example .env                 # fill in OPENROUTER_API_KEY (and optionally AIRTABLE_*)
uv sync                              # or: pip install -e .
uv run cyprus-elections run          # ingest → merge → validate → export
```

## Commands

```bash
uv run cyprus-elections init-db                # create schema (idempotent)
uv run cyprus-elections ingest                 # scrape all enabled parties
uv run cyprus-elections ingest --only-party VOLT
uv run cyprus-elections ingest --restart       # force re-ingest
uv run cyprus-elections merge                  # dedupe → candidates + field_values
uv run cyprus-elections validate               # rules + confidence + report
uv run cyprus-elections export --format csv    # writes data/exports/candidates.csv
uv run cyprus-elections export --format airtable
uv run cyprus-elections run --airtable         # end-to-end
uv run cyprus-elections status                 # counts + run_state
```

## Configuration

- `config/config.yaml` — paths, fetch rate limits, LLM settings, confidence model.
- `config/parties.yaml` — one entry per party with `scraper`, `enabled`, `seed_urls`.
- `config/districts.yaml` — 6 Cyprus districts + Greek/English aliases.
- `.env` — `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`.

## Where the data lives

```
data/
├── candidates.db          # SQLite source of truth (schema in src/cyprus_elections/db.py)
├── raw/<bucket>/<host>/<YYYY-MM-DD>/<hash>.html    # cached HTTP bodies
├── processed/             # normalized per-source JSONL (future)
└── exports/
    ├── candidates.csv              # wide, one row per candidate + confidence columns
    ├── candidates_detailed.csv     # long, one row per (candidate, field, source)
    └── validation_report.md
```

## Resuming / re-running

- Every fetch is cached to disk (TTL = 7 days). Re-runs hit the cache unless
  expired; no upstream load.
- Every stage writes to `run_state`; `--resume` (default) skips `status='ok'`
  keys. `--restart` forces re-runs.
- Failures set `status='error'` with the exception message.

## Confidence scoring

Per-field: `source_trust × agreement_boost × plausibility`, tunable in
`config/config.yaml → confidence`. Row confidence is a weighted mean over the
row-weighted fields (name/party/district/age/education/career/social/...).
Candidates with row confidence < 0.6 are flagged in `validation_report.md`.

## Status (initial scaffold — M1)

Working:
- Config, DB schema, state, polite fetch client with per-host rate limiting
  and disk cache.
- Scrapers for **Volt** and **AKEL** (both read today's list).
- Merge with name-key dedup across GR/EN, heuristic gender from Greek
  first-name endings, materialized `candidate_current`.
- Validation rules (age range, URL shapes, missing names) + row confidence +
  markdown report.
- CSV exports (wide + detailed) and Airtable upsert (gated on env vars).

To do: scrapers for DISY / DIKO / DIPA / ELAM / EDEK / KOSP / ALMA /
Direct Democracy, news-aggregator fallback, enrichment (Wikipedia / Wikidata /
web search / LinkedIn / LLM), official MoI scraper post-May-6.
