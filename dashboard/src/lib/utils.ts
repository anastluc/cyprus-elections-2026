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

export function parseHighlights(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as string[];
    if (parsed && Array.isArray(parsed.items)) return parsed.items as string[];
  } catch {}
  return [];
}
