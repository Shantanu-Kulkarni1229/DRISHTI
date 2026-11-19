import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Compass, Info, Lasso, Hand, Orbit, Database, Boxes, BookmarkCheck, Focus, Search as SearchIcon } from 'lucide-react';
import { useFilterStore } from '../../state/filterStore';
import { useClusterStore } from '../../state/clusterStore';
import { useSearchStore } from '../../state/searchStore';
import { useIngestStore } from '../../state/ingestStore';
import { TILES, SCENES, aoiById } from '../../lib/mockData';
import { EmbeddingField, type FieldHalo } from '../../components/charts/EmbeddingField';
import { TileThumb } from '../../components/ui/TileThumb';
import { Card, CardHeader } from '../../components/ui/Card';
import { Drawer } from '../../components/ui/Drawer';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import { useShortcuts } from '../../lib/useShortcuts';
import { cn } from '../../lib/utils';
import type { Tile } from '../../lib/types';
import { SiteMap, type CellView } from './SiteMap';
import { Inspector } from './Inspector';
import { ClusterCards } from './ClusterCards';
import { SIM_STOPS, aggregate, nearestOtherSites, ramp, similarityPct, yearColor, yearOfTile } from './discoveryHelpers';

type ColorBy = 'cluster' | 'year' | 'similarity';

