import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowRight, LayoutList, Rows, Search, X } from 'lucide-react';
import type { Candidate, Dataset } from '../data/types';
import { districtLabel, PARTY_ORDER, partyColour, partyLabel } from '../lib/theme';
import { useUI } from '../lib/store';
import { hostOf } from '../lib/utils';
import { translateName, useT } from '../lib/i18n';
import {
  DataSource,
  CANDIDATES_SOURCE_LINK,
  PIPELINE_SOURCE_LINK,
} from '../components/DataSource';

/**
 * The Wall — a Swiss-style editorial display of every highlight in the
 * dataset, one per scroll-slab. Inspired by museum quote walls and
 * 1960s typographic posters.
 *
 * Each slab fills the viewport vertically: tiny index counter and party
 * caption on top, display-scale quotation at centre, candidate caption
 * at bottom. The party is signalled by a single thin coloured rule
 * along the left edge; everything else is monochrome.
 *
 * `Index` is the alternate dense list view — same data, paginated rows,
 * for users who want to skim or search-and-filter quickly.
 */

type WallItem = {
  candidate: Candidate;
  highlight: string;
  position: number; // 0-based position in `c.highlights`
};

type Mode = 'wall' | 'index';

const PAGE_SIZE = 60;

export function Highlights({ data }: { data: Dataset }) {
  const t = useT();
  const locale = useUI((s) => s.locale);
  const openProfile = useUI((s) => s.openProfile);

  const [party, setParty] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<Mode>('wall');
  const [page, setPage] = useState(0);

  // One row per (candidate, highlight). The Wall scrolls through all of
  // them; the Index lists them as a flat table.
  const all = useMemo<WallItem[]>(() => {
    const needle = q.toLowerCase().trim();
    const out: WallItem[] = [];
    for (const c of data.candidates) {
      if (!c.highlights?.length) continue;
      if (party && c.party !== party) continue;
      const candidateMatches =
        !needle ||
        c.name_en.toLowerCase().includes(needle) ||
        c.name_gr.toLowerCase().includes(needle);
      for (let i = 0; i < c.highlights.length; i++) {
        const h = c.highlights[i];
        if (candidateMatches || h.toLowerCase().includes(needle)) {
          out.push({ candidate: c, highlight: h, position: i });
        }
      }
    }
    return out;
  }, [data.candidates, party, q]);

  useEffect(() => setPage(0), [party, q, mode]);

  const activeParties = useMemo(
    () =>
      PARTY_ORDER.filter((p) =>
        data.candidates.some((c) => c.party === p && c.highlights?.length)
      ),
    [data.candidates]
  );

  return (
    <div className="space-y-12">
      <Masthead total={all.length} t={t} />

      <FilterStrip
        party={party}
        onParty={setParty}
        q={q}
        onQ={setQ}
        mode={mode}
        onMode={setMode}
        activeParties={activeParties}
        locale={locale}
      />

      {all.length === 0 ? (
        <Empty />
      ) : mode === 'wall' ? (
        <Wall items={all} locale={locale} openProfile={openProfile} />
      ) : (
        <Index
          items={all}
          page={page}
          setPage={setPage}
          locale={locale}
          openProfile={openProfile}
        />
      )}

      <DataSource
        summary="Each highlight is an LLM-extracted bullet summarising the candidate's bio. The 'source' link points to the underlying bio document — that is authoritative, not the LLM-generated text."
        sources={[CANDIDATES_SOURCE_LINK, PIPELINE_SOURCE_LINK]}
        generatedAt={data.meta.generated_at}
      />
    </div>
  );
}

/* ─── Masthead — editorial title block ─────────────────────────────── */

