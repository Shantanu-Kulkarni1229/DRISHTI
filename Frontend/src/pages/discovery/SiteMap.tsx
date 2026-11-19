import { AnimatePresence, motion } from 'framer-motion';
import { Play, Pause } from 'lucide-react';
import { cn } from '../../lib/utils';

export type CellState = 'normal' | 'dim' | 'member' | 'neighbor' | 'seed';

export interface CellView {
  gridCellId: string;
  cx: number;
  cy: number;
  label: string;
  tint: string;
  clusterName: string;
  state: CellState;
  rank?: number;
  sim?: number;
  years?: number[];
}

interface Props {
  imageUrl?: string;
  year: number;
  years: number[];
  onYear: (y: number) => void;
  playing: boolean;
  onPlay: () => void;
  cells: CellView[];
  hoveredCell: string | null;
  onHover: (id: string | null) => void;
  onPick: (id: string) => void;
}

export function SiteMap(p: Props) {
  const byPos = new Map(p.cells.map((c) => [`${c.cx}-${c.cy}`, c]));
  const rows = [3, 2, 1, 0]; // image top = north = highest cy

  return (
    <div className="space-y-2.5">
      <div className="relative aspect-square w-full max-w-[640px] mx-auto rounded-xl overflow-hidden border border-border-subtle bg-black">
        <AnimatePresence mode="popLayout">
          <motion.img
            key={p.imageUrl ?? p.year}
            src={p.imageUrl}
            alt={`Sector ${p.year}`}
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover select-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
        </AnimatePresence>

        <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
          {rows.flatMap((cy) =>
            [0, 1, 2, 3].map((cx) => {
              const c = byPos.get(`${cx}-${cy}`);
              if (!c) return <div key={`${cx}-${cy}`} />;
              const hover = p.hoveredCell === c.gridCellId;
              const seed = c.state === 'seed';
              const nb = c.state === 'neighbor';
              const member = c.state === 'member';
              const dim = c.state === 'dim';
              return (
                <motion.button
                  key={c.gridCellId}
                  type="button"
                  onMouseEnter={() => p.onHover(c.gridCellId)}
                  onMouseLeave={() => p.onHover(null)}
                  onClick={() => p.onPick(c.gridCellId)}
                  className={cn('relative border text-left outline-none', seed ? 'z-10' : nb ? 'z-[5]' : '')}
                  style={{
                    borderColor: seed ? '#fff' : nb ? 'var(--color-accent-soft)' : member ? c.tint : 'rgba(255,255,255,0.07)',
                    borderStyle: nb ? 'dashed' : 'solid',
                    borderWidth: seed || nb || member ? 2 : 1,
                    boxShadow: seed ? '0 0 26px rgba(255,255,255,0.45), inset 0 0 22px rgba(255,255,255,0.18)' : hover ? `inset 0 0 0 2px ${c.tint}` : 'none',
                  }}
                  animate={{ backgroundColor: dim ? 'rgba(0,0,0,0.5)' : member ? `${c.tint}66` : nb ? 'rgba(129,140,248,0.22)' : seed ? 'rgba(255,255,255,0.08)' : hover ? `${c.tint}55` : `${c.tint}26` }}
                  transition={{ duration: 0.4 }}
                >
                  {seed && (
                    <>
                      {['top-1 left-1 border-t-2 border-l-2', 'top-1 right-1 border-t-2 border-r-2', 'bottom-1 left-1 border-b-2 border-l-2', 'bottom-1 right-1 border-b-2 border-r-2'].map((k) => (
                        <motion.span key={k} className={cn('absolute w-3 h-3 border-white', k)} animate={{ scale: [1, 1.35, 1] }} transition={{ repeat: Infinity, duration: 1.6 }} />
                      ))}
                    </>
                  )}
                  {nb && c.rank !== undefined && (
                    <motion.span
                      initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.05 * c.rank, type: 'spring', stiffness: 400, damping: 18 }}
                      className="absolute top-1 left-1 w-5 h-5 rounded-full bg-accent-soft text-[#0a0e16] text-[10px] mono font-bold flex items-center justify-center"
                    >
                      {c.rank}
                    </motion.span>
                  )}
                  {nb && c.sim !== undefined && (
                    <span className="absolute bottom-1 right-1 mono text-[10px] font-semibold text-white bg-black/60 px-1 rounded">{c.sim}%</span>
                  )}
                  {(member || nb) && c.years && c.years.length > 0 && (
                    <span className="absolute bottom-1 left-1 mono text-[8px] text-white/90 bg-black/55 px-1 rounded max-w-[90%] truncate">
                      {c.years.map((y) => `'${String(y).slice(2)}`).join(' ')}
                    </span>
                  )}
                  <AnimatePresence>
                    {hover && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="absolute left-1 top-1 right-1 z-20 pointer-events-none"
                      >
                        <div className="inline-block max-w-full bg-black/80 backdrop-blur rounded px-1.5 py-1">
                          <div className="text-[10px] text-white font-medium leading-tight truncate">{c.label}</div>
                          <div className="text-[9px] flex items-center gap-1 leading-tight" style={{ color: c.tint }}>
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.tint }} />
                            <span className="truncate">{c.clusterName}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })
          )}
        </div>
        <div className="absolute top-2 left-2 mono text-[10px] bg-black/65 text-white px-2 py-1 rounded-md backdrop-blur pointer-events-none">{p.year}</div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={p.onPlay}
          className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] font-medium shrink-0 transition-colors', p.playing ? 'bg-accent border-accent text-white' : 'border-border text-text-secondary hover:text-text-primary')}
        >
          {p.playing ? <Pause size={12} /> : <Play size={12} />}
          <span className="hidden sm:inline">{p.playing ? 'pause' : 'play years'}</span>
        </button>
        <div className="flex-1 flex gap-0.5 bg-bg-raised rounded-lg p-1 overflow-x-auto">
          {p.years.map((y) => (
            <button
              key={y}
              onClick={() => p.onYear(y)}
              className={cn('relative flex-1 min-w-[38px] py-1 rounded text-[10px] mono z-10 transition-colors', y === p.year ? 'text-white' : 'text-text-muted hover:text-text-secondary')}
            >
              {y === p.year && <motion.span layoutId="disc-year" className="absolute inset-0 bg-accent rounded" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
              <span className="relative">{y}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
