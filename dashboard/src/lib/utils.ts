import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function pct(n: number, total: number): string {
  if (!total) return '0%';
  return `${((n / total) * 100).toFixed(1)}%`;
}

export function fmtInt(n: number): string {
  return n.toLocaleString('en-GB');
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function daysUntil(iso: string): number {
  const t = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(t / (1000 * 60 * 60 * 24)));
}

export function isFemale(raw: string | undefined | null): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === 'f' || v === 'female' || v === 'woman' || v === 'w';
}

export function isMale(raw: string | undefined | null): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === 'm' || v === 'male' || v === 'man';
}

export function womenCount(g: Record<string, number>): number {
  let n = 0;
  for (const [k, v] of Object.entries(g)) if (isFemale(k)) n += v;
  return n;
}

export function menCount(g: Record<string, number>): number {
  let n = 0;
  for (const [k, v] of Object.entries(g)) if (isMale(k)) n += v;
  return n;
}

/**
 * Slugify a candidate name for use in URLs. Strips Greek diacritics, lowercases,
 * collapses whitespace and non-alphanumerics to hyphens. Result is decorative —
 * the leading numeric id is the actual identifier.
 */
export function candidateSlug(nameEn: string | undefined, nameGr: string | undefined): string {
  const raw = (nameEn && nameEn.trim()) || (nameGr && nameGr.trim()) || '';
  if (!raw) return '';
  return raw
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
}

export function candidatePath(
  id: number,
  nameEn: string | undefined,
  nameGr: string | undefined,
): string {
  const slug = candidateSlug(nameEn, nameGr);
  return slug ? `/candidate/${id}-${slug}` : `/candidate/${id}`;
}

/**
 * Parse a `/candidate/{id}` or `/candidate/{id}-{slug}` pathname.
 * Returns the candidate id, or null if the path is not a candidate URL.
 */
export function parseCandidatePath(pathname: string): number | null {
  const m = pathname.match(/\/candidate\/(\d+)(?:-[a-z0-9-]*)?\/?$/i);
  if (!m) return null;
  const id = Number.parseInt(m[1], 10);
  return Number.isFinite(id) ? id : null;
}

export function parseHighlights(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as string[];
    if (parsed && Array.isArray(parsed.items)) return parsed.items as string[];
  } catch {}
  return [];
}
