import { useUI } from '../lib/store';
import type { FieldValue } from '../data/types';

export function LangBadge({ value }: { value: FieldValue | undefined }) {
  const locale = useUI((s) => s.locale);
  if (!value?.lang) return null;
  if (value.lang === locale) return null;
  const label = value.lang === 'gr' ? 'GR' : 'EN';
  const title =
    value.lang === 'gr'
      ? 'Original value is in Greek'
      : 'Original value is in English';
  return (
    <span
      title={title}
      className="ml-1.5 inline-flex items-center rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 align-middle font-mono text-[9px] font-semibold uppercase tracking-wider text-slate-400"
    >
      {label}
    </span>
  );
}
