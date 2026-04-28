import { create } from 'zustand';
import { candidatePath } from './utils';

export type Section =
  | 'overview'
  | 'demographics'
  | 'parties'
  | 'professions'
  | 'education'
  | 'digital'
  | 'highlights'
  | 'timeline'
  | 'explorer'
  | 'quality'
  | 'profile'
  | 'correction'
  | 'predict'
  | 'explore';

export interface FilterState {
  party: string | null;
  district: string | null;
  gender: string | null;
  cluster: string | null;
  profession: string | null;
  education: string | null;
  platform: string | null;
  search: string;
  setParty: (p: string | null) => void;
  setDistrict: (d: string | null) => void;
  setGender: (g: string | null) => void;
  setCluster: (c: string | null) => void;
  setProfession: (p: string | null) => void;
  setEducation: (e: string | null) => void;
  setPlatform: (p: string | null) => void;
  setSearch: (s: string) => void;
  setMany: (patch: Partial<FilterState>) => void;
  reset: () => void;
}

export const useFilters = create<FilterState>((set) => ({
  party: null,
  district: null,
  gender: null,
  cluster: null,
  profession: null,
  education: null,
  platform: null,
  search: '',
  setParty: (party) => set({ party }),
  setDistrict: (district) => set({ district }),
  setGender: (gender) => set({ gender }),
  setCluster: (cluster) => set({ cluster }),
  setProfession: (profession) => set({ profession }),
  setEducation: (education) => set({ education }),
  setPlatform: (platform) => set({ platform }),
  setSearch: (search) => set({ search }),
  setMany: (patch) => set(patch as FilterState),
  reset: () =>
    set({
      party: null,
      district: null,
      gender: null,
      cluster: null,
      profession: null,
      education: null,
      platform: null,
      search: '',
    }),
}));

export type Locale = 'en' | 'gr';
export type Theme = 'dark' | 'light';

export interface UIState {
  disclaimerDismissed: boolean;
  dismissDisclaimer: () => void;
  reopenDisclaimer: () => void;
  activeSection: Section;
  setActiveSection: (s: Section) => void;
  profileCandidateId: number | null;
  openProfile: (id: number, name?: { name_en?: string; name_gr?: string }) => void;
  closeProfile: () => void;
  locale: Locale;
  setLocale: (l: Locale) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const DISCLAIMER_KEY = 'cy2026-disclaimer-dismissed';
const LOCALE_KEY = 'cy2026-locale';
const THEME_KEY = 'cy2026-theme';

function initialLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(LOCALE_KEY);
  if (stored === 'en' || stored === 'gr') return stored;
  const nav = window.navigator.language?.toLowerCase() ?? '';
  return nav.startsWith('el') ? 'gr' : 'en';
}

function initialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
  return prefersLight ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

export const useUI = create<UIState>((set) => ({
  disclaimerDismissed:
    typeof window !== 'undefined' &&
    window.localStorage.getItem(DISCLAIMER_KEY) === '1',
  dismissDisclaimer: () => {
    try {
      window.localStorage.setItem(DISCLAIMER_KEY, '1');
    } catch {}
    set({ disclaimerDismissed: true });
  },
  reopenDisclaimer: () => {
    try {
      window.localStorage.removeItem(DISCLAIMER_KEY);
    } catch {}
    set({ disclaimerDismissed: false });
  },
  activeSection: 'overview',
  setActiveSection: (activeSection) => set({ activeSection }),
  profileCandidateId: null,
  openProfile: (profileCandidateId, name) => {
    if (typeof window !== 'undefined') {
      const target = candidatePath(profileCandidateId, name?.name_en, name?.name_gr);
      if (window.location.pathname !== target) {
        try {
          window.history.pushState(null, '', target);
        } catch {}
      }
    }
    set({ profileCandidateId, activeSection: 'profile' });
  },
  closeProfile: () => {
    if (typeof window !== 'undefined' && /^\/candidate\//i.test(window.location.pathname)) {
      try {
        window.history.pushState(null, '', '/');
      } catch {}
    }
    set({ profileCandidateId: null });
  },
  locale: initialLocale(),
  setLocale: (locale) => {
    try {
      window.localStorage.setItem(LOCALE_KEY, locale);
    } catch {}
    set({ locale });
  },
  theme: (() => {
    const t = initialTheme();
    applyTheme(t);
    return t;
  })(),
  setTheme: (theme) => {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {}
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next: Theme = useUI.getState().theme === 'dark' ? 'light' : 'dark';
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {}
    applyTheme(next);
    set({ theme: next });
  },
}));