function Seg<T extends string>({ value, options, onChange, layout }: { value: T; options: { id: T; label: string; icon?: React.ReactNode; disabled?: boolean; tip?: string }[]; onChange: (v: T) => void; layout: string }) {
  return (
    <div className="relative flex bg-bg-raised rounded-lg p-1">
      {options.map((o) => (
        <button
          key={o.id} disabled={o.disabled} title={o.tip} onClick={() => onChange(o.id)}
          className={cn('relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium z-10 transition-colors disabled:opacity-35', value === o.id ? 'text-white' : 'text-text-muted hover:text-text-secondary')}
        >
          {value === o.id && <motion.span layoutId={layout} className="absolute inset-0 bg-accent rounded-md" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
          <span className="relative flex">{o.icon}</span>
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function Stat({ icon, label, value, delay }: { icon: React.ReactNode; label: string; value: number; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.35 }} className="bg-bg-panel border border-border-subtle rounded-lg px-3 py-2 min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] text-text-faint mb-0.5 truncate"><span className="text-accent-soft">{icon}</span>{label}</div>
      <AnimatedNumber value={value} className="mono text-lg font-semibold text-text-primary" />
    </motion.div>
  );
}

export function DiscoveryPage() {
  const navigate = useNavigate();
  const aoiId = useFilterStore((s) => s.aoiId);
  const aoi = aoiById(aoiId)!;
  const tileCount = useIngestStore((s) => s.indexStats.tileCount);

  const { clusters, selectedClusterId, lassoSelectedTileIds, select, rename, toggleSave, setLassoSelection, createCluster } = useClusterStore();
  const setImageQuery = useSearchStore((s) => s.setImageQuery);

  const [tool, setTool] = useState<'lasso' | 'pan'>('lasso');
  const [colorBy, setColorBy] = useState<ColorBy>('cluster');
  const [halos, setHalos] = useState(true);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [hoveredTileId, setHoveredTileId] = useState<string | null>(null);
  const [k, setK] = useState(8);
  const [year, setYear] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const tilesInAoi = useMemo(() => TILES.filter((t) => t.aoiId === aoiId), [aoiId, tileCount]); // eslint-disable-line react-hooks/exhaustive-deps
  const tileIndex = useMemo(() => new Map(tilesInAoi.map((t) => [t.id, t])), [tilesInAoi]);
  const years = useMemo(() => [...new Set(SCENES.filter((s) => s.aoiId === aoiId).map((s) => new Date(s.datetime).getUTCFullYear()))].sort((a, b) => a - b), [aoiId, tileCount]); // eslint-disable-line react-hooks/exhaustive-deps
  const mapYear = year ?? years[years.length - 1];
  const clusterMap = useMemo(() => new Map(clusters.map((c) => [c.id, c])), [clusters]);
  const imageFor = (y: number) =>
    SCENES.find((s) => s.aoiId === aoiId && new Date(s.datetime).getUTCFullYear() === y && s.imageUrl)?.imageUrl ??
    [...SCENES].filter((s) => s.aoiId === aoiId && s.imageUrl).sort((a, b) => b.datetime.localeCompare(a.datetime))[0]?.imageUrl;

  useEffect(() => {
    if (!selectedTileId && colorBy === 'similarity') setColorBy('cluster');
  }, [selectedTileId, colorBy]);

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setYear((y) => { const i = years.indexOf(y ?? years[years.length - 1]); return years[(i + 1) % years.length]; }), 1400);
    return () => window.clearInterval(t);
  }, [playing, years]);

  // ----- focus model: exactly one of seed / lasso / cluster is active -----
  const seed = selectedTileId ? tileIndex.get(selectedTileId) ?? null : null;
  const matches = useMemo(() => (seed ? nearestOtherSites(seed, tilesInAoi, k) : []), [seed, tilesInAoi, k]);
  const neighborIds = useMemo(() => matches.map((m) => m.tile.id), [matches]);
  const lassoTiles = useMemo(() => lassoSelectedTileIds.map((id) => tileIndex.get(id)).filter((t): t is Tile => !!t), [lassoSelectedTileIds, tileIndex]);
  const cluster = !seed && lassoTiles.length === 0 && selectedClusterId ? clusterMap.get(selectedClusterId) ?? null : null;
  const clusterTiles = useMemo(() => (cluster ? cluster.memberTileIds.map((id) => tileIndex.get(id)).filter((t): t is Tile => !!t) : []), [cluster, tileIndex]);

  const highlightIds = useMemo(() => {
    if (lassoTiles.length && !seed) return new Set(lassoTiles.map((t) => t.id));
    if (seed) return new Set([seed.id, ...neighborIds]);
    if (cluster) return new Set(clusterTiles.map((t) => t.id));
    return new Set<string>();
  }, [lassoTiles, seed, neighborIds, cluster, clusterTiles]);

  const clearAll = () => { setSelectedTileId(null); select(null); setLassoSelection([]); };
  const pickTile = (id: string) => {
    const t = tileIndex.get(id);
    setSelectedTileId(id);
    select(null);
    if (t) { setYear(yearOfTile(t)); setPlaying(false); }
  };
  const pickCluster = (id: string) => { setSelectedTileId(null); select(id); };
  const searchWith = (id: string) => { setImageQuery(id); navigate('/search'); };
  const surprise = () => {
    const pool = tilesInAoi.filter((t) => t.clusterId);
    if (pool.length) pickTile(pool[Math.floor(Math.random() * pool.length)].id);
  };

  // ----- scatter data -----
  const minY = years[0];
  const maxY = years[years.length - 1];
  const points = useMemo(
    () =>
      tilesInAoi.map((t) => ({
        id: t.id, x: t.embedding2d[0], y: t.embedding2d[1],
        color:
          colorBy === 'year' ? yearColor(yearOfTile(t), minY, maxY)
          : colorBy === 'similarity' && seed ? ramp(similarityPct(t.embedding2d, seed.embedding2d) / 100, SIM_STOPS)
          : clusterMap.get(t.clusterId ?? '')?.color ?? t.thumbColor,
      })),
    [tilesInAoi, colorBy, seed, clusterMap, minY, maxY]
  );

  const haloData: FieldHalo[] = useMemo(
    () =>
      clusters.filter((c) => !c.id.startsWith('cl-custom')).flatMap((c) => {
        const m = c.memberTileIds.map((id) => tileIndex.get(id)).filter((t): t is Tile => !!t);
        if (m.length < 3) return [];
        const mx = m.reduce((s, t) => s + t.embedding2d[0], 0) / m.length;
        const my = m.reduce((s, t) => s + t.embedding2d[1], 0) / m.length;
        const sdx = Math.sqrt(m.reduce((s, t) => s + (t.embedding2d[0] - mx) ** 2, 0) / m.length);
        const sdy = Math.sqrt(m.reduce((s, t) => s + (t.embedding2d[1] - my) ** 2, 0) / m.length);
        return [{ id: c.id, label: c.name, color: c.color, x: mx, y: my, rx: Math.max(0.55, sdx * 2.1), ry: Math.max(0.55, sdy * 2.1) }];
      }),
    [clusters, tileIndex]
  );

  // ----- site map cells for the chosen year -----
  const cells: CellView[] = useMemo(() => {
    const byCell = new Map<string, Tile[]>();
    tilesInAoi.forEach((t) => byCell.set(t.gridCellId, [...(byCell.get(t.gridCellId) ?? []), t]));
    const matchByCell = new Map(matches.map((m, i) => [m.tile.gridCellId, { ...m, rank: i + 1 }]));
    return [...byCell.entries()].map(([gridCellId, list]) => {
      const atYear = list.find((t) => yearOfTile(t) === mapYear) ?? list[list.length - 1];
      const [cy, cx] = [Number(gridCellId.split('-').pop()), Number(gridCellId.split('-').slice(-2)[0])];
      const cl = clusterMap.get(atYear.clusterId ?? '');
      const hit = list.filter((t) => highlightIds.has(t.id));
      const nb = matchByCell.get(gridCellId);
      let state: CellView['state'] = 'normal';
      if (seed && seed.gridCellId === gridCellId) state = 'seed';
      else if (seed && nb) state = 'neighbor';
      else if (!seed && hit.length) state = 'member';
      else if (highlightIds.size) state = 'dim';
      return {
        gridCellId, cx, cy, label: atYear.label ?? gridCellId, tint: cl?.color ?? atYear.thumbColor, clusterName: cl?.name ?? 'Unclassified',
        state, rank: nb?.rank, sim: nb?.sim, years: state === 'member' ? hit.map(yearOfTile) : nb ? [yearOfTile(nb.tile)] : undefined,
      };
    });
  }, [tilesInAoi, matches, mapYear, clusterMap, highlightIds, seed]);

  const tileAt = (cellId: string) => tilesInAoi.find((t) => t.gridCellId === cellId && yearOfTile(t) === mapYear) ?? tilesInAoi.filter((t) => t.gridCellId === cellId).pop();
  const hoveredCell = hoveredTileId ? tileIndex.get(hoveredTileId)?.gridCellId ?? null : null;
  const cellTiles = useMemo(() => (seed ? tilesInAoi.filter((t) => t.gridCellId === seed.gridCellId).sort((a, b) => a.datetime.localeCompare(b.datetime)) : []), [seed, tilesInAoi]);

  const cards = useMemo(
    () => clusters.map((c) => ({ cluster: c, members: c.memberTileIds.map((id) => tileIndex.get(id)).filter((t): t is Tile => !!t) })).filter((x) => x.members.length > 0).sort((a, b) => b.members.length - a.members.length),
    [clusters, tileIndex]
  );
  const saved = cards.filter((c) => c.cluster.isSaved);

  useShortcuts(
    {
      l: () => setTool('lasso'),
      p: () => setTool('pan'),
      h: () => setHalos((v) => !v),
      c: () => setColorBy((c) => (c === 'cluster' ? 'year' : c === 'year' ? (seed ? 'similarity' : 'cluster') : 'cluster')),
      escape: clearAll,
      enter: () => seed && searchWith(seed.id),
      '[': () => { setPlaying(false); setYear(years[Math.max(0, years.indexOf(mapYear) - 1)]); },
      ']': () => { setPlaying(false); setYear(years[Math.min(years.length - 1, years.indexOf(mapYear) + 1)]); },
      ' ': () => setPlaying((v) => !v),
    },
    [
      { keys: 'L / P', label: 'lasso / pan tool' },
      { keys: 'C', label: 'cycle colour: cluster, year, similarity' },
      { keys: 'H', label: 'toggle cluster halos' },
      { keys: '[ ]', label: 'previous / next year on the map' },
      { keys: 'space', label: 'play the years' },
      { keys: 'enter', label: 'search with the selected chip' },
      { keys: 'Esc', label: 'clear the selection' },
    ]
  );

  const renderTip = (id: string) => {
    const t = tileIndex.get(id);
    if (!t) return null;
    const cl = clusterMap.get(t.clusterId ?? '');
    return (
      <div className="w-[196px] bg-bg-panel border border-border rounded-lg shadow-2xl p-1.5 flex gap-2">
        <TileThumb tile={t} size={46} rounded="rounded" />
        <div className="min-w-0">
          <div className="text-[11px] text-text-primary font-medium truncate">{t.label}</div>
          <div className="flex items-center gap-1 text-[10px] text-text-muted truncate"><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cl?.color }} />{cl?.name ?? 'Unclassified'}</div>
          <div className="mono text-[10px] text-text-faint">{yearOfTile(t)}{seed && seed.id !== t.id ? ` · ${similarityPct(t.embedding2d, seed.embedding2d)}% alike` : ''}</div>
        </div>
      </div>
    );
  };

  const legend =
    colorBy === 'cluster' ? (
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {cards.filter((c) => !c.cluster.id.startsWith('cl-custom')).map(({ cluster: c }) => (
          <button key={c.id} onClick={() => pickCluster(c.id)} className="flex items-center gap-1.5 text-[10px] text-text-muted hover:text-text-primary">
            <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />{c.name}
          </button>
        ))}
      </div>
    ) : (
      <div className="flex items-center gap-2 text-[10px] text-text-muted">
        <span className="mono">{colorBy === 'year' ? minY : 'less alike'}</span>
        <span className="h-2 w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${(colorBy === 'year' ? [0, 0.25, 0.5, 0.75, 1].map((t) => ramp(t)) : SIM_STOPS).join(',')})` }} />
        <span className="mono">{colorBy === 'year' ? maxY : 'more alike'}</span>
      </div>
    );

  return (
    <div className="p-3 sm:p-4 lg:p-5 max-w-[1900px] mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 mb-4">
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2"><Compass size={17} className="text-accent-soft shrink-0" /> Discovery</h2>
          <p className="text-[11px] text-text-muted mt-0.5">"I found one — find me the rest." Explore how every place in {aoi.name} relates to every other, then turn a hunch into a reusable site type.</p>
        </div>
        <button onClick={() => setHelpOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-text-secondary hover:text-accent-soft hover:border-accent/50 transition-colors">
          <Info size={13} /> How it works
        </button>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        <Stat icon={<Database size={11} />} label="frames mapped" value={tilesInAoi.length} delay={0.02} />
        <Stat icon={<Boxes size={11} />} label="clusters found" value={cards.length} delay={0.06} />
        <Stat icon={<BookmarkCheck size={11} />} label="saved site types" value={saved.length} delay={0.1} />
        <Stat icon={<Focus size={11} />} label="in focus" value={highlightIds.size} delay={0.14} />
      </div>

      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_380px] items-start">
        <div className="min-w-0 grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-[repeat(2,minmax(0,1fr))] xl:col-start-1 xl:row-start-1">
          <Card>
            <CardHeader title="Embedding space" subtitle="Places that look alike sit close together" />
            <div className="p-3 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Seg layout="disc-tool" value={tool} onChange={setTool} options={[{ id: 'lasso', label: 'Lasso', icon: <Lasso size={12} />, tip: 'Drag a loop to select (L)' }, { id: 'pan', label: 'Pan', icon: <Hand size={12} />, tip: 'Drag to move around (P)' }]} />
                <Seg layout="disc-color" value={colorBy} onChange={setColorBy} options={[{ id: 'cluster', label: 'Cluster' }, { id: 'year', label: 'Year' }, { id: 'similarity', label: 'Match', disabled: !seed, tip: seed ? 'Colour by similarity to your chip' : 'Pick a chip first' }]} />
                <button onClick={() => setHalos((h) => !h)} title="Cluster halos (H)" className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] transition-colors', halos ? 'border-accent/60 bg-accent/15 text-accent-soft' : 'border-border text-text-muted')}>
                  <Orbit size={12} /> halos
                </button>
              </div>
              <EmbeddingField
                className="aspect-square w-full"
                points={points} halos={haloData} showHalos={halos} tool={tool}
                hoveredId={hoveredTileId} selectedId={seed?.id ?? null} highlightIds={highlightIds} neighborIds={neighborIds}
                onHover={setHoveredTileId} onSelect={pickTile}
                onLasso={(ids) => { setSelectedTileId(null); setLassoSelection(ids); }}
                onClear={clearAll} renderTip={renderTip}
              />
              {legend}
            </div>
          </Card>

          <Card>
            <CardHeader title="Where they are" subtitle="The real sector — scrub the years to watch places change identity" />
            <div className="p-3">
              <SiteMap
                imageUrl={imageFor(mapYear)} year={mapYear} years={years}
                onYear={(y) => { setPlaying(false); setYear(y); }} playing={playing} onPlay={() => setPlaying((v) => !v)}
                cells={cells} hoveredCell={hoveredCell}
                onHover={(id) => setHoveredTileId(id ? tileAt(id)?.id ?? null : null)}
                onPick={(id) => { const t = tileAt(id); if (t) pickTile(t.id); }}
              />
            </div>
          </Card>
        </div>

        <aside className="xl:col-start-2 xl:row-start-1 xl:row-span-2 xl:sticky xl:top-3 xl:max-h-[calc(100dvh-6.5rem)] xl:overflow-y-auto">
          <Card className="p-4">
            <Inspector
              years={years} clusters={clusters} cellTiles={cellTiles} seed={seed} matches={matches} k={k} onK={setK}
              lassoTiles={lassoTiles} cluster={cluster} clusterTiles={clusterTiles}
              onPickTile={pickTile} onHoverTile={setHoveredTileId} onSearchWith={searchWith} onSelectCluster={pickCluster}
              onClear={clearAll}
              onCreate={(name) => { createCluster(name, lassoTiles.map((t) => t.id)); setSelectedTileId(null); }}
              onRename={rename} onToggleSave={toggleSave} onSurprise={surprise} onOpenTimeline={() => navigate('/timeline')}
            />
          </Card>
        </aside>

        <div className="min-w-0 xl:col-start-1 xl:row-start-2">
          <Card>
            <CardHeader title="Site types" subtitle="Clusters the system found on its own. Name them, save the useful ones, and search for them later." />
            <div className="p-3 sm:p-4 space-y-3">
              {saved.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-text-faint mr-1">saved — tap to search for one:</span>
                  {saved.map(({ cluster: c, members }) => (
                    <button key={c.id} onClick={() => searchWith(aggregate(members).medoid!.id)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] text-text-secondary hover:text-white hover:bg-accent transition-colors" style={{ borderColor: `${c.color}88` }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />{c.name}<SearchIcon size={10} className="opacity-60" />
                    </button>
                  ))}
                </div>
              )}
              <ClusterCards cards={cards} years={years} selectedId={cluster?.id ?? null} totalTiles={tilesInAoi.length} onSelect={pickCluster} onRename={rename} onToggleSave={toggleSave} />
            </div>
          </Card>
        </div>
      </div>

      <Drawer open={helpOpen} onClose={() => setHelpOpen(false)} title="How discovery works" subtitle="From thousands of pixels to a handful of useful ideas" width="w-[540px]">
        <div className="p-4 space-y-4 text-[12px] text-text-secondary leading-relaxed">
          {[
            ['The big idea', 'Every frame of every place is turned into a fingerprint of numbers describing what it looks like. Frames that look alike get similar fingerprints — so you can find "more like this" without ever describing it in words.'],
            ['The star map', 'The fingerprints are squashed onto a flat map (a technique called UMAP) so that similar frames sit close together. Glowing halos mark groups the system found by itself (clustering).'],
            ['Colour modes', 'Cluster shows the groups. Year shows time, violet to yellow. Match shows how alike everything is to the chip you picked.'],
            ['Click a dot', 'It becomes your seed. Dashed lines link it to its closest matches at other locations, numbered by how alike they are. The map on the right shows exactly where they are.'],
            ['Lasso a region', 'Drag a loop around any group. You get a breakdown of what is inside, and you can name it and save it as your own site type.'],
            ['Watch places change', 'Scrub or play the years on the site map. A place can move between clusters as it is built up — the "This place over time" strip lists exactly when it changed identity.'],
            ['Site types', 'A saved site type is a reusable idea ("hardened storage", "launch pad"). Tap one to search the whole archive for it.'],
            ['In this prototype', 'The map layout and fingerprints are precomputed sample data standing in for a real image model plus UMAP and HDBSCAN. Every interaction, selection and calculation on top of them is live.'],
          ].map(([t, d]) => (
            <div key={t}><div className="text-[11px] font-semibold text-text-primary mb-0.5">{t}</div>{d}</div>
          ))}
          <div>
            <div className="text-[11px] font-semibold text-text-primary mb-1">Keyboard</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              {[['L / P', 'lasso / pan'], ['C', 'cycle colour'], ['H', 'halos'], ['[ ]', 'change year'], ['space', 'play years'], ['enter', 'search with chip'], ['Esc', 'clear'], ['?', 'all shortcuts']].map(([kk, d]) => (
                <div key={kk} className="flex items-center justify-between gap-2"><span className="text-text-muted">{d}</span><kbd className="mono px-1.5 py-0.5 rounded bg-bg-raised border border-border text-text-primary">{kk}</kbd></div>
              ))}
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
