import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, X, SkipForward, ChevronLeft, ChevronRight, ExternalLink, CircleCheck, TriangleAlert, User, History } from 'lucide-react';
import { CHANGE_TYPE_COLORS, CHANGE_TYPE_LABELS, confidenceColor } from '../../lib/colors';
import { ConfidenceBars } from '../../components/charts/ConfidenceBars';
import { Badge } from '../../components/ui/Badge';
import { cn, formatDate } from '../../lib/utils';
import type { ChangeCandidate, Decision, RejectReasonCode } from '../../lib/types';
import { FindingViewer, type ViewerMode } from '../../components/charts/FindingViewer';
import { candidateBox, qualityChecksFor, sceneImage, yearOf } from '../../lib/findingView';

export const REJECT_REASONS: { code: RejectReasonCode; label: string; hint: string }[] = [
  { code: 'cloud', label: 'Cloud', hint: 'Cloud or haze covers the site' },
  { code: 'shadow', label: 'Shadow', hint: 'A shadow was mistaken for change' },
  { code: 'seasonal', label: 'Seasonal', hint: 'Normal seasonal variation' },
  { code: 'misregistration', label: 'Misaligned', hint: 'The two images do not line up' },
  { code: 'not_of_interest', label: 'Not of interest', hint: 'Real, but irrelevant to us' },
  { code: 'duplicate', label: 'Duplicate', hint: 'Already reported elsewhere' },
];

interface Props {
  c: ChangeCandidate;
  number: number;
  total: number;
  aoiBbox: [number, number, number, number];
  aoiName: string;
  status: 'pending' | 'accepted' | 'rejected';
  rejectReason: RejectReasonCode | null;
  history: Decision[];
  assignee: string | null;
  analysts: string[];
  rejectMode: boolean;
  onRejectMode: (v: boolean) => void;
  onAccept: (note: string) => void;
  onReject: (reason: RejectReasonCode, note: string) => void;
  onSkip: () => void;
  onPrev: () => void;
  onNext: () => void;
  onAssign: (name: string | null) => void;
  onEvidence: () => void;
}

function Ring({ value }: { value: number }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-border)" strokeWidth="5" />
        <motion.circle
          key={value} cx="32" cy="32" r={r} fill="none" stroke={confidenceColor(value)} strokeWidth="5" strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: circ * (1 - value) }} transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="mono text-sm font-bold text-text-primary leading-none">{Math.round(value * 100)}</span>
        <span className="text-[8px] text-text-faint">conf.</span>
      </div>
    </div>
  );
}

