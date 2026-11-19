import { create } from 'zustand';
import { AOIS } from '../lib/mockData';
import type { Sensor } from '../lib/types';

interface FilterState {
  aoiId: string;
  dateFrom: string;
  dateTo: string;
  sensors: Sensor[];
  maxCloud: number; // 0..100
  setAoi: (id: string) => void;
  setDateRange: (from: string, to: string) => void;
  toggleSensor: (s: Sensor) => void;
  setMaxCloud: (v: number) => void;
}

export const useFilterStore = create<FilterState>((set, get) => ({
  aoiId: AOIS[0].id,
  dateFrom: '2016-01-01',
  dateTo: '2025-12-31',
  sensors: ['S2', 'S1', 'L8'],
  maxCloud: 20,
  setAoi: (id) => set({ aoiId: id }),
  setDateRange: (from, to) => set({ dateFrom: from, dateTo: to }),
  toggleSensor: (s) => {
    const cur = get().sensors;
    set({ sensors: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] });
  },
  setMaxCloud: (v) => set({ maxCloud: v }),
}));
