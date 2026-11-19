import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Search, Bookmark, BookmarkCheck, X, Crosshair, Shuffle, MousePointerClick, Lasso, History, ArrowRight, Save } from 'lucide-react';
import { TileThumb } from '../../components/ui/TileThumb';
import { ImageMagnifier } from '../../components/ui/ImageMagnifier';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import { tileCropFraction } from '../../lib/mockData';
import { cn } from '../../lib/utils';
import type { Cluster, Tile } from '../../lib/types';
import { aggregate, identityChanges, yearOfTile, type SiteMatch } from './discoveryHelpers';

export function Sparkline({ years, counts, color, height = 22 }: { years: number[]; counts: Record<number, number>; color: string; height?: number }) {
  const max = Math.max(1, ...years.map((y) => counts[y] ?? 0));
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {years.map((y, i) => {
        const v = counts[y] ?? 0;
        return (
          <motion.div
            key={y} title={`${y}: ${v}`} className="flex-1 rounded-[1px]"
            style={{ background: v ? color : 'var(--color-border)' }}
            initial={{ height: 2 }} animate={{ height: Math.max(2, (v / max) * height) }} transition={{ delay: i * 0.03, duration: 0.4 }}
          />
        );
      })}
    </div>
  );
}

function H({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <div className="text-[11px] font-semibold text-text-primary">{children}</div>
      {right}
    </div>
  );
}

interface Props {
  years: number[];
  clusters: Cluster[];
  cellTiles: Tile[];
  seed: Tile | null;
  matches: SiteMatch[];
  k: number;
  onK: (k: number) => void;
  lassoTiles: Tile[];
  cluster: Cluster | null;
  clusterTiles: Tile[];
  onPickTile: (id: string) => void;
  onHoverTile: (id: string | null) => void;
  onSearchWith: (tileId: string) => void;
  onSelectCluster: (id: string) => void;
  onClear: () => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onToggleSave: (id: string) => void;
  onSurprise: () => void;
  onOpenTimeline: () => void;
}

