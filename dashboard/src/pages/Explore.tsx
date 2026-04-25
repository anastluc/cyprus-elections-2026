import { useEffect, useState } from 'react';
import { Calendar, RefreshCw, Sparkles } from 'lucide-react';
import { SectionHeader } from '../components/SectionHeader';
import { listPredictionsFromFirebase } from '../lib/firebase';
import type { Prediction, OverUnder } from '../data/predict-store';
import { usePredictStore } from '../data/predict-store';
import { useUI } from '../lib/store';
import { useT } from '../lib/i18n';
import { PREDICT_PARTY_ORDER, partyColour, partyLabel } from '../lib/theme';

const ELECTION_DATE = new Date('2026-05-24T00:00:00');

function relativeTime(iso: string, locale: 'en' | 'gr'): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const sec = Math.round(diffMs / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  if (locale === 'gr') {
    if (sec < 60) return 'μόλις τώρα';
    if (min < 60) return `πριν ${min}'`;
    if (hr < 24) return `πριν ${hr}ώ`;
    if (day < 30) return `πριν ${day}μ`;
    return new Date(iso).toLocaleDateString('el-GR');
  }
  if (sec < 60) return 'just now';
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString('en-GB');
}

function daysBeforeElection(iso: string): number {
  const d = new Date(iso).getTime();
  return Math.max(0, Math.ceil((ELECTION_DATE.getTime() - d) / (1000 * 60 * 60 * 24)));
}

function rowToPrediction(row: Record<string, unknown>): Prediction {
  return {
    id: row.id as string,
    name: (row.name as string) ?? 'Anonymous',
    timestamp: (row.timestamp as string) ?? new Date().toISOString(),
    partyPcts: (row.partyPcts as Record<string, number>) ?? {},
    bonusTurnout: row.bonusTurnout as number | undefined,
    overUnders: row.overUnders as OverUnder[] | undefined,
  };
}

export function Explore() {
  const t = useT();
  const locale = useUI((s) => s.locale);
  const setSection = useUI((s) => s.setActiveSection);
  const setShared = usePredictStore((s) => s.setShared);

  const [items, setItems] = useState<Prediction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const rows = await listPredictionsFromFirebase(100);
      setItems(rows.map(rowToPrediction));
    } catch (e) {
      console.error('Failed to load predictions:', e);
      setError(String(e));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openPrediction = (p: Prediction) => {
    setShared(p);
    setSection('predict');
    window.history.replaceState(null, '', `#predict=${p.id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={t('explore_eyebrow')}
        title={t('explore_title')}
        subtitle={t('explore_subtitle')}
      />

      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">
          {items && (items.length === 0
            ? t('explore_empty_inline')
            : (t('explore_count') as Function)(items.length))}
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          {t('explore_refresh')}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {t('explore_error')}: <code className="text-xs">{error}</code>
        </div>
      )}

      {/* Loading skeleton */}
      {items === null && !error && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-40 animate-pulse bg-white/[0.02]" />
          ))}
        </div>
      )}

      {/* Empty */}
      {items && items.length === 0 && !error && (
        <div className="card flex flex-col items-center gap-3 py-16 text-center">
          <Sparkles className="h-8 w-8 text-brand-400" />
          <div className="text-sm text-slate-400">{t('explore_empty')}</div>
          <button
            onClick={() => setSection('predict')}
            className="mt-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-5 py-2 text-sm font-bold text-white"
          >
            {t('explore_make_first')}
          </button>
        </div>
      )}

      {/* Grid of predictions */}
      {items && items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <PredictionRow key={p.id} prediction={p} locale={locale} onOpen={() => openPrediction(p)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PredictionRow({
  prediction,
  locale,
  onOpen,
}: {
  prediction: Prediction;
  locale: 'en' | 'gr';
  onOpen: () => void;
}) {
  const t = useT();
  // Top 4 parties by predicted vote share — only active 2026 parties.
  const topParties = PREDICT_PARTY_ORDER
    .map((code) => ({ code, pct: prediction.partyPcts[code] ?? 0 }))
    .filter((r) => r.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4);

  const days = daysBeforeElection(prediction.timestamp);

  return (
    <button
      onClick={onOpen}
      className="card group flex flex-col items-stretch gap-3 text-left transition hover:border-brand-500/30 hover:bg-white/[0.04]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-white">{prediction.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
            <Calendar className="h-3 w-3" />
            <span>{relativeTime(prediction.timestamp, locale)}</span>
            <span className="text-slate-700">·</span>
            <span>{(t('explore_days_before') as Function)(days)}</span>
          </div>
        </div>
      </div>

      {/* Top parties bar */}
      <div className="space-y-1.5">
        {topParties.length === 0 ? (
          <div className="text-xs italic text-slate-500">{t('explore_no_picks')}</div>
        ) : (
          topParties.map((r) => {
            const color = partyColour(r.code);
            const widthPct = Math.min(100, (r.pct / 35) * 100); // scale: 35% fills the row
            return (
              <div key={r.code} className="flex items-center gap-2">
                <div className="w-12 flex-none truncate text-[10px] font-semibold tracking-wide text-slate-400">
                  {partyLabel(r.code, locale)}
                </div>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${widthPct}%`, background: color }}
                  />
                </div>
                <div className="w-10 flex-none text-right text-[11px] font-mono font-semibold text-slate-300">
                  {r.pct.toFixed(1)}%
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-1 text-[10px] text-brand-300/60 transition group-hover:text-brand-300">
        {t('explore_open')} →
      </div>
    </button>
  );
}
