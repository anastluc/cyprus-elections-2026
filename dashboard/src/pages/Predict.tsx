import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Trash2, Eye, RotateCcw } from 'lucide-react';
import { SectionHeader } from '../components/SectionHeader';
import { PredictionCard } from '../components/PredictionCard';
import { PartyBadge } from '../components/PartyBadge';
import { usePredictStore, decodePrediction, shareUrl } from '../data/predict-store';
import type { Prediction, OverUnder } from '../data/predict-store';
import { PARTY_ORDER, partyColour, partyLabel, DISTRICT_ORDER, districtLabel, DISTRICT_SEATS } from '../lib/theme';
import { useT } from '../lib/i18n';
import { useUI } from '../lib/store';
import type { Dataset } from '../data/types';

/* ── Over/Under presets ── */
const OU_PRESETS: { label: string; line: number }[] = [
  { label: 'AKEL vote share', line: 22 },
  { label: 'DISY vote share', line: 21 },
  { label: 'Women elected', line: 10 },
  { label: 'Voter turnout', line: 65 },
];

/* ── Scoring example data ── */
const EXAMPLE_ROWS = [
  { party: 'AKEL', yours: 25.0, actual: 23.2 },
  { party: 'DISY', yours: 22.0, actual: 24.1 },
  { party: 'DIKO', yours: 10.0, actual: 9.5 },
  { party: 'ELAM', yours: 8.0, actual: 7.2 },
  { party: 'KOSP', yours: 5.0, actual: 4.8 },
  { party: 'Others', yours: 30.0, actual: 31.2 },
];

