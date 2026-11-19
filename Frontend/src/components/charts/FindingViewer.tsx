import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronsLeftRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { focusFor, type PctBox } from '../../lib/findingView';

export type ViewerMode = 'swipe' | 'before' | 'after' | 'blink';

const MODES: { id: ViewerMode; label: string }[] = [
  { id: 'swipe', label: 'Swipe' },
  { id: 'before', label: 'Before' },
  { id: 'after', label: 'After' },
  { id: 'blink', label: 'Blink' },
];

interface Props {
  beforeImage?: string;
  afterImage?: string;
  beforeYear: number;
  afterYear: number;
  box: PctBox;
  color: string;
  mode: ViewerMode;
  onMode: (m: ViewerMode) => void;
  showBox: boolean;
  onShowBox: (v: boolean) => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function FindingViewer(p: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [swipe, setSwipe] = useState(50);
  const [blinkOn, setBlinkOn] = useState(false);

  const { fx, fy, s } = focusFor(p.box);
  // the viewport is 4:3 over a square frame, so vertical centre is 0.375 of the frame width
  const target = {
    scale: s,
    x: `${clamp(0.5 - s * fx, 1 - s, 0) * 100}%`,
    y: `${clamp(0.375 - s * fy, 0.75 - s, 0) * 100}%`,
  };

  useEffect(() => {
    if (p.mode !== 'blink') return;
    const t = window.setInterval(() => setBlinkOn((v) => !v), 800);
    return () => window.clearInterval(t);
  }, [p.mode]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      setSwipe(clamp(((e.clientX - r.left) / r.width) * 100, 0, 100));
    };
    const up = () => { dragging.current = false; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  const layer = (src?: string, children?: React.ReactNode) => (
    <motion.div
      className="absolute left-0 top-0 w-full aspect-square"
      style={{ transformOrigin: '0 0' }}
      initial={false}
      animate={target}
      transition={{ type: 'spring', stiffness: 110, damping: 20 }}
    >
      {src && <img src={src} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover select-none" />}
      {children}
    </motion.div>
  );

  const showAfter = p.mode === 'after' || (p.mode === 'blink' && blinkOn);
  const afterClip = p.mode === 'swipe' ? `inset(0 0 0 ${swipe}%)` : showAfter ? 'inset(0)' : 'inset(0 0 0 100%)';
  const label = p.mode === 'blink' ? (blinkOn ? `AFTER ${p.afterYear}` : `BEFORE ${p.beforeYear}`) : p.mode === 'after' ? `AFTER ${p.afterYear}` : p.mode === 'before' ? `BEFORE ${p.beforeYear}` : null;

  return (
    <div className="space-y-2 mx-auto" style={{ width: 'min(100%, 62vh)' }}>
      <div
        ref={ref}
        className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black border border-border shadow-xl touch-none"
        onPointerDown={(e) => {
          if (p.mode !== 'swipe' || !ref.current) return;
          dragging.current = true;
          const r = ref.current.getBoundingClientRect();
          setSwipe(clamp(((e.clientX - r.left) / r.width) * 100, 0, 100));
        }}
      >
        {layer(p.beforeImage)}
        <div className="absolute inset-0" style={{ clipPath: afterClip, transition: p.mode === 'swipe' ? undefined : 'clip-path 0.35s' }}>
          {layer(p.afterImage)}
        </div>
        {p.showBox && (
          <div className="absolute inset-0 pointer-events-none">
            {layer(undefined,
              <motion.div
                className="absolute rounded-sm"
                style={{
                  left: `${p.box.left}%`, top: `${p.box.top}%`, width: `${p.box.width}%`, height: `${p.box.height}%`,
                  border: `${2 / s}px solid ${p.color}`, background: `${p.color}18`, boxShadow: `0 0 ${18 / s}px ${p.color}88`,
                }}
                animate={{ opacity: [0.75, 1, 0.75] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            )}
          </div>
        )}

        {p.mode === 'swipe' && (
          <div className="absolute inset-y-0 z-10 pointer-events-none" style={{ left: `${swipe}%` }}>
            <div className="absolute inset-y-0 -translate-x-1/2 w-0.5 bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.7)]" />
            <div className="absolute top-1/2 w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white text-[#0a0e16] flex items-center justify-center shadow-xl">
              <ChevronsLeftRight size={15} />
            </div>
          </div>
        )}
        {p.mode === 'swipe' ? (
          <>
            <span className="absolute top-2 left-2 mono text-[10px] bg-black/65 text-white px-2 py-1 rounded-md backdrop-blur pointer-events-none">BEFORE {p.beforeYear}</span>
            <span className="absolute top-2 right-2 mono text-[10px] bg-black/65 text-white px-2 py-1 rounded-md backdrop-blur pointer-events-none">AFTER {p.afterYear}</span>
          </>
        ) : (
          label && <span className="absolute top-2 left-2 mono text-[10px] bg-black/65 text-white px-2 py-1 rounded-md backdrop-blur pointer-events-none">{label}</span>
        )}
        <span className="absolute bottom-2 right-2 mono text-[10px] bg-black/55 text-white/80 px-1.5 py-0.5 rounded pointer-events-none">{s.toFixed(1)}x</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex bg-bg-raised rounded-lg p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => p.onMode(m.id)}
              className={cn('relative px-2.5 py-1 rounded-md text-[11px] font-medium z-10 transition-colors', p.mode === m.id ? 'text-white' : 'text-text-muted hover:text-text-secondary')}
            >
              {p.mode === m.id && <motion.span layoutId="viewer-mode" className="absolute inset-0 bg-accent rounded-md" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
              <span className="relative">{m.label}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-text-muted cursor-pointer select-none">
          <input type="checkbox" checked={p.showBox} onChange={(e) => p.onShowBox(e.target.checked)} className="accent-[var(--color-accent)]" />
          outline the change
        </label>
      </div>
    </div>
  );
}
