import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Check, X, Clock } from 'lucide-react';
import type { Candidate, HistoryRow } from '../data/types';
import { partyColour, partyLabel } from '../lib/theme';
import { PartyBadge } from './PartyBadge';

const YEARS = [2001, 2006, 2011, 2016, 2021, 2026];

interface Cell {
  year: number;
  party_code: string;
  votes: number | null;
  elected: boolean;
  source_url?: string;
  upcoming?: boolean;
}

interface Row {
  candidate: Candidate;
  cells: Record<number, Cell>;
  firstYear: number;
  totalVotes: number;
  anyElected: boolean;
}

export function TimelineMatrix({
  candidates,
  history,
  sort = 'first-year',
}: {
  candidates: Candidate[];
  history: HistoryRow[];
  sort?: 'first-year' | 'party' | 'total-votes' | 'name';
}) {
  const rows = useMemo<Row[]>(() => {
    const byId = new Map<number, HistoryRow[]>();
    for (const h of history) {
      if (h.candidate_id == null) continue;
      const arr = byId.get(h.candidate_id) ?? [];
      arr.push(h);
      byId.set(h.candidate_id, arr);
    }
    const out: Row[] = [];
    for (const c of candidates) {
      const past = byId.get(c.id) ?? [];
      const cells: Record<number, Cell> = {};
      for (const h of past) {
        cells[h.year] = {
          year: h.year,
          party_code: h.party_code,
          votes: h.votes,
          elected: !!h.elected,
          source_url: h.source_url,
        };
      }
      cells[2026] = {
        year: 2026,
        party_code: c.party,
        votes: null,
        elected: false,
        upcoming: true,
      };
      if (past.length === 0) continue;
      const firstYear = past.reduce(
        (acc, h) => Math.min(acc, h.year),
        9999
      );
      const totalVotes = past.reduce((acc, h) => acc + (h.votes ?? 0), 0);
      out.push({
        candidate: c,
        cells,
        firstYear,
        totalVotes,
        anyElected: past.some((h) => h.elected),
      });
    }
    const sorted = [...out];
    sorted.sort((a, b) => {
      if (sort === 'first-year') return a.firstYear - b.firstYear;
      if (sort === 'party') return a.candidate.party.localeCompare(b.candidate.party);
      if (sort === 'total-votes') return b.totalVotes - a.totalVotes;
      return a.candidate.name_en.localeCompare(b.candidate.name_en);
    });
    return sorted;
  }, [candidates, history, sort]);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 12,
  });

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-slate-400">
        <p className="text-lg font-semibold text-slate-200">No historical matches yet.</p>
        <p className="mt-2 text-sm">
          Run <code className="kbd">cyprus-elections historical ingest</code> to populate
          past-election records.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="grid grid-cols-[minmax(220px,1fr)_repeat(6,minmax(80px,1fr))] items-center gap-2 border-b border-white/10 bg-white/[0.04] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <div>Candidate ({rows.length})</div>
        {YEARS.map((y) => (
          <div key={y} className="text-center">
            {y}
            {y === 2026 ? (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-brand-500/20 px-1.5 py-0.5 text-[9px] text-brand-200">
                <Clock className="h-2.5 w-2.5" />
                live
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <div
        ref={parentRef}
        className="max-h-[560px] overflow-auto"
        style={{ contain: 'strict' }}
      >
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((vi) => {
            const row = rows[vi.index];
            return (
              <div
                key={row.candidate.id}
                className="grid grid-cols-[minmax(220px,1fr)_repeat(6,minmax(80px,1fr))] items-center gap-2 border-b border-white/5 px-4 hover:bg-white/[0.03]"
                style={{
                  position: 'absolute',
                  top: vi.start,
                  left: 0,
                  right: 0,
                  height: vi.size,
                }}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <PartyBadge code={row.candidate.party} size="sm" />
                  <span className="truncate text-sm text-slate-100">
                    {row.candidate.name_en}
                  </span>
                </div>
                {YEARS.map((y) => (
                  <TimelineCell key={y} cell={row.cells[y]} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-white/10 bg-white/[0.04] px-4 py-2.5 text-[11px] text-slate-400">
        <Legend colour="#22c55e" icon={<Check className="h-3 w-3" />} label="Elected" />
        <Legend colour="#ef4444" icon={<X className="h-3 w-3" />} label="Ran · lost" />
        <Legend colour="#6366f1" icon={<Clock className="h-3 w-3" />} label="2026 · running" />
        <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-500">
          2001 – 2011 coverage is thin (Wikipedia only)
        </span>
      </div>
    </div>
  );
}

function TimelineCell({ cell }: { cell?: Cell }) {
  if (!cell) {
    return <div className="mx-auto h-8 w-full rounded border border-dashed border-white/5" />;
  }
  const colour = partyColour(cell.party_code);
  if (cell.upcoming) {
    return (
      <a
        className="group mx-auto flex h-8 items-center justify-center rounded-md border text-[10px] font-semibold uppercase tracking-wider"
        style={{
          borderColor: `${colour}66`,
          background: `${colour}22`,
          color: colour,
        }}
        title={`Running in 2026 for ${partyLabel(cell.party_code)}`}
      >
        <Clock className="mr-1 h-3 w-3" />
        Running
      </a>
    );
  }
  const inner = cell.elected ? (
    <Check className="h-4 w-4" style={{ color: colour }} />
  ) : (
    <X className="h-4 w-4" style={{ color: colour, opacity: 0.7 }} />
  );
  return (
    <a
      href={cell.source_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group mx-auto flex h-8 flex-col items-center justify-center rounded-md border text-[10px] transition hover:scale-[1.04]"
      style={{
        borderColor: cell.elected ? `${colour}88` : `${colour}44`,
        background: cell.elected ? `${colour}33` : `${colour}14`,
      }}
      title={`${partyLabel(cell.party_code)} · ${cell.elected ? 'elected' : 'ran'}${cell.votes != null ? ` · ${cell.votes.toLocaleString()} votes` : ''}`}
    >
      {inner}
      {cell.votes != null ? (
        <span className="mt-[-2px] font-mono text-[9px] text-slate-400">
          {cell.votes.toLocaleString()}
        </span>
      ) : null}
    </a>
  );
}

function Legend({
  colour,
  icon,
  label,
}: {
  colour: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded border"
        style={{ borderColor: `${colour}66`, background: `${colour}26`, color: colour }}
      >
        {icon}
      </span>
      {label}
    </span>
  );
}
