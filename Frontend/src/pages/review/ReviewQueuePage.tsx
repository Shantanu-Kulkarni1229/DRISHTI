import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { ListChecks, Info, Undo2, SquareCheck, Search as SearchIcon, ArrowUpDown, Check, X, CheckCheck, Layers } from 'lucide-react';
import { CHANGE_CANDIDATES, aoiById } from '../../lib/mockData';
import { CHANGE_TYPE_COLORS, CHANGE_TYPE_LABELS, confidenceColor } from '../../lib/colors';
import { useReviewStore } from '../../state/reviewStore';
import { useShortcuts } from '../../lib/useShortcuts';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Drawer } from '../../components/ui/Drawer';
import { EmptyState } from '../../components/ui/EmptyState';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import { Tooltip } from '../../components/ui/Tooltip';
import type { ChangeCandidate, ChangeType, RejectReasonCode } from '../../lib/types';
import { FocusPanel, REJECT_REASONS } from './FocusPanel';
import { FindingCrop, candidateBox, sceneImage, yearOf } from '../../lib/findingView';

const TYPES: ChangeType[] = ['construction', 'clearance', 'water', 'roads'];
const ANALYSTS = ['A. Rao', 'S. Verma', 'K. Nair', 'M. Iyer'];
type Status = 'pending' | 'accepted' | 'rejected';
type SortKey = 'confidence' | 'date' | 'area';

// The population a real system would surface to review: candidates that survived every suppression gate.
const REVIEWABLE = CHANGE_CANDIDATES.filter((c) => c.suppressedBy === null);

function useMediaQuery(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = () => setM(mq.matches);
    mq.addEventListener('change', h);
    h();
    return () => mq.removeEventListener('change', h);
  }, [q]);
  return m;
}

const AVATAR = ['#818cf8', '#34d399', '#fbbf24', '#f472b6', '#38bdf8'];
function Avatar({ name }: { name: string | null }) {
  if (!name) return <span className="w-6 h-6 rounded-full border border-dashed border-border shrink-0" title="unassigned" />;
  const initials = name.replace(/[^A-Za-z ]/g, ' ').split(' ').filter(Boolean).map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  const color = AVATAR[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % AVATAR.length];
  return <span title={name} className="w-6 h-6 rounded-full text-[9px] font-bold flex items-center justify-center text-[#0a0e16] shrink-0" style={{ background: color }}>{initials}</span>;
}

function QueueRow({ c, aoiBbox, selected, checked, selectMode, status, assignee, onSelect, onCheck, rowRef }: {
  c: ChangeCandidate; aoiBbox: [number, number, number, number]; selected: boolean; checked: boolean; selectMode: boolean; status: Status; assignee: string | null;
  onSelect: () => void; onCheck: () => void; rowRef: (el: HTMLDivElement | null) => void;
}) {
  const box = candidateBox(c, aoiBbox);
  const color = CHANGE_TYPE_COLORS[c.type];
  const by = yearOf(c.earliestIntervalStart);
  const ay = yearOf(c.earliestIntervalEnd);
  const risky = c.registrationResidualPx > 1.2 || c.seasonalZScore < 2 || c.sarAgreement < 0.55;
  return (
    <motion.div
      ref={rowRef}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -60, transition: { duration: 0.25 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      onClick={onSelect}
      className={cn('relative flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors', selected ? 'bg-bg-hover border-transparent' : 'border-border-subtle hover:bg-bg-panel hover:border-border')}
      style={selected ? { boxShadow: `0 0 0 1.5px ${color}` } : undefined}
    >
      {selectMode && (
        <input type="checkbox" checked={checked} onClick={(e) => e.stopPropagation()} onChange={onCheck} className="accent-[var(--color-accent)] shrink-0" />
      )}
      <div className="flex gap-0.5 shrink-0">
        <FindingCrop imageUrl={sceneImage(c.aoiId, by)} box={box} size={46} tag={String(by)} />
        <FindingCrop imageUrl={sceneImage(c.aoiId, ay)} box={box} size={46} tag={String(ay)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium text-text-primary leading-snug line-clamp-2">{c.headline}</div>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-text-muted">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />{CHANGE_TYPE_LABELS[c.type]}</span>
          <span className="mono text-text-faint">{ay}</span>
          {risky && <span className="text-status-warn" title="Has quality checks worth a look">⚠ check</span>}
          {status !== 'pending' && (
            <span className={cn('capitalize', status === 'accepted' ? 'text-status-good' : 'text-status-bad')}>{status}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="mono text-[12px] font-semibold" style={{ color: confidenceColor(c.confidence) }}>{Math.round(c.confidence * 100)}%</span>
        <Avatar name={assignee} />
      </div>
    </motion.div>
  );
}

function Confetti() {
  const colors = ['#34d399', '#818cf8', '#fbbf24', '#f472b6', '#38bdf8'];
  return (
    <>
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const d = 70 + (i % 3) * 22;
        return (
          <motion.span
            key={i} className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full"
            style={{ background: colors[i % colors.length] }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d, opacity: 0, scale: 0.4 }}
            transition={{ duration: 1.1, delay: 0.25, ease: 'easeOut' }}
          />
        );
      })}
    </>
  );
}

