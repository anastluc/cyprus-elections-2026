import { ArrowLeft, ExternalLink, Sparkles } from 'lucide-react';
import type { Dataset, Candidate, FieldValue } from '../data/types';
import { PartyBadge } from '../components/PartyBadge';
import { ProvenancePill } from '../components/ProvenancePill';
import { districtLabel } from '../lib/theme';
import { useUI } from '../lib/store';

const SOCIAL_FIELDS: { key: string; label: string }[] = [
  { key: 'facebook', label: 'Facebook' },
  { key: 'twitter', label: 'X / Twitter' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'website', label: 'Website' },
  { key: 'wikipedia', label: 'Wikipedia' },
];

const DETAIL_FIELDS: { key: string; label: string }[] = [
  { key: 'age', label: 'Age' },
  { key: 'date_of_birth', label: 'Date of birth' },
  { key: 'gender', label: 'Gender' },
  { key: 'profession', label: 'Profession' },
  { key: 'profession_cluster', label: 'Cluster' },
  { key: 'sector', label: 'Sector' },
  { key: 'education', label: 'Education' },
  { key: 'career_previous', label: 'Previous career' },
];

export function CandidateProfile({ data }: { data: Dataset }) {
  const profileId = useUI((s) => s.profileCandidateId);
  const closeProfile = useUI((s) => s.closeProfile);
  const setSection = useUI((s) => s.setActiveSection);

  const candidate: Candidate | undefined = data.candidates.find((c) => c.id === profileId);

  if (!candidate) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold text-white">No candidate selected</h2>
        <p className="mt-2 text-sm text-slate-400">
          Profiles open from the Highlights cards, Explorer rows, or any spot where you click a
          candidate name.
        </p>
      </div>
    );
  }

  const highlightsField = candidate.fields.highlights;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            closeProfile();
            setSection('highlights');
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:border-white/20 hover:bg-white/10"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Highlights
        </button>
        <button
          type="button"
          onClick={() => {
            closeProfile();
            setSection('explorer');
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:border-white/20 hover:bg-white/10"
        >
          Open in Explorer →
        </button>
      </div>

      <header className="card flex flex-col gap-4 md:flex-row md:items-center">
        {candidate.fields.photo_url?.value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={candidate.fields.photo_url.value}
            alt={candidate.name_en}
            className="h-28 w-28 flex-none rounded-2xl border border-white/10 object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-28 w-28 flex-none items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-3xl text-slate-400"
            aria-hidden
          >
            {initials(candidate.name_en || candidate.name_gr)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <PartyBadge code={candidate.party} />
          <h1 className="mt-2 text-3xl font-bold text-white">{candidate.name_en || '—'}</h1>
          <p className="text-slate-400">{candidate.name_gr}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span>{candidate.district ? districtLabel(candidate.district) : 'District unknown'}</span>
            {candidate.age ? <span>· {candidate.age} yrs</span> : null}
            <span>· row conf. {(candidate.row_confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      </header>

      {candidate.highlights && candidate.highlights.length > 0 ? (
        <section className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">
              <Sparkles className="h-4 w-4" /> Highlights
            </h2>
            {highlightsField?.source_url ? (
              <a
                href={highlightsField.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand-300 hover:text-brand-200"
              >
                source <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
          <ul className="space-y-2 text-sm text-slate-200">
            {candidate.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-300" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
            Details
          </h2>
          <dl className="grid grid-cols-1 gap-y-3 sm:grid-cols-2">
            {DETAIL_FIELDS.map(({ key, label }) => {
              const v = candidate.fields[key];
              if (!v?.value) return null;
              return (
                <div key={key}>
                  <dt className="text-[11px] uppercase tracking-wider text-slate-500">{label}</dt>
                  <dd className="mt-0.5 break-words text-sm text-slate-100">{v.value}</dd>
                  <div className="mt-1">
                    <ProvenancePill value={v} />
                  </div>
                </div>
              );
            })}
          </dl>
          {candidate.fields.bio_text?.value ? (
            <div className="mt-6 border-t border-white/5 pt-4">
              <h3 className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Bio</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                {candidate.fields.bio_text.value}
              </p>
              <div className="mt-2">
                <ProvenancePill value={candidate.fields.bio_text} />
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
              Online
            </h2>
            <ul className="space-y-2 text-sm">
              {SOCIAL_FIELDS.map(({ key, label }) => {
                const v: FieldValue | undefined = candidate.fields[key];
                if (!v?.value) return null;
                return (
                  <li key={key}>
                    <a
                      href={ensureUrl(v.value)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-brand-300 hover:text-brand-200"
                    >
                      <span className="text-[11px] uppercase tracking-wider text-slate-500">
                        {label}:
                      </span>
                      <span className="max-w-[260px] truncate">{v.value}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          {candidate.sources.length > 0 ? (
            <div className="card">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                All sources
              </h2>
              <ul className="space-y-1 text-xs">
                {candidate.sources.map((s, i) => (
                  <li key={i}>
                    <a
                      href={s}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 break-all text-brand-300 hover:text-brand-200"
                    >
                      {s}
                      <ExternalLink className="h-3 w-3 flex-none" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ensureUrl(v: string): string {
  if (/^https?:/i.test(v)) return v;
  if (v.startsWith('@')) return `https://twitter.com/${v.slice(1)}`;
  return v;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');
}
