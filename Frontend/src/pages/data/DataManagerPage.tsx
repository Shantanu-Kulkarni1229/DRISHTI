import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  UploadCloud, FolderInput, CheckCircle2, Loader2, Circle, XCircle, Search, Database, Info,
  RotateCcw, Trash2, Ban, Sparkles, Download, Copy, CopyCheck, TriangleAlert, ChevronRight,
} from 'lucide-react';
import { useIngestStore } from '../../state/ingestStore';
import { useFilterStore } from '../../state/filterStore';
import { SCENES, MODELS, aoiById } from '../../lib/mockData';
import { formatBytes, formatNumber, formatMs, formatDate, copyText, downloadTextFile, cn } from '../../lib/utils';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Drawer } from '../../components/ui/Drawer';
import { Tooltip } from '../../components/ui/Tooltip';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import { MockMap } from '../../components/map/MockMap';
import { StageStepper } from './StageStepper';
import type { IngestJob } from '../../lib/types';

const STATUS_META: Record<IngestJob['status'], { label: string; color: string }> = {
  queued: { label: 'Queued', color: 'var(--color-text-faint)' },
  masking: { label: 'Masking', color: 'var(--color-accent-soft)' },
  normalising: { label: 'Normalising', color: 'var(--color-accent-soft)' },
  aligning: { label: 'Aligning', color: 'var(--color-accent-soft)' },
  tiling: { label: 'Tiling', color: 'var(--color-accent-soft)' },
  embedding: { label: 'Embedding', color: 'var(--color-accent-soft)' },
  indexing: { label: 'Indexing', color: 'var(--color-accent-soft)' },
  done: { label: 'Done', color: 'var(--color-status-good)' },
  failed: { label: 'Failed', color: 'var(--color-status-bad)' },
};
const RUNNING: IngestJob['status'][] = ['queued', 'masking', 'normalising', 'aligning', 'tiling', 'embedding', 'indexing'];

function StatTile({ icon, label, value, sub, hint, delay = 0 }: { icon?: React.ReactNode; label: string; value: string | number; sub?: string; hint?: string; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.3 }}>
      <Card className="p-3 h-full">
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-text-muted mb-1">
          {icon}<span className="truncate">{label}</span>
          {hint && <Tooltip content={hint}><Info size={10} className="text-text-faint shrink-0" /></Tooltip>}
        </div>
        {typeof value === 'number' ? (
          <AnimatedNumber value={value} className="mono text-lg font-semibold text-text-primary leading-tight" />
        ) : (
          <div className="mono text-lg font-semibold text-text-primary leading-tight">{value}</div>
        )}
        {sub && <div className="text-[10px] text-text-faint mt-0.5">{sub}</div>}
      </Card>
    </motion.div>
  );
}

function cloudColor(cloudPct: number): string {
  if (cloudPct > 60) return 'var(--color-status-bad)';
  if (cloudPct > 25) return 'var(--color-status-warn)';
  return 'var(--color-status-good)';
}

