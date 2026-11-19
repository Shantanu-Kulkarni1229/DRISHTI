import { create } from 'zustand';
import { CHANGE_CANDIDATES, funnelForAoi, sensitivityToThreshold, type FunnelResult } from '../lib/mockData';
import type { ChangeCandidate, ChangeType } from '../lib/types';

export type DateMode = 'pair' | 'range';
export type StageId = 'masking' | 'normalising' | 'aligning' | 'scoring' | 'suppressing';

export interface StageLogEntry {
  id: StageId;
  label: string;
  status: 'pending' | 'running' | 'done';
  progress: number;
}

const STAGE_DEFS: { id: StageId; label: string }[] = [
  { id: 'masking', label: 'Masking cloud / shadow / snow' },
  { id: 'normalising', label: 'Radiometric normalisation (IR-MAD)' },
  { id: 'aligning', label: 'Co-registration to reference grid' },
  { id: 'scoring', label: 'Screening + Siamese confirmation' },
  { id: 'suppressing', label: 'Running the suppression gauntlet' },
];

interface ChangeState {
  dateMode: DateMode;
  pairBefore: string | null;
  pairAfter: string | null;
  selectedTypes: ChangeType[];
  sensitivity: number; // 0..1, precision <-> recall
  running: boolean;
  stages: StageLogEntry[];
  lastRunAoiId: string | null;
  compareTool: 'swipe' | 'blink' | 'fade' | 'sync';
  swipePosition: number;
  selectedCandidateId: string | null;
  inspectGate: string | null; // which funnel stage's "why dropped" gallery is open
  timerHandles: number[];

  setDateMode: (m: DateMode) => void;
  setPair: (before: string | null, after: string | null) => void;
  toggleType: (t: ChangeType) => void;
  setSensitivity: (v: number) => void;
  setCompareTool: (t: ChangeState['compareTool']) => void;
  setSwipePosition: (v: number) => void;
  runAnalysis: (aoiId: string) => void;
  selectCandidate: (id: string | null) => void;
  setInspectGate: (gate: string | null) => void;
  candidatesForAoi: (aoiId: string) => ChangeCandidate[];
  funnel: (aoiId: string) => FunnelResult;
  threshold: () => number;
}

export const useChangeStore = create<ChangeState>((set, get) => ({
  dateMode: 'range',
  pairBefore: null,
  pairAfter: null,
  selectedTypes: ['construction', 'clearance', 'water', 'roads'],
  sensitivity: 0.55,
  running: false,
  stages: STAGE_DEFS.map((s) => ({ ...s, status: 'pending', progress: 0 })),
  lastRunAoiId: null,
  compareTool: 'swipe',
  swipePosition: 50,
  selectedCandidateId: null,
  inspectGate: null,
  timerHandles: [],

  setDateMode: (m) => set({ dateMode: m }),
  setPair: (before, after) => set({ pairBefore: before, pairAfter: after }),
  toggleType: (t) => {
    const cur = get().selectedTypes;
    set({ selectedTypes: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] });
  },
  setSensitivity: (v) => set({ sensitivity: v }),
  setCompareTool: (t) => set({ compareTool: t }),
  setSwipePosition: (v) => set({ swipePosition: v }),
  setInspectGate: (gate) => set({ inspectGate: gate }),
  selectCandidate: (id) => set({ selectedCandidateId: id }),

  runAnalysis: (aoiId) => {
    get().timerHandles.forEach((h) => window.clearTimeout(h));
    const stages = STAGE_DEFS.map((s) => ({ ...s, status: 'pending' as const, progress: 0 }));
    set({ running: true, stages, lastRunAoiId: aoiId });

    const handles: number[] = [];
    let elapsed = 0;
    STAGE_DEFS.forEach((stage, i) => {
      const startAt = elapsed;
      const duration = 420 + i * 140;
      elapsed += duration;
      const startHandle = window.setTimeout(() => {
        set((s) => ({ stages: s.stages.map((st) => (st.id === stage.id ? { ...st, status: 'running' } : st)) }));
        const steps = 5;
        for (let k = 1; k <= steps; k++) {
          const h = window.setTimeout(() => {
            set((s) => ({
              stages: s.stages.map((st) => (st.id === stage.id ? { ...st, progress: Math.round((k / steps) * 100) } : st)),
            }));
          }, (duration / steps) * k);
          handles.push(h);
        }
        const doneHandle = window.setTimeout(() => {
          set((s) => ({ stages: s.stages.map((st) => (st.id === stage.id ? { ...st, status: 'done', progress: 100 } : st)) }));
          if (i === STAGE_DEFS.length - 1) set({ running: false });
        }, duration);
        handles.push(doneHandle);
      }, startAt);
      handles.push(startHandle);
    });
    set({ timerHandles: handles });
  },

  candidatesForAoi: (aoiId) => {
    const { selectedTypes } = get();
    return CHANGE_CANDIDATES.filter((c) => c.aoiId === aoiId && selectedTypes.includes(c.type));
  },

  funnel: (aoiId) => funnelForAoi(aoiId, get().sensitivity),
  threshold: () => sensitivityToThreshold(get().sensitivity),
}));