function ClearedState({ accepted, rejected, avgConf, onViewAccepted, onExport }: { accepted: number; rejected: number; avgConf: number; onViewAccepted: () => void; onExport: () => void }) {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-sm">
        <div className="relative w-20 h-20 mx-auto mb-4">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} className="w-20 h-20 rounded-full bg-status-good/15 border-2 border-status-good flex items-center justify-center">
            <CheckCheck size={34} className="text-status-good" />
          </motion.div>
          <motion.span className="absolute inset-0 rounded-full border-2 border-status-good" initial={{ scale: 1, opacity: 0.7 }} animate={{ scale: 1.9, opacity: 0 }} transition={{ duration: 1.3, repeat: Infinity }} />
          <Confetti />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">Queue cleared</h2>
        <p className="text-[12px] text-text-muted mt-1">Every finding has a decision and a record.</p>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[['Accepted', accepted, 'text-status-good'], ['Rejected', rejected, 'text-status-bad']].map(([l, v, c]) => (
            <div key={l as string} className="bg-bg-raised/60 border border-border-subtle rounded-lg py-2"><AnimatedNumber value={v as number} className={cn('mono text-xl font-semibold', c as string)} /><div className="text-[10px] text-text-faint">{l}</div></div>
          ))}
          <div className="bg-bg-raised/60 border border-border-subtle rounded-lg py-2"><AnimatedNumber value={Math.round(avgConf * 100)} suffix="%" className="mono text-xl font-semibold text-text-primary" /><div className="text-[10px] text-text-faint">avg. confidence</div></div>
        </div>
        <div className="flex justify-center gap-2 mt-5">
          <Button size="sm" variant="secondary" onClick={onViewAccepted}>Review accepted</Button>
          <Button size="sm" variant="primary" onClick={onExport}>Export results</Button>
        </div>
      </motion.div>
    </div>
  );
}

