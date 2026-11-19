import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { Play, Pause, SkipBack, SkipForward, Radar, ShieldAlert, Mountain, Boxes, ExternalLink, GitCompareArrows } from 'lucide-react';
import { useFilterStore } from '../../state/filterStore';
import { CHANGE_CANDIDATES, SCENES, aoiById } from '../../lib/mockData';
import { CHANGE_TYPE_COLORS, CHANGE_TYPE_LABELS } from '../../lib/colors';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Slider } from '../../components/ui/Slider';
import { formatDate, cn } from '../../lib/utils';
import { useShortcuts } from '../../lib/useShortcuts';

const AUTOPLAY_MS = 2600;

function pctBox(bbox: [number, number, number, number], aoiBbox: [number, number, number, number]) {
  const [minX, minY, maxX, maxY] = aoiBbox;
  const [x0, y0, x1, y1] = bbox;
  const left = ((x0 - minX) / (maxX - minX)) * 100;
  const right = ((x1 - minX) / (maxX - minX)) * 100;
  const top = ((maxY - y1) / (maxY - minY)) * 100;
  const bottom = ((maxY - y0) / (maxY - minY)) * 100;
  return { left, top, width: Math.max(right - left, 1.2), height: Math.max(bottom - top, 1.2) };
}

export function SiteTimelinePage() {
  const navigate = useNavigate();
  const aoiId = useFilterStore((s) => s.aoiId);
  const aoi = aoiById(aoiId)!;

  const years = useMemo(
    () => SCENES.filter((s) => s.aoiId === aoiId).map((s) => new Date(s.datetime).getUTCFullYear()).sort((a, b) => a - b),
    [aoiId]
  );
  const sceneForYear = useMemo(() => {
    const m = new Map<number, (typeof SCENES)[number]>();
    SCENES.filter((s) => s.aoiId === aoiId).forEach((s) => m.set(new Date(s.datetime).getUTCFullYear(), s));
    return m;
  }, [aoiId]);

  const candidates = useMemo(
    () =>
      CHANGE_CANDIDATES.filter((c) => c.aoiId === aoiId && c.suppressedBy === null).sort(
        (a, b) => new Date(a.earliestIntervalEnd).getTime() - new Date(b.earliestIntervalEnd).getTime()
      ),
    [aoiId]
  );

  const [yearIdx, setYearIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const selectedYear = years[yearIdx] ?? years[0];
  const scene = sceneForYear.get(selectedYear);

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => {
      setYearIdx((i) => {
        if (i >= years.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, AUTOPLAY_MS);
    return () => window.clearInterval(t);
  }, [playing, years.length]);

  const step = (delta: number) => setYearIdx((i) => Math.min(years.length - 1, Math.max(0, i + delta)));

  useShortcuts(
    {
      arrowleft: () => { setPlaying(false); step(-1); },
      arrowright: () => { setPlaying(false); step(1); },
      ' ': () => setPlaying((p) => !p),
    },
    [
      { keys: '←/→', label: 'step through years' },
      { keys: 'space', label: 'play / pause the timeline' },
    ]
  );

  const cumulative = candidates.filter((c) => new Date(c.earliestIntervalEnd).getUTCFullYear() <= selectedYear);
  const newThisYear = candidates.filter((c) => new Date(c.earliestIntervalEnd).getUTCFullYear() === selectedYear);
  const logEntries = [...cumulative].reverse();

  const missileFindings = cumulative.filter((c) => c.headline?.toLowerCase().includes('missile') || c.headline?.toLowerCase().includes('pad') || c.headline?.toLowerCase().includes('battery')).length;
  const tunnelFindings = cumulative.filter((c) => c.headline?.toLowerCase().includes('tunnel')).length;

  const growthData = years.map((y) => ({
    year: String(y),
    findings: candidates.filter((c) => new Date(c.earliestIntervalEnd).getUTCFullYear() <= y).length,
  }));

  // before/after compare
  const [compareFromIdx, setCompareFromIdx] = useState(0);
  const [compareToIdx, setCompareToIdx] = useState(years.length - 1);
  const [swipePos, setSwipePos] = useState(50);
  const fromScene = sceneForYear.get(years[compareFromIdx]);
  const toScene = sceneForYear.get(years[compareToIdx]);

  return (
    <div className="h-full min-h-0 overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Radar size={15} className="text-accent-soft" />
            Border watch — {aoi.name}
          </h2>
          <p className="text-[11px] text-text-muted mt-0.5 max-w-2xl">{aoi.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatPill icon={<Mountain size={12} />} label="years monitored" value={`${selectedYear - years[0] + 1}`} />
          <StatPill icon={<Boxes size={12} />} label="confirmed findings" value={String(cumulative.length)} />
          <StatPill icon={<ShieldAlert size={12} />} label="missile-related" value={String(missileFindings)} accent="var(--color-status-bad)" />
          <StatPill icon={<GitCompareArrows size={12} />} label="tunnel / bunker" value={String(tunnelFindings)} accent="var(--color-status-warn)" />
        </div>
      </div>

      {/* Year scrubber */}
      <Card className="p-3">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="ghost" onClick={() => step(-1)} disabled={yearIdx === 0}><SkipBack size={13} /></Button>
          <Button size="sm" variant={playing ? 'primary' : 'secondary'} onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause size={13} /> : <Play size={13} />}
            {playing ? 'pause' : 'play the decade'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => step(1)} disabled={yearIdx === years.length - 1}><SkipForward size={13} /></Button>
          <div className="flex-1 flex items-center gap-1 px-2">
            {years.map((y, i) => {
              const has = candidates.some((c) => new Date(c.earliestIntervalEnd).getUTCFullYear() === y);
              return (
                <button
                  key={y}
                  onClick={() => { setPlaying(false); setYearIdx(i); }}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1 py-1.5 rounded-md border text-[11px] mono transition-colors',
                    i === yearIdx ? 'border-accent bg-accent/15 text-accent-soft' : 'border-transparent text-text-muted hover:text-text-secondary hover:bg-bg-hover'
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full', has ? 'bg-status-warn' : 'bg-transparent')} />
                  {y}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-[1fr_360px] gap-4 items-start">
        {/* Hero detection view */}
        <Card className="overflow-hidden">
          <CardHeader
            title={`Frame ${selectedYear}`}
            subtitle={scene ? `${scene.sensor} · ${formatDate(scene.datetime)} · ${scene.cloudPct}% cloud` : undefined}
            right={newThisYear.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-status-warn animate-pulse-soft">
                <ShieldAlert size={12} /> {newThisYear.length} new detection{newThisYear.length > 1 ? 's' : ''}
              </span>
            )}
          />
          <div className="relative w-full aspect-square bg-black">
            <AnimatePresence mode="wait">
              <motion.img
                key={selectedYear}
                src={scene?.imageUrl}
                alt={`Sector-14, ${selectedYear}`}
                className="absolute inset-0 w-full h-full object-cover select-none"
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                draggable={false}
              />
            </AnimatePresence>

            {/* scan sweep on year change */}
            <div key={`sweep-${selectedYear}`} className="absolute inset-0 pointer-events-none overflow-hidden">
              <div
                className="absolute left-0 right-0 h-1/3 animate-scan-sweep"
                style={{ background: 'linear-gradient(180deg, transparent, rgba(129,140,248,0.35), transparent)' }}
              />
            </div>

            {/* detection boxes */}
            <div key={`boxes-${selectedYear}`} className="absolute inset-0">
              <AnimatePresence>
                {cumulative.map((c, i) => {
                  const box = pctBox(c.bbox, aoi.bbox);
                  const isNew = newThisYear.includes(c);
                  const color = CHANGE_TYPE_COLORS[c.type];
                  return (
                    <motion.div
                      key={c.id}
                      className={cn('group absolute border-2 rounded-sm', isNew ? 'animate-box-glow' : 'opacity-70 hover:opacity-100')}
                      style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%`, borderColor: color, color }}
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: isNew ? 1 : 0.7, scale: 1 }}
                      transition={{ delay: isNew ? i * 0.12 : 0, duration: 0.35, ease: 'easeOut' }}
                      onClick={() => navigate(`/evidence/${c.id}`)}
                    >
                      <div
                        className={cn(
                          'absolute -top-5 left-0 whitespace-nowrap text-[10px] font-medium px-1.5 py-0.5 rounded cursor-pointer pointer-events-auto transition-opacity',
                          isNew ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        )}
                        style={{ background: color, color: '#0a0e16' }}
                        onClick={(e) => { e.stopPropagation(); navigate(`/evidence/${c.id}`); }}
                      >
                        {c.headline}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            <div className="absolute bottom-2 left-2 mono text-[10px] text-white/70 bg-black/50 px-1.5 py-0.5 rounded">
              offline basemap · local raster cache
            </div>
          </div>
        </Card>

        {/* Intelligence log */}
        <Card className="flex flex-col max-h-[640px]">
          <CardHeader title="Intelligence log" subtitle={`${logEntries.length} of ${candidates.length} confirmed findings through ${selectedYear}`} />
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            <AnimatePresence initial={false}>
              {logEntries.length === 0 && (
                <p className="text-[11px] text-text-muted p-3">No confirmed findings yet — press play or step forward.</p>
              )}
              {logEntries.map((c) => (
                <motion.button
                  key={c.id}
                  layout
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  onClick={() => navigate(`/evidence/${c.id}`)}
                  className="w-full text-left bg-bg-raised hover:bg-bg-hover border border-border-subtle rounded-md p-2.5 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="mono text-[10px] text-accent-soft">{new Date(c.earliestIntervalEnd).getUTCFullYear()}</span>
                    <Badge color={CHANGE_TYPE_COLORS[c.type]} variant="dot">{CHANGE_TYPE_LABELS[c.type]}</Badge>
                  </div>
                  <div className="text-[12px] font-medium text-text-primary mt-1 flex items-center gap-1">
                    {c.headline}
                    <ExternalLink size={10} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                  </div>
                  <p className="text-[11px] text-text-muted mt-1 leading-snug">{c.narrative}</p>
                  <div className="mono text-[10px] text-text-faint mt-1.5">confidence {Math.round(c.confidence * 100)}%</div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </Card>
      </div>

      {/* Growth chart */}
      <Card>
        <CardHeader title="Escalation over time" subtitle="Cumulative confirmed findings, year over year" />
        <div className="px-3 pb-3 pt-1">
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={growthData} margin={{ top: 8, right: 12, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent-soft)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--color-accent-soft)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'var(--color-text-faint)' }} axisLine={{ stroke: 'var(--color-border-subtle)' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--color-text-faint)' }} axisLine={false} tickLine={false} width={24} />
              <RechartsTooltip contentStyle={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)', fontSize: 11, borderRadius: 6 }} />
              <Area type="stepAfter" dataKey="findings" stroke="var(--color-accent-soft)" strokeWidth={2} fill="url(#growthFill)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Before / after compare */}
      <Card>
        <CardHeader
          title="Ten years, side by side"
          subtitle="Drag to compare any two years directly"
          right={
            <div className="flex items-center gap-2 text-[11px]">
              <select
                value={compareFromIdx}
                onChange={(e) => setCompareFromIdx(Number(e.target.value))}
                className="bg-bg-raised border border-border rounded px-1.5 py-1 mono"
              >
                {years.map((y, i) => <option key={y} value={i}>{y}</option>)}
              </select>
              <span className="text-text-faint">→</span>
              <select
                value={compareToIdx}
                onChange={(e) => setCompareToIdx(Number(e.target.value))}
                className="bg-bg-raised border border-border rounded px-1.5 py-1 mono"
              >
                {years.map((y, i) => <option key={y} value={i}>{y}</option>)}
              </select>
            </div>
          }
        />
        <div className="p-3 space-y-2">
          <div className="relative w-full aspect-[21/9] rounded-lg overflow-hidden bg-black">
            <img src={fromScene?.imageUrl} alt={`${years[compareFromIdx]}`} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
            <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${swipePos}%)` }}>
              <img src={toScene?.imageUrl} alt={`${years[compareToIdx]}`} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
            </div>
            <div className="absolute inset-y-0" style={{ left: `${swipePos}%` }}>
              <div className="w-0.5 h-full bg-white/80" />
            </div>
            <div className="absolute bottom-2 left-2 mono text-[10px] text-white/80 bg-black/50 px-1.5 py-0.5 rounded">{years[compareFromIdx]}</div>
            <div className="absolute bottom-2 right-2 mono text-[10px] text-white/80 bg-black/50 px-1.5 py-0.5 rounded">{years[compareToIdx]}</div>
          </div>
          <Slider value={swipePos} min={0} max={100} step={1} onChange={setSwipePos} leftLabel={String(years[compareFromIdx])} rightLabel={String(years[compareToIdx])} />
        </div>
      </Card>
    </div>
  );
}

function StatPill({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-bg-panel border border-border-subtle rounded-md px-2.5 py-1.5">
      <span style={{ color: accent ?? 'var(--color-accent-soft)' }}>{icon}</span>
      <span className="mono text-sm font-semibold text-text-primary">{value}</span>
      <span className="text-[10px] text-text-faint">{label}</span>
    </div>
  );
}

