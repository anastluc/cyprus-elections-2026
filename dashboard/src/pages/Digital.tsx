import { ResponsiveHeatMap } from '@nivo/heatmap';
import { SectionHeader } from '../components/SectionHeader';
import { CoverageBar } from '../components/CoverageBar';
import { NIVO_THEME, PARTY_ORDER, partyLabel } from '../lib/theme';
import type { Dataset } from '../data/types';
import { useFilters, useUI } from '../lib/store';
import { useT } from '../lib/i18n';

const PLATFORMS = ['facebook', 'twitter', 'instagram', 'linkedin', 'website', 'wikipedia'];
const PLATFORM_COLOURS: Record<string, string> = {
  facebook: '#1877f2',
  twitter: '#e2e8f0',
  instagram: '#e1306c',
  linkedin: '#0a66c2',
  website: '#60a5fa',
  wikipedia: '#cbd5e1',
};

export function Digital({ data }: { data: Dataset }) {
  const { stats } = data;
  const total = stats.total_candidates;
  const setFilters = useFilters((s) => s.setMany);
  const resetFilters = useFilters((s) => s.reset);
  const setSection = useUI((s) => s.setActiveSection);
  const locale = useUI((s) => s.locale);
  const t = useT();

  function openExplorer(patch: { platform?: string | null; party?: string | null }) {
    resetFilters();
    setFilters(patch);
    setSection('explorer');
  }

  const coverage = PLATFORMS.map((p) => {
    const entry = stats.coverage[p] ?? { count: 0, percentage: 0 };
    return { platform: p, ...entry };
  });

  const footprint = stats.digital_footprint;
  const heatParties = PARTY_ORDER.filter((p) =>
    footprint.parties.includes(p) || (stats.by_party[p] ?? 0) > 0
  );
  const heat = heatParties.map((p) => ({
    id: partyLabel(p, locale),
    partyCode: p,
    data: PLATFORMS.map((pl) => ({
      x: pl,
      y: footprint.matrix?.[p]?.[pl] ?? 0,
    })),
  }));

  const topPlatform = [...coverage].sort((a, b) => b.count - a.count)[0];
  const leastPlatform = [...coverage].sort((a, b) => a.count - b.count)[0];

  return (
    <div>
      <SectionHeader
        eyebrow={t('digital_eyebrow')}
        title={t('digital_title')}
        subtitle={
          <>
            {t('digital_subtitle_part1')}
            <span className="font-semibold text-brand-300">
              {t('digital_subtitle_part2')(
                topPlatform?.percentage?.toFixed(0) ?? '0',
                topPlatform?.platform ?? '',
              )}
            </span>
            <span className="font-semibold text-rose-300">
              {t('digital_subtitle_part3')(
                leastPlatform?.percentage?.toFixed(0) ?? '0',
                leastPlatform?.platform ?? '',
              )}
            </span>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="card lg:col-span-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {t('digital_coverage_eyebrow')}
          </div>
          <h3 className="mb-4 text-lg font-semibold text-white">
            {t('digital_coverage_title')}
          </h3>
          <div className="space-y-4">
            {coverage.map((c) => (
              <button
                key={c.platform}
                type="button"
                onClick={() => openExplorer({ platform: c.platform })}
                className="block w-full rounded-lg text-left transition hover:bg-white/[0.03]"
              >
                <CoverageBar
                  label={cap(c.platform)}
                  count={c.count}
                  total={total}
                  accent={PLATFORM_COLOURS[c.platform]}
                />
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">{t('digital_coverage_caption')}</p>
        </div>

        <div className="card lg:col-span-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {t('digital_matrix_eyebrow')}
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">
            {t('digital_matrix_title')}
          </h3>
          <div className="h-[420px]">
            <ResponsiveHeatMap
              data={heat}
              theme={NIVO_THEME}
              margin={{ top: 40, right: 20, bottom: 30, left: 110 }}
              axisTop={{ tickSize: 0, tickPadding: 6 }}
              axisLeft={{ tickSize: 0, tickPadding: 6 }}
              axisBottom={null}
              colors={{
                type: 'sequential',
                scheme: 'oranges',
                minValue: 0,
              }}
              emptyColor="rgba(255,255,255,0.04)"
              borderRadius={4}
              borderWidth={1}
              borderColor="rgba(255,255,255,0.08)"
              labelTextColor="#0b1224"
              onClick={(cell) => {
                const serieLabel = String((cell as { serieId?: unknown }).serieId ?? '');
                const platform = String((cell as { data?: { x?: unknown } }).data?.x ?? '');
                const party = heat.find((h) => h.id === serieLabel)?.partyCode ?? null;
                if (platform && party) openExplorer({ party, platform });
              }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {t('digital_matrix_caption')}
          </p>
        </div>
      </div>
    </div>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
