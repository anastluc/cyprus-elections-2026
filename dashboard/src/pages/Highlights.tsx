import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ExternalLink } from 'lucide-react';
import { SectionHeader } from '../components/SectionHeader';
import { PartyBadge } from '../components/PartyBadge';
import { districtLabel, PARTY_ORDER, partyLabel } from '../lib/theme';
import type { Dataset } from '../data/types';
import { useUI } from '../lib/store';
import { hostOf } from '../lib/utils';

export function Highlights({ data }: { data: Dataset }) {
  const [party, setParty] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const openProfile = useUI((s) => s.openProfile);

  const cards = useMemo(() => {
    return data.candidates
      .filter((c) => c.highlights && c.highlights.length > 0)
      .filter((c) => (party ? c.party === party : true))
      .filter((c) => {
        if (!q) return true;
        const needle = q.toLowerCase();
        return (
          c.name_en.toLowerCase().includes(needle) ||
          c.name_gr.toLowerCase().includes(needle) ||
          (c.highlights ?? []).some((h) => h.toLowerCase().includes(needle))
        );
      });
  }, [data.candidates, party, q]);

  const activeParties = PARTY_ORDER.filter((p) =>
    data.candidates.some((c) => c.party === p && c.highlights?.length)
  );

  return (
    <div>
      <SectionHeader
        eyebrow="Highlights"
        title="Remarkable mentions"
        subtitle={
          <>
            AI-extracted summaries of standout facts — published works, awards, past
            elected roles, founded organisations — from each candidate's bio or CV.
            Click any card to open the full profile.
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setParty(null)}
          className={`rounded-full border px-3 py-1 text-xs transition ${
            party === null
              ? 'border-brand-400/60 bg-brand-500/20 text-brand-100'
              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          All parties
        </button>
        {activeParties.map((p) => (
          <button
            key={p}
            onClick={() => setParty(p === party ? null : p)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              party === p
                ? 'border-brand-400/60 bg-brand-500/20 text-brand-100'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            {partyLabel(p)}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or highlight…"
          className="ml-auto w-64 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-brand-400/50"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.slice(0, 60).map((c, i) => {
          const source = c.highlights_source;
          const sourceLabel = source ? hostOf(source) : null;
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.02, 0.3) }}
              className="card group flex flex-col hover:border-white/20"
            >
              <button
                type="button"
                onClick={() => openProfile(c.id)}
                className="flex flex-1 flex-col text-left"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-white">
                      {c.name_en}
                    </div>
                    <div className="truncate text-xs text-slate-500">{c.name_gr}</div>
                  </div>
                  <PartyBadge code={c.party} size="sm" />
                </div>
                <div className="mb-3 flex items-center gap-2 text-[11px] text-slate-400">
                  <span>{c.district ? districtLabel(c.district) : '—'}</span>
                  {c.fields.profession_cluster?.value ? (
                    <>
                      <span>·</span>
                      <span>{c.fields.profession_cluster.value}</span>
                    </>
                  ) : null}
                </div>
                <ul className="flex-1 space-y-2">
                  {(c.highlights ?? []).slice(0, 4).map((h, j) => (
                    <li
                      key={j}
                      className="flex items-start gap-2 text-sm leading-relaxed text-slate-200"
                    >
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-300" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </button>
              <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-2 text-[10px] text-slate-500">
                {source ? (
                  <a
                    href={source}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 hover:text-brand-200"
                    title={source}
                  >
                    from bio · {sourceLabel}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                ) : (
                  <span>from bio</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      {cards.length > 60 ? (
        <div className="mt-4 text-center text-xs text-slate-500">
          Showing 60 of {cards.length}. Refine filters or search to see more.
        </div>
      ) : null}
      {cards.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-slate-400">
          No highlights match your filter.
        </div>
      ) : null}
    </div>
  );
}
