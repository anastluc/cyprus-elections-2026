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

export function Demographics({ data }: { data: Dataset }) {
  const { stats } = data;
  const total = stats.total_candidates;
  const women = womenCount(stats.by_gender);
  const men = menCount(stats.by_gender);

  const genderData = [
    { id: 'Women', label: 'Women', value: women, color: '#f472b6' },
    { id: 'Men', label: 'Men', value: men, color: '#60a5fa' },
  ];

  const ageBars = stats.age_histogram.buckets.map((b) => ({
    bucket: b.range,
    count: b.count,
  }));

  const districtBars = DISTRICT_ORDER.map((d) => ({
    district: districtLabel(d),
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
        eyebrow="Demographics"
        title="Who is standing?"
        subtitle="Age, gender and geography across all 297 candidates. Age is only recorded for ~⅓ of the slate, so the histogram is indicative."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="card lg:col-span-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Gender
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">
            {pct(women, total)} women on the combined slate
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
            {women} women · {men} men. Party-level splits vary widely — see "Parties".
          </p>
        </div>

        <div className="card lg:col-span-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Age distribution
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">
            Age histogram
            {stats.age_histogram.median ? (
              <span className="ml-2 text-sm font-normal text-slate-400">
                · median {Math.round(stats.age_histogram.median)}yr
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
            n = {stats.age_histogram.n} candidates with published birth year.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="card lg:col-span-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Geography
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">
            Candidates per district
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
            Age by party
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">
            Average candidate age per party
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
                format: (d) => partyLabel(String(d)),
              }}
              axisLeft={{ tickSize: 0, tickPadding: 6 }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Only parties with at least one candidate with a known birth year are shown.
          </p>
        </div>
      </div>
    </div>
  );
}
