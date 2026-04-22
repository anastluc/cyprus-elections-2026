# Cyprus 2026 · Candidate Atlas

Single-page React + Vite dashboard on top of the `cyprus-elections` pipeline.

## Develop

```
cd dashboard
npm install
npm run dev           # http://localhost:5173
```

## Refresh data

The SPA reads four JSON bundles from `public/data/`. Regenerate them from the
SQLite DB at any time:

```
uv run cyprus-elections export --format dashboard
```

That writes `candidates.json`, `stats.json`, `history.json`, `meta.json`.

The pipeline stages that feed those bundles:

- `cyprus-elections enrich --source professions` → LLM clusters free-text
  profession/sector into 15 categories.
- `cyprus-elections enrich --source highlights` → LLM extracts up to 4
  "remarkable mentions" per candidate from their CV or bio.
- `cyprus-elections historical ingest` → LLM with web search fills the
  `historical_results` table for 2001 – 2021.

## Build

```
npm run build         # outputs dist/
npm run preview       # serves dist/ at http://localhost:4173
```

## Pages

1. **Overview** — KPIs, Cyprus map (click district to filter), party pie.
2. **Demographics** — gender, age histogram, district bars, avg age per party.
3. **Parties** — per-party cards, stacked gender bars, district × party heatmap.
4. **Professions** — treemap of LLM-clustered career categories, top 12 titles.
5. **Digital footprint** — platform coverage, party × platform heatmap.
6. **Highlights** — CV/bio-derived remarkable mentions, filterable by party.
7. **Timeline** — returning candidates × past elections (2001 – 2026), ✓/✗ cells.
8. **Explorer** — every candidate, every field, with a provenance pill per value.
9. **Data quality** — confidence histogram, source-kind breakdown, coverage.

## Notes

- Always dark-mode.
- No backend required at runtime — four static JSON files only.
- A dismissible banner makes the AI-assisted-data caveat visible on first load.
- Every value links to its original source URL.
