import { useState } from 'react';
import { SectionHeader } from '../components/SectionHeader';
import { TimelineMatrix } from '../components/TimelineMatrix';
import type { Dataset } from '../data/types';

type SortKey = 'first-year' | 'party' | 'total-votes' | 'name';

const SORT_LABELS: Record<SortKey, string> = {
  'first-year': 'First year running',
  party: 'Party',
  'total-votes': 'Total historical votes',
  name: 'Name',
};

export function Timeline({ data }: { data: Dataset }) {
  const [sort, setSort] = useState<SortKey>('first-year');

  const covered = new Set(
    data.history.filter((h) => h.candidate_id != null).map((h) => h.candidate_id!)
  );

  return (
    <div>
      <SectionHeader
        eyebrow="Historical timeline"
        title={`${covered.size} returning candidates`}
        subtitle={
          <>
            Each row is a person currently on a 2026 slate who also appeared in a past
            parliamentary election. ✓ = elected; ✗ = ran but lost. Cell colour maps to
            the party they stood with <em>that year</em> (parties rebrand and merge).
            Hover for vote counts and sources.
          </>
        }
        action={
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Sort:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-slate-200 outline-none"
            >
              {Object.entries(SORT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <TimelineMatrix
        candidates={data.candidates}
        history={data.history}
        sort={sort}
      />

      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        Pre-2016 historical data is drawn from the Wikipedia records of each
        parliamentary election — it is limited to elected MPs and occasional
        high-profile candidates. The Cyprus Ministry of Interior results portal provides
        per-candidate vote counts for 2016 and 2021 when available. Cells left empty mean
        we do not have a record — not that the candidate did not run.
      </p>
    </div>
  );
}
