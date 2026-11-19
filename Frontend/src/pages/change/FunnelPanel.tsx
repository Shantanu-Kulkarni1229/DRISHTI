import { motion } from 'framer-motion';
import { Filter, ChevronRight } from 'lucide-react';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import { Card, CardHeader } from '../../components/ui/Card';
import { cn } from '../../lib/utils';
import type { SuppressionGateId } from '../../lib/types';
import { GATE_INFO, DROP_CATEGORIES } from './changeHelpers';

interface Props {
  active: boolean;
  screened: number;
  passedQuality: number;
  persisted: number;
  reported: number;
  gateCounts: Record<SuppressionGateId, number>;
  onInspectCategory: (key: string) => void;
  onInspectGate: (gate: SuppressionGateId) => void;
}

const STAGES = [
  { id: 'screened', label: 'Screened', note: 'every tile pair compared across the two dates' },
  { id: 'passedQuality', label: 'Passed quality', note: 'clear, well-lit and well-aligned' },
  { id: 'persisted', label: 'Persisted', note: 'still present in later frames, not seasonal' },
  { id: 'reported', label: 'Reported', note: 'survived every gate — shown to the analyst' },
] as const;

export function FunnelPanel(p: Props) {
  const counts = [p.screened, p.passedQuality, p.persisted, p.reported].map((n) => (p.active ? n : 0));
  const max = Math.max(p.screened, 1);
  const widthFor = (n: number) => (n <= 0 ? 0 : Math.max(4, (Math.log(n + 1) / Math.log(max + 1)) * 100));
  const keptPct = p.screened > 0 ? (p.reported / p.screened) * 100 : 0;

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-1.5"><Filter size={13} className="text-accent-soft" /> Suppression funnel</span>}
        subtitle="How thousands of noisy differences become a handful of real findings. Tap a drop to see what was removed and why."
      />
      <div className="p-3 sm:p-4 space-y-3">
        {STAGES.map((s, i) => {
          const dropped = i > 0 ? counts[i - 1] - counts[i] : 0;
          const cat = i > 0 ? DROP_CATEGORIES[i - 1] : null;
          return (
            <div key={s.id}>
              {i > 0 && p.active && dropped > 0 && cat && (
                <button
                  onClick={() => p.onInspectCategory(cat.key)}
                  className="group flex items-center gap-1 text-[10px] text-text-muted hover:text-accent-soft mb-1.5 ml-1 transition-colors"
                >
                  <ChevronRight size={10} className="transition-transform group-hover:translate-x-0.5" />
                  <AnimatedNumber value={dropped} className="mono" /> dropped — {cat.title.replace('Dropped ', '')}
                </button>
              )}
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs font-medium text-text-primary">{s.label} <span className="text-[10px] text-text-faint font-normal hidden sm:inline">· {s.note}</span></span>
                <AnimatedNumber value={counts[i]} className="mono text-sm font-semibold text-text-primary" />
              </div>
              <div className="h-5 rounded bg-bg-raised overflow-hidden">
                <motion.div
                  className="h-full rounded"
                  style={{ background: `linear-gradient(90deg, var(--color-accent), ${i === 3 ? 'var(--color-status-good)' : 'var(--color-accent-soft)'})` }}
                  animate={{ width: `${widthFor(counts[i])}%` }}
                  transition={{ duration: 0.9, delay: 0.12 * i, ease: 'easeOut' }}
                />
              </div>
            </div>
          );
        })}

        <div className={cn('rounded-md border border-border-subtle bg-bg-raised/50 p-2.5 text-[11px] text-text-secondary leading-relaxed transition-opacity', !p.active && 'opacity-40')}>
          Only <span className="mono text-status-good">{keptPct.toFixed(1)}%</span> of candidates are reported. That is deliberate: a short list an analyst can trust beats a long list they have to second-guess.
        </div>

        <div>
          <div className="text-[10px] text-text-faint mb-1.5">The seven gates (tap one to see what it rejected)</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(GATE_INFO) as SuppressionGateId[]).map((g) => (
              <button
                key={g}
                onClick={() => p.onInspectGate(g)}
                title={GATE_INFO[g].explain}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-border text-[10px] text-text-secondary hover:border-accent/60 hover:text-accent-soft transition-colors"
              >
                {GATE_INFO[g].label}
                <span className="mono text-text-faint">{p.gateCounts[g] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
