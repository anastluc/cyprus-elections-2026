import { ResponsivePie } from '@nivo/pie';
import { Vote, Users, MapPin, Clock, Sparkles, BadgeCheck } from 'lucide-react';
import { KPICard } from '../components/KPICard';
import { SectionHeader } from '../components/SectionHeader';
import { CyprusMap } from '../components/CyprusMap';
import { NIVO_THEME, partyColour, partyLabel, PARTY_ORDER } from '../lib/theme';
import type { Dataset } from '../data/types';
import { fmtInt, pct, womenCount } from '../lib/utils';
import { useUI } from '../lib/store';

export function Overview({ data }: { data: Dataset }) {
  const { stats } = data;
  const locale = useUI((s) => s.locale);
  const women = womenCount(stats.by_gender);
  const total = stats.total_candidates;
  const avgAge = stats.age_histogram.mean ?? 0;
  const partyPie = PARTY_ORDER.filter((p) => stats.by_party[p]).map((p) => ({
    id: p,
    label: partyLabel(p, locale),
    value: stats.by_party[p] ?? 0,
    color: partyColour(p),
  }));

  return (
    <div>
      <SectionHeader
        eyebrow="Overview"
        title="297 candidates. 9 parties. One island."
        subtitle={
          <>
            Every candidate standing for the 56 parliamentary seats across Cyprus's six
            districts. Data collected from official party lists, ministry notices,
            Wikipedia, LinkedIn and AI-assisted enrichment — each value here is
            traceable to a source.
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KPICard label="Candidates" value={total} icon={<Users className="h-5 w-5" />} accent="brand" />
        <KPICard label="Parties" value={Object.keys(stats.by_party).length} icon={<Vote className="h-5 w-5" />} accent="rose" />
        <KPICard label="Districts" value={Object.keys(stats.by_district).length} icon={<MapPin className="h-5 w-5" />} accent="amber" />
        <KPICard label="Women" value={women} suffix={`· ${pct(women, total)}`} icon={<Sparkles className="h-5 w-5" />} accent="emerald" />
        <KPICard label="Avg. age" value={Math.round(avgAge)} suffix="yrs" icon={<Clock className="h-5 w-5" />} hint={`n=${stats.age_histogram.n}`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="card lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Geography
              </div>
              <h3 className="mt-0.5 text-lg font-semibold text-white">
                Candidate density by district
              </h3>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <BadgeCheck className="h-3 w-3 text-brand-400" />
              Click a district to filter
            </div>
          </div>
          <CyprusMap byDistrict={stats.by_district} />
        </div>

        <div className="card lg:col-span-2">
          <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Party mix
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">
            Candidates per party
          </h3>
          <div className="h-[360px]">
            <ResponsivePie
              data={partyPie}
              theme={NIVO_THEME}
              colors={(d) => d.data.color}
              innerRadius={0.62}
              padAngle={1.2}
              cornerRadius={4}
              margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
              borderWidth={0}
              enableArcLabels={false}
              enableArcLinkLabels
              arcLinkLabelsTextColor="#cbd5e1"
              arcLinkLabelsColor={{ from: 'color' }}
              arcLinkLabelsThickness={1}
              activeOuterRadiusOffset={6}
              valueFormat={(v) => `${v}`}
            />
          </div>
          <div className="mt-2 text-center text-xs text-slate-400">
            Largest slate: <span className="text-white">{
              [...Object.entries(stats.by_party)].sort((a, b) => b[1] - a[1])[0]?.[0]
            }</span> · {fmtInt(Math.max(...Object.values(stats.by_party)))} candidates
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StoryCard
          headline={`${pct(women, total)} women`}
          body="Across the full slate of 297 candidates. Gender balance varies sharply by party — see the Demographics section for the breakdown."
        />
        <StoryCard
          headline={`${Math.round(stats.coverage.profession?.percentage ?? 0)}% have a listed profession`}
          body="LLM-clustered into 15 categories. Law, Education and Business dominate; the Professions section shows the full treemap."
        />
        <StoryCard
          headline={`Only ${Math.round(stats.coverage.twitter?.percentage ?? 0)}% have a public X/Twitter handle`}
          body="Digital footprint is patchy — Facebook leads at ~19%, Wikipedia under 3%. Explore the Digital page for per-party heatmap."
        />
      </div>
    </div>
  );
}

function StoryCard({ headline, body }: { headline: string; body: string }) {
  return (
    <div className="card">
      <div className="text-2xl font-bold tracking-tight text-white">
        <span className="gradient-text">{headline}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
    </div>
  );
}
