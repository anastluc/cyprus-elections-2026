import { create } from 'zustand';

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
  | 'profile';

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

export interface UIState {
  disclaimerDismissed: boolean;
  dismissDisclaimer: () => void;
  reopenDisclaimer: () => void;
  activeSection: Section;
  setActiveSection: (s: Section) => void;
  profileCandidateId: number | null;
  openProfile: (id: number) => void;
  closeProfile: () => void;
}

const DISCLAIMER_KEY = 'cy2026-disclaimer-dismissed';

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
  openProfile: (profileCandidateId) =>
    set({ profileCandidateId, activeSection: 'profile' }),
  closeProfile: () => set({ profileCandidateId: null }),
}));