function JobRow({ job, onCancel, onRetry, onRemove }: { job: IngestJob; onCancel: () => void; onRetry: () => void; onRemove: () => void }) {
  const meta = STATUS_META[job.status];
  const running = RUNNING.includes(job.status);
  const StatusIcon = job.status === 'done' ? CheckCircle2 : job.status === 'failed' ? XCircle : job.status === 'queued' ? Circle : Loader2;
  return (
    <motion.div layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 32 }} className="border-b border-border-subtle/60 last:border-0 px-3 sm:px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1 basis-full sm:basis-auto">
          <div className="mono text-[11px] text-text-secondary truncate">{job.filename}</div>
          {job.retryOf && <div className="text-[9px] text-text-faint">retry of <span className="mono">{job.retryOf}</span></div>}
        </div>
        <Badge color={meta.color} variant="dot">
          <span className="inline-flex items-center gap-1">
            <StatusIcon size={10} className={running ? 'animate-spin' : undefined} />
            {meta.label}
          </span>
        </Badge>
        <div className="w-20 shrink-0"><ProgressBar value={job.progress} thin color={meta.color} /></div>
        <div className="mono text-[10px] text-text-secondary w-14 text-right shrink-0">{job.status === 'done' ? `${job.tilesProduced} tiles` : job.status === 'failed' ? '—' : `${job.progress}%`}</div>
        <div className="mono text-[10px] text-text-faint shrink-0 hidden md:block">{job.embedMs !== null ? formatMs(job.embedMs) : '—'}</div>
        <div className="mono text-[10px] text-text-faint shrink-0 hidden md:block">{job.indexInsertMs !== null ? formatMs(job.indexInsertMs) : '—'}</div>
        <div className="mono text-[10px] text-text-faint shrink-0 w-24 text-right hidden lg:block">{formatDate(job.startedAt)}</div>
        <div className="flex items-center gap-1 shrink-0">
          {running && <Tooltip content="Cancel this job"><button onClick={onCancel} className="p-1 rounded text-text-faint hover:text-status-bad hover:bg-status-bad/10"><Ban size={13} /></button></Tooltip>}
          {job.status === 'failed' && <Tooltip content="Retry with the same file"><button onClick={onRetry} className="p-1 rounded text-text-faint hover:text-accent-soft hover:bg-accent/10"><RotateCcw size={13} /></button></Tooltip>}
          {(job.status === 'done' || job.status === 'failed') && <Tooltip content="Dismiss from this list"><button onClick={onRemove} className="p-1 rounded text-text-faint hover:text-text-primary hover:bg-bg-hover"><Trash2 size={13} /></button></Tooltip>}
        </div>
      </div>
      {running && (
        <div className="mt-2.5 pl-0 sm:pl-1">
          <StageStepper job={job} />
        </div>
      )}
      {job.status === 'failed' && job.error && (
        <div className="mt-2 flex items-start gap-1.5 text-[11px] text-status-bad bg-status-bad/10 border border-status-bad/30 rounded-md px-2 py-1.5">
          <TriangleAlert size={12} className="mt-0.5 shrink-0" /> {job.error}
        </div>
      )}
    </motion.div>
  );
}

