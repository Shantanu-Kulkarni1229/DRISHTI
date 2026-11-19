import { create } from 'zustand';
import { INGEST_JOBS, INDEX_STATS, ingestNewScene } from '../lib/mockData';
import { useAuditStore } from './auditStore';
import type { IngestJob, IndexStats } from '../lib/types';

const STAGE_ORDER: IngestJob['status'][] = ['queued', 'masking', 'normalising', 'aligning', 'tiling', 'embedding', 'indexing', 'done'];

const FAILURE_MESSAGES: Partial<Record<IngestJob['status'], string>> = {
  masking: 'Cloud/shadow mask failed — SCL band missing from product',
  normalising: 'IR-MAD normalisation did not converge within the iteration budget',
  aligning: 'Co-registration residual exceeded tolerance (phase correlation failed)',
  tiling: 'Tiling aborted — footprint polygon self-intersects',
  embedding: 'Embedding worker ran out of memory on this tile batch',
  indexing: 'Vector upsert rejected — dimension mismatch with the existing index',
};

// Timer handles per job live outside React/zustand state since they are not
// serialisable — this is what makes a genuine cancel possible.
const timers = new Map<string, number[]>();
function clearTimers(id: string) {
  (timers.get(id) ?? []).forEach((t) => window.clearTimeout(t));
  timers.delete(id);
}

interface IngestState {
  jobs: IngestJob[];
  indexStats: IndexStats;
  startIngest: (filename: string, aoiId: string, retryOf?: string) => string;
  cancelJob: (id: string) => void;
  retryJob: (id: string) => string | null;
  removeJob: (id: string) => void;
}

export const useIngestStore = create<IngestState>((set, get) => {
  const run = (id: string, filename: string, aoiId: string) => {
    // decided once, up front, so the outcome is fixed the moment the job is queued
    const willFail = Math.random() < 0.16;
    const failableStages = STAGE_ORDER.slice(1, -1); // masking..indexing
    const failAt = failableStages[Math.floor(Math.random() * failableStages.length)];

    let stageIdx = 0;
    const advance = () => {
      stageIdx += 1;
      const status = STAGE_ORDER[stageIdx];
      const progress = Math.round((stageIdx / (STAGE_ORDER.length - 1)) * 100);

      if (willFail && status === failAt) {
        const error = FAILURE_MESSAGES[status] ?? 'Unknown pipeline error';
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, status: 'failed', progress, error, finishedAt: new Date().toISOString() } : j)) }));
        useAuditStore.getState().append({ actor: 'system', action: 'ingest.failed', targetType: 'scene', targetId: id, payload: { filename, stage: status, error } });
        clearTimers(id);
        return;
      }

      set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, status, progress } : j)) }));

      if (status === 'done') {
        const { scene, tiles } = ingestNewScene(aoiId, filename);
        const embedMs = Math.round(1200 + Math.random() * 900);
        const indexInsertMs = Math.round(60 + Math.random() * 100);
        set((s) => ({
          jobs: s.jobs.map((j) => (j.id === id ? { ...j, tilesProduced: tiles.length, embedMs, indexInsertMs, finishedAt: new Date().toISOString() } : j)),
          indexStats: { ...INDEX_STATS },
        }));
        useAuditStore.getState().append({ actor: 'system', action: 'ingest.scene', targetType: 'scene', targetId: scene.id, payload: { filename, tiles: tiles.length, aoiId } });
        clearTimers(id);
        return;
      }
      const t = window.setTimeout(advance, 550 + Math.random() * 350);
      timers.set(id, [...(timers.get(id) ?? []), t]);
    };
    const t0 = window.setTimeout(advance, 500);
    timers.set(id, [t0]);
  };

  return {
    jobs: [...INGEST_JOBS],
    indexStats: { ...INDEX_STATS },

    startIngest: (filename, aoiId, retryOf) => {
      const id = `ingest-live-${Date.now()}`;
      const job: IngestJob = {
        id, filename, aoiId, status: 'queued', progress: 0, tilesProduced: 0, embedMs: null, indexInsertMs: null,
        startedAt: new Date().toISOString(), finishedAt: null, error: null, retryOf: retryOf ?? null,
      };
      set((s) => ({ jobs: [job, ...s.jobs] }));
      run(id, filename, aoiId);
      return id;
    },

    cancelJob: (id) => {
      const job = get().jobs.find((j) => j.id === id);
      if (!job || job.status === 'done' || job.status === 'failed') return;
      clearTimers(id);
      set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, status: 'failed', error: 'Cancelled by operator', finishedAt: new Date().toISOString() } : j)) }));
      useAuditStore.getState().append({ actor: 'system', action: 'ingest.cancelled', targetType: 'scene', targetId: id, payload: { filename: job.filename } });
    },

    retryJob: (id) => {
      const job = get().jobs.find((j) => j.id === id);
      if (!job) return null;
      return get().startIngest(job.filename, job.aoiId, id);
    },

    removeJob: (id) => {
      const job = get().jobs.find((j) => j.id === id);
      if (!job || (job.status !== 'done' && job.status !== 'failed')) return;
      clearTimers(id);
      set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }));
    },
  };
});
