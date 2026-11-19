import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Play, Loader2, Check, CalendarRange, Layers3, Gauge, Rocket, Wand2 } from 'lucide-react';
import { CHANGE_TYPE_COLORS, CHANGE_TYPE_LABELS } from '../../lib/colors';
import { Slider } from '../../components/ui/Slider';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import { Tooltip } from '../../components/ui/Tooltip';
import { cn } from '../../lib/utils';
import type { ChangeType } from '../../lib/types';
import type { DateMode, StageLogEntry } from '../../state/changeStore';
import { STAGE_INFO, TYPES } from './changeHelpers';

interface Props {
  years: number[];
  dateMode: DateMode;
  onDateMode: (m: DateMode) => void;
  beforeYear: number;
  afterYear: number;
  onPickBefore: (y: number) => void;
  onPickAfter: (y: number) => void;
  selectedTypes: ChangeType[];
  onToggleType: (t: ChangeType) => void;
  typeCounts: Record<ChangeType, number>;
  sensitivity: number;
  onSensitivity: (v: number) => void;
  threshold: number;
  precision: number;
  recall: number;
  shown: number;
  inWindow: number;
  running: boolean;
  analysisDone: boolean;
  stages: StageLogEntry[];
  onRun: () => void;
}

function Step({ n, icon, title, hint, children, delay }: { n: number; icon: ReactNode; title: string; hint: string; children: ReactNode; delay: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="w-5 h-5 rounded-full bg-accent/20 border border-accent/40 text-accent-soft text-[10px] mono font-bold flex items-center justify-center">
          {n}
        </span>
        <span className="text-accent-soft">{icon}</span>
        <h3 className="text-xs font-semibold text-text-primary">{title}</h3>
      </div>
      <p className="text-[11px] text-text-faint mb-2 pl-7">{hint}</p>
      <div className="pl-0 sm:pl-7">{children}</div>
    </motion.section>
  );
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex-1">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] text-text-muted">{label}</span>
        <AnimatedNumber value={Math.round(value * 100)} suffix="%" className="mono text-xs font-semibold text-text-primary" />
      </div>
      <div className="h-1.5 rounded-full bg-bg-raised overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: color }} animate={{ width: `${value * 100}%` }} transition={{ type: 'spring', stiffness: 160, damping: 22 }} />
      </div>
    </div>
  );
}

