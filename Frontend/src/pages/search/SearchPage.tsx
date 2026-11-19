import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  Search as SearchIcon, Image as ImageIcon, Layers, Upload, MapPin, ThumbsUp, ThumbsDown, Sparkles,
  RotateCcw, ArrowUpDown, Info, Bookmark, BookmarkPlus, History, LayoutGrid, Rows3, Trash2,
  Keyboard, Crosshair, Wand2, Check,
} from 'lucide-react';
import { useSearchStore } from '../../state/searchStore';
import { useFilterStore } from '../../state/filterStore';
import { useAuditStore } from '../../state/auditStore';
import { AOIS, sceneById, aoiById, tileCropFraction, latestSceneFor, TILES } from '../../lib/mockData';
import { MockMap } from '../../components/map/MockMap';
import { TileThumb } from '../../components/ui/TileThumb';
import { ImageMagnifier } from '../../components/ui/ImageMagnifier';
import { Button } from '../../components/ui/Button';
import { Slider } from '../../components/ui/Slider';
import { Badge } from '../../components/ui/Badge';
import { Drawer } from '../../components/ui/Drawer';
import { EmptyState } from '../../components/ui/EmptyState';
import { Tooltip } from '../../components/ui/Tooltip';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import { useShortcuts } from '../../lib/useShortcuts';
import { formatDate, formatDateShort, cn } from '../../lib/utils';
import type { QueryMode } from '../../state/searchStore';
import type { SearchResult } from '../../lib/types';

const MODES: { id: QueryMode; label: string; icon: typeof SearchIcon }[] = [
  { id: 'text', label: 'Text', icon: SearchIcon },
  { id: 'image', label: 'Image', icon: ImageIcon },
  { id: 'both', label: 'Both', icon: Layers },
];

const CONCEPT_CHIPS = [
  'missile launch pad', 'erector launcher', 'tunnel portal', 'bunker entrance', 'aircraft hangar',
  'paved runway', 'barracks rows', 'fuel storage tanks', 'radar mast', 'perimeter wall',
  'tented camp', 'command post', 'control tower', 'motor pool',
];

type SortKey = 'relevance' | 'date' | 'cloud';
type ViewMode = 'list' | 'grid';

const RANK_STYLE = ['border-status-warn/60 bg-status-warn/10', 'border-text-faint/40 bg-bg-hover', 'border-[#b8834a]/50 bg-[#b8834a]/10'];

