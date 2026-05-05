import { create } from 'zustand';
import type { FilterState, Mode, RegionId } from '../types';

export type GlobalNavMode = 'orbit' | 'pan';

export interface HoverInfo {
  kind: 'entity' | 'region';
  id: string;
  x: number;
  y: number;
}

export interface SelectionInfo {
  kind: 'entity' | 'region';
  id: string;
}

export interface AppState {
  mode: Mode;
  region: RegionId;
  selection: SelectionInfo | null;
  hover: HoverInfo | null;
  search: string;
  filters: FilterState;
  /** Global map only: left-drag orbit vs pan-first. */
  globalNavMode: GlobalNavMode;

  setMode: (m: Mode) => void;
  setRegion: (r: RegionId) => void;
  selectEntity: (id: string) => void;
  selectStartup: (id: string) => void;
  selectRegion: (id: RegionId) => void;
  clearSelection: () => void;
  setHover: (h: HoverInfo | null) => void;
  setSearch: (q: string) => void;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  toggleFilterValue: <K extends keyof FilterState>(key: K, value: unknown) => void;
  resetFilters: () => void;
  setGlobalNavMode: (m: GlobalNavMode) => void;
}

export const defaultFilters: FilterState = {
  vertical: [],
  subSector: [],
  stage: [],
  geography: [],
  companySize: [],
  investorType: [],
  investorName: [],
  timePeriod: 'LTM',
  outcomeStatus: [],
  fundraisingStatus: [],
  education: [],
  founderBackground: [],
  university: [],
  repeatFounder: 'any',
  priorExit: 'any',
};

export const useAppStore = create<AppState>((set) => ({
  mode: 'global',
  region: 'UK',
  selection: null,
  hover: null,
  search: '',
  filters: defaultFilters,
  globalNavMode: 'orbit',

  setMode: (m) => set({ mode: m, selection: null, globalNavMode: 'orbit' }),
  setRegion: (r) => set({ region: r }),
  selectEntity: (id) => set({ selection: { kind: 'entity', id } }),
  selectStartup: (id) => set({ selection: { kind: 'entity', id } }),
  selectRegion: (id) => set({ selection: { kind: 'region', id } }),
  clearSelection: () => set({ selection: null }),
  setHover: (h) => set({ hover: h }),
  setSearch: (q) => set({ search: q }),
  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } })),
  toggleFilterValue: (key, value) =>
    set((s) => {
      const current = s.filters[key];
      if (!Array.isArray(current)) return s;
      const arr = current as unknown[];
      const next = arr.includes(value)
        ? arr.filter((v) => v !== value)
        : [...arr, value];
      return {
        filters: { ...s.filters, [key]: next as FilterState[typeof key] },
      };
    }),
  resetFilters: () => set({ filters: defaultFilters }),
  setGlobalNavMode: (m) => set({ globalNavMode: m }),
}));
