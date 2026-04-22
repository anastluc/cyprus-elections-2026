import type { Dataset, Candidate, Stats, HistoryRow, Meta } from './types';

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/data/${path}`);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return (await res.json()) as T;
}

export async function loadDataset(): Promise<Dataset> {
  const [candidates, stats, history, meta] = await Promise.all([
    getJSON<Candidate[]>('candidates.json'),
    getJSON<Stats>('stats.json'),
    getJSON<HistoryRow[]>('history.json'),
    getJSON<Meta>('meta.json'),
  ]);
  return { candidates, stats, history, meta };
}