export function SearchPage() {
  const navigate = useNavigate();
  const {
    queryText, mode, blend, imageQueryTileId, results, feedback, hoveredTileId, selectedTileId,
    feedbackRounds, drawnAoiBbox, savedQueries, recentQueries,
    setQueryText, setMode, setBlend, setImageQuery, setDrawnAoi, runSearch, markFeedback, resetFeedback,
    setHovered, setSelected, saveCurrentQuery, removeSavedQuery, loadSavedQuery,
  } = useSearchStore();
  const { aoiId, dateFrom, dateTo, sensors, maxCloud } = useFilterStore();
  const appendAudit = useAuditStore((s) => s.append);

  const [drawMode, setDrawMode] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('relevance');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [detail, setDetail] = useState<SearchResult | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [savingLabel, setSavingLabel] = useState<string | null>(null);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const geoInputRef = useRef<HTMLInputElement>(null);
  const queryRef = useRef<HTMLTextAreaElement>(null);

  const aoi = aoiById(aoiId)!;

  useEffect(() => {
    runSearch();
    setFocusedIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aoiId, dateFrom, dateTo, sensors.join(','), maxCloud, queryText, mode, blend, imageQueryTileId]);

  const sorted = useMemo(
    () =>
      [...results].sort((a, b) => {
        if (sortKey === 'date') return b.tile.datetime.localeCompare(a.tile.datetime);
        if (sortKey === 'cloud') return a.tile.cloudFrac - b.tile.cloudFrac;
        return b.score - a.score;
      }),
    [results, sortKey]
  );

  useEffect(() => {
    setFocusedIdx((i) => Math.min(i, Math.max(0, sorted.length - 1)));
  }, [sorted.length]);

  useEffect(() => {
    const t = sorted[focusedIdx];
    if (t) setHovered(t.tile.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedIdx]);

  const imageSeedTile = imageQueryTileId ? results.find((r) => r.tile.id === imageQueryTileId)?.tile : null;

  const handleSimilarTo = (tileId: string) => {
    setImageQuery(tileId);
    setDetail(null);
  };

  const handleAddToQueue = (result: SearchResult) => {
    appendAudit({ actor: 'A. Rao', action: 'search.flag_for_review', targetType: 'tile', targetId: result.tile.id, payload: { score: result.score } });
  };

  const handleGeoJsonUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const bbox = parsed.bbox ?? parsed.features?.[0]?.bbox;
        if (Array.isArray(bbox) && bbox.length === 4) setDrawnAoi(bbox as [number, number, number, number]);
      } catch {
        // ignore malformed upload — prototype-grade parser, real one would validate + report
      }
    };
    reader.readAsText(file);
  };

  const toggleChip = (chip: string) => {
    const has = queryText.toLowerCase().includes(chip.toLowerCase());
    if (has) {
      setQueryText(queryText.replace(new RegExp(chip, 'i'), '').replace(/\s{2,}/g, ' ').trim());
    } else {
      setQueryText(queryText ? `${queryText}, ${chip}` : chip);
    }
  };

  useShortcuts(
    {
      '/': () => queryRef.current?.focus(),
      j: () => setFocusedIdx((i) => Math.min(sorted.length - 1, i + 1)),
      k: () => setFocusedIdx((i) => Math.max(0, i - 1)),
      arrowdown: () => setFocusedIdx((i) => Math.min(sorted.length - 1, i + 1)),
      arrowup: () => setFocusedIdx((i) => Math.max(0, i - 1)),
      enter: () => sorted[focusedIdx] && setDetail(sorted[focusedIdx]),
      g: () => sorted[focusedIdx] && markFeedback(sorted[focusedIdx].tile.id, 'good'),
      b: () => sorted[focusedIdx] && markFeedback(sorted[focusedIdx].tile.id, 'bad'),
    },
    [
      { keys: '/', label: 'focus the query box' },
      { keys: 'j/k', label: 'move through results' },
      { keys: 'enter', label: 'open focused result' },
      { keys: 'g', label: 'thumbs up focused result' },
      { keys: 'b', label: 'thumbs down focused result' },
    ]
  );

  const otherYearsForDetail = useMemo(() => {
    if (!detail) return [];
    return TILES.filter((t) => t.gridCellId === detail.tile.gridCellId && t.id !== detail.tile.id).sort((a, b) =>
      a.datetime.localeCompare(b.datetime)
    );
  }, [detail]);

  return (
    <div className="flex flex-col xl:grid xl:grid-cols-[360px_minmax(0,1fr)_380px] xl:h-full min-h-0">
      {/* Query column */}
      <div className="border-b xl:border-b-0 xl:border-r border-border-subtle flex flex-col min-h-0 xl:overflow-y-auto">
        <div className="p-4 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
              <SearchIcon size={14} className="text-accent-soft" /> Search
            </h2>
            <Tooltip content="How search works">
              <button
                onClick={() => setHelpOpen(true)}
                className="w-6 h-6 flex items-center justify-center rounded-full text-text-muted hover:text-accent-soft hover:bg-bg-hover transition-colors"
              >
                <Info size={14} />
              </button>
            </Tooltip>
          </div>

          <div>
            <div className="relative flex items-center gap-1 mb-2 bg-bg-raised rounded-md p-1">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    'relative flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium z-10 transition-colors',
                    mode === m.id ? 'text-white' : 'text-text-muted hover:text-text-secondary'
                  )}
                >
                  {mode === m.id && (
                    <motion.div layoutId="mode-pill" className="absolute inset-0 bg-accent rounded" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
                  )}
                  <m.icon size={13} className="relative" />
                  <span className="relative">{m.label}</span>
                </button>
              ))}
            </div>

            {(mode === 'text' || mode === 'both') && (
              <>
                <textarea
                  ref={queryRef}
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  rows={3}
                  placeholder='e.g. "missile launch pad" or "underground bunker entrance"'
                  className="w-full bg-bg-raised border border-border rounded-md px-3 py-2 text-xs text-text-primary resize-none focus:outline-none focus:ring-1 focus:ring-accent-soft"
                />
                <div className="mt-2">
                  <div className="text-[10px] text-text-faint mb-1.5 flex items-center gap-1">
                    <Wand2 size={10} /> try a concept — click to add or remove
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {CONCEPT_CHIPS.map((chip) => {
                      const active = queryText.toLowerCase().includes(chip.toLowerCase());
                      return (
                        <button
                          key={chip}
                          onClick={() => toggleChip(chip)}
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] border transition-colors',
                            active ? 'bg-accent/20 border-accent/50 text-accent-soft' : 'border-border text-text-muted hover:text-text-secondary hover:border-border-strong'
                          )}
                        >
                          {chip}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {(mode === 'image' || mode === 'both') && (
              <div className="mt-2">
                {imageSeedTile ? (
                  <div className="flex items-center gap-2 bg-bg-raised border border-border rounded-md p-2">
                    <TileThumb tile={imageSeedTile} size={40} rounded="rounded" />
                    <div className="flex-1 text-[11px] text-text-secondary">
                      Query chip · {imageSeedTile.label ?? imageSeedTile.thumbPattern}
                    </div>
                    <button onClick={() => setImageQuery(null)} className="text-text-muted hover:text-status-bad text-[11px]">
                      clear
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center gap-1.5 py-4 border border-dashed border-border rounded-md text-text-muted hover:text-text-secondary hover:border-border-strong text-xs"
                  >
                    <Upload size={16} />
                    Drop an image chip, or pick "similar to this" on a result
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={() => {
                  if (results[0]) setImageQuery(results[0].tile.id);
                }} />
              </div>
            )}

            {mode === 'both' && (
              <Slider value={blend} onChange={setBlend} leftLabel="text" rightLabel="image" className="mt-3" />
            )}
          </div>

          <div>
            <div className="text-[11px] font-medium text-text-muted mb-1.5 flex items-center gap-1">
              <MapPin size={11} /> Area of interest
            </div>
            <div className="flex gap-1.5 mb-1.5">
              <Tooltip content="Click-drag on the map to draw a custom search box">
                <Button size="xs" variant={drawMode ? 'primary' : 'outline'} onClick={() => setDrawMode((d) => !d)}>
                  {drawMode ? 'drawing…' : 'draw AOI'}
                </Button>
              </Tooltip>
              <Tooltip content='Upload a JSON file shaped like {"bbox":[minLng,minLat,maxLng,maxLat]}'>
                <Button size="xs" variant="outline" onClick={() => geoInputRef.current?.click()}>
                  upload GeoJSON
                </Button>
              </Tooltip>
              {drawnAoiBbox && (
                <Button size="xs" variant="ghost" onClick={() => setDrawnAoi(null)}>
                  clear
                </Button>
              )}
            </div>
            <input
              ref={geoInputRef}
              type="file"
              accept=".json,.geojson"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleGeoJsonUpload(e.target.files[0])}
            />
            <div className="flex flex-wrap gap-1">
              {AOIS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => useFilterStore.getState().setAoi(a.id)}
                  className={cn(
                    'px-2 py-1 rounded text-[11px] border',
                    a.id === aoiId ? 'border-accent/50 bg-accent/10 text-accent-soft' : 'border-border text-text-muted hover:text-text-secondary'
                  )}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11px] font-medium text-text-muted flex items-center gap-1">
                <Bookmark size={11} /> Saved queries
              </div>
              <Tooltip content="Save the current query">
                <button
                  onClick={() => setSavingLabel(savingLabel === null ? '' : null)}
                  className="text-text-muted hover:text-accent-soft"
                >
                  <BookmarkPlus size={13} />
                </button>
              </Tooltip>
            </div>
            <AnimatePresence>
              {savingLabel !== null && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-1.5"
                >
                  <div className="flex gap-1">
                    <input
                      autoFocus
                      value={savingLabel}
                      onChange={(e) => setSavingLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          saveCurrentQuery(savingLabel);
                          setSavingLabel(null);
                        }
                        if (e.key === 'Escape') setSavingLabel(null);
                      }}
                      placeholder="name this search…"
                      className="flex-1 bg-bg-raised border border-border rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-accent-soft"
                    />
                    <Button size="xs" variant="primary" onClick={() => { saveCurrentQuery(savingLabel); setSavingLabel(null); }}>
                      <Check size={12} />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {savedQueries.map((sq) => (
                <div key={sq.id} className="group flex items-center gap-1">
                  <button
                    onClick={() => loadSavedQuery(sq)}
                    className="flex-1 text-left px-2 py-1.5 rounded text-[11px] text-text-secondary hover:bg-bg-hover hover:text-text-primary border border-transparent hover:border-border-subtle truncate"
                  >
                    {sq.label}
                  </button>
                  <button
                    onClick={() => removeSavedQuery(sq.id)}
                    className="opacity-0 group-hover:opacity-100 text-text-faint hover:text-status-bad p-1"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {recentQueries.length > 0 && (
            <div>
              <div className="text-[11px] font-medium text-text-muted mb-1.5 flex items-center gap-1">
                <History size={11} /> Recent
              </div>
              <div className="flex flex-wrap gap-1">
                {recentQueries.map((q) => (
                  <button
                    key={q}
                    onClick={() => setQueryText(q)}
                    className="px-2 py-0.5 rounded-full text-[10px] border border-border-subtle text-text-faint hover:text-text-secondary hover:border-border truncate max-w-[150px]"
                    title={q}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence>
            {feedbackRounds > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between bg-accent/10 border border-accent/30 rounded-md px-2.5 py-2 text-[11px] text-accent-soft"
              >
                <span className="flex items-center gap-1">
                  <Sparkles size={12} /> reranked after <AnimatedNumber value={feedbackRounds} /> round{feedbackRounds > 1 ? 's' : ''}
                </span>
                <button onClick={resetFeedback} className="flex items-center gap-1 text-text-muted hover:text-text-primary">
                  <RotateCcw size={11} /> reset
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setHelpOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 text-[10px] text-text-faint hover:text-text-muted border-t border-border-subtle pt-3"
          >
            <Keyboard size={11} /> press <kbd className="mono px-1 rounded bg-bg-raised border border-border">?</kbd> for keyboard shortcuts
          </button>
        </div>
      </div>

      {/* Map column */}
      <div className="p-3 min-h-0 flex flex-col h-[420px] sm:h-[520px] xl:h-auto">
        <MockMap
          bbox={aoi.bbox}
          imageUrl={latestSceneFor(aoiId)?.imageUrl}
          className="flex-1"
          height="100%"
          label={aoi.name}
          drawMode={drawMode}
          drawnBbox={drawnAoiBbox}
          onDrawComplete={(bbox) => {
            setDrawnAoi(bbox);
            setDrawMode(false);
          }}
          tiles={sorted.map((r) => ({
            id: r.tile.id,
            bbox: r.tile.footprint.bbox,
            color: 'var(--color-accent-soft)',
            opacity: 0.12 + r.score * 0.4,
          }))}
          hoveredId={hoveredTileId}
          selectedId={selectedTileId}
          onHoverId={setHovered}
          onSelectId={(id) => {
            setSelected(id);
            const r = results.find((x) => x.tile.id === id);
            if (r) setDetail(r);
          }}
        />
        <p className="text-[11px] text-text-faint mt-2 px-1">
          Real imagery of the sector, current as of the latest scene. Footprints highlighted by relevance score. Scroll to zoom, drag to pan{drawMode ? ', click-drag to draw the AOI box.' : '.'}
        </p>
      </div>

      {/* Results column */}
      <div className="border-t xl:border-t-0 xl:border-l border-border-subtle flex flex-col min-h-0 max-h-[680px] xl:max-h-none">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-subtle shrink-0">
          <span className="text-xs text-text-muted">
            <AnimatedNumber value={sorted.length} /> results
          </span>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-bg-raised rounded-md p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={cn('p-1 rounded', viewMode === 'list' ? 'bg-accent/20 text-accent-soft' : 'text-text-faint hover:text-text-secondary')}
              >
                <Rows3 size={12} />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={cn('p-1 rounded', viewMode === 'grid' ? 'bg-accent/20 text-accent-soft' : 'text-text-faint hover:text-text-secondary')}
              >
                <LayoutGrid size={12} />
              </button>
            </div>
            <button
              onClick={() => setSortKey((k) => (k === 'relevance' ? 'date' : k === 'date' ? 'cloud' : 'relevance'))}
              className="flex items-center gap-1 text-[11px] text-text-secondary hover:text-text-primary"
            >
              <ArrowUpDown size={11} /> sort: {sortKey}
            </button>
          </div>
        </div>
        <div className={cn('flex-1 overflow-y-auto p-2', viewMode === 'grid' ? 'grid grid-cols-2 gap-2 content-start' : 'space-y-1.5')}>
          {sorted.length === 0 && <EmptyState title="No tiles match" description="Loosen the cloud filter or widen the date range." />}
          <LayoutGroup>
            <AnimatePresence initial={false}>
              {sorted.map((r, i) =>
                viewMode === 'grid' ? (
                  <GridCard
                    key={r.tile.id}
                    result={r}
                    rank={i}
                    focused={i === focusedIdx}
                    active={hoveredTileId === r.tile.id || selectedTileId === r.tile.id}
                    feedback={feedback[r.tile.id]}
                    onHover={() => setHovered(r.tile.id)}
                    onLeave={() => setHovered(null)}
                    onOpen={() => { setSelected(r.tile.id); setDetail(r); setFocusedIdx(i); }}
                    onGood={() => markFeedback(r.tile.id, 'good')}
                    onBad={() => markFeedback(r.tile.id, 'bad')}
                  />
                ) : (
                  <ListRow
                    key={r.tile.id}
                    result={r}
                    rank={i}
                    focused={i === focusedIdx}
                    active={hoveredTileId === r.tile.id || selectedTileId === r.tile.id}
                    feedback={feedback[r.tile.id]}
                    onHover={() => setHovered(r.tile.id)}
                    onLeave={() => setHovered(null)}
                    onOpen={() => { setSelected(r.tile.id); setDetail(r); setFocusedIdx(i); }}
                    onGood={() => markFeedback(r.tile.id, 'good')}
                    onBad={() => markFeedback(r.tile.id, 'bad')}
                  />
                )
              )}
            </AnimatePresence>
          </LayoutGroup>
        </div>
      </div>

      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.tile.label ?? 'Tile'}` : ''}
        subtitle={detail ? `${detail.tile.sensor} · ${formatDate(detail.tile.datetime)}` : ''}
      >
        {detail && (
          <div className="p-4 space-y-4">
            <ImageMagnifier imageUrl={detail.tile.imageUrl} cropFrac={tileCropFraction(detail.tile)} label={detail.tile.label} zoom={7} className="block">
              <TileThumb tile={detail.tile} saliency={detail.saliency} size="100%" className="h-56 w-full" rounded="rounded-lg" />
            </ImageMagnifier>

            <div>
              <div className="text-[11px] font-medium text-text-muted mb-1.5 flex items-center gap-1">
                <Crosshair size={11} /> Why this matched
              </div>
              <div className="flex flex-wrap gap-1.5">
                {detail.tile.conceptTerms.map((t) => (
                  <Badge key={t} color="var(--color-accent-soft)">{t}</Badge>
                ))}
              </div>
              <p className="text-[11px] text-text-muted mt-1.5">
                Saliency overlay (hover the image above) highlights the regions driving the match. Zoom in with the lens to inspect real pixel detail.
              </p>
            </div>

            <div>
              <div className="text-[11px] font-medium text-text-muted mb-1.5">Match breakdown</div>
              <div className="space-y-1.5">
                {detail.textScore !== undefined && <ScoreBar label="Text relevance" value={detail.textScore} />}
                {detail.imageScore !== undefined && <ScoreBar label="Image similarity" value={detail.imageScore} />}
                {detail.rocchioScore !== undefined && <ScoreBar label="Feedback pull (Rocchio)" value={detail.rocchioScore} color="var(--color-status-warn)" />}
                <ScoreBar label="Final score" value={detail.score} color="var(--color-accent)" bold />
              </div>
            </div>

            {otherYearsForDetail.length > 0 && (
              <div>
                <div className="text-[11px] font-medium text-text-muted mb-1.5">This location across time</div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {otherYearsForDetail.map((t) => (
                    <Tooltip key={t.id} content={formatDate(t.datetime)}>
                      <button onClick={() => navigate('/timeline')} className="shrink-0">
                        <TileThumb tile={t} size={40} rounded="rounded" />
                        <div className="text-[9px] mono text-text-faint mt-0.5 text-center">{formatDateShort(t.datetime)}</div>
                      </button>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              <Meta label="Score" value={detail.score.toFixed(2)} />
              <Meta label="Sensor" value={detail.tile.sensor} />
              <Meta label="GSD" value={`${detail.tile.gsdM} m`} />
              <Meta label="Cloud fraction" value={`${Math.round(detail.tile.cloudFrac * 100)}%`} />
              <Meta label="Valid fraction" value={`${Math.round(detail.tile.validFrac * 100)}%`} />
              <Meta label="Grid cell" value={detail.tile.gridCellId} mono />
              <Meta label="Parent scene" value={sceneById(detail.tile.sceneId)?.id ?? '—'} mono />
              <Meta label="Checksum" value={sceneById(detail.tile.sceneId)?.checksum ?? '—'} mono />
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-border-subtle">
              <Button size="sm" variant="secondary" onClick={() => handleSimilarTo(detail.tile.id)}>Similar tiles</Button>
              <Button size="sm" variant="secondary" onClick={() => navigate('/timeline')}>Change history here</Button>
              <Button size="sm" variant="outline" onClick={() => handleAddToQueue(detail)}>Add to queue</Button>
            </div>
          </div>
        )}
      </Drawer>

      <Drawer open={helpOpen} onClose={() => setHelpOpen(false)} title="How search works" subtitle="Everything this screen is doing, in plain language" width="w-[520px]">
        <HelpContent />
      </Drawer>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-text-faint">{label}</div>
      <div className={mono ? 'mono text-text-secondary truncate' : 'text-text-secondary'}>{value}</div>
    </div>
  );
}

function ScoreBar({ label, value, color = 'var(--color-accent-soft)', bold }: { label: string; value: number; color?: string; bold?: boolean }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className={bold ? 'text-text-primary font-medium' : 'text-text-secondary'}>{label}</span>
        <span className="mono text-text-muted">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-1.5 bg-bg-raised rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(2, value * 100)}%` }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

interface CardProps {
  result: SearchResult;
  rank: number;
  focused: boolean;
  active: boolean;
  feedback?: 'good' | 'bad';
  onHover: () => void;
  onLeave: () => void;
  onOpen: () => void;
  onGood: () => void;
  onBad: () => void;
}

function ListRow({ result: r, rank, focused, active, feedback, onHover, onLeave, onOpen, onGood, onBad }: CardProps) {
  return (
    <motion.div
      layout
      layoutId={r.tile.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onOpen}
      className={cn(
        'flex gap-2.5 p-2 rounded-md border cursor-pointer transition-colors',
        focused && 'ring-1 ring-accent-soft',
        active ? 'border-accent-soft bg-bg-hover' : 'border-transparent hover:bg-bg-hover'
      )}
    >
      <div className="relative shrink-0">
        <ImageMagnifier imageUrl={r.tile.imageUrl} cropFrac={tileCropFraction(r.tile)} label={r.tile.label} zoom={9}>
          <TileThumb tile={r.tile} saliency={r.saliency} size={56} />
        </ImageMagnifier>
        {rank < 3 && (
          <div className={cn('absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full border text-[8px] mono font-bold flex items-center justify-center', RANK_STYLE[rank])}>
            {rank + 1}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="mono text-[11px] text-accent-soft font-medium">{r.score.toFixed(2)}</span>
          <div className="flex gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); onGood(); }}
              className={cn('p-1 rounded', feedback === 'good' ? 'text-status-good bg-status-good/10' : 'text-text-faint hover:text-status-good')}
            >
              <ThumbsUp size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onBad(); }}
              className={cn('p-1 rounded', feedback === 'bad' ? 'text-status-bad bg-status-bad/10' : 'text-text-faint hover:text-status-bad')}
            >
              <ThumbsDown size={12} />
            </button>
          </div>
        </div>
        <div className="h-1 bg-bg-raised rounded-full overflow-hidden mt-1">
          <motion.div className="h-full bg-accent-soft rounded-full" animate={{ width: `${r.score * 100}%` }} transition={{ duration: 0.4 }} />
        </div>
        <div className="text-[11px] text-text-secondary mt-1 truncate">{r.tile.label ?? formatDate(r.tile.datetime)}</div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <Badge variant="dot">{r.tile.sensor}</Badge>
          <span className="text-[10px] text-text-faint">{formatDateShort(r.tile.datetime)}</span>
          <span className="text-[10px] text-text-faint">{Math.round(r.tile.cloudFrac * 100)}% cloud</span>
        </div>
      </div>
    </motion.div>
  );
}

function GridCard({ result: r, rank, focused, active, feedback, onHover, onLeave, onOpen, onGood, onBad }: CardProps) {
  return (
    <motion.div
      layout
      layoutId={r.tile.id}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onOpen}
      className={cn(
        'relative rounded-md border cursor-pointer overflow-hidden group',
        focused && 'ring-1 ring-accent-soft',
        active ? 'border-accent-soft' : 'border-border-subtle hover:border-border-strong'
      )}
    >
      <ImageMagnifier imageUrl={r.tile.imageUrl} cropFrac={tileCropFraction(r.tile)} label={r.tile.label} zoom={9} className="block">
        <TileThumb tile={r.tile} saliency={r.saliency} size="100%" className="h-28 w-full" rounded="rounded-none" />
      </ImageMagnifier>
      {rank < 3 && (
        <div className={cn('absolute top-1 left-1 w-4 h-4 rounded-full border text-[8px] mono font-bold flex items-center justify-center', RANK_STYLE[rank])}>
          {rank + 1}
        </div>
      )}
      <div className="absolute top-1 right-1 mono text-[10px] font-medium px-1 rounded bg-black/60 text-accent-soft">{r.score.toFixed(2)}</div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[9px] text-white/80 mono">{formatDateShort(r.tile.datetime)}</span>
        <div className="flex gap-0.5">
          <button onClick={(e) => { e.stopPropagation(); onGood(); }} className={cn('p-0.5 rounded', feedback === 'good' ? 'text-status-good' : 'text-white/70 hover:text-status-good')}>
            <ThumbsUp size={11} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onBad(); }} className={cn('p-0.5 rounded', feedback === 'bad' ? 'text-status-bad' : 'text-white/70 hover:text-status-bad')}>
            <ThumbsDown size={11} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function HelpContent() {
  return (
    <div className="p-4 space-y-4 text-[12px] text-text-secondary leading-relaxed">
      <Section title="Query modes">
        Switch between <b className="text-text-primary">Text</b> (matched against each tile's detected concepts),{' '}
        <b className="text-text-primary">Image</b> (find tiles visually similar to a chip you pick or upload), and{' '}
        <b className="text-text-primary">Both</b>, which blends the two with the slider.
      </Section>
      <Section title="Concept chips">
        Click any suggested concept to add it to your query, or click it again to remove it — a quick way to discover
        what the archive actually knows how to find.
      </Section>
      <Section title="Relevance feedback">
        Thumbs up/down any result. Behind the scenes this nudges a query vector toward what you liked and away from
        what you didn't (a Rocchio update), then reruns the search instantly — watch the ranking reshuffle.
      </Section>
      <Section title="Why this matched">
        Open any result to see its matched concepts, a saliency-style highlight over the image, and a full score
        breakdown (text match, image similarity, feedback pull) so the ranking is never a black box.
      </Section>
      <Section title="The magnifier">
        Hover any thumbnail to pop a zoomed lens showing real pixel detail from the source photo — not a stock icon,
        the actual satellite frame.
      </Section>
      <Section title="Area of interest">
        Draw a box directly on the map, upload a GeoJSON bounding box, or jump to a named sector.
      </Section>
      <Section title="Saved & recent">
        Save the current query for one-click reuse later, or pull up anything you searched recently.
      </Section>
      <Section title="Keyboard shortcuts">
        <div className="flex flex-col gap-1 mt-1">
          {[
            ['/', 'focus the query box'],
            ['j / k', 'move through results'],
            ['enter', 'open the focused result'],
            ['g', 'thumbs up the focused result'],
            ['b', 'thumbs down the focused result'],
            ['?', 'show this app’s shortcut legend'],
          ].map(([k, d]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-text-muted">{d}</span>
              <kbd className="mono text-[11px] px-1.5 py-0.5 rounded bg-bg-raised border border-border text-text-primary">{k}</kbd>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-text-primary mb-1">{title}</div>
      <div>{children}</div>
    </div>
  );
}