function Masthead({ total, t }: { total: number; t: ReturnType<typeof useT> }) {
  return (
    <header className="border-b border-stone-200 pb-6 dark:border-stone-800 sm:pb-8">
      <div className="mb-3 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.2em] text-stone-900/50 dark:text-stone-50/50">
        <span className="tabular-nums">{t('highlights_eyebrow')}</span>
        <span className="h-px w-12 bg-stone-300 dark:bg-stone-700" />
        <span className="tabular-nums">{total.toLocaleString()} entries</span>
      </div>
      <h1 className="text-balance text-4xl font-light leading-[0.95] tracking-tight text-stone-900 dark:text-stone-50 sm:text-6xl md:text-7xl lg:text-[clamp(3.5rem,7vw,6.5rem)]">
        {t('highlights_title')}
      </h1>
      <p className="mt-4 max-w-[60ch] text-pretty text-base leading-relaxed text-stone-900/70 dark:text-stone-50/70 sm:text-lg">
        {t('highlights_subtitle')}
      </p>
    </header>
  );
}

/* ─── Filter strip — minimal Swiss controls ────────────────────────── */

function FilterStrip({
  party,
  onParty,
  q,
  onQ,
  mode,
  onMode,
  activeParties,
  locale,
}: {
  party: string | null;
  onParty: (p: string | null) => void;
  q: string;
  onQ: (s: string) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  activeParties: string[];
  locale: 'en' | 'gr';
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <PartyToken active={party === null} onClick={() => onParty(null)} label="All" />
        {activeParties.map((p) => (
          <PartyToken
            key={p}
            active={party === p}
            onClick={() => onParty(p === party ? null : p)}
            label={partyLabel(p, locale)}
            color={partyColour(p)}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-900/40 dark:text-stone-50/40" />
          <input
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder="Search name or highlight…"
            className="w-full border border-stone-200 bg-transparent px-9 py-2 text-sm text-stone-900 placeholder:text-stone-900/40 focus-visible:border-stone-900 focus-visible:outline-none dark:border-stone-800 dark:text-stone-50 dark:placeholder:text-stone-50/40 dark:focus-visible:border-stone-50"
          />
          {q ? (
            <button
              type="button"
              onClick={() => onQ('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-900/50 hover:text-stone-900 dark:text-stone-50/50 dark:hover:text-stone-50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <ModeToggle mode={mode} onMode={onMode} />
      </div>
    </div>
  );
}

function PartyToken({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex items-center gap-2 border-b py-1 text-xs font-medium tracking-wide transition focus-visible:outline-none ${
        active
          ? 'border-stone-900 text-stone-900 dark:border-stone-50 dark:text-stone-50'
          : 'border-transparent text-stone-900/60 hover:border-stone-300 hover:text-stone-900 dark:text-stone-50/60 dark:hover:border-stone-700 dark:hover:text-stone-50'
      }`}
    >
      {color ? (
        <span aria-hidden className="h-2 w-2" style={{ background: color }} />
      ) : null}
      {label}
    </button>
  );
}

function ModeToggle({ mode, onMode }: { mode: Mode; onMode: (m: Mode) => void }) {
  return (
    <div className="flex items-center gap-0 border border-stone-200 dark:border-stone-800">
      <button
        type="button"
        onClick={() => onMode('wall')}
        title="Wall (typographic scroll)"
        aria-pressed={mode === 'wall'}
        className={`flex h-9 items-center gap-1.5 px-3 text-xs transition focus-visible:outline-none ${
          mode === 'wall'
            ? 'bg-stone-900 text-stone-50 dark:bg-stone-50 dark:text-stone-900'
            : 'text-stone-900/70 hover:bg-stone-100 dark:text-stone-50/70 dark:hover:bg-stone-900'
        }`}
      >
        <Rows className="h-3.5 w-3.5" /> Wall
      </button>
      <button
        type="button"
        onClick={() => onMode('index')}
        title="Index (dense list)"
        aria-pressed={mode === 'index'}
        className={`flex h-9 items-center gap-1.5 border-l border-stone-200 px-3 text-xs transition focus-visible:outline-none dark:border-stone-800 ${
          mode === 'index'
            ? 'bg-stone-900 text-stone-50 dark:bg-stone-50 dark:text-stone-900'
            : 'text-stone-900/70 hover:bg-stone-100 dark:text-stone-50/70 dark:hover:bg-stone-900'
        }`}
      >
        <LayoutList className="h-3.5 w-3.5" /> Index
      </button>
    </div>
  );
}

function Empty() {
  return (
    <div className="border border-stone-200 px-6 py-24 text-center text-stone-900/60 dark:border-stone-800 dark:text-stone-50/60">
      No highlights match the current filter.
    </div>
  );
}

/* ─── Wall — typographic vertical scroll ───────────────────────────── */

function Wall({
  items,
  locale,
  openProfile,
}: {
  items: WallItem[];
  locale: 'en' | 'gr';
  openProfile: (id: number, name?: { name_en?: string; name_gr?: string }) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();

  // Lazy-grow: render the first N slabs immediately; load more as the
  // user scrolls toward the end so the initial paint stays cheap.
  const [windowEnd, setWindowEnd] = useState(() => Math.min(40, items.length));
  useEffect(() => setWindowEnd(Math.min(40, items.length)), [items]);

  // Observe which slab is centred in the viewport — used by the
  // running counter and the jump-rail.
  useEffect(() => {
    if (!containerRef.current) return;
    const slabs = Array.from(containerRef.current.querySelectorAll<HTMLElement>('[data-slab]'));
    if (!slabs.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const idx = Number(e.target.getAttribute('data-slab'));
            setActive(idx);
            if (idx > windowEnd - 6) {
              setWindowEnd((n) => Math.min(items.length, n + 20));
            }
          }
        }
      },
      { root: null, rootMargin: '-40% 0% -40% 0%', threshold: 0 }
    );
    slabs.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [windowEnd, items.length]);

  const jump = (idx: number) => {
    if (idx < windowEnd) {
      const el = containerRef.current?.querySelector<HTMLElement>(`[data-slab="${idx}"]`);
      el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    } else {
      setWindowEnd(Math.min(items.length, idx + 5));
      // give the new DOM a tick to mount
      setTimeout(() => {
        const el = containerRef.current?.querySelector<HTMLElement>(`[data-slab="${idx}"]`);
        el?.scrollIntoView({ behavior: 'auto', block: 'start' });
      }, 0);
    }
  };

  return (
    <div className="relative">
      {/* Running counter — sticky to viewport corner */}
      <div className="pointer-events-none sticky top-4 z-10 flex justify-end pr-1 sm:pr-2">
        <div className="pointer-events-auto inline-flex items-center gap-2 border border-stone-200 bg-stone-50/80 px-3 py-1 text-[11px] tracking-wide backdrop-blur dark:border-stone-800 dark:bg-stone-950/80">
          <span className="font-mono tabular-nums text-stone-900 dark:text-stone-50">
            {String(active + 1).padStart(3, '0')}
          </span>
          <span className="text-stone-900/40 dark:text-stone-50/40">/</span>
          <span className="font-mono tabular-nums text-stone-900/60 dark:text-stone-50/60">
            {String(items.length).padStart(3, '0')}
          </span>
        </div>
      </div>

      <div ref={containerRef} className="-mt-8">
        {items.slice(0, windowEnd).map((it, i) => (
          <Slab
            key={`${it.candidate.id}-${it.position}`}
            item={it}
            index={i}
            locale={locale}
            openProfile={openProfile}
            isLast={i === items.length - 1}
            isFirst={i === 0}
            onAdvance={() => jump(Math.min(items.length - 1, i + 1))}
          />
        ))}

        {windowEnd < items.length ? (
          <div className="flex items-center justify-center py-8">
            <button
              type="button"
              onClick={() => setWindowEnd((n) => Math.min(items.length, n + 40))}
              className="border border-stone-200 px-4 py-2 text-xs font-medium tracking-wide text-stone-900/70 transition hover:bg-stone-100 dark:border-stone-800 dark:text-stone-50/70 dark:hover:bg-stone-900"
            >
              Load 40 more →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Slab({
  item,
  index,
  locale,
  openProfile,
  isFirst,
  isLast,
  onAdvance,
}: {
  item: WallItem;
  index: number;
  locale: 'en' | 'gr';
  openProfile: (id: number, name?: { name_en?: string; name_gr?: string }) => void;
  isFirst: boolean;
  isLast: boolean;
  onAdvance: () => void;
}) {
  const reduce = useReducedMotion();
  const c = item.candidate;
  const partyHex = partyColour(c.party);
  const source = c.highlights_source;
  const slabId = String(index).padStart(3, '0');
  const photo = c.fields.photo_url?.value;

  return (
    <section
      data-slab={index}
      className="relative grid min-h-screen grid-cols-12 gap-4 border-t border-stone-200 px-4 py-16 dark:border-stone-800 sm:gap-8 sm:px-8 sm:py-24"
    >
      {/* Left party rule */}
      <div
        aria-hidden
        className="absolute inset-y-12 left-0 hidden w-[2px] sm:block"
        style={{ background: partyHex }}
      />

      {/* Top meta row */}
      <div className="col-span-12 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.18em] text-stone-900/60 dark:text-stone-50/60">
          <span className="font-mono tabular-nums">{slabId}</span>
          <span aria-hidden className="h-2 w-2" style={{ background: partyHex }} />
          <span>{partyLabel(c.party, locale)}</span>
          {c.district ? (
            <>
              <span aria-hidden className="text-stone-900/30 dark:text-stone-50/30">·</span>
              <span>{districtLabel(c.district, locale)}</span>
            </>
          ) : null}
        </div>
        {source ? (
          <a
            href={source}
            target="_blank"
            rel="noopener noreferrer"
            title={source}
            className="hidden text-[11px] tracking-wide text-stone-900/50 underline-offset-4 hover:text-stone-900 hover:underline dark:text-stone-50/50 dark:hover:text-stone-50 sm:inline-block"
          >
            source — {hostOf(source)}
          </a>
        ) : null}
      </div>

      {/* Quote — display-scale, centred vertically by the parent grid */}
      <motion.blockquote
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '0px 0px -20% 0px' }}
        transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
        className="col-span-12 self-center text-balance text-stone-900 dark:text-stone-50 md:col-span-11 md:col-start-1 lg:col-span-10"
      >
        <span className="block font-light leading-[0.98] tracking-tight text-[clamp(1.85rem,4.5vw,4.25rem)]">
          <span className="select-none pr-3 align-top text-stone-900/15 dark:text-stone-50/15">“</span>
          <span>{item.highlight}</span>
          <span className="select-none pl-2 align-bottom text-stone-900/15 dark:text-stone-50/15">”</span>
        </span>
      </motion.blockquote>

      {/* Candidate signature row */}
      <div className="col-span-12 mt-auto flex flex-col gap-4 self-end md:flex-row md:items-end md:justify-between">
        <button
          type="button"
          onClick={() => openProfile(c.id, { name_en: c.name_en, name_gr: c.name_gr })}
          className="group flex items-center gap-4 text-left"
        >
          {photo ? (
            <img
              src={photo}
              alt=""
              loading="lazy"
              className="h-12 w-12 flex-none object-cover ring-1 ring-stone-200 dark:ring-stone-800"
            />
          ) : (
            <span
              aria-hidden
              className="grid h-12 w-12 flex-none place-items-center bg-stone-100 text-xs font-medium tracking-wide text-stone-900/60 ring-1 ring-stone-200 dark:bg-stone-900 dark:text-stone-50/60 dark:ring-stone-800"
            >
              {initials(c)}
            </span>
          )}
          <div className="min-w-0">
            <div className="truncate text-xs font-medium uppercase tracking-[0.18em] text-stone-900 group-hover:underline dark:text-stone-50">
              {translateName(locale, c.name_en, c.name_gr)}
            </div>
            <div className="truncate text-[11px] text-stone-900/50 dark:text-stone-50/50">
              {locale === 'gr' ? c.name_en : c.name_gr}
              {c.fields.profession_cluster?.value ? (
                <> · {c.fields.profession_cluster.value}</>
              ) : null}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-stone-900/50 dark:text-stone-50/50">
          {!isLast ? (
            <button
              type="button"
              onClick={onAdvance}
              className="inline-flex items-center gap-1.5 hover:text-stone-900 dark:hover:text-stone-50"
            >
              Next <ArrowRight className="h-3 w-3" />
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5">End</span>
          )}
        </div>
      </div>

      {/* First-slab affordance: subtle "scroll" cue */}
      {isFirst ? (
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0.6, 0] }}
          transition={{ duration: 2.2, repeat: 2 }}
          className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-[11px] tracking-[0.2em] text-stone-900/50 dark:text-stone-50/50"
        >
          <span className="inline-flex items-center gap-2">
            SCROLL <ArrowDown className="h-3 w-3" />
          </span>
        </motion.div>
      ) : null}
    </section>
  );
}

function initials(c: Candidate): string {
  const src = (c.name_en || c.name_gr).trim();
  if (!src) return '?';
  const parts = src.split(/\s+/);
  const a = parts[0]?.[0] ?? '';
  const b = parts[parts.length - 1]?.[0] ?? '';
  return (a + b).toUpperCase();
}

/* ─── Index — dense paginated list ─────────────────────────────────── */

function Index({
  items,
  page,
  setPage,
  locale,
  openProfile,
}: {
  items: WallItem[];
  page: number;
  setPage: (n: number) => void;
  locale: 'en' | 'gr';
  openProfile: (id: number, name?: { name_en?: string; name_gr?: string }) => void;
}) {
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const slice = items.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <ol className="border-t border-stone-200 dark:border-stone-800">
        {slice.map((it, i) => {
          const globalIdx = safePage * PAGE_SIZE + i;
          const c = it.candidate;
          const partyHex = partyColour(c.party);
          return (
            <li
              key={`${c.id}-${it.position}`}
              className="grid grid-cols-12 gap-4 border-b border-stone-200 py-5 dark:border-stone-800"
            >
              <div className="col-span-12 flex items-baseline gap-3 text-[11px] uppercase tracking-[0.18em] text-stone-900/50 dark:text-stone-50/50 sm:col-span-3">
                <span className="font-mono tabular-nums">
                  {String(globalIdx + 1).padStart(3, '0')}
                </span>
                <span aria-hidden className="h-2 w-2 shrink-0" style={{ background: partyHex }} />
                <span className="truncate">{partyLabel(c.party, locale)}</span>
              </div>

              <div className="col-span-12 sm:col-span-9">
                <p className="text-pretty text-base leading-snug text-stone-900 dark:text-stone-50 sm:text-lg">
                  {it.highlight}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.18em] text-stone-900/50 dark:text-stone-50/50">
                  <button
                    type="button"
                    onClick={() => openProfile(c.id, { name_en: c.name_en, name_gr: c.name_gr })}
                    className="font-medium text-stone-900/80 hover:underline dark:text-stone-50/80"
                  >
                    {translateName(locale, c.name_en, c.name_gr)}
                  </button>
                  {c.district ? <span>· {districtLabel(c.district, locale)}</span> : null}
                  {c.highlights_source ? (
                    <a
                      href={c.highlights_source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline-offset-4 hover:text-stone-900 hover:underline dark:hover:text-stone-50"
                    >
                      source — {hostOf(c.highlights_source)}
                    </a>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {pages > 1 ? (
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => setPage(Math.max(0, safePage - 1))}
            disabled={safePage === 0}
            className="px-3 py-1.5 font-medium tracking-wide text-stone-900/70 hover:text-stone-900 disabled:opacity-30 dark:text-stone-50/70 dark:hover:text-stone-50"
          >
            ← Previous
          </button>
          <span className="tabular-nums text-stone-900/50 dark:text-stone-50/50">
            Page {safePage + 1} of {pages} · {items.length} entries
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(pages - 1, safePage + 1))}
            disabled={safePage >= pages - 1}
            className="px-3 py-1.5 font-medium tracking-wide text-stone-900/70 hover:text-stone-900 disabled:opacity-30 dark:text-stone-50/70 dark:hover:text-stone-50"
          >
            Next →
          </button>
        </div>
      ) : null}
    </div>
  );
}
