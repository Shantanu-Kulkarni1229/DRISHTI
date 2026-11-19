import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, Maximize2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface FieldPoint {
  id: string;
  x: number;
  y: number;
  color: string;
}
export interface FieldHalo {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  rx: number;
  ry: number;
}

interface Props {
  points: FieldPoint[];
  halos: FieldHalo[];
  showHalos: boolean;
  tool: 'lasso' | 'pan';
  hoveredId: string | null;
  selectedId: string | null;
  highlightIds: Set<string>;
  neighborIds: string[];
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onLasso: (ids: string[]) => void;
  onClear: () => void;
  renderTip?: (id: string) => ReactNode;
  resetKey?: number;
  className?: string;
}

const VIEW = 600;

function inside(x: number, y: number, poly: [number, number][]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

export function EmbeddingField(p: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  const [lasso, setLasso] = useState<[number, number][] | null>(null);
  const [tip, setTip] = useState<{ id: string; left: number; top: number; w: number } | null>(null);
  const mode = useRef<'none' | 'lasso' | 'pan'>('none');
  const last = useRef({ x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;

  const b = useMemo(() => {
    const xs = p.points.map((q) => q.x);
    const ys = p.points.map((q) => q.y);
    return { minX: Math.min(...xs, 0) - 0.9, maxX: Math.max(...xs, 0) + 0.9, minY: Math.min(...ys, 0) - 0.9, maxY: Math.max(...ys, 0) + 0.9 };
  }, [p.points]);
  const sx = (x: number) => ((x - b.minX) / (b.maxX - b.minX)) * VIEW;
  const sy = (y: number) => VIEW - ((y - b.minY) / (b.maxY - b.minY)) * VIEW;
  const pos = useMemo(() => new Map(p.points.map((q) => [q.id, { x: sx(q.x), y: sy(q.y) }])), [p.points, b]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setView({ k: 1, tx: 0, ty: 0 }), [p.resetKey]);

  // native non-passive wheel listener so zoom can preventDefault without a warning
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * VIEW;
      const py = ((e.clientY - r.top) / r.height) * VIEW;
      const v = viewRef.current;
      const k = Math.min(8, Math.max(1, v.k * (e.deltaY < 0 ? 1.18 : 1 / 1.18)));
      setView(k === 1 ? { k: 1, tx: 0, ty: 0 } : { k, tx: px - (k * (px - v.tx)) / v.k, ty: py - (k * (py - v.ty)) / v.k });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const toView = (cx: number, cy: number): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect();
    return [((cx - r.left) / r.width) * VIEW, ((cy - r.top) / r.height) * VIEW];
  };
  const toWorld = (cx: number, cy: number): [number, number] => {
    const [px, py] = toView(cx, cy);
    return [(px - view.tx) / view.k, (py - view.ty) / view.k];
  };

  const down = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // a press that starts on a dot is a click, not a drag — capturing here would swallow it
    if ((e.target as Element).tagName === 'circle') return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    if (p.tool === 'pan') {
      mode.current = 'pan';
      last.current = { x: e.clientX, y: e.clientY };
    } else {
      mode.current = 'lasso';
      setLasso([toWorld(e.clientX, e.clientY)]);
    }
  };
  const move = (e: React.PointerEvent) => {
    if (mode.current === 'lasso') setLasso((l) => (l ? [...l, toWorld(e.clientX, e.clientY)] : l));
    else if (mode.current === 'pan') {
      const r = svgRef.current!.getBoundingClientRect();
      const dx = ((e.clientX - last.current.x) / r.width) * VIEW;
      const dy = ((e.clientY - last.current.y) / r.height) * VIEW;
      last.current = { x: e.clientX, y: e.clientY };
      setView((v) => ({ ...v, tx: Math.min(0, Math.max(VIEW - VIEW * v.k, v.tx + dx)), ty: Math.min(0, Math.max(VIEW - VIEW * v.k, v.ty + dy)) }));
    }
  };
  const up = (e: React.PointerEvent) => {
    if (mode.current === 'lasso' && lasso) {
      if (lasso.length > 6) {
        const ids = p.points.filter((q) => inside(sx(q.x), sy(q.y), lasso)).map((q) => q.id);
        p.onLasso(ids);
      } else if ((e.target as Element).tagName !== 'circle') p.onClear();
    }
    mode.current = 'none';
    setLasso(null);
  };

  const zoomBy = (f: number) => setView((v) => {
    const k = Math.min(8, Math.max(1, v.k * f));
    if (k === 1) return { k: 1, tx: 0, ty: 0 };
    const c = VIEW / 2;
    return { k, tx: c - (k * (c - v.tx)) / v.k, ty: c - (k * (c - v.ty)) / v.k };
  });

  const focusOn = p.highlightIds.size > 0;
  const seed = p.selectedId ? pos.get(p.selectedId) : undefined;
  const rScale = 1 / Math.pow(view.k, 0.6);

  return (
    <div ref={wrapRef} className={cn('relative rounded-xl overflow-hidden border border-border-subtle bg-[#050810]', p.className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className={cn('w-full h-full block touch-none select-none', p.tool === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair')}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={() => { if (mode.current !== 'none') { mode.current = 'none'; setLasso(null); } }}
        onDoubleClick={() => setView({ k: 1, tx: 0, ty: 0 })}
      >
        <defs>
          <pattern id="ef-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0f1a2e" strokeWidth="1" />
          </pattern>
          <radialGradient id="ef-vignette" cx="50%" cy="50%" r="70%">
            <stop offset="60%" stopColor="transparent" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
          </radialGradient>
          {p.halos.map((h) => (
            <radialGradient key={h.id} id={`halo-${h.id}`}>
              <stop offset="0%" stopColor={h.color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={h.color} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>
        <rect width={VIEW} height={VIEW} fill="url(#ef-grid)" />

        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          {p.showHalos &&
            p.halos.map((h, i) => (
              <g key={h.id} pointerEvents="none" opacity={focusOn ? 0.35 : 1}>
                <motion.ellipse
                  cx={sx(h.x)} cy={sy(h.y)} rx={(h.rx / (b.maxX - b.minX)) * VIEW} ry={(h.ry / (b.maxY - b.minY)) * VIEW}
                  fill={`url(#halo-${h.id})`}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: [0.75, 1, 0.75], scale: 1 }}
                  transition={{ opacity: { repeat: Infinity, duration: 4 + i * 0.6, ease: 'easeInOut' }, scale: { duration: 0.8 } }}
                  style={{ transformOrigin: `${sx(h.x)}px ${sy(h.y)}px` }}
                />
                <text
                  x={sx(h.x)} y={sy(h.y) - (h.ry / (b.maxY - b.minY)) * VIEW - 6 / view.k}
                  textAnchor="middle" fontSize={11 / view.k} fill={h.color} fontWeight={600}
                  stroke="#050810" strokeWidth={3 / view.k} paintOrder="stroke"
                >
                  {h.label}
                </text>
              </g>
            ))}

          {seed &&
            p.neighborIds.map((id, i) => {
              const t = pos.get(id);
              if (!t) return null;
              return (
                <g key={`web-${id}`} pointerEvents="none">
                  <motion.path
                    d={`M ${seed.x} ${seed.y} L ${t.x} ${t.y}`}
                    stroke="var(--color-accent-soft)" strokeOpacity={0.75} strokeWidth={1.4 / view.k} strokeDasharray={`${4 / view.k} ${3 / view.k}`} fill="none"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.06 * i, duration: 0.5 }}
                  />
                  <motion.text
                    x={t.x + 7 / view.k} y={t.y - 7 / view.k} fontSize={10 / view.k} fill="#e0e7ff" fontWeight={700}
                    stroke="#050810" strokeWidth={3 / view.k} paintOrder="stroke"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.06 * i + 0.3 }}
                  >
                    {i + 1}
                  </motion.text>
                </g>
              );
            })}

          {p.points.map((q, i) => {
            const active = p.hoveredId === q.id || p.selectedId === q.id;
            const isNb = p.neighborIds.includes(q.id);
            const lit = !focusOn || p.highlightIds.has(q.id);
            const r = (active ? 8 : isNb ? 5.5 : 3.6) * rScale;
            return (
              <motion.circle
                key={q.id}
                cx={pos.get(q.id)!.x} cy={pos.get(q.id)!.y}
                initial={{ r: 0, opacity: 0 }}
                animate={{ r, opacity: lit ? 1 : 0.13, fill: q.color }}
                transition={{ delay: Math.min(i * 0.004, 0.8), duration: 0.45 }}
                stroke={active ? '#fff' : isNb ? 'var(--color-accent-soft)' : 'none'}
                strokeWidth={1.6 / view.k}
                style={{ filter: lit && !focusOn ? `drop-shadow(0 0 3px ${q.color})` : undefined }}
                className="cursor-pointer"
                onPointerEnter={(e) => {
                  p.onHover(q.id);
                  const w = wrapRef.current!.getBoundingClientRect();
                  const c = (e.currentTarget as Element).getBoundingClientRect();
                  setTip({ id: q.id, left: c.left + c.width / 2 - w.left, top: c.top - w.top, w: w.width });
                }}
                onPointerLeave={() => { p.onHover(null); setTip(null); }}
                onClick={(e) => { e.stopPropagation(); p.onSelect(q.id); }}
              />
            );
          })}

          {seed && (
            <motion.circle
              cx={seed.x} cy={seed.y} r={10 * rScale} fill="none" stroke="#fff" strokeWidth={1.5 / view.k} pointerEvents="none"
              initial={{ r: 10 * rScale, opacity: 0.9 }}
              animate={{ r: [10 * rScale, 19 * rScale, 10 * rScale], opacity: [0.9, 0.2, 0.9] }}
              transition={{ repeat: Infinity, duration: 1.8 }}
            />
          )}

          {lasso && lasso.length > 1 && (
            <motion.polygon
              points={lasso.map((q) => q.join(',')).join(' ')}
              fill="var(--color-accent)" fillOpacity={0.14} stroke="var(--color-accent-soft)" strokeWidth={1.6 / view.k}
              strokeDasharray={`${5 / view.k} ${4 / view.k}`}
              animate={{ strokeDashoffset: [0, -18 / view.k] }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
              pointerEvents="none"
            />
          )}
        </g>
        <rect width={VIEW} height={VIEW} fill="url(#ef-vignette)" pointerEvents="none" />
      </svg>

      <div className="absolute top-2 right-2 flex flex-col gap-1">
        {[{ i: <Plus size={12} />, f: () => zoomBy(1.4), t: 'Zoom in' }, { i: <Minus size={12} />, f: () => zoomBy(1 / 1.4), t: 'Zoom out' }, { i: <Maximize2 size={11} />, f: () => setView({ k: 1, tx: 0, ty: 0 }), t: 'Reset view' }].map((b2) => (
          <button key={b2.t} title={b2.t} onClick={b2.f} className="w-6 h-6 flex items-center justify-center bg-bg-panel/90 border border-border rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover">
            {b2.i}
          </button>
        ))}
      </div>
      <div className="absolute bottom-2 left-2 mono text-[10px] text-text-faint bg-black/50 px-1.5 py-0.5 rounded pointer-events-none">
        {p.tool === 'lasso' ? 'drag to lasso' : 'drag to pan'} · scroll to zoom · {view.k.toFixed(1)}x
      </div>

      {tip && p.renderTip && (
        <div className="absolute z-10 pointer-events-none" style={{ left: Math.min(Math.max(tip.left, 104), Math.max(104, tip.w - 104)), top: tip.top, transform: tip.top < 90 ? 'translate(-50%, 22px)' : 'translate(-50%, calc(-100% - 10px))' }}>
          {p.renderTip(tip.id)}
        </div>
      )}
    </div>
  );
}
