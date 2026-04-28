import { ResponsivePie } from '@nivo/pie';
import { ResponsiveBar } from '@nivo/bar';
import { SectionHeader } from '../components/SectionHeader';
import {
  DISTRICT_ORDER,
  NIVO_THEME,
  PARTY_ORDER,
  partyColour,
  partyLabel,
  districtLabel,
} from '../lib/theme';
import type { Dataset } from '../data/types';
import { menCount, pct, womenCount } from '../lib/utils';
import { useUI } from '../lib/store';
import { useT } from '../lib/i18n';
import {
  DataSource,
  CANDIDATES_SOURCE_LINK,
  STATS_SOURCE_LINK,
} from '../components/DataSource';

export function Demographics({ data }: { data: Dataset }) {
  const { stats } = data;
  const locale = useUI((s) => s.locale);
  const t = useT();
  const total = stats.total_candidates;
  const women = womenCount(stats.by_gender);
  const men = menCount(stats.by_gender);

  const genderData = [
    { id: 'Women', label: t('women_label'), value: women, color: '#f472b6' },
    { id: 'Men', label: t('men_label'), value: men, color: '#60a5fa' },
  ];

  const ageBars = stats.age_histogram.buckets.map((b) => ({
    bucket: b.range,
    count: b.count,
  }));

  const districtBars = DISTRICT_ORDER.map((d) => ({
    district: districtLabel(d, locale),
    count: stats.by_district[d] ?? 0,
  }));

  const partyAge = PARTY_ORDER.filter((p) => stats.avg_age_by_party[p])
    .map((p) => ({
      party: p,
      age: Math.round(stats.avg_age_by_party[p] ?? 0),
    }))
    .sort((a, b) => b.age - a.age);

  return (
    <div>
      <SectionHeader
        eyebrow={t('demo_eyebrow')}
        title={t('demo_title')}
        subtitle={t('demo_subtitle')}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="card lg:col-span-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {t('demo_gender_eyebrow')}
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">
            {t('demo_gender_headline')(pct(women, total))}
          </h3>
          <div className="h-[260px]">
            <ResponsivePie
              data={genderData}
              theme={NIVO_THEME}
              colors={(d) => d.data.color}
              innerRadius={0.68}
              padAngle={2}
              cornerRadius={6}
              margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              borderWidth={0}
              enableArcLabels={false}
              arcLinkLabelsTextColor="#cbd5e1"
              arcLinkLabelsColor={{ from: 'color' }}
              activeOuterRadiusOffset={6}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {t('demo_gender_caption')(women, men)}
          </p>
        </div>

        <div className="card lg:col-span-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {t('demo_age_eyebrow')}
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">
            {t('demo_age_title')}
            {stats.age_histogram.median ? (
              <span className="ml-2 text-sm font-normal text-slate-400">
                {t('demo_age_median_suffix')(Math.round(stats.age_histogram.median))}
              </span>
            ) : null}
          </h3>
          <div className="h-[260px]">
            <ResponsiveBar
              data={ageBars}
              theme={NIVO_THEME}
              keys={['count']}
              indexBy="bucket"
              margin={{ top: 8, right: 12, bottom: 36, left: 36 }}
              padding={0.25}
              colors={() => '#818cf8'}
              borderRadius={4}
              enableLabel={false}
              axisBottom={{ tickSize: 0, tickPadding: 6 }}
              axisLeft={{ tickSize: 0, tickPadding: 6 }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {t('demo_age_n')(stats.age_histogram.n)}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="card lg:col-span-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {t('demo_geo_eyebrow')}
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">
            {t('demo_geo_title')}
          </h3>
          <div className="h-[320px]">
            <ResponsiveBar
              data={districtBars}
              theme={NIVO_THEME}
              keys={['count']}
              indexBy="district"
              layout="horizontal"
              margin={{ top: 8, right: 16, bottom: 30, left: 72 }}
              padding={0.3}
              colors={() => '#f0abfc'}
              borderRadius={4}
              labelTextColor="#0b1224"
              axisBottom={{ tickSize: 0, tickPadding: 6 }}
              axisLeft={{ tickSize: 0, tickPadding: 6 }}
            />
          </div>
        </div>

        <div className="card lg:col-span-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {t('demo_age_party_eyebrow')}
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">
            {t('demo_age_party_title')}
          </h3>
          <div className="h-[320px]">
            <ResponsiveBar
              data={partyAge}
              theme={NIVO_THEME}
              keys={['age']}
              indexBy="party"
              margin={{ top: 8, right: 12, bottom: 36, left: 36 }}
              padding={0.25}
              colors={(b) => partyColour(b.data.party)}
              borderRadius={4}
              labelSkipHeight={18}
              labelTextColor="#0b1224"
              axisBottom={{
                tickSize: 0,
                tickPadding: 6,
                format: (d) => partyLabel(String(d), locale),
              }}
              axisLeft={{ tickSize: 0, tickPadding: 6 }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {t('demo_age_party_caption')}
          </p>
        </div>
      </div>

      <DataSource
        summary="Gender, age and district splits aggregated from candidate records. Each individual value is verifiable on the candidate's profile via its provenance pill."
        sources={[STATS_SOURCE_LINK, CANDIDATES_SOURCE_LINK]}
        generatedAt={data.meta.generated_at}
      />
    </div>
  );
}
