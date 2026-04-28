import { ResponsiveBar } from '@nivo/bar';
import { ResponsiveHeatMap } from '@nivo/heatmap';
import { SectionHeader } from '../components/SectionHeader';
import { PartyBadge } from '../components/PartyBadge';
import {
  DISTRICT_ORDER,
  NIVO_THEME,
  PARTY_ORDER,
  partyColour,
  partyLabel,
  districtLabel,
} from '../lib/theme';
import type { Dataset } from '../data/types';
import { isFemale, pct } from '../lib/utils';
import { useFilters, useUI } from '../lib/store';
import { useT } from '../lib/i18n';
import {
  DataSource,
  CANDIDATES_SOURCE_LINK,
  STATS_SOURCE_LINK,
} from '../components/DataSource';

export function Parties({ data }: { data: Dataset }) {
  const { stats, candidates } = data;
  const partyCodes = PARTY_ORDER.filter((p) => stats.by_party[p]);
  const setFilters = useFilters((s) => s.setMany);
  const resetFilters = useFilters((s) => s.reset);
  const setSection = useUI((s) => s.setActiveSection);
  const locale = useUI((s) => s.locale);
  const t = useT();

  function openExplorer(patch: { party?: string | null; gender?: string | null; district?: string | null }) {
    resetFilters();
    setFilters(patch);
    setSection('explorer');
  }

  const genderPerParty = partyCodes.map((p) => {
    const inParty = candidates.filter((c) => c.party === p);
    const women = inParty.filter((c) => isFemale(c.fields.gender?.value)).length;
    const men = inParty.length - women;
    return { party: p, women, men };
  });

  const heat = DISTRICT_ORDER.map((d) => ({
    id: districtLabel(d, locale),
    data: partyCodes.map((p) => ({
      x: p,
      y: stats.district_party_matrix[p]?.[d] ?? 0,
    })),
  }));

  return (
    <div>
      <SectionHeader
        eyebrow={t('parties_eyebrow')}
        title={t('parties_title')}
        subtitle={t('parties_subtitle')}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {partyCodes.map((p) => {
          const total = stats.by_party[p] ?? 0;
          const women = candidates.filter(
            (c) => c.party === p && isFemale(c.fields.gender?.value)
          ).length;
          const avgAge = stats.avg_age_by_party[p];
          return (
            <button
              key={p}
              type="button"
              onClick={() => openExplorer({ party: p })}
              className="card group relative cursor-pointer overflow-hidden text-left transition hover:border-white/20 hover:-translate-y-0.5"
            >
              <div
                className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-2xl"
                style={{ background: `${partyColour(p)}44` }}
              />
              <div className="relative flex items-start justify-between">
                <div>
                  <PartyBadge code={p} />
                  <div className="mt-2 font-mono text-3xl font-bold text-white">
                    {total}
                  </div>
                  <div className="text-xs text-slate-400">{t('parties_candidates_label')}</div>
                </div>
                <div className="text-right text-xs">
                  <div>
                    <span className="text-pink-300">{pct(women, total)}</span> {t('parties_women_suffix')}
                  </div>
                  {avgAge ? (
                    <div className="mt-1 text-slate-400">
                      {t('parties_avg_age')}{' '}
                      <span className="text-slate-100">{Math.round(avgAge)}</span>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-brand-300 opacity-0 transition group-hover:opacity-100">
                {t('parties_click_explore')}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {t('parties_gender_eyebrow')}
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">
            {t('parties_gender_title')}
          </h3>
          <div className="h-[360px]">
            <ResponsiveBar
              data={genderPerParty}
              theme={NIVO_THEME}
              keys={['women', 'men']}
              indexBy="party"
              margin={{ top: 8, right: 16, bottom: 40, left: 36 }}
              padding={0.25}
              groupMode="stacked"
              colors={['#f472b6', '#60a5fa']}
              borderRadius={4}
              enableLabel={false}
              axisBottom={{
                tickSize: 0,
                tickPadding: 6,
                format: (d) => partyLabel(String(d), locale),
              }}
              axisLeft={{ tickSize: 0, tickPadding: 6 }}
              onClick={(node) => {
                const party = String((node as { indexValue?: unknown }).indexValue ?? '');
                const key = (node as { id?: unknown }).id;
                if (party) openExplorer({ party, gender: key === 'women' ? 'female' : 'male' });
              }}
              legends={[
                {
                  dataFrom: 'keys',
                  anchor: 'top-right',
                  direction: 'row',
                  translateY: -4,
                  itemsSpacing: 4,
                  itemWidth: 72,
                  itemHeight: 14,
                  symbolSize: 10,
                  symbolShape: 'circle',
                  itemTextColor: '#cbd5e1',
                },
              ]}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">{t('parties_gender_caption')}</p>
        </div>

        <div className="card">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {t('parties_heat_eyebrow')}
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">
            {t('parties_heat_title')}
          </h3>
          <div className="h-[360px]">
            <ResponsiveHeatMap
              data={heat}
              theme={NIVO_THEME}
              margin={{ top: 40, right: 20, bottom: 30, left: 80 }}
              axisTop={{
                tickSize: 0,
                tickPadding: 6,
                format: (d) => partyLabel(String(d), locale),
              }}
              axisLeft={{ tickSize: 0, tickPadding: 6 }}
              axisBottom={null}
              colors={{
                type: 'sequential',
                scheme: 'purple_blue',
                minValue: 0,
              }}
              emptyColor="rgba(255,255,255,0.04)"
              borderRadius={4}
              borderWidth={1}
              borderColor="rgba(255,255,255,0.08)"
              labelTextColor="#0b1224"
              hoverTarget="cell"
              onClick={(cell) => {
                const party = String((cell as { serieId?: unknown }).serieId ?? '');
                const x = String((cell as { data?: { x?: unknown } }).data?.x ?? '');
                // serieId is district label, x is party code — we swap to match openExplorer shape.
                const districtCode = DISTRICT_ORDER.find((d) => districtLabel(d, locale) === party) ?? null;
                if (districtCode && x) openExplorer({ party: x, district: districtCode });
              }}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">{t('parties_heat_caption')}</p>
        </div>
      </div>

      <DataSource
        summary="Party totals and the district × party heatmap are computed from the candidates dataset. Party affiliation comes from each candidate's official ballot record."
        sources={[STATS_SOURCE_LINK, CANDIDATES_SOURCE_LINK]}
        generatedAt={data.meta.generated_at}
      />
    </div>
  );
}
