import { create } from 'zustand';
import { PARTY_ORDER } from '../lib/theme';

/* ─── Types ─── */
export interface OverUnder {
  label: string;
  line: number;
  pick: 'over' | 'under';
}

export interface Prediction {
  id: string;
  name: string;
  timestamp: string;
  partyPcts: Record<string, number>;
  bonusParliamentParties?: number;
  bonusTurnout?: number;
  overUnders?: OverUnder[];
  districtPcts?: Record<string, Record<string, number>>;
  electedMPs?: Record<string, string[]>;
}

export interface PredictState {
  /** Currently-editing prediction (draft) */
  draft: Partial<Prediction>;
  /** Prediction loaded from a shared URL (read-only view) */
  shared: Prediction | null;
  /** All locally-saved predictions */
  saved: Prediction[];
  /** Whether the advanced mode panel is open */
  advancedOpen: boolean;

  setDraftField: <K extends keyof Prediction>(k: K, v: Prediction[K]) => void;
  setDraftPartyPct: (party: string, pct: number) => void;
  resetDraft: () => void;
  submitDraft: () => Prediction | null;
  setShared: (p: Prediction | null) => void;
  toggleAdvanced: () => void;
  loadSaved: () => void;
  deleteSaved: (id: string) => void;
}

/* ─── Helpers ─── */

const LS_KEY = 'cy2026-predictions';

function generateId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

function readLS(): Prediction[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Prediction[];
  } catch {
    return [];
  }
}

function writeLS(predictions: Prediction[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(predictions));
  } catch {}
}

/**
 * Encode a prediction into a compact URL-safe string.
 * Format: base64url( JSON({ n, t, p, b, u, o }) )
 * where we use short keys to minimize URL length.
 */
export function encodePrediction(p: Prediction): string {
  const compact: Record<string, unknown> = {
    n: p.name,
    t: p.timestamp,
    p: p.partyPcts,
  };
  if (p.bonusParliamentParties != null) compact.b = p.bonusParliamentParties;
  if (p.bonusTurnout != null) compact.u = p.bonusTurnout;
  if (p.overUnders?.length) compact.o = p.overUnders;
  if (p.districtPcts && Object.keys(p.districtPcts).length)
    compact.d = p.districtPcts;

  const json = JSON.stringify(compact);
  // Use base64url encoding
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return b64;
}

/**
 * Decode a prediction from a URL hash.
 */
export function decodePrediction(hash: string): Prediction | null {
  try {
    const b64 = hash.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = decodeURIComponent(escape(atob(padded)));
    const c = JSON.parse(json);
    return {
      id: generateId(),
      name: c.n ?? 'Anonymous',
      timestamp: c.t ?? new Date().toISOString(),
      partyPcts: c.p ?? {},
      bonusParliamentParties: c.b,
      bonusTurnout: c.u,
      overUnders: c.o,
      districtPcts: c.d,
    };
  } catch {
    return null;
  }
}

/**
 * Build a full shareable URL for a prediction.
 */
export function shareUrl(p: Prediction): string {
  const base = window.location.origin + window.location.pathname;
  return `${base}#predict=${encodePrediction(p)}`;
}

/* ─── Default party percentages ─── */
function emptyPartyPcts(): Record<string, number> {
  const pcts: Record<string, number> = {};
  for (const code of PARTY_ORDER) pcts[code] = 0;
  return pcts;
}

/* ─── Store ─── */
export const usePredictStore = create<PredictState>((set, get) => ({
  draft: { partyPcts: emptyPartyPcts() },
  shared: null,
  saved: [],
  advancedOpen: false,

  setDraftField: (k, v) =>
    set((s) => ({ draft: { ...s.draft, [k]: v } })),

  setDraftPartyPct: (party, pct) =>
    set((s) => ({
      draft: {
        ...s.draft,
        partyPcts: { ...(s.draft.partyPcts ?? {}), [party]: pct },
      },
    })),

  resetDraft: () => set({ draft: { partyPcts: emptyPartyPcts() } }),

  submitDraft: () => {
    const { draft, saved } = get();
    if (!draft.partyPcts) return null;

    const prediction: Prediction = {
      id: generateId(),
      name: draft.name?.trim() || 'Anonymous',
      timestamp: new Date().toISOString(),
      partyPcts: draft.partyPcts,
      bonusParliamentParties: draft.bonusParliamentParties,
      bonusTurnout: draft.bonusTurnout,
      overUnders: draft.overUnders,
      districtPcts: draft.districtPcts,
      electedMPs: draft.electedMPs,
    };

    const next = [prediction, ...saved];
    writeLS(next);
    set({ saved: next, shared: prediction });
    return prediction;
  },

  setShared: (shared) => set({ shared }),
  toggleAdvanced: () => set((s) => ({ advancedOpen: !s.advancedOpen })),
  loadSaved: () => set({ saved: readLS() }),
  deleteSaved: (id) => {
    const next = get().saved.filter((p) => p.id !== id);
    writeLS(next);
    set({ saved: next });
  },
}));
