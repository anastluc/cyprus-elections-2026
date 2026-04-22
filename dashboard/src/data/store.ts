import { create } from 'zustand';
import type { Dataset } from './types';

interface DatasetState {
  data: Dataset | null;
  error: string | null;
  setData: (d: Dataset) => void;
  setError: (e: string) => void;
}

export const useDataset = create<DatasetState>((set) => ({
  data: null,
  error: null,
  setData: (data) => set({ data, error: null }),
  setError: (error) => set({ error }),
}));
