import { useState } from 'react';
import { SectionHeader } from '../components/SectionHeader';
import { TimelineMatrix } from '../components/TimelineMatrix';
import type { Dataset } from '../data/types';
import { useT } from '../lib/i18n';

type SortKey = 'first-year' | 'party' | 'total-votes' | 'name';

export function Timeline({ data }: { data: Dataset }) {
  const t = useT();
  const [sort, setSort] = useState<SortKey>('first-year');

  const covered = new Set(
    data.history.filter((h) => h.candidate_id != null).map((h) => h.candidate_id!)
  );

  const sortLabels: Record<SortKey, string> = {
    'first-year': t('timeline_sort_first_year'),
    party: t('timeline_sort_party'),
    'total-votes': t('timeline_sort_votes'),
    name: t('timeline_sort_name'),
  };

  return (
    <div>
      <SectionHeader
        eyebrow={t('timeline_eyebrow')}
        title={t('timeline_title')(covered.size)}
        subtitle={
          <>
            {t('timeline_subtitle_1')}
            <em>{t('timeline_subtitle_2_em')}</em>
            {t('timeline_subtitle_3')}
          </>
        }
        action={
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">{t('timeline_sort')}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-slate-200 outline-none"
            >
              {(Object.keys(sortLabels) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {sortLabels[k]}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        {t('timeline_dev_banner')}
      </div>

      <TimelineMatrix
        candidates={data.candidates}
        history={data.history}
        sort={sort}
      />

      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        {t('timeline_footer')}
      </p>
    </div>
  );
}
