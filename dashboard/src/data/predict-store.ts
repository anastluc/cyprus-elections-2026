import { create } from 'zustand';
import { PARTY_ORDER } from '../lib/theme';
import { savePredictionToFirebase, loadPredictionFromFirebase } from '../lib/firebase';

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
  bonusTurnout?: number;
  overUnders?: OverUnder[];
}

export interface PredictState {
  /** Currently-editing prediction (draft) */
  draft: Partial<Prediction>;
  /** Prediction loaded from a shared URL or Firebase (read-only view) */
  shared: Prediction | null;
  /** Whether shared prediction is still loading from Firebase */
  sharedLoading: boolean;

  setDraftField: <K extends keyof Prediction>(k: K, v: Prediction[K]) => void;
  setDraftPartyPct: (party: string, pct: number) => void;
  resetDraft: () => void;
  submitDraft: () => Promise<Prediction | null>;
  setShared: (p: Prediction | null) => void;
  loadSharedById: (id: string) => Promise<void>;
}

/* ─── Helpers ─── */

function generateId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

const RANDOM_ADJ = [
  'Bold', 'Curious', 'Lucky', 'Sneaky', 'Mighty', 'Witty', 'Sunny', 'Rapid',
  'Calm', 'Brave', 'Clever', 'Swift', 'Silent', 'Wild', 'Sharp', 'Cosmic',
];
const RANDOM_NOUN = [
  'Owl', 'Falcon', 'Mongoose', 'Lynx', 'Otter', 'Fox', 'Lion', 'Hawk',
  'Wolf', 'Tiger', 'Heron', 'Moufflon', 'Dolphin', 'Raven', 'Panther', 'Stag',
];

function randomName(): string {
  const a = RANDOM_ADJ[Math.floor(Math.random() * RANDOM_ADJ.length)];
  const n = RANDOM_NOUN[Math.floor(Math.random() * RANDOM_NOUN.length)];
  const num = Math.floor(Math.random() * 100);
  return `${a} ${n} ${num}`;
}

function withTimeout<T>(p: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/* ─── Canonical URL ─── */
const HOSTING_URL = 'https://cyprus-elections-2026.web.app';

/**
 * Build a shareable URL for a prediction (uses Firebase document ID).
 */
export function shareUrl(p: Prediction): string {
  return `${HOSTING_URL}/p/${p.id}`;
}

/**
 * Build a local dev-friendly URL (for testing).
 */
export function shareUrlLocal(p: Prediction): string {
  const base = window.location.origin + window.location.pathname;
  return `${base}#predict=${p.id}`;
}

/**
 * Get the URL to use for sharing — production or local.
 */
export function getShareUrl(p: Prediction): string {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return shareUrlLocal(p);
  }
  return shareUrl(p);
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
  sharedLoading: false,

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

  submitDraft: async () => {
    const { draft } = get();
    if (!draft.partyPcts) return null;

    const prediction: Prediction = {
      id: generateId(),
      name: draft.name?.trim() || randomName(),
      timestamp: new Date().toISOString(),
      partyPcts: draft.partyPcts,
      bonusTurnout: draft.bonusTurnout,
      overUnders: draft.overUnders,
    };

    // Save to Firebase — with a hard timeout so the UI never hangs
    // (Firestore can leave writes pending indefinitely if rules deny or the
    // network is offline; we always want the local card to render.)
    try {
      await withTimeout(
        savePredictionToFirebase(prediction.id, {
          name: prediction.name,
          timestamp: prediction.timestamp,
          partyPcts: prediction.partyPcts,
          bonusTurnout: prediction.bonusTurnout ?? null,
          overUnders: prediction.overUnders ?? [],
        }),
        8000,
        'savePrediction',
      );
    } catch (err) {
      console.error('Failed to save prediction to Firebase:', err);
      // Continue — the prediction still works locally
    }

    set({ shared: prediction });
    return prediction;
  },

  setShared: (shared) => set({ shared }),

  loadSharedById: async (id: string) => {
    set({ sharedLoading: true });
    try {
      const data = await loadPredictionFromFirebase(id);
      if (data) {
        const prediction: Prediction = {
          id,
          name: (data.name as string) ?? 'Anonymous',
          timestamp: (data.timestamp as string) ?? new Date().toISOString(),
          partyPcts: (data.partyPcts as Record<string, number>) ?? {},
          bonusTurnout: data.bonusTurnout as number | undefined,
          overUnders: data.overUnders as OverUnder[] | undefined,
        };
        set({ shared: prediction, sharedLoading: false });
      } else {
        set({ sharedLoading: false });
      }
    } catch (err) {
      console.error('Failed to load prediction from Firebase:', err);
      set({ sharedLoading: false });
    }
  },
}));
