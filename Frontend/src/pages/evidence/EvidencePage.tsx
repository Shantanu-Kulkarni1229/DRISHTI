import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Info, Check, X, Copy, CopyCheck, ExternalLink, User,
  CircleCheck, TriangleAlert, History as HistoryIcon, MapPinned, ScrollText, Workflow,
  ImagePlay, ChevronDown,
} from 'lucide-react';
import { CHANGE_CANDIDATES, aoiById, sceneById, tileById, TILES } from '../../lib/mockData';
import { CHANGE_TYPE_COLORS, CHANGE_TYPE_LABELS, confidenceColor } from '../../lib/colors';
import { buildProvenanceTree } from '../../lib/provenance';
import { candidateBox, qualityChecksFor, sceneImage, yearOf } from '../../lib/findingView';
import { useReviewStore } from '../../state/reviewStore';
import { useAuditStore } from '../../state/auditStore';
import { formatDate, formatDateShort, cn, copyText } from '../../lib/utils';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TileThumb } from '../../components/ui/TileThumb';
import { EmptyState } from '../../components/ui/EmptyState';
import { Drawer } from '../../components/ui/Drawer';
import { Tooltip } from '../../components/ui/Tooltip';
import { ConfidenceBars } from '../../components/charts/ConfidenceBars';
import { ProvenanceTree } from '../../components/charts/ProvenanceTree';
import { FindingViewer, type ViewerMode } from '../../components/charts/FindingViewer';
import { useShortcuts } from '../../lib/useShortcuts';
import type { ChangeCandidate, RejectReasonCode } from '../../lib/types';

const ANALYSTS = ['A. Rao', 'S. Verma', 'K. Nair', 'M. Iyer'];
const REJECT_REASONS: { code: RejectReasonCode; label: string; hint: string }[] = [
  { code: 'cloud', label: 'Cloud', hint: 'Cloud or haze covers the site' },
  { code: 'shadow', label: 'Shadow', hint: 'A shadow was mistaken for change' },
  { code: 'seasonal', label: 'Seasonal', hint: 'Normal seasonal variation' },
  { code: 'misregistration', label: 'Misaligned', hint: 'The two images do not line up' },
  { code: 'not_of_interest', label: 'Not of interest', hint: 'Real, but irrelevant to us' },
  { code: 'duplicate', label: 'Duplicate', hint: 'Already reported elsewhere' },
];
const TABS = [
  { id: 'evidence', label: 'Evidence', icon: ScrollText },
  { id: 'provenance', label: 'Provenance', icon: Workflow },
  { id: 'activity', label: 'Activity', icon: HistoryIcon },
] as const;
type Tab = (typeof TABS)[number]['id'];

function distanceKm(a: ChangeCandidate, b: ChangeCandidate) {
  const dx = a.geomCenter.lng - b.geomCenter.lng;
  const dy = a.geomCenter.lat - b.geomCenter.lat;
  return Math.sqrt(dx * dx + dy * dy) * 111;
}

function Ring({ value, size = 68 }: { value: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" style={{ width: size, height: size }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth="6" />
        <motion.circle
          key={value} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={confidenceColor(value)} strokeWidth="6" strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: circ * (1 - value) }} transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="mono text-base font-bold text-text-primary leading-none">{Math.round(value * 100)}</span>
        <span className="text-[8px] text-text-faint mt-0.5">confidence</span>
      </div>
    </div>
  );
}

function StatusPill({ status, reason }: { status: 'pending' | 'accepted' | 'rejected'; reason: RejectReasonCode | null }) {
  return (
    <span className={cn('text-[11px] px-2 py-0.5 rounded-full border capitalize font-medium', status === 'accepted' ? 'text-status-good border-status-good/40 bg-status-good/10' : status === 'rejected' ? 'text-status-bad border-status-bad/40 bg-status-bad/10' : 'text-text-muted border-border')}>
      {status}{reason ? ` · ${reason.replace('_', ' ')}` : ''}
    </span>
  );
}

