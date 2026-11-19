import { AnimatePresence, motion } from 'framer-motion';
import { Bookmark, BookmarkCheck, Pencil } from 'lucide-react';
import { TileThumb } from '../../components/ui/TileThumb';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import { cn } from '../../lib/utils';
import type { Cluster, Tile } from '../../lib/types';
import { Sparkline } from './Inspector';
import { yearOfTile } from './discoveryHelpers';

export interface ClusterCard {
  cluster: Cluster;
  members: Tile[];
}

interface Props {
  cards: ClusterCard[];
  years: number[];
  selectedId: string | null;
  totalTiles: number;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onToggleSave: (id: string) => void;
}

export function ClusterCards(p: Props) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
      <AnimatePresence initial>
        {p.cards.map(({ cluster, members }, i) => {
          const counts: Record<number, number> = {};
          members.forEach((t) => { counts[yearOfTile(t)] = (counts[yearOfTile(t)] ?? 0) + 1; });
          const first = Math.min(...members.map(yearOfTile));
          const active = p.selectedId === cluster.id;
          const custom = cluster.id.startsWith('cl-custom');
          const mosaic = members.filter((_, idx) => idx % Math.max(1, Math.floor(members.length / 6)) === 0).slice(0, 6);
          return (
            <motion.div
              key={cluster.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 28 }}
              whileHover={{ y: -3 }}
              onClick={() => p.onSelect(cluster.id)}
              className={cn('relative rounded-xl border bg-bg-panel p-3 cursor-pointer flex flex-col gap-2.5 overflow-hidden', active ? 'border-transparent' : 'border-border-subtle hover:border-border-strong', custom && 'border-dashed')}
              style={active ? { boxShadow: `0 0 0 1.5px ${cluster.color}, 0 8px 28px ${cluster.color}26` } : undefined}
            >
              <span className="absolute -top-8 -right-8 w-20 h-20 rounded-full blur-2xl opacity-25 pointer-events-none" style={{ background: cluster.color }} />
              <div className="grid grid-cols-3 gap-0.5 rounded-md overflow-hidden">
                {mosaic.map((t) => <TileThumb key={t.id} tile={t} size="100%" className="h-11" rounded="rounded-none" />)}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cluster.color, boxShadow: `0 0 8px ${cluster.color}` }} />
                <input
                  value={cluster.name}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => p.onRename(cluster.id, e.target.value)}
                  className="flex-1 min-w-0 bg-transparent text-[12px] text-text-primary font-semibold focus:outline-none focus:bg-bg-raised rounded px-1 py-0.5"
                />
                <Pencil size={10} className="text-text-faint shrink-0" />
              </div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="mono text-lg font-semibold text-text-primary leading-none"><AnimatedNumber value={members.length} /></div>
                  <div className="text-[10px] text-text-faint mt-0.5">frames · {Math.round((members.length / Math.max(1, p.totalTiles)) * 100)}% · since {first}</div>
                </div>
                <div className="w-24"><Sparkline years={p.years} counts={counts} color={cluster.color} /></div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); p.onToggleSave(cluster.id); }}
                className={cn('relative flex items-center justify-center gap-1.5 rounded-md border py-1.5 text-[11px] font-medium transition-colors', cluster.isSaved ? 'bg-accent border-accent text-white' : 'border-border text-text-secondary hover:border-accent/60 hover:text-accent-soft')}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={String(cluster.isSaved)} initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0.4 }} className="flex">
                    {cluster.isSaved ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
                  </motion.span>
                </AnimatePresence>
                {cluster.isSaved ? 'Saved site type' : 'Save as site type'}
                {cluster.isSaved && (
                  <motion.span key="burst" className="absolute inset-0 rounded-md ring-2 ring-accent-soft pointer-events-none" initial={{ opacity: 0.9, scale: 1 }} animate={{ opacity: 0, scale: 1.25 }} transition={{ duration: 0.6 }} />
                )}
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
