#!/usr/bin/env bash
# Run the full pipeline with resume semantics.
set -euo pipefail
cd "$(dirname "$0")/.."
uv run cyprus-elections init-db
uv run cyprus-elections ingest   "$@"
uv run cyprus-elections merge
uv run cyprus-elections validate
uv run cyprus-elections export --format csv