export function EvidencePage() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const { actor, setActor, decide, statusFor, decisions, assignments, assign } = useReviewStore();
  const auditEntries = useAuditStore((s) => s.entries);

  const pool = useMemo(
    () => [...CHANGE_CANDIDATES].filter((c) => c.suppressedBy === null).sort((a, b) => b.confidence - a.confidence),
    []
  );
  const fallback = useMemo(() => pool.find((c) => statusFor(c.id).status === 'pending') ?? pool[0], [pool, statusFor]);
  const candidate = (candidateId && pool.find((c) => c.id === candidateId)) || fallback;
  const index = candidate ? pool.findIndex((c) => c.id === candidate.id) : -1;

  const [tab, setTab] = useState<Tab>('evidence');
  const [mode, setMode] = useState<ViewerMode>('swipe');
  const [showBox, setShowBox] = useState(true);
  const [rejectMode, setRejectMode] = useState(false);
  const [note, setNote] = useState('');
  const [sameTypeOnly, setSameTypeOnly] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [flash, setFlash] = useState<'accepted' | 'rejected' | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => setNote(''), [candidate?.id]);
  useEffect(() => setRejectMode(false), [candidate?.id]);
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 900);
    return () => window.clearTimeout(t);
  }, [flash]);

  const goto = (i: number) => {
    const c = pool[(i + pool.length) % pool.length];
    navigate(`/evidence/${c.id}`);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const accept = () => {
    if (!candidate) return;
    decide(candidate.id, 'accepted', null, note);
    setFlash('accepted');
  };
  const reject = (reason: RejectReasonCode) => {
    if (!candidate) return;
    decide(candidate.id, 'rejected', reason, note);
    setRejectMode(false);
    setFlash('rejected');
  };
  const copyCitation = () => {
    if (!candidate) return;
    const text = [
      `Candidate ${candidate.id} — ${candidate.headline}`,
      `${CHANGE_TYPE_LABELS[candidate.type]} · ${Math.round(candidate.confidence * 100)}% confidence · ${candidate.direction}`,
      `Location ${candidate.geomCenter.lat.toFixed(4)}, ${candidate.geomCenter.lng.toFixed(4)}`,
      `Earliest supported interval ${candidate.earliestIntervalStart} → ${candidate.earliestIntervalEnd}`,
      `Job ${candidate.jobId}`,
    ].join('\n');
    copyText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
  };

  useShortcuts(
    {
      j: () => goto(index + 1), arrowright: () => goto(index + 1),
      k: () => goto(index - 1), arrowleft: () => goto(index - 1),
      a: accept, r: () => setRejectMode((v) => !v), escape: () => setRejectMode(false),
      ...Object.fromEntries(REJECT_REASONS.map((r, i) => [String(i + 1), () => rejectMode && reject(r.code)])),
    },
    [
      { keys: 'J / K', label: 'next / previous candidate' },
      { keys: 'A', label: 'accept' },
      { keys: 'R then 1–6', label: 'reject with a reason' },
      { keys: 'Esc', label: 'cancel reject' },
    ],
    !!candidate
  );

  if (!candidate) {
    return <EmptyState title="No candidates available" description="The mock dataset has no reviewable candidates." />;
  }

  const aoi = aoiById(candidate.aoiId);
  const tileBefore = tileById(candidate.tileBeforeId);
  const tileAfter = tileById(candidate.tileAfterId);
  const sceneBefore = tileBefore ? sceneById(tileBefore.sceneId) : undefined;
  const sceneAfter = tileAfter ? sceneById(tileAfter.sceneId) : undefined;
  const status = statusFor(candidate.id);
  const assignee = assignments[candidate.id] ?? null;
  const color = CHANGE_TYPE_COLORS[candidate.type];
  const box = aoi ? candidateBox(candidate, aoi.bbox) : { left: 0, top: 0, width: 100, height: 100 };
  const by = yearOf(candidate.earliestIntervalStart);
  const ay = yearOf(candidate.earliestIntervalEnd);
  const checks = qualityChecksFor(candidate);
  const failing = checks.filter((k) => !k.ok).length;

  const provenanceRoot = useMemo(() => buildProvenanceTree(candidate), [candidate]);

  const nearby = useMemo(() => {
    return pool
      .filter((c) => c.id !== candidate.id && c.aoiId === candidate.aoiId && (!sameTypeOnly || c.type === candidate.type))
      .map((c) => ({ c, d: distanceKm(c, candidate) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 8);
  }, [pool, candidate, sameTypeOnly]);

  const cellTiles = useMemo(
    () => TILES.filter((t) => t.gridCellId === candidate.gridCellId).sort((a, b) => a.datetime.localeCompare(b.datetime)),
    [candidate.gridCellId]
  );

  const history = decisions.filter((d) => d.candidateId === candidate.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activity = auditEntries.filter((e) => e.targetId === candidate.id && e.action !== 'candidate.decision').sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div ref={topRef} className="h-full min-h-0 overflow-y-auto">
      <div className="p-3 sm:p-4 lg:p-5 max-w-[1500px] mx-auto space-y-4">
        {/* header */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Tooltip content="Previous (K)"><button onClick={() => goto(index - 1)} className="w-8 h-8 flex items-center justify-center rounded-md border border-border text-text-muted hover:text-text-primary hover:bg-bg-hover"><ChevronLeft size={15} /></button></Tooltip>
            <Tooltip content="Next (J)"><button onClick={() => goto(index + 1)} className="w-8 h-8 flex items-center justify-center rounded-md border border-border text-text-muted hover:text-text-primary hover:bg-bg-hover"><ChevronRight size={15} /></button></Tooltip>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-text-faint uppercase tracking-wide">Evidence · {index + 1} of {pool.length}</div>
            <div className="mono text-[11px] text-text-muted">{candidate.id}</div>
          </div>
          <div className="flex-1" />
          <StatusPill status={status.status} reason={status.rejectReason} />
          <button onClick={() => setHelpOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-text-secondary hover:text-accent-soft hover:border-accent/50 transition-colors"><Info size={13} /> How it works</button>
        </div>

        {/* hero */}
        <Card className="overflow-hidden">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="p-3 sm:p-4 border-b lg:border-b-0 lg:border-r border-border-subtle">
              <FindingViewer
                beforeImage={sceneImage(candidate.aoiId, by)} afterImage={sceneImage(candidate.aoiId, ay)} beforeYear={by} afterYear={ay}
                box={box} color={color} mode={mode} onMode={setMode} showBox={showBox} onShowBox={setShowBox}
              />
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <Badge color={color} variant="dot">{CHANGE_TYPE_LABELS[candidate.type]}</Badge>
                  <h1 className="text-base font-semibold text-text-primary leading-snug mt-1.5">{candidate.headline}</h1>
                </div>
                <Ring value={candidate.confidence} />
              </div>
              <p className="text-[12px] text-text-secondary leading-relaxed">{candidate.narrative}</p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {[
                  ['Area', candidate.areaM2 >= 10000 ? `${(candidate.areaM2 / 10000).toFixed(1)} ha` : `${candidate.areaM2.toLocaleString()} m²`],
                  ['Direction', candidate.direction[0].toUpperCase() + candidate.direction.slice(1)],
                  ['First seen', formatDate(candidate.earliestIntervalEnd)],
                  ['Revisit gap', `${candidate.revisitGapDays} d`],
                ].map(([k, v]) => (
                  <div key={k} className="bg-bg-raised/60 border border-border-subtle rounded-lg px-2.5 py-1.5 min-w-0">
                    <div className="text-[10px] text-text-faint">{k}</div>
                    <div className="mono text-text-primary truncate">{v}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                <MapPinned size={12} className="shrink-0" />
                <span className="mono truncate">{candidate.geomCenter.lat.toFixed(4)}, {candidate.geomCenter.lng.toFixed(4)}</span>
                <span className="truncate">· {aoi?.name ?? candidate.aoiId}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                <Tooltip content="Copy a citation for this finding">
                  <Button size="xs" variant="outline" icon={copied ? <CopyCheck size={12} /> : <Copy size={12} />} onClick={copyCitation}>{copied ? 'Copied' : 'Copy citation'}</Button>
                </Tooltip>
                <Button size="xs" variant="outline" icon={<ExternalLink size={12} />} onClick={() => navigate('/export')}>Send to export</Button>
                <Button size="xs" variant="outline" icon={<ImagePlay size={12} />} onClick={() => navigate('/timeline')}>Open timeline</Button>
              </div>
            </div>
          </div>
        </Card>

        {/* decision bar */}
        <Card className="p-3 sm:p-4 space-y-2.5">
          <AnimatePresence initial={false}>
            {rejectMode && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="text-[10px] text-text-faint mb-1.5">Why is this not a real, useful finding? Press a number or tap.</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {REJECT_REASONS.map((r, i) => (
                    <motion.button key={r.code} whileTap={{ scale: 0.96 }} onClick={() => reject(r.code)} className="text-left px-2 py-1.5 rounded-md border border-border-strong bg-bg-raised hover:border-status-bad/70 hover:bg-status-bad/10 transition-colors">
                      <div className="flex items-center gap-1.5 text-[11px] text-text-primary"><kbd className="mono text-[10px] text-text-faint">{i + 1}</kbd>{r.label}</div>
                      <div className="text-[9px] text-text-faint leading-tight mt-0.5">{r.hint}</div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex flex-wrap items-center gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)…" className="flex-1 min-w-[140px] bg-bg-raised border border-border rounded-md px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-accent-soft" />
            <label className="flex items-center gap-1 text-[11px] text-text-muted"><User size={11} />
              <select value={assignee ?? ''} onChange={(e) => assign([candidate.id], e.target.value || null)} className="bg-bg-raised border border-border rounded px-1.5 py-1 text-[11px] text-text-primary">
                <option value="">unassigned</option>
                {ANALYSTS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1 text-[11px] text-text-muted">reviewing as
              <select value={actor} onChange={(e) => setActor(e.target.value)} className="bg-bg-raised border border-border rounded px-1.5 py-1 text-[11px] text-text-primary">
                {ANALYSTS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <motion.button whileTap={{ scale: 0.97 }} onClick={accept} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-status-good/90 hover:bg-status-good text-[#04130c] font-semibold text-sm transition-colors">
                <Check size={16} strokeWidth={3} /> Accept <kbd className="mono text-[10px] opacity-60 hidden sm:inline">A</kbd>
              </motion.button>
              <AnimatePresence>{flash === 'accepted' && <motion.span className="absolute inset-0 rounded-lg ring-2 ring-status-good pointer-events-none" initial={{ opacity: 0.9, scale: 1 }} animate={{ opacity: 0, scale: 1.15 }} exit={{ opacity: 0 }} transition={{ duration: 0.9 }} />}</AnimatePresence>
            </div>
            <div className="relative flex-1">
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setRejectMode((v) => !v)} className={cn('w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border font-semibold text-sm transition-colors', rejectMode ? 'bg-status-bad/20 border-status-bad text-status-bad' : 'border-status-bad/50 text-status-bad hover:bg-status-bad/10')}>
                <X size={16} strokeWidth={3} /> Reject <kbd className="mono text-[10px] opacity-60 hidden sm:inline">R</kbd>
              </motion.button>
              <AnimatePresence>{flash === 'rejected' && <motion.span className="absolute inset-0 rounded-lg ring-2 ring-status-bad pointer-events-none" initial={{ opacity: 0.9, scale: 1 }} animate={{ opacity: 0, scale: 1.15 }} exit={{ opacity: 0 }} transition={{ duration: 0.9 }} />}</AnimatePresence>
            </div>
          </div>
        </Card>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
          <div className="min-w-0 space-y-4">
            <Card>
              <div className="flex border-b border-border-subtle px-2">
                {TABS.map((t) => (
                  <button key={t.id} onClick={() => setTab(t.id)} className={cn('relative flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium transition-colors', tab === t.id ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary')}>
                    <t.icon size={13} />{t.label}
                    {t.id === 'activity' && (history.length + activity.length) > 0 && <span className="mono text-[9px] text-text-faint">{history.length + activity.length}</span>}
                    {tab === t.id && <motion.span layoutId="ev-tab" className="absolute left-2 right-2 -bottom-px h-0.5 bg-accent rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
                  </button>
                ))}
              </div>
              <div className="p-4">
                {tab === 'evidence' && (
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <div className="text-[11px] font-semibold text-text-primary mb-2">Why we believe it</div>
                      <ConfidenceBars factors={candidate.factors} />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-text-primary mb-2 flex items-center gap-1.5">
                        Quality checks
                        <span className={cn('text-[10px] font-normal', failing ? 'text-status-warn' : 'text-status-good')}>{failing ? `${failing} to look at` : 'all clear'}</span>
                      </div>
                      <ul className="space-y-2 mb-4">
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
                      <details className="group">
                        <summary className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary cursor-pointer list-none">
                          <ChevronDown size={12} className="transition-transform group-open:rotate-180" /> Full metadata
                        </summary>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] mt-2">
                          <Field label="Before acquisition" value={tileBefore ? formatDate(tileBefore.datetime) : '—'} mono />
                          <Field label="After acquisition" value={tileAfter ? formatDate(tileAfter.datetime) : '—'} mono />
                          <Field label="Before sensor" value={`${sceneBefore?.sensor ?? '—'} · ${sceneBefore?.productLevel ?? '—'}`} mono />
                          <Field label="After sensor" value={`${sceneAfter?.sensor ?? '—'} · ${sceneAfter?.productLevel ?? '—'}`} mono />
                          <Field label="Job" value={candidate.jobId} mono />
                          <Field label="Grid cell" value={candidate.gridCellId} mono />
                          <Field label="Earliest interval" value={`${candidate.earliestIntervalStart} → ${candidate.earliestIntervalEnd}`} mono />
                          <Field label="Checksum (after)" value={sceneAfter?.checksum ?? '—'} mono />
                        </div>
                      </details>
                    </div>
                  </div>
                )}
                {tab === 'provenance' && (
                  <div>
                    <p className="text-[11px] text-text-muted mb-3">Source scenes → processing chain → model registry, exactly as they produced this candidate.</p>
                    <ProvenanceTree root={provenanceRoot} />
                  </div>
                )}
                {tab === 'activity' && (
                  <div className="space-y-2">
                    {history.length === 0 && activity.length === 0 ? (
                      <p className="text-[11px] text-text-faint">No decisions or activity recorded yet.</p>
                    ) : (
                      [
                        ...history.map((d) => ({ id: d.id, at: d.createdAt, node: (
                          <>
                            <span className="text-text-primary font-medium">{d.actor}</span>{' '}
                            <span className={d.verdict === 'accepted' ? 'text-status-good' : 'text-status-bad'}>{d.verdict}{d.reasonCode ? ` · ${d.reasonCode.replace('_', ' ')}` : ''}</span>
                            {d.note && <span className="text-text-muted"> — {d.note}</span>}
                          </>
                        ) })),
                        ...activity.map((e) => ({ id: e.id, at: e.createdAt, node: (
                          <>
                            <span className="text-text-primary font-medium">{e.actor}</span>{' '}
                            <span className="text-accent-soft">{e.action.replace('candidate.', '').replace('_', ' ')}</span>
                            {'assignee' in e.payload && <span className="text-text-muted"> — now {String(e.payload.assignee ?? 'unassigned')}</span>}
                            <span className="mono text-text-faint"> · {e.hash.slice(0, 10)}</span>
                          </>
                        ) })),
                      ]
                        .sort((a, b) => b.at.localeCompare(a.at))
                        .map((row) => (
                          <div key={row.id} className="text-[11px] border-b border-border-subtle last:border-0 pb-2 last:pb-0">
                            <div>{row.node}</div>
                            <div className="mono text-text-faint mt-0.5">{new Date(row.at).toLocaleString()}</div>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="This location across time" subtitle={`All ${cellTiles.length} acquisitions for this grid cell`} />
              <div className="p-3 flex gap-1.5 overflow-x-auto">
                {cellTiles.map((t) => (
                  <div key={t.id} className={cn('shrink-0 text-center', (t.id === candidate.tileBeforeId || t.id === candidate.tileAfterId) && 'ring-2 rounded-md')} style={(t.id === candidate.tileBeforeId || t.id === candidate.tileAfterId) ? { boxShadow: `0 0 0 2px ${color}` } : undefined}>
                    <TileThumb tile={t} size={44} rounded="rounded-md" />
                    <div className="mono text-[9px] text-text-faint mt-0.5">{formatDateShort(t.datetime)}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="min-w-0">
            <Card>
              <CardHeader
                title="Nearby & similar"
                subtitle={`${nearby.length} in ${aoi?.name ?? candidate.aoiId}`}
                right={
                  <label className="flex items-center gap-1 text-[10px] text-text-muted cursor-pointer select-none">
                    <input type="checkbox" checked={sameTypeOnly} onChange={(e) => setSameTypeOnly(e.target.checked)} className="accent-[var(--color-accent)]" />
                    same type
                  </label>
                }
              />
              <div className="p-2 space-y-1 max-h-[560px] overflow-y-auto">
                {nearby.length === 0 ? (
                  <p className="text-[11px] text-text-faint p-2">Nothing else nearby with these filters.</p>
                ) : (
                  nearby.map(({ c, d }) => {
                    const st = statusFor(c.id);
                    return (
                      <Link key={c.id} to={`/evidence/${c.id}`} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-bg-hover transition-colors">
                        <div className="shrink-0">
                          <TileThumb tile={tileById(c.tileAfterId)!} size={30} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] text-text-primary truncate">{c.headline}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge color={CHANGE_TYPE_COLORS[c.type]} variant="dot">{CHANGE_TYPE_LABELS[c.type]}</Badge>
                            <span className={cn('text-[9px] capitalize', st.status === 'accepted' ? 'text-status-good' : st.status === 'rejected' ? 'text-status-bad' : 'text-text-faint')}>{st.status}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="mono text-[11px]" style={{ color: confidenceColor(c.confidence) }}>{Math.round(c.confidence * 100)}%</div>
                          <div className="mono text-[9px] text-text-faint">{d.toFixed(1)} km</div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <Drawer open={helpOpen} onClose={() => setHelpOpen(false)} title="How the evidence page works" subtitle="Everything a decision needs, in one place" width="w-[520px]">
        <div className="p-4 space-y-4 text-[12px] text-text-secondary leading-relaxed">
          {[
            ['What this page is for', 'One candidate change, fully argued: the imagery, the reasoning, where it came from, and what happened to it.'],
            ['The viewer', 'Glides and zooms to the exact spot. Swipe, flip, or blink between the two years, and toggle the outline to see the raw ground beneath it.'],
            ['Why we believe it', 'The same seven-factor breakdown used everywhere in this app — the model score, persistence, radar agreement, seasonal deviation and more, blended into the confidence you see.'],
            ['Quality checks', 'Four spot-checks any reviewer would want before trusting a finding. A check failing does not mean the finding is wrong — it tells you exactly what to look at yourself.'],
            ['Provenance', 'The source scenes, every processing step with its parameters, and the exact model versions and checksums that produced this candidate — a full chain of custody.'],
            ['Activity', 'Every decision, undo and reassignment for this candidate, each one also written to the tamper-evident audit log elsewhere in the app.'],
            ['Nearby & similar', 'Other candidates close to this one, so a single finding can lead you to the rest of a pattern.'],
            ['Deciding here', 'Accept or reject right on this page — it does not move you to the next item, so you can keep studying this one after you decide.'],
          ].map(([t, d]) => (<div key={t}><div className="text-[11px] font-semibold text-text-primary mb-0.5">{t}</div>{d}</div>))}
          <div>
            <div className="text-[11px] font-semibold text-text-primary mb-1">Keyboard</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              {[['J / K', 'next / previous'], ['A', 'accept'], ['R then 1–6', 'reject with reason'], ['Esc', 'cancel'], ['?', 'all shortcuts']].map(([k, d]) => (
                <div key={k} className="flex items-center justify-between gap-2"><span className="text-text-muted">{d}</span><kbd className="mono px-1.5 py-0.5 rounded bg-bg-raised border border-border text-text-primary">{k}</kbd></div>
              ))}
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
}

function Field({ label, value, mono, className }: { label: string; value: string; mono?: boolean; className?: string }) {
  return (
    <div>
      <div className="text-text-faint">{label}</div>
      <div className={cn('text-text-primary truncate', mono && 'mono', className)}>{value}</div>
    </div>
  );
}
