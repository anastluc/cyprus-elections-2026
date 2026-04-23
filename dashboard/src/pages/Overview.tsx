import { ResponsivePie } from '@nivo/pie';
import { Vote, Users, MapPin, Clock, Sparkles, BadgeCheck } from 'lucide-react';
import { KPICard } from '../components/KPICard';
import { SectionHeader } from '../components/SectionHeader';
import { CyprusMap } from '../components/CyprusMap';
import { NIVO_THEME, partyColour, partyLabel, PARTY_ORDER } from '../lib/theme';
import type { Dataset } from '../data/types';
import { fmtInt, pct, womenCount } from '../lib/utils';
import { useUI } from '../lib/store';
import { useT } from '../lib/i18n';

export function Overview({ data }: { data: Dataset }) {
  const { stats } = data;
  const locale = useUI((s) => s.locale);
  const t = useT();
  const women = womenCount(stats.by_gender);
  const total = stats.total_candidates;
  const partyCount = Object.keys(stats.by_party).length;
  const avgAge = stats.age_histogram.mean ?? 0;
  const partyPie = PARTY_ORDER.filter((p) => stats.by_party[p]).map((p) => ({
    id: p,
    label: partyLabel(p, locale),
    value: stats.by_party[p] ?? 0,
    color: partyColour(p),
  }));

  const largestEntry = [...Object.entries(stats.by_party)].sort((a, b) => b[1] - a[1])[0];
  const largestCode = largestEntry?.[0] ?? '';
  const largestCount = largestEntry?.[1] ?? 0;

  return (
    <div>
      <SectionHeader
        eyebrow={t('overview_eyebrow')}
        title={t('overview_title')(total, partyCount)}
        subtitle={<>{t('overview_subtitle')}</>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KPICard label={t('kpi_candidates')} value={total} icon={<Users className="h-5 w-5" />} accent="brand" />
        <KPICard label={t('kpi_parties')} value={partyCount} icon={<Vote className="h-5 w-5" />} accent="rose" />
        <KPICard label={t('kpi_districts')} value={data.meta.district_codes.length} icon={<MapPin className="h-5 w-5" />} accent="amber" />
        <KPICard label={t('kpi_women')} value={women} suffix={`· ${pct(women, total)}`} icon={<Sparkles className="h-5 w-5" />} accent="emerald" />
        <KPICard label={t('kpi_avg_age')} value={Math.round(avgAge)} suffix={t('kpi_avg_age_suffix')} icon={<Clock className="h-5 w-5" />} hint={`n=${stats.age_histogram.n}`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="card lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                {t('overview_geo_eyebrow')}
              </div>
              <h3 className="mt-0.5 text-lg font-semibold text-white">
                {t('overview_geo_title')}
              </h3>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <BadgeCheck className="h-3 w-3 text-brand-400" />
              {t('overview_geo_hint')}
            </div>
          </div>
          <CyprusMap byDistrict={stats.by_district} />
        </div>

        <div className="card lg:col-span-2">
          <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {t('overview_party_eyebrow')}
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">
            {t('overview_party_title')}
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
            {t('overview_party_largest')(largestCode, fmtInt(largestCount))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StoryCard
          headline={t('overview_story_women_headline')(pct(women, total))}
          body={t('overview_story_women_body')(total)}
        />
        <StoryCard
          headline={t('overview_story_prof_headline')(Math.round(stats.coverage.profession?.percentage ?? 0))}
          body={t('overview_story_prof_body')}
        />
        <StoryCard
          headline={t('overview_story_twitter_headline')(Math.round(stats.coverage.twitter?.percentage ?? 0))}
          body={t('overview_story_twitter_body')}
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
