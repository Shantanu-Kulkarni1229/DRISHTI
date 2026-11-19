import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, X, ExternalLink, ArrowUpDown, ScanSearch, CalendarClock } from 'lucide-react';
import { CHANGE_TYPE_COLORS, CHANGE_TYPE_LABELS, confidenceColor } from '../../lib/colors';
import { tileById } from '../../lib/mockData';
import { useReviewStore } from '../../state/reviewStore';
import { TileThumb } from '../../components/ui/TileThumb';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConfidenceBars } from '../../components/charts/ConfidenceBars';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import { cn, formatDate } from '../../lib/utils';
import type { ChangeCandidate } from '../../lib/types';
import { yearOf } from './changeHelpers';

export type FindingSort = 'confidence' | 'date' | 'area';

interface Props {
  findings: ChangeCandidate[];
  numberById: Map<string, number>;
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  analysisDone: boolean;
  running: boolean;
  inWindow: number;
  sort: FindingSort;
  onSort: (s: FindingSort) => void;
}

function Ring({ value }: { value: number }) {
  const r = 13;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-9 h-9 shrink-0">
      <svg viewBox="0 0 32 32" className="w-9 h-9 -rotate-90">
        <circle cx="16" cy="16" r={r} fill="none" stroke="var(--color-border)" strokeWidth="3" />
        <motion.circle
          cx="16" cy="16" r={r} fill="none" stroke={confidenceColor(value)} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - value) }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center mono text-[9px] font-semibold text-text-primary">{Math.round(value * 100)}</span>
    </div>
  );
}

function FindingCard({ c, n, active, expanded, onHover, onSelect }: { c: ChangeCandidate; n: number; active: boolean; expanded: boolean; onHover: (id: string | null) => void; onSelect: (id: string | null) => void }) {
  const navigate = useNavigate();
  const { statusFor, decide } = useReviewStore();
  const status = statusFor(c.id).status;
  const color = CHANGE_TYPE_COLORS[c.type];
  const tb = tileById(c.tileBeforeId);
  const ta = tileById(c.tileAfterId);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      onMouseEnter={() => onHover(c.id)}
      onMouseLeave={() => onHover(null)}
      className={cn('rounded-lg border bg-bg-panel overflow-hidden transition-colors', active ? 'border-transparent' : 'border-border-subtle hover:border-border-strong')}
      style={active ? { boxShadow: `0 0 0 1.5px ${color}, 0 4px 20px ${color}22` } : undefined}
    >
      <button onClick={() => onSelect(expanded ? null : c.id)} className="w-full flex items-start gap-2.5 p-2.5 text-left">
        <span className="w-6 h-6 rounded-full text-[11px] mono font-bold flex items-center justify-center text-[#0a0e16] shrink-0 mt-0.5" style={{ background: color }}>{n}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium text-text-primary leading-snug">{c.headline}</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
            <Badge color={color} variant="dot">{CHANGE_TYPE_LABELS[c.type]}</Badge>
            <span className="text-[10px] text-text-faint capitalize">{c.direction}</span>
            <span className="text-[10px] mono text-text-faint">{yearOf(c.earliestIntervalEnd)}</span>
            {status !== 'pending' && (
              <span className={cn('text-[10px] px-1.5 rounded border', status === 'accepted' ? 'text-status-good border-status-good/40' : 'text-status-bad border-status-bad/40')}>{status}</span>
            )}
          </div>
        </div>
        <Ring value={c.confidence} />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pb-3 space-y-3 border-t border-border-subtle pt-2.5">
              <p className="text-[11px] text-text-secondary leading-relaxed">{c.narrative}</p>
              <div className="grid grid-cols-2 gap-2">
                {tb && <TileThumb tile={tb} size="100%" className="h-20" cornerBadge={<Badge variant="solid">before</Badge>} />}
                {ta && <TileThumb tile={ta} size="100%" className="h-20" cornerBadge={<Badge variant="solid">after</Badge>} />}
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div><div className="text-text-faint">Area</div><div className="mono text-text-primary">{c.areaM2 >= 10000 ? `${(c.areaM2 / 10000).toFixed(1)} ha` : `${c.areaM2.toLocaleString()} m²`}</div></div>
                <div><div className="text-text-faint flex items-center gap-1"><CalendarClock size={9} /> First seen</div><div className="mono text-text-primary">{formatDate(c.earliestIntervalEnd)}</div></div>
                <div><div className="text-text-faint">Revisit gap</div><div className="mono text-text-primary">{c.revisitGapDays} d</div></div>
              </div>
              <div>
                <div className="text-[10px] text-text-faint mb-1.5">Why we believe it</div>
                <ConfidenceBars factors={c.factors} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="xs" variant="primary" disabled={status === 'accepted'} icon={<Check size={11} />} onClick={() => decide(c.id, 'accepted')}>Accept</Button>
                <Button size="xs" variant="danger" disabled={status === 'rejected'} icon={<X size={11} />} onClick={() => decide(c.id, 'rejected', 'not_of_interest')}>Reject</Button>
                <Button size="xs" variant="outline" icon={<ExternalLink size={11} />} onClick={() => navigate(`/evidence/${c.id}`)}>Full evidence</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FindingsPanel(p: Props) {
  const SORTS: FindingSort[] = ['confidence', 'date', 'area'];
  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
          <ScanSearch size={13} className="text-accent-soft" /> Findings
          <span className="mono text-[11px] text-accent-soft"><AnimatedNumber value={p.analysisDone ? p.findings.length : 0} /></span>
        </h3>
        <button
          onClick={() => p.onSort(SORTS[(SORTS.indexOf(p.sort) + 1) % SORTS.length])}
          className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-primary"
        >
          <ArrowUpDown size={10} /> {p.sort}
        </button>
      </div>

      {!p.analysisDone ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <ScanSearch size={22} className="mx-auto text-text-faint mb-2" />
          <div className="text-xs text-text-secondary">{p.running ? 'Detecting changes…' : 'No analysis yet'}</div>
          <p className="text-[11px] text-text-faint mt-1">Findings appear here — numbered, explained and linked to the map — once the analysis has run.</p>
        </div>
      ) : p.findings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <div className="text-xs text-text-secondary">Nothing at this setting</div>
          <p className="text-[11px] text-text-faint mt-1">
            {p.inWindow > 0 ? `${p.inWindow} finding${p.inWindow > 1 ? 's' : ''} sit below the confidence cut-off — slide toward recall to reveal them.` : 'No changes appeared between these two years. Try a wider window or more change types.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {p.findings.map((c) => (
              <FindingCard
                key={c.id}
                c={c}
                n={p.numberById.get(c.id) ?? 0}
                active={p.hoveredId === c.id || p.selectedId === c.id}
                expanded={p.selectedId === c.id}
                onHover={p.onHover}
                onSelect={p.onSelect}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