export function FocusPanel(p: Props) {
  const { c } = p;
  const [mode, setMode] = useState<ViewerMode>('swipe');
  const [showBox, setShowBox] = useState(true);
  const [note, setNote] = useState('');
  useEffect(() => setNote(''), [c.id]);
  const color = CHANGE_TYPE_COLORS[c.type];
  const box = candidateBox(c, p.aoiBbox);
  const by = yearOf(c.earliestIntervalStart);
  const ay = yearOf(c.earliestIntervalEnd);
  const checks = qualityChecksFor(c);
  const failing = checks.filter((k) => !k.ok).length;

  return (
    <div className="flex flex-col min-h-full">
      <div className="p-4 space-y-4 flex-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button onClick={p.onPrev} className="w-7 h-7 flex items-center justify-center rounded-md border border-border text-text-muted hover:text-text-primary hover:bg-bg-hover"><ChevronLeft size={14} /></button>
            <button onClick={p.onNext} className="w-7 h-7 flex items-center justify-center rounded-md border border-border text-text-muted hover:text-text-primary hover:bg-bg-hover"><ChevronRight size={14} /></button>
          </div>
          <span className="mono text-[11px] text-text-muted">{p.number} of {p.total}</span>
          <span className="mono text-[11px] text-text-faint">{c.id}</span>
          <div className="flex-1" />
          <Badge color={color} variant="dot">{CHANGE_TYPE_LABELS[c.type]}</Badge>
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full border capitalize', p.status === 'accepted' ? 'text-status-good border-status-good/40 bg-status-good/10' : p.status === 'rejected' ? 'text-status-bad border-status-bad/40 bg-status-bad/10' : 'text-text-muted border-border')}>
            {p.status}{p.rejectReason ? ` · ${p.rejectReason.replace('_', ' ')}` : ''}
          </span>
        </div>

        <FindingViewer
          beforeImage={sceneImage(c.aoiId, by)} afterImage={sceneImage(c.aoiId, ay)} beforeYear={by} afterYear={ay}
          box={box} color={color} mode={mode} onMode={setMode} showBox={showBox} onShowBox={setShowBox}
        />

        <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-text-primary leading-snug">{c.headline}</h2>
            <p className="text-[12px] text-text-secondary mt-1 leading-relaxed">{c.narrative}</p>
          </div>
          <Ring value={c.confidence} />
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          {[
            ['Area', c.areaM2 >= 10000 ? `${(c.areaM2 / 10000).toFixed(1)} ha` : `${c.areaM2.toLocaleString()} m²`],
            ['First seen', formatDate(c.earliestIntervalEnd)],
            ['Direction', c.direction.charAt(0).toUpperCase() + c.direction.slice(1)],
            ['Location', `${c.geomCenter.lat.toFixed(3)}, ${c.geomCenter.lng.toFixed(3)}`],
          ].map(([k, v]) => (
            <div key={k} className="bg-bg-raised/60 border border-border-subtle rounded-lg px-2.5 py-1.5 min-w-0">
              <div className="text-[10px] text-text-faint">{k}</div>
              <div className="mono text-text-primary truncate">{v}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] font-semibold text-text-primary mb-2">Why we believe it</div>
            <ConfidenceBars factors={c.factors} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-text-primary mb-2 flex items-center gap-1.5">
              Quality checks
              <span className={cn('text-[10px] font-normal', failing ? 'text-status-warn' : 'text-status-good')}>{failing ? `${failing} to look at` : 'all clear'}</span>
            </div>
            <ul className="space-y-2">
              {checks.map((k) => (
                <li key={k.label} className="flex items-start gap-2">
                  {k.ok ? <CircleCheck size={13} className="text-status-good mt-0.5 shrink-0" /> : <TriangleAlert size={13} className="text-status-warn mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2"><span className="text-[11px] text-text-primary">{k.label}</span><span className="mono text-[11px] text-text-muted">{k.value}</span></div>
                    <div className="text-[10px] text-text-faint leading-snug">{k.note}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {p.history.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-text-primary mb-1.5 flex items-center gap-1.5"><History size={12} className="text-text-faint" /> Decision history</div>
            <ul className="space-y-1">
              {p.history.slice(0, 4).map((d) => (
                <li key={d.id} className="text-[11px] flex items-baseline gap-2 flex-wrap">
                  <span className={cn('capitalize font-medium', d.verdict === 'accepted' ? 'text-status-good' : 'text-status-bad')}>{d.verdict}</span>
                  <span className="text-text-secondary">by {d.actor}</span>
                  {d.reasonCode && <span className="text-text-muted">({d.reasonCode.replace('_', ' ')})</span>}
                  <span className="text-text-faint">— {d.note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* decision bar */}
      <div className="sticky bottom-0 border-t border-border bg-bg-panel/95 backdrop-blur p-3 space-y-2.5">
        <AnimatePresence initial={false}>
          {p.rejectMode && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="text-[10px] text-text-faint mb-1.5">Why is this not a real, useful finding? Press a number or tap.</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {REJECT_REASONS.map((r, i) => (
                  <motion.button
                    key={r.code} whileTap={{ scale: 0.96 }} onClick={() => p.onReject(r.code, note)}
                    className="text-left px-2 py-1.5 rounded-md border border-border-strong bg-bg-raised hover:border-status-bad/70 hover:bg-status-bad/10 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-text-primary"><kbd className="mono text-[10px] text-text-faint">{i + 1}</kbd>{r.label}</div>
                    <div className="text-[9px] text-text-faint leading-tight mt-0.5">{r.hint}</div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)…"
            className="flex-1 min-w-[140px] bg-bg-raised border border-border rounded-md px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-accent-soft"
          />
          <label className="flex items-center gap-1 text-[11px] text-text-muted">
            <User size={11} />
            <select value={p.assignee ?? ''} onChange={(e) => p.onAssign(e.target.value || null)} className="bg-bg-raised border border-border rounded px-1.5 py-1 text-[11px] text-text-primary">
              <option value="">unassigned</option>
              {p.analysts.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => p.onAccept(note)} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-status-good/90 hover:bg-status-good text-[#04130c] font-semibold text-sm transition-colors">
            <Check size={16} strokeWidth={3} /> Accept <kbd className="mono text-[10px] opacity-60 hidden sm:inline">A</kbd>
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => p.onRejectMode(!p.rejectMode)} className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border font-semibold text-sm transition-colors', p.rejectMode ? 'bg-status-bad/20 border-status-bad text-status-bad' : 'border-status-bad/50 text-status-bad hover:bg-status-bad/10')}>
            <X size={16} strokeWidth={3} /> Reject <kbd className="mono text-[10px] opacity-60 hidden sm:inline">R</kbd>
          </motion.button>
          <button onClick={p.onSkip} className="px-3 py-2.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover text-sm flex items-center gap-1.5">
            <SkipForward size={14} /> <span className="hidden sm:inline">Skip</span> <kbd className="mono text-[10px] opacity-50 hidden sm:inline">S</kbd>
          </button>
          <button onClick={p.onEvidence} title="Open the full evidence page (Enter)" className="px-2.5 py-2.5 rounded-lg border border-border text-text-muted hover:text-accent-soft hover:border-accent/50">
            <ExternalLink size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
