import { ExternalLink, Globe, Newspaper, BookOpen, Landmark, Cpu, FileText, Search, Linkedin, Database } from 'lucide-react';
import type { FieldValue } from '../data/types';
import { hostOf } from '../lib/utils';

const ICONS: Record<string, typeof Globe> = {
  official: Landmark,
  party_site: Landmark,
  news: Newspaper,
  wikipedia: BookOpen,
  wikidata: Database,
  linkedin: Linkedin,
  linkedin_snippet: Linkedin,
  search_snippet: Search,
  llm_from_bio: Cpu,
  heuristic: Cpu,
  cv_doc: FileText,
  historical_moi: Landmark,
  historical_wiki: BookOpen,
};

const KIND_LABEL: Record<string, string> = {
  llm_from_bio: 'AI from bio',
  search_snippet: 'search',
  linkedin_snippet: 'LinkedIn',
  cv_doc: 'CV',
  party_site: 'party site',
  historical_moi: 'MOI',
  historical_wiki: 'Wikipedia',
};

function isHttpUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return /^https?:\/\//i.test(url);
}

export function ProvenancePill({ value }: { value: FieldValue }) {
  const Icon = ICONS[value.source_kind] ?? Globe;
  const linkable = isHttpUrl(value.source_url);
  const host = linkable ? hostOf(value.source_url) : value.source_kind;
  const label = KIND_LABEL[value.source_kind] ?? (linkable ? host : value.source_kind);
  const conf = Math.round((value.confidence ?? 0) * 100);
  const tooltip = `${value.source_kind} · ${linkable ? host : 'no public URL'} · ${conf}% confidence`;
  const inner = (
    <>
      <Icon className="h-3 w-3" />
      <span className="max-w-[120px] truncate">{label}</span>
      <span className="tabular-nums text-slate-500 group-hover:text-brand-300">
        {conf}
      </span>
      {linkable ? <ExternalLink className="h-2.5 w-2.5 opacity-60" /> : null}
    </>
  );
  if (!linkable) {
    return (
      <span
        className="group inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-300"
        title={tooltip}
      >
        {inner}
      </span>
    );
  }
  return (
    <a
      href={value.source_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-300 transition hover:border-brand-400/40 hover:bg-brand-400/10 hover:text-brand-100"
      title={tooltip}
    >
      {inner}
    </a>
  );
}
