"""Historical Cyprus parliamentary-election results (2001–2021).

Populates the `historical_results` table with one row per (candidate, year,
party) tuple, whether they were elected, their vote count if known, and
the source URL. The dashboard consumes this via export/dashboard.py to
render the per-candidate timeline matrix.
"""
from cyprus_elections.historical.run import run as run  # re-export