export function DataManagerPage() {
  const { jobs, indexStats, startIngest, cancelJob, retryJob, removeJob } = useIngestStore();
  const { aoiId } = useFilterStore();
  const aoi = aoiById(aoiId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [hoveredSceneId, setHoveredSceneId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [sceneQuery, setSceneQuery] = useState('');
  const [modelQuery, setModelQuery] = useState('');
  const [copiedSha, setCopiedSha] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const scenes = useMemo(
    () => SCENES.filter((s) => s.aoiId === aoiId).sort((a, b) => b.datetime.localeCompare(a.datetime)),
    [aoiId, indexStats.sceneCount]
  );
  const filteredScenes = useMemo(() => {
    const q = sceneQuery.trim().toLowerCase();
    if (!q) return scenes;
    return scenes.filter((s) => `${s.datetime} ${s.sensor} ${s.productLevel} ${s.checksum}`.toLowerCase().includes(q));
  }, [scenes, sceneQuery]);
  const filteredModels = useMemo(() => {
    const q = modelQuery.trim().toLowerCase();
    if (!q) return MODELS;
    return MODELS.filter((m) => `${m.name} ${m.task} ${m.licence}`.toLowerCase().includes(q));
  }, [modelQuery]);

  const activeJobs = jobs.filter((j) => RUNNING.includes(j.status));
  const failedJobs = jobs.filter((j) => j.status === 'failed');
  const latestLiveDone = useMemo(() => jobs.find((j) => j.id.startsWith('ingest-live-') && j.status === 'done'), [jobs]);
  const avgEmbedMs = useMemo(() => {
    const done = jobs.filter((j) => j.embedMs !== null);
    return done.length ? Math.round(done.reduce((s, j) => s + (j.embedMs ?? 0), 0) / done.length) : 0;
  }, [jobs]);

  function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    Array.from(files).forEach((f) => startIngest(f.name, aoiId));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }
  function simulateWatchedFolderDrop() {
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    startIngest(`watched-folder/${aoi?.id ?? 'aoi'}_${stamp}.tif`, aoiId);
  }
  function downloadManifest() {
    const header = 'date,sensor,product_level,cloud_pct,size_mb,checksum,licence';
    const rows = filteredScenes.map((s) => [s.datetime, s.sensor, s.productLevel, s.cloudPct, s.sizeMb, s.checksum, `"${s.licence}"`].join(','));
    downloadTextFile(`scene-manifest-${aoiId}.csv`, [header, ...rows].join('\n'), 'text/csv');
  }
  function copySha(sha: string) {
    copyText(sha).then(() => {
      setCopiedSha(sha);
      window.setTimeout(() => setCopiedSha((s) => (s === sha ? null : s)), 1600);
    });
  }

  const activeScene = scenes.find((s) => s.id === (hoveredSceneId ?? selectedSceneId)) ?? scenes[0];
  const activePolygons = activeScene
    ? [{ id: activeScene.id, bbox: activeScene.footprint.bbox, color: cloudColor(activeScene.cloudPct), fillOpacity: 0, dashed: activeScene.cloudPct > 25 }]
    : [];

  return (
    <div className="p-3 sm:p-4 lg:p-5 max-w-[1900px] mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <h1 className="text-base font-semibold text-text-primary flex items-center gap-2"><Database size={17} className="text-accent-soft" /> Data manager</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Ingestion pipeline, scene inventory, index health and model provenance for <span className="text-text-secondary">{aoi?.name ?? 'this AOI'}</span>.
          </p>
        </div>
        <button onClick={() => setHelpOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-text-secondary hover:text-accent-soft hover:border-accent/50 transition-colors"><Info size={13} /> How it works</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <StatTile icon={<Database size={11} />} label="scenes indexed" value={indexStats.sceneCount} delay={0.02} />
        <StatTile icon={<Loader2 size={11} />} label="jobs running" value={activeJobs.length} sub={activeJobs.length ? activeJobs[0].filename : undefined} delay={0.06} />
        <StatTile icon={<TriangleAlert size={11} />} label="need attention" value={failedJobs.length} sub={failedJobs.length ? 'failed — retry below' : 'nothing failing'} delay={0.1} />
        <StatTile icon={<Sparkles size={11} />} label="mean embed time" value={formatMs(avgEmbedMs)} delay={0.14} />
      </div>

      {/* Ingestion */}
      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="p-4 flex flex-col gap-3">
          <div className="text-[11px] font-medium text-text-muted">Watched folder / drop zone</div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            className={cn('flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-8 px-3 text-center transition-colors', dragOver ? 'border-accent bg-accent-soft/10' : 'border-border-subtle bg-bg-raised')}
          >
            <motion.div animate={dragOver ? { y: [0, -4, 0] } : {}} transition={{ repeat: dragOver ? Infinity : 0, duration: 0.6 }}>
              <UploadCloud size={22} className={dragOver ? 'text-accent' : 'text-text-faint'} />
            </motion.div>
            <p className="text-[11px] text-text-secondary">Drop scene files here</p>
            <p className="text-[10px] text-text-faint">or</p>
            <Button size="xs" variant="secondary" onClick={() => fileInputRef.current?.click()}>Browse files</Button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          </div>
          <Button size="sm" variant="outline" icon={<FolderInput size={13} />} onClick={simulateWatchedFolderDrop}>Simulate watched-folder drop</Button>
          <p className="text-[10px] text-text-faint leading-relaxed">
            Ingests into <span className="text-text-secondary">{aoi?.name ?? aoiId}</span> — switch AOI in the top bar to target a different site. Fully offline: files are never uploaded anywhere, only the filename is used to enqueue a job against the in-memory pipeline. About 1 in 6 jobs is deliberately made to fail, so Retry has something real to do.
          </p>
        </Card>

        <Card className="flex flex-col min-h-0">
          <CardHeader title="Ingest jobs" subtitle="Per-scene pipeline status — masking → normalising → aligning → tiling → embedding → indexing" />
          <AnimatePresence>
            {latestLiveDone && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mx-3 sm:mx-4 mt-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-status-good/40 bg-status-good/10 px-3 py-2">
                  <span className="text-[11px] text-text-secondary">
                    <span className="mono text-status-good font-medium">{latestLiveDone.tilesProduced} new tiles</span> indexed from <span className="mono">{latestLiveDone.filename}</span> — no rebuild required.
                  </span>
                  <Link to="/search"><Button size="xs" variant="primary" icon={<Search size={12} />}>Search them now</Button></Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="hidden md:flex items-center gap-3 px-4 pt-3 text-[10px] text-text-faint uppercase tracking-wide">
            <div className="flex-1">Filename</div><div className="w-14">Status</div><div className="w-20">Progress</div><div className="w-14 text-right">Result</div>
            <div className="w-12 hidden md:block">Embed</div><div className="w-12 hidden md:block">Index</div><div className="w-24 text-right hidden lg:block">Started</div><div className="w-16" />
          </div>
          <div className="flex-1 overflow-y-auto max-h-[420px] mt-1">
            <AnimatePresence initial={false}>
              {jobs.map((j) => (
                <JobRow key={j.id} job={j} onCancel={() => cancelJob(j.id)} onRetry={() => retryJob(j.id)} onRemove={() => removeJob(j.id)} />
              ))}
            </AnimatePresence>
          </div>
        </Card>
      </div>

      {/* Scene inventory */}
      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="flex flex-col min-h-0">
          <CardHeader
            title="Scene inventory"
            subtitle={`${filteredScenes.length} of ${scenes.length} scenes for ${aoi?.name ?? aoiId}`}
            right={
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-faint" />
                  <input value={sceneQuery} onChange={(e) => setSceneQuery(e.target.value)} placeholder="filter…" className="bg-bg-raised border border-border rounded-md pl-6 pr-2 py-1 text-[11px] w-28 sm:w-36 focus:outline-none focus:ring-1 focus:ring-accent-soft" />
                </div>
                <Tooltip content="Download this list as CSV"><button onClick={downloadManifest} className="p-1.5 rounded-md border border-border text-text-muted hover:text-accent-soft hover:border-accent/50"><Download size={12} /></button></Tooltip>
              </div>
            }
          />
          <div className="overflow-auto max-h-[420px]">
            <table className="w-full min-w-[640px] text-[11px]">
              <thead className="sticky top-0 bg-bg-panel">
                <tr className="text-left text-text-muted border-b border-border-subtle">
                  <th className="px-4 py-2 font-normal">Date</th>
                  <th className="px-2 py-2 font-normal">Sensor</th>
                  <th className="px-2 py-2 font-normal">Product</th>
                  <th className="px-2 py-2 font-normal text-right">Cloud %</th>
                  <th className="px-2 py-2 font-normal text-right">Size</th>
                  <th className="px-2 py-2 font-normal">Checksum</th>
                  <th className="px-2 py-2 font-normal">Licence</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {filteredScenes.map((s) => {
                    const isNew = s.id.startsWith('scene-live-');
                    return (
                      <motion.tr
                        key={s.id} layout initial={isNew ? { opacity: 0, backgroundColor: 'rgba(52,211,153,0.18)' } : false} animate={{ opacity: 1, backgroundColor: 'rgba(52,211,153,0)' }} transition={{ duration: 1.2 }}
                        onMouseEnter={() => setHoveredSceneId(s.id)} onMouseLeave={() => setHoveredSceneId(null)}
                        onClick={() => setSelectedSceneId(s.id === selectedSceneId ? null : s.id)}
                        className={cn('border-b border-border-subtle/60 last:border-0 cursor-pointer', selectedSceneId === s.id ? 'bg-bg-hover' : 'hover:bg-bg-hover/60')}
                      >
                        <td className="px-4 py-1.5 mono text-text-secondary whitespace-nowrap">
                          {s.datetime}{isNew && <Badge color="var(--color-status-good)" variant="solid" className="ml-1.5 align-middle">new</Badge>}
                        </td>
                        <td className="px-2 py-1.5">{s.sensor}</td>
                        <td className="px-2 py-1.5 text-text-muted">{s.productLevel}</td>
                        <td className="px-2 py-1.5 text-right mono" style={{ color: cloudColor(s.cloudPct) }}>{s.cloudPct}%</td>
                        <td className="px-2 py-1.5 text-right mono text-text-secondary">{formatBytes(s.sizeMb * 1024 * 1024)}</td>
                        <td className="px-2 py-1.5 mono text-text-faint">{s.checksum}</td>
                        <td className="px-2 py-1.5 text-text-muted">{s.licence}</td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Scene preview" subtitle="Hover or select a scene row to load its real photo" right={<Link to="/timeline" className="text-[11px] text-accent-soft hover:underline flex items-center gap-0.5">timeline <ChevronRight size={11} /></Link>} />
          <div className="p-2">
            {aoi && (
              <MockMap bbox={aoi.bbox} imageUrl={activeScene?.imageUrl} polygons={activePolygons} height={360} label={activeScene ? `${aoi.name} · ${activeScene.datetime}` : aoi.name} />
            )}
          </div>
        </Card>
      </div>

      {/* Index statistics */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Database size={13} className="text-text-muted" />
          <h2 className="text-[11px] font-medium text-text-muted uppercase tracking-wide">Index statistics — live from the running system</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
          <StatTile label="Vector count" value={indexStats.vectorCount} hint="One vector per tile per embedding column, currently indexed." />
          <StatTile label="Index size on disk" value={formatBytes(indexStats.indexSizeBytes)} hint="Two float32 embedding columns per tile (RemoteCLIP + DINOv2)." />
          <StatTile label="Last full build" value={formatMs(indexStats.lastBuildMs)} hint="Time to build the HNSW index from scratch." />
          <StatTile label="Last incremental insert" value={formatMs(indexStats.lastIncrementalInsertMs)} hint="Time to upsert the most recent scene — no rebuild." />
          <StatTile label="Indexed area" value={`${formatNumber(indexStats.indexedAreaKm2)} km²`} hint="Total ground area covered by the archive." />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2 mt-2">
          <StatTile label="Scene count" value={indexStats.sceneCount} />
          <StatTile label="Tile count" value={indexStats.tileCount} />
          <Card className="p-3 col-span-2 sm:col-span-1 xl:col-span-2">
            <div className="text-[10px] uppercase tracking-wide text-text-muted mb-1.5">Query latency</div>
            <div className="flex items-center gap-2 text-[10px] text-text-faint mb-1"><span>p50</span><span className="mono text-text-secondary ml-auto">{formatMs(indexStats.meanQueryLatencyMs)}</span></div>
            <ProgressBar value={(indexStats.meanQueryLatencyMs / indexStats.p95QueryLatencyMs) * 100} thin />
            <div className="flex items-center gap-2 text-[10px] text-text-faint mt-2 mb-1"><span>p95</span><span className="mono text-text-secondary ml-auto">{formatMs(indexStats.p95QueryLatencyMs)}</span></div>
            <ProgressBar value={100} thin color="var(--color-status-warn)" />
          </Card>
        </div>
      </div>

      {/* Model registry */}
      <Card>
        <CardHeader
          title="Model registry" subtitle="Provenance for every model in the pipeline"
          right={<div className="relative"><Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-faint" /><input value={modelQuery} onChange={(e) => setModelQuery(e.target.value)} placeholder="filter…" className="bg-bg-raised border border-border rounded-md pl-6 pr-2 py-1 text-[11px] w-32 focus:outline-none focus:ring-1 focus:ring-accent-soft" /></div>}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[11px]">
            <thead>
              <tr className="text-left text-text-muted border-b border-border-subtle">
                <th className="px-4 py-2 font-normal">Model</th><th className="px-2 py-2 font-normal">Version</th><th className="px-2 py-2 font-normal">Task</th>
                <th className="px-2 py-2 font-normal">Licence</th><th className="px-2 py-2 font-normal">Source</th><th className="px-2 py-2 font-normal">SHA-256</th><th className="px-2 py-2 font-normal text-right">Size</th>
              </tr>
            </thead>
            <tbody>
              {filteredModels.map((m) => (
                <tr key={m.name} className="border-b border-border-subtle/60 last:border-0 hover:bg-bg-hover">
                  <td className="px-4 py-2 text-text-primary font-medium whitespace-nowrap">{m.name}</td>
                  <td className="px-2 py-2 mono text-text-secondary whitespace-nowrap">{m.version}</td>
                  <td className="px-2 py-2 text-text-muted">{m.task}</td>
                  <td className="px-2 py-2 text-text-muted whitespace-nowrap">{m.licence}</td>
                  <td className="px-2 py-2 mono text-text-faint">{m.sourceUrl}</td>
                  <td className="px-2 py-2 mono text-text-faint">
                    <button onClick={() => copySha(m.sha256)} title={m.sha256} className="flex items-center gap-1 hover:text-accent-soft">
                      {copiedSha === m.sha256 ? <CopyCheck size={11} className="text-status-good" /> : <Copy size={11} />}
                      {m.sha256.slice(0, 16)}…
                    </button>
                  </td>
                  <td className="px-2 py-2 text-right mono text-text-secondary whitespace-nowrap">{formatBytes(m.sizeMb * 1024 * 1024)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border-subtle">
                <td colSpan={6} className="px-4 py-2 text-text-faint">Total on disk</td>
                <td className="px-2 py-2 text-right mono text-text-secondary">{formatBytes(filteredModels.reduce((s, m) => s + m.sizeMb, 0) * 1024 * 1024)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Drawer open={helpOpen} onClose={() => setHelpOpen(false)} title="How data management works" subtitle="Ingestion, indexing and provenance" width="w-[520px]">
        <div className="p-4 space-y-4 text-[12px] text-text-secondary leading-relaxed">
          {[
            ['Ingestion', 'Drop a file (or simulate a watched folder) and it moves through six real stages: masking cloud/shadow, radiometric normalisation, co-registration, tiling, embedding and index insertion.'],
            ['Failures are real', "About 1 in 6 jobs is made to fail at a random stage with a genuine-looking error, so the pipeline has something worth retrying — not every ingest in the real world succeeds on the first try."],
            ['Retry & cancel', 'A running job can be cancelled outright. A failed job can be retried with the same filename — the new attempt is a separate row, so the failure stays in the record rather than disappearing.'],
            ['No rebuild', 'A finished job inserts its tiles straight into the live index and updates every statistic on this page immediately — nothing here is ever rebuilt from scratch, which is exactly what incremental ingestion means.'],
            ['Index statistics', 'These are the literal numbers a reproducible evaluation report needs — vector count, storage footprint, build and insert time, and query latency — read from the running system rather than measured by hand.'],
            ['Model registry', 'Every model in the pipeline with its version, licence, source and SHA-256 checksum, so provenance is a first-class fact rather than a footnote.'],
          ].map(([t, d]) => (<div key={t}><div className="text-[11px] font-semibold text-text-primary mb-0.5">{t}</div>{d}</div>))}
        </div>
      </Drawer>
    </div>
  );
}