export function Predict({ data: _data }: { data: Dataset }) {
  const t = useT();
  const locale = useUI((s) => s.locale);
  const {
    draft, shared, saved, advancedOpen,
    setDraftField, setDraftPartyPct, resetDraft, submitDraft,
    setShared, toggleAdvanced, loadSaved, deleteSaved,
  } = usePredictStore();

  const [submitted, setSubmitted] = useState<Prediction | null>(null);

  // On mount: load saved predictions + check URL hash for shared prediction
  useEffect(() => {
    loadSaved();
    const hash = window.location.hash;
    if (hash.startsWith('#predict=')) {
      const decoded = decodePrediction(hash.slice('#predict='.length));
      if (decoded) setShared(decoded);
    }
  }, [loadSaved, setShared]);

  // Compute total percentage
  const total = useMemo(() => {
    if (!draft.partyPcts) return 0;
    return Object.values(draft.partyPcts).reduce((s, v) => s + (v || 0), 0);
  }, [draft.partyPcts]);

  const remaining = +(100 - total).toFixed(1);
  const isValid = Math.abs(remaining) <= 0.5;

  const handleSubmit = () => {
    const result = submitDraft();
    if (result) {
      setSubmitted(result);
      setShared(result);
    }
  };

  // ── Shared prediction view (read-only) ──
  if (shared && !submitted) {
    return (
      <div className="space-y-8">
        <SectionHeader eyebrow={t('predict_eyebrow')} title={t('predict_title')} />
        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 text-sm text-purple-200">
          {t('predict_shared_viewing')} <strong>{shared.name}</strong>
        </div>
        <PredictionCard prediction={shared} />
        <button
          onClick={() => {
            setShared(null);
            window.history.replaceState(null, '', window.location.pathname);
          }}
          className="text-sm text-brand-300 transition hover:text-brand-200"
        >
          {t('predict_make_your_own')}
        </button>
        <ScoringExplainer />
        <LeaderboardSection />
      </div>
    );
  }

  // ── After submission ──
  if (submitted) {
    return (
      <div className="space-y-8">
        <SectionHeader eyebrow={t('predict_eyebrow')} title={t('predict_title')} />
        <PredictionCard prediction={submitted} />
        <button
          onClick={() => {
            setSubmitted(null);
            setShared(null);
            resetDraft();
            window.history.replaceState(null, '', window.location.pathname);
          }}
          className="flex items-center gap-2 text-sm text-brand-300 transition hover:text-brand-200"
        >
          <RotateCcw className="h-3.5 w-3.5" /> {t('predict_make_your_own')}
        </button>
        <ScoringExplainer />
        <LeaderboardSection />
        <SavedPredictions saved={saved} deleteSaved={deleteSaved} setShared={setShared} />
      </div>
    );
  }

  // ── Main form ──
  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow={t('predict_eyebrow')}
        title={t('predict_title')}
        subtitle={t('predict_subtitle')}
      />

      {/* Name input */}
      <div className="card max-w-xl">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          {t('predict_name_label')}
        </label>
        <input
          type="text"
          value={draft.name ?? ''}
          onChange={(e) => setDraftField('name', e.target.value)}
          placeholder={t('predict_name_placeholder') as string}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30"
        />
      </div>

      {/* Party percentages */}
      <div className="card">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">{t('predict_party_pcts_title')}</h3>
          <TotalBadge remaining={remaining} isValid={isValid} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {PARTY_ORDER.map((code) => (
            <PartySlider
              key={code}
              code={code}
              locale={locale}
              value={draft.partyPcts?.[code] ?? 0}
              onChange={(v) => setDraftPartyPct(code, v)}
            />
          ))}
        </div>
      </div>

      {/* Bonus predictions */}
      <div className="card">
        <h3 className="mb-4 text-lg font-bold text-white">{t('predict_bonus_title')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              {t('predict_bonus_parties')}
            </label>
            <input
              type="number"
              min={1}
              max={14}
              value={draft.bonusParliamentParties ?? ''}
              onChange={(e) => setDraftField('bonusParliamentParties', e.target.value ? +e.target.value : undefined as any)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              {t('predict_bonus_turnout')}
            </label>
            <input
              type="number"
              min={30}
              max={100}
              step={0.1}
              value={draft.bonusTurnout ?? ''}
              onChange={(e) => setDraftField('bonusTurnout', e.target.value ? +e.target.value : undefined as any)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50"
            />
          </div>
        </div>

        {/* Over / Under */}
        <div className="mt-5">
          <h4 className="mb-3 text-sm font-semibold text-slate-300">{t('predict_over_under_title')}</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {OU_PRESETS.map((preset, i) => (
              <OverUnderPick
                key={i}
                preset={preset}
                current={draft.overUnders?.find((o) => o.label === preset.label)}
                onPick={(pick) => {
                  const existing = draft.overUnders ?? [];
                  const filtered = existing.filter((o) => o.label !== preset.label);
                  const newOU: OverUnder = { ...preset, pick };
                  setDraftField('overUnders', [...filtered, newOU]);
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Advanced mode */}
      <div className="card">
        <button
          onClick={toggleAdvanced}
          className="flex w-full items-center justify-between text-left"
        >
          <h3 className="text-lg font-bold text-white">{t('predict_advanced_title')}</h3>
          {advancedOpen ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </button>
        <AnimatePresence>
          {advancedOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-6">
                {/* District-level percentages */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-slate-300">
                    {t('predict_advanced_district_title')}
                  </h4>
                  <div className="overflow-x-auto">
                    <div className="text-[10px] text-slate-500 mb-2">
                      Enter % for each party in each district. This is optional — leave blank to skip.
                    </div>
                    {DISTRICT_ORDER.map((dist) => (
                      <div key={dist} className="mb-3">
                        <div className="mb-1 text-xs font-medium text-slate-400">
                          {districtLabel(dist, locale)} ({DISTRICT_SEATS[dist]} seats)
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {PARTY_ORDER.slice(0, 8).map((party) => (
                            <input
                              key={party}
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              placeholder={partyLabel(party, locale)}
                              className="w-[72px] rounded border border-white/10 bg-white/[0.03] px-1.5 py-1 text-[11px] text-white placeholder-slate-600 outline-none focus:border-brand-500/40"
                              onChange={(e) => {
                                const val = e.target.value ? +e.target.value : 0;
                                const prev = draft.districtPcts ?? {};
                                const distPcts = { ...prev, [dist]: { ...(prev[dist] ?? {}), [party]: val } };
                                setDraftField('districtPcts', distPcts);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Elected MPs */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-slate-300">
                    {t('predict_advanced_mps_title')}
                  </h4>
                  {DISTRICT_ORDER.map((dist) => (
                    <div key={dist} className="mb-3">
                      <div className="mb-1 text-xs font-medium text-slate-400">
                        {districtLabel(dist, locale)} — {DISTRICT_SEATS[dist]} seats
                      </div>
                      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: DISTRICT_SEATS[dist] }).map((_, i) => (
                          <input
                            key={i}
                            type="text"
                            placeholder={`${t('predict_advanced_mps_placeholder')}`}
                            className="rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-white placeholder-slate-600 outline-none focus:border-brand-500/40"
                            onChange={(e) => {
                              const prev = draft.electedMPs ?? {};
                              const distMPs = [...(prev[dist] ?? [])];
                              distMPs[i] = e.target.value;
                              setDraftField('electedMPs', { ...prev, [dist]: distMPs });
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Submit */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={!isValid}
          onClick={handleSubmit}
          className={`predict-glow rounded-2xl px-8 py-3.5 text-base font-bold transition ${
            isValid
              ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-rose-500 text-white shadow-lg hover:shadow-xl hover:brightness-110'
              : 'cursor-not-allowed bg-slate-800 text-slate-500'
          }`}
        >
          {isValid ? t('predict_submit') : t('predict_submit_disabled')}
        </button>
        <button
          onClick={resetDraft}
          className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
        >
          {t('predict_reset')}
        </button>
      </div>

      {/* Scoring explainer */}
      <ScoringExplainer />

      {/* Leaderboard placeholder */}
      <LeaderboardSection />

      {/* Saved predictions */}
      <SavedPredictions saved={saved} deleteSaved={deleteSaved} setShared={(p) => { setShared(p); setSubmitted(p); }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════ Sub-components ═══════════════ */

function TotalBadge({ remaining, isValid }: { remaining: number; isValid: boolean }) {
  const t = useT();
  if (isValid) {
    return <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">{t('predict_perfect')}</span>;
  }
  if (remaining > 0) {
    return <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400">{(t('predict_remaining') as Function)(remaining.toFixed(1))}</span>;
  }
  return <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-400">{(t('predict_over_100') as Function)(Math.abs(remaining).toFixed(1))}</span>;
}

function PartySlider({ code, locale, value, onChange }: { code: string; locale: 'en' | 'gr'; value: number; onChange: (v: number) => void }) {
  const color = partyColour(code);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <div className="w-16 flex-none">
        <PartyBadge code={code} size="sm" />
      </div>
      <input
        type="range"
        min={0}
        max={50}
        step={0.1}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="party-slider min-w-0 flex-1"
        style={{ '--party-color': color } as React.CSSProperties}
      />
      <div className="flex w-[60px] items-center gap-0.5">
        <input
          type="number"
          min={0}
          max={100}
          step={0.1}
          value={value || ''}
          onChange={(e) => onChange(Math.min(100, Math.max(0, +e.target.value || 0)))}
          className="w-[48px] rounded border border-white/10 bg-transparent px-1.5 py-0.5 text-right text-xs text-white outline-none focus:border-brand-500/40"
        />
        <span className="text-[10px] text-slate-500">%</span>
      </div>
    </div>
  );
}

function OverUnderPick({
  preset,
  current,
  onPick,
}: {
  preset: { label: string; line: number };
  current?: OverUnder;
  onPick: (pick: 'over' | 'under') => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <span className="text-xs text-slate-300">
        {preset.label} <span className="text-slate-500">({preset.line})</span>
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => onPick('over')}
          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
            current?.pick === 'over'
              ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
              : 'text-slate-500 hover:bg-white/[0.06] hover:text-slate-300'
          }`}
        >
          ↑ {t('predict_over')}
        </button>
        <button
          onClick={() => onPick('under')}
          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
            current?.pick === 'under'
              ? 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/30'
              : 'text-slate-500 hover:bg-white/[0.06] hover:text-slate-300'
          }`}
        >
          ↓ {t('predict_under')}
        </button>
      </div>
    </div>
  );
}

function ScoringExplainer() {
  const t = useT();
  const exTotal = EXAMPLE_ROWS.reduce((s, r) => s + Math.abs(r.yours - r.actual), 0);
  return (
    <div className="card space-y-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">
        {t('predict_scoring_eyebrow')}
      </div>
      <h3 className="text-xl font-bold text-white">{t('predict_scoring_title')}</h3>
      <p className="text-sm leading-relaxed text-slate-400">{t('predict_scoring_body')}</p>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-300">{t('predict_scoring_example_title')}</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-500">
                <th className="px-2 py-1.5 text-left font-medium">{t('predict_scoring_col_party')}</th>
                <th className="px-2 py-1.5 text-right font-medium">{t('predict_scoring_col_yours')}</th>
                <th className="px-2 py-1.5 text-right font-medium">{t('predict_scoring_col_actual')}</th>
                <th className="px-2 py-1.5 text-right font-medium">{t('predict_scoring_col_diff')}</th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLE_ROWS.map((r) => (
                <tr key={r.party} className="border-b border-white/5">
                  <td className="px-2 py-1.5 text-slate-300">{r.party}</td>
                  <td className="px-2 py-1.5 text-right text-slate-300">{r.yours.toFixed(1)}%</td>
                  <td className="px-2 py-1.5 text-right text-slate-300">{r.actual.toFixed(1)}%</td>
                  <td className="px-2 py-1.5 text-right font-mono text-amber-400">{Math.abs(r.yours - r.actual).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/10">
                <td colSpan={3} className="px-2 py-1.5 text-right font-semibold text-white">{t('predict_scoring_total')}</td>
                <td className="px-2 py-1.5 text-right font-mono font-bold text-amber-300">{exTotal.toFixed(1)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="space-y-1 text-xs text-slate-400">
        <p>{t('predict_scoring_perfect')}</p>
        <p>🥇 {t('predict_scoring_scale_excellent')}</p>
        <p>🥈 {t('predict_scoring_scale_good')}</p>
        <p>🥉 {t('predict_scoring_scale_ok')}</p>
      </div>

      <p className="text-center text-lg font-bold text-white">{t('predict_scoring_no_prizes')}</p>
    </div>
  );
}

function LeaderboardSection() {
  const t = useT();
  return (
    <div className="card">
      <h3 className="mb-3 text-xl font-bold text-white">{t('predict_leaderboard_title')}</h3>
      <div className="flex items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-12 text-sm text-slate-500">
        {t('predict_leaderboard_coming')}
      </div>
    </div>
  );
}

function SavedPredictions({
  saved,
  deleteSaved,
  setShared,
}: {
  saved: Prediction[];
  deleteSaved: (id: string) => void;
  setShared: (p: Prediction) => void;
}) {
  const t = useT();
  if (!saved.length) return null;

  return (
    <div className="card">
      <h3 className="mb-4 text-lg font-bold text-white">{t('predict_my_predictions')}</h3>
      <div className="space-y-2">
        {saved.map((p) => {
          const ts = new Date(p.timestamp);
          return (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5"
            >
              <div>
                <div className="text-sm font-medium text-white">{p.name}</div>
                <div className="text-[11px] text-slate-500">
                  {ts.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setShared(p)}
                  className="rounded-lg border border-white/10 p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
                  title={t('predict_view') as string}
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deleteSaved(p.id)}
                  className="rounded-lg border border-white/10 p-1.5 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-400"
                  title={t('predict_delete') as string}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
