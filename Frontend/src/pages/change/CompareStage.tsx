import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GitCompareArrows, Blend, Columns2, Eye, ZoomIn, ZoomOut, Maximize2, Play, Loader2, Tag, ChevronsLeftRight } from 'lucide-react';
import { CHANGE_TYPE_COLORS, CHANGE_TYPE_LABELS } from '../../lib/colors';
import { bboxToPercent } from '../../lib/geo';
import { Tooltip } from '../../components/ui/Tooltip';
import { Slider } from '../../components/ui/Slider';
import { cn } from '../../lib/utils';
import type { ChangeCandidate } from '../../lib/types';

export type CompareTool = 'swipe' | 'blink' | 'fade' | 'sync';

const TOOLS: { id: CompareTool; label: string; icon: typeof Eye; tip: string; key: string }[] = [
  { id: 'swipe', label: 'Swipe', icon: GitCompareArrows, tip: 'Drag the divider to reveal before and after (1)', key: '1' },
  { id: 'blink', label: 'Blink', icon: Eye, tip: 'Flip between the two years automatically (2)', key: '2' },
  { id: 'fade', label: 'Fade', icon: Blend, tip: 'Cross-fade smoothly from before to after (3)', key: '3' },
  { id: 'sync', label: 'Side by side', icon: Columns2, tip: 'See both frames at once (4)', key: '4' },
];

interface Props {
  aoiBbox: [number, number, number, number];
  beforeImage?: string;
  afterImage?: string;
  beforeYear: number;
  afterYear: number;
  findings: ChangeCandidate[];
  numberById: Map<string, number>;
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  tool: CompareTool;
  onTool: (t: CompareTool) => void;
  swipe: number;
  onSwipe: (v: number) => void;
  analysisDone: boolean;
  running: boolean;
  stageLabel: string;
  progress: number;
  onRun: () => void;
  runKey: number;
}