export function ReviewQueuePage() {
  const navigate = useNavigate();
  const isWide = useMediaQuery('(min-width: 1280px)');
  const { actor, setActor, decide, bulkDecide, undoLast, assign, statusFor, decisions, assignments } = useReviewStore();

  const [typeFilter, setTypeFilter] = useState<ChangeType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('pending');
  const [sortKey, setSortKey] = useState<SortKey>('confidence');
  const [query, setQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<'accept' | 'reject' | null>(null);
  const [bulkReason, setBulkReason] = useState<RejectReasonCode>('not_of_interest');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [rejectMode, setRejectMode] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; msg: string; canUndo: boolean } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const sessionStart = useRef(new Date().toISOString());

  const aoiBbox = aoiById(REVIEWABLE[0]?.aoiId)!.bbox;
  const aoiName = aoiById(REVIEWABLE[0]?.aoiId)!.name;

  const counts = useMemo(() => {
    const k = { pending: 0, accepted: 0, rejected: 0 };
    REVIEWABLE.forEach((c) => { k[statusFor(c.id).status] += 1; });
    return k;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisions]);
  const total = REVIEWABLE.length;
  const reviewed = counts.accepted + counts.rejected;
  const sessionCount = decisions.filter((d) => d.createdAt >= sessionStart.current).length;

  const inStatusAndQuery = useMemo(() => {
    const q = query.trim().toLowerCase();
    return REVIEWABLE.filter((c) => statusFilter === 'all' || statusFor(c.id).status === statusFilter).filter((c) => !q || `${c.headline} ${c.narrative} ${c.id}`.toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, query, decisions]);
  const typeCounts = useMemo(() => TYPES.reduce((a, t) => ({ ...a, [t]: inStatusAndQuery.filter((c) => c.type === t).length }), {} as Record<ChangeType, number>), [inStatusAndQuery]);
  const rows = useMemo(
    () => inStatusAndQuery.filter((c) => typeFilter === 'all' || c.type === typeFilter).sort((a, b) =>
      sortKey === 'confidence' ? b.confidence - a.confidence : sortKey === 'area' ? b.areaM2 - a.areaM2 : b.earliestIntervalEnd.localeCompare(a.earliestIntervalEnd)
    ),
    [inStatusAndQuery, typeFilter, sortKey]
  );

  useEffect(() => {
    if (selectedIndex >= rows.length) setSelectedIndex(Math.max(0, rows.length - 1));
  }, [rows.length, selectedIndex]);

  const current = rows[selectedIndex];
  useEffect(() => {
    if (current) rowRefs.current[current.id]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const move = (d: number) => setSelectedIndex((i) => Math.min(rows.length - 1, Math.max(0, i + d)));
  const say = (msg: string, canUndo = true) => setToast({ id: Date.now(), msg, canUndo });

  // A decided row leaves a filtered list, so the next one slides into the same slot; only step forward if it stayed.
  const afterDecision = (verdict: Status) => {
    setRejectMode(false);
    if (statusFilter === 'all' || statusFilter === verdict) move(1);
  };
  const accept = (note = '') => {
    if (!current) return;
    decide(current.id, 'accepted', null, note);
    say(`Accepted — ${current.headline}`);
    afterDecision('accepted');
  };
  const reject = (reason: RejectReasonCode, note = '') => {
    if (!current) return;
    decide(current.id, 'rejected', reason, note);
    say(`Rejected as ${reason.replace('_', ' ')} — ${current.headline}`);
    afterDecision('rejected');
  };
  const undo = () => {
    const r = undoLast();
    say(r ? `Undid ${r.count} decision${r.count > 1 ? 's' : ''}` : 'Nothing to undo', false);
  };
  const toggleCheck = (id: string) => setChecked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const runBulk = (v: 'accepted' | 'rejected') => {
    const n = checked.size;
    bulkDecide([...checked], v, v === 'rejected' ? bulkReason : null);
    say(`${v === 'accepted' ? 'Accepted' : 'Rejected'} ${n} finding${n > 1 ? 's' : ''}`);
    setChecked(new Set());
    setConfirm(null);
  };

  useShortcuts(
    {
      j: () => move(1), k: () => move(-1), arrowdown: () => move(1), arrowup: () => move(-1),
      a: () => accept(), r: () => setRejectMode((v) => !v), s: () => { setRejectMode(false); move(1); }, u: undo,
      x: () => { if (current) { setSelectMode(true); toggleCheck(current.id); } },
      '/': () => searchRef.current?.focus(),
      escape: () => { setRejectMode(false); setChecked(new Set()); },
      enter: () => current && navigate(`/evidence/${current.id}`),
      ...Object.fromEntries(REJECT_REASONS.map((r, i) => [String(i + 1), () => rejectMode && reject(r.code)])),
    },
    [
      { keys: 'J / K', label: 'next / previous finding' },
      { keys: 'A', label: 'accept' },
      { keys: 'R then 1–6', label: 'reject with a reason' },
      { keys: 'S', label: 'skip' },
      { keys: 'U', label: 'undo the last decision' },
      { keys: 'X', label: 'tick for bulk actions' },
      { keys: '/', label: 'search the queue' },
      { keys: 'Enter', label: 'open full evidence' },
      { keys: 'Esc', label: 'cancel' },
    ]
  );

  const acceptedRows = REVIEWABLE.filter((c) => statusFor(c.id).status === 'accepted');
  const avgConf = acceptedRows.length ? acceptedRows.reduce((s, c) => s + c.confidence, 0) / acceptedRows.length : 0;
  const cleared = counts.pending === 0 && statusFilter === 'pending';

  const focus = current && (
    <FocusPanel
      c={current} number={selectedIndex + 1} total={rows.length} aoiBbox={aoiBbox} aoiName={aoiName}
      status={statusFor(current.id).status} rejectReason={statusFor(current.id).rejectReason}
      history={decisions.filter((d) => d.candidateId === current.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))}
      assignee={assignments[current.id] ?? null} analysts={ANALYSTS}
      rejectMode={rejectMode} onRejectMode={setRejectMode} onAccept={accept} onReject={reject}
      onSkip={() => { setRejectMode(false); move(1); }} onPrev={() => move(-1)} onNext={() => move(1)}
      onAssign={(n) => assign([current.id], n)} onEvidence={() => navigate(`/evidence/${current.id}`)}
    />
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 border-b border-border-subtle px-3 sm:px-4 py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
            <h1 className="text-base font-semibold text-text-primary flex items-center gap-2"><ListChecks size={17} className="text-accent-soft" /> Review queue</h1>
            <p className="text-[11px] text-text-muted mt-0.5">Work through findings fast — every decision leaves a record and teaches the ranking.</p>
          </div>
          <Tooltip content="Undo (U)"><button onClick={undo} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover"><Undo2 size={13} /> <span className="hidden sm:inline">Undo</span></button></Tooltip>
          <label className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span className="hidden sm:inline">Reviewing as</span>
            <select value={actor} onChange={(e) => setActor(e.target.value)} className="bg-bg-raised border border-border rounded px-2 py-1 text-[11px] text-text-primary">
              {ANALYSTS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <button onClick={() => setHelpOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-text-secondary hover:text-accent-soft hover:border-accent/50 transition-colors"><Info size={13} /> How it works</button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-[repeat(4,auto)_1fr] gap-3 items-center">
          {[['Pending', counts.pending, 'text-text-primary'], ['Accepted', counts.accepted, 'text-status-good'], ['Rejected', counts.rejected, 'text-status-bad']].map(([l, v, c]) => (
            <div key={l as string} className="flex items-baseline gap-2"><AnimatedNumber value={v as number} className={cn('mono text-xl font-semibold', c as string)} /><span className="text-[11px] text-text-muted">{l}</span></div>
          ))}
          <Tooltip content="Each decision is stored as a labelled example that re-ranks future results and builds the false-alarm dataset">
            <div className="flex items-baseline gap-2"><AnimatedNumber value={decisions.length} className="mono text-xl font-semibold text-accent-soft" /><span className="text-[11px] text-text-muted">fed back to ranking</span></div>
          </Tooltip>
          <div className="col-span-2 lg:col-span-1">
            <div className="flex h-2 rounded-full overflow-hidden bg-bg-raised">
              <motion.div className="bg-status-good" animate={{ width: `${(counts.accepted / Math.max(1, total)) * 100}%` }} transition={{ duration: 0.6 }} />
              <motion.div className="bg-status-bad" animate={{ width: `${(counts.rejected / Math.max(1, total)) * 100}%` }} transition={{ duration: 0.6 }} />
            </div>
            <div className="text-[10px] text-text-faint mt-1 mono">{reviewed} of {total} reviewed{sessionCount > 0 ? ` · ${sessionCount} this session` : ''}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 xl:grid xl:grid-cols-[minmax(360px,460px)_minmax(0,1fr)] flex flex-col">
        <div className="flex flex-col min-h-0 flex-1 xl:border-r border-border-subtle">
          <div className="shrink-0 p-3 space-y-2.5 border-b border-border-subtle">
            <div className="relative flex bg-bg-raised rounded-lg p-1">
              {([['pending', counts.pending], ['accepted', counts.accepted], ['rejected', counts.rejected], ['all', total]] as [Status | 'all', number][]).map(([s, n]) => (
                <button key={s} onClick={() => setStatusFilter(s)} className={cn('relative flex-1 py-1.5 rounded-md text-[11px] font-medium capitalize z-10 transition-colors', statusFilter === s ? 'text-white' : 'text-text-muted hover:text-text-secondary')}>
                  {statusFilter === s && <motion.span layoutId="rv-status" className="absolute inset-0 bg-accent rounded-md" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
                  <span className="relative">{s} <span className="mono opacity-70">{n}</span></span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setTypeFilter('all')} className={cn('px-2 py-1 rounded-full border text-[10px] transition-colors', typeFilter === 'all' ? 'border-accent/60 bg-accent/15 text-accent-soft' : 'border-border text-text-muted hover:text-text-secondary')}>all types <span className="mono">{inStatusAndQuery.length}</span></button>
              {TYPES.filter((t) => typeCounts[t] > 0 || typeFilter === t).map((t) => (
                <button key={t} onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)} className={cn('flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] transition-colors', typeFilter === t ? 'bg-bg-hover text-text-primary' : 'border-border text-text-muted hover:text-text-secondary')} style={typeFilter === t ? { borderColor: CHANGE_TYPE_COLORS[t] } : undefined}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: CHANGE_TYPE_COLORS[t] }} />{CHANGE_TYPE_LABELS[t]} <span className="mono">{typeCounts[t]}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <SearchIcon size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" />
                <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search findings…  ( / )" className="w-full bg-bg-raised border border-border rounded-md pl-7 pr-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-accent-soft" />
              </div>
              <button onClick={() => setSortKey((k) => (k === 'confidence' ? 'date' : k === 'date' ? 'area' : 'confidence'))} className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-border text-[11px] text-text-secondary hover:text-text-primary whitespace-nowrap"><ArrowUpDown size={11} /> {sortKey}</button>
              <Tooltip content="Select several findings for bulk actions (X)"><button onClick={() => { setSelectMode((v) => !v); setChecked(new Set()); }} className={cn('p-1.5 rounded-md border transition-colors', selectMode ? 'border-accent/60 bg-accent/15 text-accent-soft' : 'border-border text-text-muted hover:text-text-primary')}><SquareCheck size={14} /></button></Tooltip>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5">
            {rows.length === 0 ? (
              cleared ? (
                <div className="text-center py-10"><CheckCheck size={26} className="mx-auto text-status-good mb-2" /><div className="text-sm text-text-primary">All caught up</div><div className="text-[11px] text-text-muted mt-1">Nothing is waiting for review.</div></div>
              ) : (
                <EmptyState icon={<Layers size={22} />} title="Nothing matches" description="Try a different status, type or search." action={<Button size="sm" variant="outline" onClick={() => { setTypeFilter('all'); setQuery(''); setStatusFilter('all'); }}>Reset filters</Button>} />
              )
            ) : (
              <LayoutGroup>
                <AnimatePresence initial={false}>
                  {rows.map((c, i) => (
                    <QueueRow
                      key={c.id} c={c} aoiBbox={aoiBbox} selected={i === selectedIndex} checked={checked.has(c.id)} selectMode={selectMode}
                      status={statusFor(c.id).status} assignee={assignments[c.id] ?? null}
                      onSelect={() => { setSelectedIndex(i); setRejectMode(false); if (!isWide) setDetailOpen(true); }}
                      onCheck={() => toggleCheck(c.id)} rowRef={(el) => { rowRefs.current[c.id] = el; }}
                    />
                  ))}
                </AnimatePresence>
              </LayoutGroup>
            )}
          </div>

          <AnimatePresence>
            {checked.size > 0 && (
              <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} className="shrink-0 border-t border-border bg-bg-raised p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-text-primary">{checked.size} selected</span>
                  <button onClick={() => { setChecked(new Set()); setConfirm(null); }} className="text-[11px] text-text-muted hover:text-text-primary">clear</button>
                </div>
                {confirm === null ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="xs" variant="primary" icon={<Check size={12} />} onClick={() => setConfirm('accept')}>Accept all</Button>
                    <select value={bulkReason} onChange={(e) => setBulkReason(e.target.value as RejectReasonCode)} className="bg-bg-panel border border-border rounded px-1.5 py-1 text-[11px]">
                      {REJECT_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                    </select>
                    <Button size="xs" variant="danger" icon={<X size={12} />} onClick={() => setConfirm('reject')}>Reject all</Button>
                    <select defaultValue="" onChange={(e) => { if (e.target.value) { assign([...checked], e.target.value); say(`Assigned ${checked.size} to ${e.target.value}`, false); e.target.value = ''; } }} className="bg-bg-panel border border-border rounded px-1.5 py-1 text-[11px]">
                      <option value="">assign to…</option>
                      {ANALYSTS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-status-warn">Confirm {confirm} {checked.size}{confirm === 'reject' ? ` as “${REJECT_REASONS.find((r) => r.code === bulkReason)?.label}”` : ''}?</span>
                    <Button size="xs" variant={confirm === 'accept' ? 'primary' : 'danger'} onClick={() => runBulk(confirm === 'accept' ? 'accepted' : 'rejected')}>Yes, confirm</Button>
                    <Button size="xs" variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {isWide && (
          <div className="min-h-0 overflow-y-auto">
            {focus ?? (cleared ? <ClearedState accepted={counts.accepted} rejected={counts.rejected} avgConf={avgConf} onViewAccepted={() => setStatusFilter('accepted')} onExport={() => navigate('/export')} /> : <div className="h-full flex items-center justify-center text-[12px] text-text-faint">Select a finding to review it</div>)}
          </div>
        )}
      </div>

      {!isWide && (
        <Drawer open={detailOpen && !!current} onClose={() => setDetailOpen(false)} title={current?.headline ?? ''} subtitle="Review this finding" width="w-[640px]">
          {focus}
        </Drawer>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} className={cn("fixed bottom-20 left-1/2 -translate-x-1/2 md:left-20 md:translate-x-0 z-50 flex items-center gap-3 bg-bg-raised border border-border-strong rounded-lg shadow-2xl pl-3 pr-2 py-2 max-w-[92vw]", checked.size > 0 ? "md:bottom-40" : "md:bottom-6")}>
            <span className="text-[12px] text-text-primary truncate">{toast.msg}</span>
            {toast.canUndo && <button onClick={() => { undo(); }} className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent text-white text-[11px] font-medium"><Undo2 size={11} /> Undo</button>}
          </motion.div>
        )}
      </AnimatePresence>

      <Drawer open={helpOpen} onClose={() => setHelpOpen(false)} title="How review works" subtitle="Fast, accountable triage" width="w-[520px]">
        <div className="p-4 space-y-4 text-[12px] text-text-secondary leading-relaxed">
          {[
            ['What you are looking at', 'Only findings that survived every suppression gate reach this queue. Your job is the final human judgement: is this a real, useful change?'],
            ['The focus panel', 'The before/after view glides straight to each finding. Swipe, flip, or blink between the two years, and switch the outline off to see the raw ground.'],
            ['Decide fast', 'Accept with A. Reject with R, then a number for the reason. Skip with S. The next finding slides into place, and a toast lets you undo (U).'],
            ['Why the reason matters', 'Reject reasons are labelled examples of exactly what the system got wrong. They re-rank future results and become a false-alarm test set.'],
            ['Quality checks', 'Alignment, seasonal deviation, radar agreement and valid pixels are shown so a rejection can be argued with evidence, not gut feel.'],
            ['Bulk work', 'Tick several findings (X, or the checkbox button), then accept, reject or assign them together. A confirmation step prevents accidents.'],
            ['Everything is recorded', 'Every decision, assignment and undo is appended to the tamper-evident audit log. Undoing never deletes history — it adds a new entry.'],
          ].map(([t, d]) => (<div key={t}><div className="text-[11px] font-semibold text-text-primary mb-0.5">{t}</div>{d}</div>))}
        </div>
      </Drawer>
    </div>
  );
}