export function ControlsPanel(p: Props) {
  const bias = p.sensitivity < 0.35 ? 'Favouring precision — fewer, surer findings' : p.sensitivity > 0.65 ? 'Favouring recall — catch more, accept more noise' : 'Balanced — a sensible middle ground';

  return (
    <div className="space-y-6">
      <Step n={1} icon={<CalendarRange size={13} />} title="Time window" hint="Which two frames should be compared?" delay={0.02}>
        <div className="relative flex gap-1 bg-bg-raised rounded-md p-1 mb-2.5">
          {(['range', 'pair'] as const).map((m) => (
            <button
              key={m}
              onClick={() => p.onDateMode(m)}
              className={cn('relative flex-1 py-1.5 text-[11px] font-medium rounded z-10 transition-colors', p.dateMode === m ? 'text-white' : 'text-text-muted hover:text-text-secondary')}
            >
              {p.dateMode === m && (
                <motion.div layoutId="date-mode-pill" className="absolute inset-0 bg-accent rounded" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />
              )}
              <span className="relative">{m === 'range' ? 'Auto — whole decade' : 'Pick two years'}</span>
            </button>
          ))}
        </div>

        {p.dateMode === 'range' ? (
          <p className="text-[11px] text-text-muted leading-relaxed">
            The system picks the best usable frames itself: <span className="mono text-text-primary">{p.beforeYear}</span> →{' '}
            <span className="mono text-text-primary">{p.afterYear}</span>.
          </p>
        ) : (
          <div className="space-y-2">
            {([
              { label: 'Before', value: p.beforeYear, disabled: (y: number) => y >= p.afterYear, pick: p.onPickBefore },
              { label: 'After', value: p.afterYear, disabled: (y: number) => y <= p.beforeYear, pick: p.onPickAfter },
            ]).map((row) => (
              <div key={row.label}>
                <div className="text-[10px] text-text-faint mb-1">{row.label}</div>
                <div className="flex flex-wrap gap-1">
                  {p.years.map((y) => {
                    const active = y === row.value;
                    const off = row.disabled(y);
                    return (
                      <button
                        key={y}
                        disabled={off}
                        onClick={() => row.pick(y)}
                        className={cn(
                          'relative px-1.5 py-1 rounded text-[10px] mono border transition-colors',
                          active ? 'text-white border-accent' : off ? 'text-text-faint/40 border-transparent cursor-not-allowed' : 'text-text-muted border-border hover:text-text-primary hover:border-border-strong'
                        )}
                      >
                        {active && <motion.span layoutId={`year-${row.label}`} className="absolute inset-0 bg-accent rounded" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
                        <span className="relative">{y}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Step>

      <Step n={2} icon={<Layers3 size={13} />} title="What kind of change?" hint="Tap a type to include or ignore it. Counts show findings in this window." delay={0.08}>
        <div className="grid grid-cols-2 gap-1.5">
          {TYPES.map((t) => {
            const on = p.selectedTypes.includes(t);
            const color = CHANGE_TYPE_COLORS[t];
            return (
              <motion.button
                key={t}
                whileTap={{ scale: 0.96 }}
                onClick={() => p.onToggleType(t)}
                className={cn('flex items-center gap-2 px-2 py-1.5 rounded-md border text-left transition-colors', on ? 'bg-bg-raised' : 'opacity-50 hover:opacity-80')}
                style={{ borderColor: on ? `${color}88` : 'var(--color-border)' }}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color, boxShadow: on ? `0 0 8px ${color}` : 'none' }} />
                <span className="flex-1 text-[11px] text-text-secondary leading-tight">{CHANGE_TYPE_LABELS[t]}</span>
                <AnimatedNumber value={p.typeCounts[t]} className="mono text-[11px] text-text-primary" />
              </motion.button>
            );
          })}
        </div>
      </Step>

      <Step n={3} icon={<Gauge size={13} />} title="Precision ↔ recall" hint="Slide toward precision for surer findings, toward recall to miss less." delay={0.14}>
        <Slider value={p.sensitivity} onChange={p.onSensitivity} leftLabel="precision" rightLabel="recall" />
        <div className="mt-3 flex gap-3">
          <Meter label="expected precision" value={p.precision} color="var(--color-status-good)" />
          <Meter label="expected recall" value={p.recall} color="var(--color-accent-soft)" />
        </div>
        <div className="mt-2.5 flex items-start gap-1.5 text-[11px] text-text-muted leading-snug">
          <Wand2 size={11} className="mt-0.5 text-accent-soft shrink-0" />
          <span>
            {bias}. Confidence cut-off <span className="mono text-text-primary">{p.threshold.toFixed(2)}</span> keeps{' '}
            <AnimatedNumber value={p.shown} className="mono text-text-primary" /> of <span className="mono">{p.inWindow}</span> findings.
          </span>
        </div>
      </Step>

      <Step n={4} icon={<Rocket size={13} />} title="Run it" hint="Detect, confirm and filter changes between your two frames." delay={0.2}>
        <Tooltip content="Keyboard: R">
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={p.running}
            onClick={p.onRun}
            className="relative w-full overflow-hidden rounded-lg py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-accent to-[#8b5cf6] disabled:opacity-70 flex items-center justify-center gap-2 shadow-lg shadow-accent/20"
          >
            {!p.running && !p.analysisDone && <span className="absolute inset-0 rounded-lg ring-2 ring-accent-soft/60 animate-ping" />}
            {p.running ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            <span className="relative">{p.running ? 'Analysing…' : p.analysisDone ? 'Run again' : 'Run analysis'}</span>
          </motion.button>
        </Tooltip>

        <div className="mt-4 relative">
          <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
          <motion.div
            className="absolute left-[9px] top-2 w-px bg-status-good origin-top"
            animate={{ height: `${(p.stages.filter((s) => s.status === 'done').length / p.stages.length) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
          <ul className="space-y-3">
            {p.stages.map((s) => {
              const info = STAGE_INFO[s.id];
              return (
                <li key={s.id} className="relative flex gap-3 items-start">
                  <span
                    className={cn(
                      'relative z-10 w-[19px] h-[19px] rounded-full border flex items-center justify-center shrink-0 bg-bg-panel',
                      s.status === 'done' ? 'border-status-good text-status-good' : s.status === 'running' ? 'border-accent-soft text-accent-soft' : 'border-border text-text-faint'
                    )}
                  >
                    {s.status === 'done' ? (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}><Check size={11} strokeWidth={3} /></motion.span>
                    ) : s.status === 'running' ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <span className="w-1 h-1 rounded-full bg-current" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={cn('text-[11px] font-medium', s.status === 'pending' ? 'text-text-faint' : 'text-text-primary')}>{info.title}</div>
                    {s.status !== 'pending' && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="text-[10px] text-text-muted leading-snug">
                        {info.detail}
                      </motion.p>
                    )}
                    {s.status === 'running' && (
                      <div className="h-1 rounded-full bg-bg-raised overflow-hidden mt-1.5">
                        <motion.div className="h-full bg-accent-soft rounded-full" animate={{ width: `${s.progress}%` }} />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Step>
    </div>
  );
}
