import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import { SectionHeader } from '../components/SectionHeader';
import { CoverageBar } from '../components/CoverageBar';
import { NIVO_THEME } from '../lib/theme';
import type { Dataset } from '../data/types';
import { CorrectionCTA } from '../components/CorrectionCTA';
import {
  DataSource,
  STATS_SOURCE_LINK,
  PIPELINE_SOURCE_LINK,
} from '../components/DataSource';

const KIND_COLOURS: Record<string, string> = {
  official: '#6366f1',
  party_site: '#8b5cf6',
  news: '#f59e0b',
  wikipedia: '#94a3b8',
  wikidata: '#64748b',
  linkedin: '#0a66c2',
  linkedin_snippet: '#60a5fa',
  search_snippet: '#22d3ee',
  llm_from_bio: '#a855f7',
  heuristic: '#f472b6',
  cv_doc: '#34d399',
  historical_moi: '#fb923c',
  historical_wiki: '#fcd34d',
};

export function DataQuality({ data }: { data: Dataset }) {
  const { stats } = data;
  const total = stats.total_candidates;
  const coverage = Object.entries(stats.coverage).sort(
    (a, b) => b[1].percentage - a[1].percentage
  );
  const kindPie = Object.entries(stats.source_kinds).map(([k, v]) => ({
    id: k,
    label: k,
    value: v,
    color: KIND_COLOURS[k] ?? '#6366f1',
  }));
  const confBars = stats.row_confidence_histogram.map((b) => ({
    bucket: b.label,
    count: b.count,
  }));
  const low = stats.row_confidence_histogram.find((b) => b.label === 'low')?.count ?? 0;

  return (
    <div>
      <SectionHeader
        eyebrow="Data quality"
        title="How confident are we?"
        subtitle={
          <>
            Every value carries a <em>confidence</em> score between 0 and 1, and every
            row carries an aggregate. <span className="font-semibold text-amber-200">{low}</span> rows
            are below the 0.6 threshold — treat those with extra care.
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="card lg:col-span-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Row confidence distribution
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">
            How many rows at each confidence band
          </h3>
          <div className="h-[260px]">
            <ResponsiveBar
              data={confBars}
              theme={NIVO_THEME}
              keys={['count']}
              indexBy="bucket"
              margin={{ top: 8, right: 12, bottom: 36, left: 36 }}
              padding={0.3}
              colors={(b) => {
                const label = (b.data.bucket as string) ?? '';
                if (label === 'low') return '#f43f5e';
                if (label === 'mid') return '#f59e0b';
                if (label === 'good') return '#60a5fa';
                return '#34d399';
              }}
              borderRadius={6}
              enableLabel={false}
              axisBottom={{ tickSize: 0, tickPadding: 6 }}
              axisLeft={{ tickSize: 0, tickPadding: 6 }}
            />
          </div>
        </div>

        <div className="card lg:col-span-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Source taxonomy
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">
            Where values come from
          </h3>
          <div className="h-[260px]">
            <ResponsivePie
              data={kindPie}
              theme={NIVO_THEME}
              colors={(d) => d.data.color}
              innerRadius={0.6}
              padAngle={1.2}
              cornerRadius={4}
              margin={{ top: 8, right: 10, bottom: 8, left: 10 }}
              borderWidth={0}
              enableArcLabels={false}
              arcLinkLabelsTextColor="#cbd5e1"
              arcLinkLabelsColor={{ from: 'color' }}
              arcLinkLabelsThickness={1}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 card">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
          Coverage per field
        </div>
        <h3 className="mb-3 text-lg font-semibold text-white">
          Which fields we have, which we don't
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {coverage.map(([field, cov]) => (
            <CoverageBar
              key={field}
              label={field.replace(/_/g, ' ')}
              count={cov.count}
              total={total}
              accent={cov.percentage >= 75 ? '#34d399' : cov.percentage >= 50 ? '#60a5fa' : '#f59e0b'}
            />
          ))}
        </div>
      </div>

      <div className="mt-6">
        <CorrectionCTA variant="card" />
      </div>

      <DataSource
        summary="Coverage, source-kind mix, and the row-confidence distribution come from the stats aggregate. The 'source kind' field on each candidate value is what these charts roll up."
        sources={[STATS_SOURCE_LINK, PIPELINE_SOURCE_LINK]}
        generatedAt={data.meta.generated_at}
      />
    </div>
  );
}
