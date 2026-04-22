import { useMemo } from 'react';
import { GraduationCap } from 'lucide-react';
import { SectionHeader } from '../components/SectionHeader';
import type { Dataset } from '../data/types';
import { useFilters, useUI } from '../lib/store';

// Greek/English tokens that anchor an education level. Order matters — PhD beats master beats bachelor.
const LEVELS: { id: string; label: string; patterns: RegExp[] }[] = [
  {
    id: 'phd',
    label: 'PhD / Doctorate',
    patterns: [/διδακτορικ/i, /\bphd\b/i, /\bdoctorate\b/i, /\bdoctoral\b/i, /dphil/i],
  },
  {
    id: 'master',
    label: "Master's",
    patterns: [/μεταπτυχιακ/i, /\bmaster\b/i, /\bmba\b/i, /\bmsc\b/i, /\bma\b/i, /\bllm\b/i],
  },
  {
    id: 'bachelor',
    label: "Bachelor's",
    patterns: [/πτυχίο/i, /πτυχιούχος/i, /προπτυχιακ/i, /\bbachelor\b/i, /\bbsc\b/i, /\bba\b/i, /\bllb\b/i],
  },
  {
    id: 'diploma',
    label: 'Diploma / Other',
    patterns: [/δίπλωμα/i, /\bdiploma\b/i, /σχολή/i, /academy/i, /τεχνικ/i],
  },
];

// Crude university detector — capture Greek/English mentions of well-known institutions.
const UNIVERSITY_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'University of Cyprus', re: /(πανεπιστήμι[οα]\s+κύπρου|university of cyprus|ucy)/i },
  { label: 'Cyprus University of Technology', re: /(τεπακ|tepak|cyprus university of technology)/i },
  { label: 'Frederick University', re: /frederick/i },
  { label: 'European University Cyprus', re: /(ευρωπαϊκό\s+πανεπιστήμιο|european university)/i },
  { label: 'University of Nicosia', re: /(university of nicosia|πανεπιστήμιο\s+λευκωσίας|unic)/i },
  { label: 'Open University of Cyprus', re: /(ανοικτό\s+πανεπιστήμι[οα]\s+κύπρου|open university of cyprus)/i },
  { label: 'LSE', re: /(london school of economics|\blse\b)/i },
  { label: 'UCL', re: /\bucl\b|university college london/i },
  { label: 'Oxford', re: /oxford/i },
  { label: 'Cambridge', re: /cambridge/i },
  { label: 'Harvard', re: /harvard/i },
  { label: 'Athens (Athina)', re: /(πανεπιστήμιο\s+αθην|university of athens|athens)/i },
  { label: 'Thessaloniki', re: /(θεσσαλονίκη|aristotle|thessaloniki)/i },
  { label: 'Patras', re: /(πατρ[ωώ]ν|πατρα|university of patras)/i },
  { label: 'CIIM', re: /\bciim\b/i },
  { label: 'CDA College', re: /cda college/i },
  { label: 'Intercollege', re: /intercollege/i },
];

function classifyLevel(text: string): string | null {
  for (const lvl of LEVELS) {
    if (lvl.patterns.some((r) => r.test(text))) return lvl.id;
  }
  return null;
}

function extractUniversities(text: string): string[] {
  const hits: string[] = [];
  for (const u of UNIVERSITY_PATTERNS) {
    if (u.re.test(text)) hits.push(u.label);
  }
  return hits;
}

export function Education({ data }: { data: Dataset }) {
  const setFilters = useFilters((s) => s.setMany);
  const resetFilters = useFilters((s) => s.reset);
  const setSection = useUI((s) => s.setActiveSection);

  function openExplorer(patch: { education?: string | null }) {
    resetFilters();
    setFilters(patch);
    setSection('explorer');
  }

  const {
    levels,
    universities,
    coverage,
  } = useMemo(() => {
    const levelCounts = new Map<string, number>(LEVELS.map((l) => [l.id, 0]));
    const uniCounts = new Map<string, number>();
    let withEd = 0;
    for (const c of data.candidates) {
      const raw = c.fields.education?.value;
      if (!raw) continue;
      withEd += 1;
      const lvl = classifyLevel(raw);
      if (lvl) levelCounts.set(lvl, (levelCounts.get(lvl) ?? 0) + 1);
      for (const u of extractUniversities(raw)) {
        uniCounts.set(u, (uniCounts.get(u) ?? 0) + 1);
      }
    }
    return {
      levels: LEVELS.map((l) => ({ ...l, count: levelCounts.get(l.id) ?? 0 })),
      universities: [...uniCounts.entries()].sort((a, b) => b[1] - a[1]),
      coverage: { withEd, total: data.candidates.length },
    };
  }, [data.candidates]);

  const topLevel = levels.reduce((m, l) => (l.count > m.count ? l : m), levels[0]);

  return (
    <div>
      <SectionHeader
        eyebrow="Education"
        title="Where candidates studied"
        subtitle={
          <>
            {coverage.withEd} of {coverage.total} candidates have an extracted education field. Highest
            attained level is inferred from free-text — most common is{' '}
            <span className="font-semibold text-brand-300">{topLevel?.label}</span>. Click any card to
            open the Explorer filtered.
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {levels.map((l) => {
          const primary = l.patterns[0].source.replace(/\\b|\/i|[()]/g, '').trim();
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => openExplorer({ education: primary })}
              className="card group relative overflow-hidden text-left transition hover:border-white/20 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Level
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">{l.label}</div>
                </div>
                <GraduationCap className="h-5 w-5 text-brand-300" />
              </div>
              <div className="mt-3 font-mono text-3xl font-bold text-white">{l.count}</div>
              <div className="text-xs text-slate-400">candidates</div>
              <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-brand-300 opacity-0 transition group-hover:opacity-100">
                Filter Explorer →
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Institutions
          </div>
          <h3 className="mb-3 text-lg font-semibold text-white">
            Most-mentioned universities
          </h3>
          {universities.length === 0 ? (
            <p className="text-sm text-slate-400">No university mentions extracted yet.</p>
          ) : (
            <ul className="space-y-2">
              {universities.slice(0, 20).map(([name, count]) => (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => openExplorer({ education: name })}
                    className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.04]"
                  >
                    <span className="truncate text-sm text-slate-200">{name}</span>
                    <span className="font-mono text-xs text-slate-400">{count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Coverage
          </div>
          <h3 className="mb-3 text-lg font-semibold text-white">
            Data quality
          </h3>
          <p className="text-sm text-slate-400">
            Education is free text pulled from bios and CV text. Levels and institutions are
            extracted with simple keyword matching here on the client; totals won't sum to candidate
            counts because a candidate can hold multiple degrees or list multiple institutions.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="font-mono text-2xl text-white">{coverage.withEd}</div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">with education</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="font-mono text-2xl text-white">
                {coverage.total > 0
                  ? `${((coverage.withEd / coverage.total) * 100).toFixed(0)}%`
                  : '—'}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">coverage</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