function DetectionLayer({
  findings, numberById, aoiBbox, hoveredId, selectedId, onHover, onSelect, showLabels, inv, runKey,
}: {
  findings: ChangeCandidate[]; numberById: Map<string, number>; aoiBbox: [number, number, number, number];
  hoveredId: string | null; selectedId: string | null; onHover: (id: string | null) => void; onSelect: (id: string | null) => void;
  showLabels: boolean; inv: number; runKey: number;
}) {
  // large boxes first so small ones stay on top and remain clickable
  const ordered = useMemo(
    () => [...findings].map((c) => ({ c, box: bboxToPercent(c.bbox, aoiBbox) })).sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height),
    [findings, aoiBbox]
  );
  const focus = hoveredId ?? selectedId;

  return (
    <div key={runKey} className="absolute inset-0">
      <AnimatePresence>
        {ordered.map(({ c, box }, i) => {
          const color = CHANGE_TYPE_COLORS[c.type];
          const active = focus === c.id;
          const dim = focus && !active;
          return (
            <motion.button
              key={c.id}
              type="button"
              onMouseEnter={() => onHover(c.id)}
              onMouseLeave={() => onHover(null)}
              onClick={(e) => { e.stopPropagation(); onSelect(selectedId === c.id ? null : c.id); }}
              className="absolute rounded-sm border-2 text-left cursor-pointer"
              style={{
                left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%`,
                borderColor: color, background: active ? `${color}38` : `${color}14`, color,
                boxShadow: active ? `0 0 0 1px ${color}, 0 0 22px ${color}88` : 'none',
              }}
              initial={{ opacity: 0, scale: 1.25 }}
              animate={{ opacity: dim ? 0.35 : 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: Math.min(i * 0.07, 0.8), duration: 0.35, ease: 'easeOut' }}
            >
              <span
                className="absolute left-0 top-0 w-[18px] h-[18px] rounded-full text-[10px] mono font-bold flex items-center justify-center text-[#0a0e16]"
                style={{ background: color, transform: `translate(-50%,-50%) scale(${inv})` }}
              >
                {numberById.get(c.id)}
              </span>
              {(showLabels || active) && (
                <span
                  className="absolute left-0 bottom-full mb-1 whitespace-nowrap text-[10px] font-medium px-1.5 py-0.5 rounded shadow-lg text-[#0a0e16] pointer-events-none"
                  style={{ background: color, transform: `scale(${inv})`, transformOrigin: 'left bottom' }}
                >
                  {c.headline} · {Math.round(c.confidence * 100)}%
                </span>
              )}
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function CompareStage(p: Props) {
  const innerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [showLabels, setShowLabels] = useState(false);
  const [blinkOn, setBlinkOn] = useState(true);
  const [view, setView] = useState({ scale: 1, cx: 0.5, cy: 0.5 });

  useEffect(() => {
    if (p.tool !== 'blink') return;
    const t = window.setInterval(() => setBlinkOn((v) => !v), 900);
    return () => window.clearInterval(t);
  }, [p.tool]);

  const onSwipeRef = useRef(p.onSwipe);
  onSwipeRef.current = p.onSwipe;

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current || !innerRef.current) return;
      const r = innerRef.current.getBoundingClientRect();
      onSwipeRef.current(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
    };
    const up = () => { dragging.current = false; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  useEffect(() => {
    const f = p.findings.find((x) => x.id === p.selectedId);
    if (!f || p.tool === 'sync') {
      setView({ scale: 1, cx: 0.5, cy: 0.5 });
      return;
    }
    const b = bboxToPercent(f.bbox, p.aoiBbox);
    const s = Math.min(4.5, Math.max(1, 0.5 / Math.max(b.width / 100, b.height / 100)));
    setView({ scale: s, cx: (b.left + b.width / 2) / 100, cy: (b.top + b.height / 2) / 100 });
    // re-zoom only when the selection or tool changes, not on every findings refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.selectedId, p.tool]);

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const xPct = clamp(0.5 - view.cx * view.scale, 1 - view.scale, 0) * 100;
  const yPct = clamp(0.5 - view.cy * view.scale, 1 - view.scale, 0) * 100;
  const inv = 1 / view.scale;
  const zoomBy = (f: number) => setView((v) => ({ ...v, scale: clamp(v.scale * f, 1, 5) }));
  const layered = p.tool !== 'sync';

  const detection = (extra?: { key?: string }) => (
    <DetectionLayer
      key={extra?.key}
      findings={p.analysisDone ? p.findings : []}
      numberById={p.numberById}
      aoiBbox={p.aoiBbox}
      hoveredId={p.hoveredId}
      selectedId={p.selectedId}
      onHover={p.onHover}
      onSelect={p.onSelect}
      showLabels={showLabels}
      inv={layered ? inv : 1}
      runKey={p.runKey}
    />
  );

  const legendTypes = Array.from(new Set(p.findings.map((f) => f.type)));

  return (
    <div className="space-y-2.5">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex bg-bg-raised rounded-lg p-1">
          {TOOLS.map((t) => (
            <Tooltip key={t.id} content={t.tip}>
              <button
                onClick={() => p.onTool(t.id)}
                className={cn('relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium z-10 transition-colors', p.tool === t.id ? 'text-white' : 'text-text-muted hover:text-text-secondary')}
              >
                {p.tool === t.id && (
                  <motion.div layoutId="tool-pill" className="absolute inset-0 bg-accent rounded-md" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />
                )}
                <t.icon size={13} className="relative" />
                <span className="relative hidden sm:inline">{t.label}</span>
              </button>
            </Tooltip>
          ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setShowLabels((s) => !s)}
          className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] transition-colors', showLabels ? 'border-accent/60 bg-accent/15 text-accent-soft' : 'border-border text-text-muted hover:text-text-secondary')}
        >
          <Tag size={12} /> labels
        </button>
        <div className="flex items-center bg-bg-raised rounded-md">
          <button disabled={!layered} onClick={() => zoomBy(1 / 1.4)} className="p-1.5 text-text-muted hover:text-text-primary disabled:opacity-30"><ZoomOut size={13} /></button>
          <span className="mono text-[10px] text-text-muted w-9 text-center">{layered ? `${view.scale.toFixed(1)}x` : '—'}</span>
          <button disabled={!layered} onClick={() => zoomBy(1.4)} className="p-1.5 text-text-muted hover:text-text-primary disabled:opacity-30"><ZoomIn size={13} /></button>
          <button disabled={!layered} onClick={() => { setView({ scale: 1, cx: 0.5, cy: 0.5 }); p.onSelect(null); }} className="p-1.5 text-text-muted hover:text-text-primary disabled:opacity-30"><Maximize2 size={12} /></button>
        </div>
      </div>

      {/* stage */}
      <div
        className={cn('relative mx-auto rounded-xl overflow-hidden border border-border bg-black shadow-2xl', layered ? 'aspect-square' : 'aspect-[2/1]')}
        style={{ width: `min(100%, ${layered ? 78 : 156}vh)` }}
      >
        <motion.div
          ref={innerRef}
          className="absolute inset-0"
          style={{ transformOrigin: '0 0' }}
          animate={{ scale: layered ? view.scale : 1, x: layered ? `${xPct}%` : '0%', y: layered ? `${yPct}%` : '0%' }}
          transition={{ type: 'spring', stiffness: 130, damping: 22 }}
        >
          {layered ? (
            <>
              <img src={p.beforeImage} alt={`${p.beforeYear}`} draggable={false} className="absolute inset-0 w-full h-full object-cover select-none" />
              <div
                className="absolute inset-0"
                style={{
                  clipPath: p.tool === 'swipe' ? `inset(0 0 0 ${p.swipe}%)` : undefined,
                  opacity: p.tool === 'fade' ? p.swipe / 100 : p.tool === 'blink' ? (blinkOn ? 1 : 0) : 1,
                  transition: p.tool === 'blink' ? 'opacity 0.35s' : undefined,
                }}
              >
                <img src={p.afterImage} alt={`${p.afterYear}`} draggable={false} className="absolute inset-0 w-full h-full object-cover select-none" />
              </div>
              {detection()}
              {p.tool === 'swipe' && (
                <div className="absolute inset-y-0 z-20" style={{ left: `${p.swipe}%` }}>
                  <div className="absolute inset-y-0 -translate-x-1/2 w-0.5 bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.7)]" />
                  <div
                    onPointerDown={(e) => { e.preventDefault(); dragging.current = true; }}
                    className="absolute top-1/2 w-9 h-9 rounded-full bg-white text-[#0a0e16] flex items-center justify-center cursor-ew-resize shadow-xl touch-none"
                    style={{ transform: `translate(-50%,-50%) scale(${inv})` }}
                  >
                    <ChevronsLeftRight size={16} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 grid grid-cols-2 gap-px bg-black">
              {[{ img: p.beforeImage, y: p.beforeYear, k: 'b' }, { img: p.afterImage, y: p.afterYear, k: 'a' }].map((pane) => (
                <div key={pane.k} className="relative overflow-hidden">
                  <img src={pane.img} alt={`${pane.y}`} draggable={false} className="absolute inset-0 w-full h-full object-cover select-none" />
                  {detection({ key: pane.k })}
                  <span className="absolute top-2 left-2 mono text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">{pane.k === 'b' ? 'BEFORE' : 'AFTER'} {pane.y}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* HUD */}
        {layered && (
          <>
            <div className="absolute top-2 left-2 mono text-[10px] bg-black/65 text-white px-2 py-1 rounded-md backdrop-blur pointer-events-none">
              {p.tool === 'blink' ? (blinkOn ? `AFTER ${p.afterYear}` : `BEFORE ${p.beforeYear}`) : `BEFORE ${p.beforeYear}`}
            </div>
            {p.tool !== 'blink' && (
              <div className="absolute top-2 right-2 mono text-[10px] bg-black/65 text-white px-2 py-1 rounded-md backdrop-blur pointer-events-none">
                AFTER {p.afterYear}
              </div>
            )}
          </>
        )}

        {p.running && (
          <>
            <motion.div
              className="absolute left-0 right-0 h-1/3 pointer-events-none z-10"
              style={{ background: 'linear-gradient(180deg, transparent, rgba(129,140,248,0.4), transparent)' }}
              animate={{ y: ['-110%', '310%'] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            />
            <div className="absolute bottom-3 left-3 right-3 z-20 bg-black/70 backdrop-blur rounded-lg px-3 py-2 flex items-center gap-3">
              <Loader2 size={14} className="animate-spin text-accent-soft shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-white truncate">{p.stageLabel}</div>
                <div className="h-1 rounded-full bg-white/15 mt-1 overflow-hidden">
                  <motion.div className="h-full bg-accent-soft rounded-full" animate={{ width: `${p.progress * 100}%` }} />
                </div>
              </div>
              <span className="mono text-[11px] text-white/80">{Math.round(p.progress * 100)}%</span>
            </div>
          </>
        )}
        {!p.running && p.analysisDone && (
          <div key={`sweep-${p.runKey}`} className="absolute inset-0 pointer-events-none overflow-hidden z-10">
            <div className="absolute left-0 right-0 h-1/3 animate-scan-sweep" style={{ background: 'linear-gradient(180deg, transparent, rgba(52,211,153,0.35), transparent)' }} />
          </div>
        )}

        <AnimatePresence>
          {!p.analysisDone && !p.running && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4"
            >
              <motion.div
                initial={{ y: 14, scale: 0.96 }}
                animate={{ y: 0, scale: 1 }}
                className="max-w-sm text-center bg-bg-panel/95 border border-border rounded-xl p-5 shadow-2xl"
              >
                <div className="text-sm font-semibold text-text-primary">
                  Compare <span className="mono text-accent-soft">{p.beforeYear}</span> with <span className="mono text-accent-soft">{p.afterYear}</span>
                </div>
                <p className="text-[11px] text-text-muted mt-1.5 mb-3.5 leading-relaxed">
                  Drag the divider to see the raw difference, then run the analysis and the system will mark, number and explain every real change.
                </p>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={p.onRun}
                  className="relative inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-accent to-[#8b5cf6]"
                >
                  <span className="absolute inset-0 rounded-lg ring-2 ring-accent-soft/60 animate-ping" />
                  <Play size={14} /> <span className="relative">Run analysis</span>
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {(p.tool === 'swipe' || p.tool === 'fade') && (
        <Slider value={p.swipe} min={0} max={100} step={1} onChange={p.onSwipe} leftLabel={`${p.beforeYear}`} rightLabel={`${p.afterYear}`} />
      )}

      {legendTypes.length > 0 && p.analysisDone && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-text-muted">
          <span className="text-text-faint">legend</span>
          {legendTypes.map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ background: CHANGE_TYPE_COLORS[t] }} />
              {CHANGE_TYPE_LABELS[t]}
            </span>
          ))}
          <span className="text-text-faint">· numbers match the findings list</span>
        </div>
      )}
    </div>
  );
}
