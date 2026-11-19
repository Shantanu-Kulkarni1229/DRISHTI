import { motion } from 'framer-motion';
import { Check, X, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { IngestJob } from '../../lib/types';

const STAGES: { id: IngestJob['status']; label: string }[] = [
  { id: 'masking', label: 'Mask' },
  { id: 'normalising', label: 'Normalise' },
  { id: 'aligning', label: 'Align' },
  { id: 'tiling', label: 'Tile' },
  { id: 'embedding', label: 'Embed' },
  { id: 'indexing', label: 'Index' },
];

export function StageStepper({ job }: { job: IngestJob }) {
  const order: IngestJob['status'][] = ['queued', ...STAGES.map((s) => s.id), 'done'];
  const curIdx = order.indexOf(job.status);

  return (
    <div className="flex items-center gap-0.5 w-full">
      {STAGES.map((s, i) => {
        const stageIdx = order.indexOf(s.id);
        const failedHere = job.status === 'failed' && job.progress === Math.round((stageIdx / (order.length - 1)) * 100);
        const state = failedHere ? 'failed' : stageIdx < curIdx || job.status === 'done' ? 'done' : stageIdx === curIdx ? 'active' : 'pending';
        return (
          <div key={s.id} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="flex items-center w-full">
              {i > 0 && <div className={cn('h-px flex-1', state === 'pending' ? 'bg-border' : 'bg-status-good/60')} />}
              <div
                className={cn(
                  'relative w-5 h-5 rounded-full border flex items-center justify-center shrink-0',
                  state === 'done' && 'bg-status-good/20 border-status-good text-status-good',
                  state === 'active' && 'bg-accent/20 border-accent-soft text-accent-soft',
                  state === 'failed' && 'bg-status-bad/20 border-status-bad text-status-bad',
                  state === 'pending' && 'border-border text-text-faint'
                )}
              >
                {state === 'done' && <Check size={11} strokeWidth={3} />}
                {state === 'active' && <Loader2 size={11} className="animate-spin" />}
                {state === 'failed' && <X size={11} strokeWidth={3} />}
                {state === 'active' && <motion.span className="absolute inset-0 rounded-full border border-accent-soft" initial={{ scale: 1, opacity: 0.8 }} animate={{ scale: 1.8, opacity: 0 }} transition={{ repeat: Infinity, duration: 1.1 }} />}
              </div>
              {i < STAGES.length - 1 && <div className={cn('h-px flex-1', stageIdx < curIdx || job.status === 'done' ? 'bg-status-good/60' : 'bg-border')} />}
            </div>
            <span className={cn('text-[9px] truncate max-w-full', state === 'pending' ? 'text-text-faint' : 'text-text-muted')}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}