export function Inspector(p: Props) {
  const [name, setName] = useState('');
  const clusterOf = (t: Tile) => p.clusters.find((c) => c.id === t.clusterId);

  // ----- nothing selected: a friendly starting point -----
  if (!p.seed && p.lassoTiles.length === 0 && !p.cluster) {
    return (
      <div className="space-y-4">
        <div>
          <div className="text-sm font-semibold text-text-primary">Start exploring</div>
          <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
            Every dot is a place at a moment in time; dots that sit together look alike. Pick a way in — or just start dragging on the star map.
          </p>
        </div>
        <div className="space-y-2">
          {[
            { icon: <MousePointerClick size={14} />, title: 'Click any dot', desc: 'Make it your seed and see its closest matches light up.' },
            { icon: <Lasso size={14} />, title: 'Lasso a region', desc: 'Drag a loop around a group to inspect it and save it as a site type.' },
            { icon: <Crosshair size={14} />, title: 'Pick a cluster', desc: 'Tap a site type card below to light up every member.' },
          ].map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * i }} className="flex gap-2.5 p-2.5 rounded-lg bg-bg-raised/60 border border-border-subtle">
              <span className="text-accent-soft mt-0.5">{s.icon}</span>
              <div>
                <div className="text-[12px] text-text-primary font-medium">{s.title}</div>
                <div className="text-[11px] text-text-muted leading-snug">{s.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {p.clusters.filter((c) => c.isSaved).slice(0, 3).map((c) => (
            <button key={c.id} onClick={() => p.onSelectCluster(c.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border text-[11px] text-text-secondary hover:border-accent/60 hover:text-accent-soft transition-colors">
              <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />{c.name}
            </button>
          ))}
          <button onClick={p.onSurprise} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-dashed border-border text-[11px] text-text-muted hover:text-accent-soft hover:border-accent/60 transition-colors">
            <Shuffle size={11} /> surprise me
          </button>
        </div>
      </div>
    );
  }

  // ----- lasso group -----
  if (p.lassoTiles.length > 0 && !p.seed) {
    const agg = aggregate(p.lassoTiles);
    const parts = Object.entries(agg.byCluster).sort((a, b) => b[1] - a[1]);
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-semibold text-text-primary flex items-center gap-1.5"><Lasso size={14} className="text-accent-soft" /> Your selection</div>
            <div className="text-[11px] text-text-muted"><AnimatedNumber value={agg.count} className="mono text-text-primary" /> frames in <span className="mono">{new Set(p.lassoTiles.map((t) => t.gridCellId)).size}</span> locations</div>
          </div>
          <button onClick={p.onClear} className="text-text-faint hover:text-text-primary"><X size={14} /></button>
        </div>
        <div>
          <H>What is in it</H>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-bg-raised">
            {parts.map(([cid, n]) => (
              <motion.div key={cid} title={`${p.clusters.find((c) => c.id === cid)?.name ?? 'Unclassified'}: ${n}`} style={{ background: p.clusters.find((c) => c.id === cid)?.color ?? '#64748b' }} initial={{ width: 0 }} animate={{ width: `${(n / agg.count) * 100}%` }} transition={{ duration: 0.6 }} />
            ))}
          </div>
          <div className="mt-1.5 space-y-0.5">
            {parts.slice(0, 4).map(([cid, n]) => (
              <div key={cid} className="flex items-center gap-1.5 text-[10px] text-text-muted">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.clusters.find((c) => c.id === cid)?.color ?? '#64748b' }} />
                <span className="flex-1 truncate">{p.clusters.find((c) => c.id === cid)?.name ?? 'Unclassified'}</span>
                <span className="mono">{n}</span>
              </div>
            ))}
          </div>
        </div>
        <div><H>When</H><Sparkline years={p.years} counts={agg.byYear} color="var(--color-accent-soft)" height={30} /></div>
        <div>
          <H>Common concepts</H>
          <div className="flex flex-wrap gap-1">{agg.terms.map(([t, n]) => <Badge key={t} color="var(--color-accent-soft)">{t} · {n}</Badge>)}</div>
        </div>
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-2">
          <div className="text-[11px] font-semibold text-text-primary">Turn this into a reusable site type</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. hardened storage" onKeyDown={(e) => { if (e.key === 'Enter') { p.onCreate(name); setName(''); } }}
            className="w-full bg-bg-raised border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-soft" />
          <div className="flex gap-1.5">
            <Button size="sm" variant="primary" icon={<Save size={12} />} onClick={() => { p.onCreate(name); setName(''); }}>Save site type</Button>
            {agg.medoid && <Button size="sm" variant="outline" icon={<Search size={12} />} onClick={() => p.onSearchWith(agg.medoid!.id)}>Search best example</Button>}
          </div>
        </div>
      </div>
    );
  }

  // ----- whole cluster -----
  if (!p.seed && p.cluster) {
    const c = p.cluster;
    const agg = aggregate(p.clusterTiles);
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2">
          <span className="w-3 h-3 rounded-full mt-1.5 shrink-0" style={{ background: c.color, boxShadow: `0 0 10px ${c.color}` }} />
          <div className="flex-1 min-w-0">
            <input value={c.name} onChange={(e) => p.onRename(c.id, e.target.value)} className="w-full bg-transparent text-sm font-semibold text-text-primary focus:outline-none focus:bg-bg-raised rounded px-1 -mx-1" />
            <div className="text-[11px] text-text-muted"><AnimatedNumber value={agg.count} className="mono text-text-primary" /> frames · {new Set(p.clusterTiles.map((t) => t.gridCellId)).size} locations</div>
          </div>
          <button onClick={p.onClear} className="text-text-faint hover:text-text-primary"><X size={14} /></button>
        </div>
        <div><H>Appears over time</H><Sparkline years={p.years} counts={agg.byYear} color={c.color} height={34} /></div>
        <div><H>Defining concepts</H><div className="flex flex-wrap gap-1">{agg.terms.map(([t, n]) => <Badge key={t} color={c.color}>{t} · {n}</Badge>)}</div></div>
        <div>
          <H>Representative frames</H>
          <div className="grid grid-cols-4 gap-1.5">
            {p.clusterTiles.filter((_, i) => i % Math.max(1, Math.floor(p.clusterTiles.length / 8)) === 0).slice(0, 8).map((t) => (
              <div key={t.id} title={`${t.label} · ${yearOfTile(t)}`}>
                <TileThumb tile={t} size="100%" className="h-14" onClick={() => p.onPickTile(t.id)} onMouseEnter={() => p.onHoverTile(t.id)} onMouseLeave={() => p.onHoverTile(null)} />
                <div className="mono text-[9px] text-text-faint text-center mt-0.5">{yearOfTile(t)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant={c.isSaved ? 'primary' : 'outline'} icon={c.isSaved ? <BookmarkCheck size={12} /> : <Bookmark size={12} />} onClick={() => p.onToggleSave(c.id)}>{c.isSaved ? 'Saved site type' : 'Save as site type'}</Button>
          {agg.medoid && <Button size="sm" variant="secondary" icon={<Search size={12} />} onClick={() => p.onSearchWith(agg.medoid!.id)}>Search this type</Button>}
        </div>
      </div>
    );
  }

  // ----- a single seed site -----
  const seed = p.seed!;
  const sc = clusterOf(seed);
  const changes = identityChanges(p.cellTiles, p.clusters);
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text-primary truncate">{seed.label ?? 'Site'}</div>
          <div className="flex items-center gap-2 mt-0.5">
            {sc && <Badge color={sc.color} variant="dot">{sc.name}</Badge>}
            <span className="mono text-[10px] text-text-faint">{yearOfTile(seed)}</span>
          </div>
        </div>
        <button onClick={p.onClear} className="text-text-faint hover:text-text-primary"><X size={14} /></button>
      </div>

      <ImageMagnifier imageUrl={seed.imageUrl} cropFrac={tileCropFraction(seed)} label={seed.label} zoom={9} className="block">
        <TileThumb tile={seed} size="100%" className="h-40 w-full" rounded="rounded-lg" />
      </ImageMagnifier>
      <div className="flex flex-wrap gap-1">{seed.conceptTerms.map((t) => <Badge key={t}>{t}</Badge>)}</div>

      <div>
        <H right={<span className="flex items-center gap-1">{[5, 8, 12].map((n) => (
          <button key={n} onClick={() => p.onK(n)} className={cn('mono text-[10px] px-1.5 py-0.5 rounded border', p.k === n ? 'border-accent/60 bg-accent/15 text-accent-soft' : 'border-border text-text-faint hover:text-text-secondary')}>{n}</button>
        ))}</span>}>
          <span className="flex items-center gap-1.5"><Sparkles size={12} className="text-accent-soft" /> More sites like this</span>
        </H>
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {p.matches.map((m, i) => (
              <motion.li
                key={m.tile.gridCellId} layout initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}
                onMouseEnter={() => p.onHoverTile(m.tile.id)} onMouseLeave={() => p.onHoverTile(null)} onClick={() => p.onPickTile(m.tile.id)}
                className="flex items-center gap-2 p-1.5 rounded-md border border-border-subtle hover:border-accent/50 bg-bg-raised/40 cursor-pointer transition-colors"
              >
                <span className="w-5 h-5 rounded-full bg-accent-soft text-[#0a0e16] text-[10px] mono font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <TileThumb tile={m.tile} size={34} rounded="rounded" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-text-primary truncate">{m.tile.label}</div>
                  <div className="h-1 rounded-full bg-bg-raised mt-1 overflow-hidden"><motion.div className="h-full bg-accent-soft rounded-full" initial={{ width: 0 }} animate={{ width: `${m.sim}%` }} transition={{ duration: 0.5, delay: i * 0.03 }} /></div>
                </div>
                <div className="text-right shrink-0"><div className="mono text-[11px] text-accent-soft font-semibold">{m.sim}%</div><div className="mono text-[9px] text-text-faint">{yearOfTile(m.tile)}</div></div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>

      <div>
        <H right={<History size={11} className="text-text-faint" />}>This place over time</H>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {p.cellTiles.map((t) => (
            <button key={t.id} onClick={() => p.onPickTile(t.id)} className="shrink-0 text-center">
              <div className={cn('rounded overflow-hidden ring-2', t.id === seed.id ? 'ring-white' : 'ring-transparent')}>
                <TileThumb tile={t} size={36} rounded="rounded-none" />
                <div className="h-1" style={{ background: clusterOf(t)?.color ?? '#64748b' }} />
              </div>
              <div className="mono text-[9px] text-text-faint mt-0.5">{String(yearOfTile(t)).slice(2)}</div>
            </button>
          ))}
        </div>
        {changes.length > 0 ? (
          <div className="mt-1.5 space-y-1">
            {changes.map((c) => (
              <div key={c.year} className="text-[10px] text-text-muted flex items-center gap-1 flex-wrap">
                <span className="mono text-accent-soft">{c.year}</span> {c.from} <ArrowRight size={9} /> <span className="text-text-secondary">{c.to}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-1.5 text-[10px] text-text-faint">This place never changed identity across the decade.</div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1">
        <Button size="sm" variant="primary" icon={<Search size={12} />} onClick={() => p.onSearchWith(seed.id)}>Search with this chip</Button>
        {sc && <Button size="sm" variant="secondary" onClick={() => p.onSelectCluster(sc.id)}>Whole cluster</Button>}
        <Button size="sm" variant="outline" onClick={p.onOpenTimeline}>Timeline</Button>
      </div>
    </div>
  );
}
