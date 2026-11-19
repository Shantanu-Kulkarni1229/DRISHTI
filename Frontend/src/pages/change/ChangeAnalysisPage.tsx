import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GitCompareArrows, Info, SlidersHorizontal, ChevronDown, CheckCircle2, Layers, Ruler, ShieldCheck, Hourglass } from 'lucide-react';
import { useChangeStore } from '../../state/changeStore';
import { useFilterStore } from '../../state/filterStore';
import { acquisitionsFor, CHANGE_CANDIDATES, SCENES, aoiById } from '../../lib/mockData';
import { Card, CardHeader } from '../../components/ui/Card';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import { useShortcuts } from '../../lib/useShortcuts';
import { cn } from '../../lib/utils';
import type { ChangeType, SuppressionGateId } from '../../lib/types';
import { ControlsPanel } from './ControlsPanel';
import { CompareStage } from './CompareStage';
import { FindingsPanel, type FindingSort } from './FindingsPanel';
import { FunnelPanel } from './FunnelPanel';
import { GalleryDrawer, HelpDrawer } from './Drawers';
import { DROP_CATEGORIES, GATE_INFO, STAGE_INFO, TYPES, appearsBetween, estimatePR, windowFunnel, yearOf } from './changeHelpers';

function StatTile({ icon, label, children, delay }: { icon: React.ReactNode; label: string; children: React.ReactNode; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-bg-raised/60 border border-border-subtle rounded-lg px-3 py-2 min-w-0"
    >
      <div className="flex items-center gap-1.5 text-[10px] text-text-faint mb-0.5 truncate">
        <span className="text-accent-soft">{icon}</span>{label}
      </div>
      <div className="mono text-base sm:text-lg font-semibold text-text-primary leading-tight truncate">{children}</div>
    </motion.div>
  );
}

export function ChangeAnalysisPage() {
  const aoiId = useFilterStore((s) => s.aoiId);
  const {
    dateMode, pairBefore, pairAfter, selectedTypes, sensitivity, running, stages, compareTool, swipePosition, selectedCandidateId,
    setDateMode, setPair, toggleType, setSensitivity, setCompareTool, setSwipePosition, runAnalysis, selectCandidate, funnel, threshold,
  } = useChangeStore();

  const aoi = aoiById(aoiId)!;
  const acquisitions = useMemo(() => acquisitionsFor(aoiId), [aoiId]);
  const usable = useMemo(() => acquisitions.filter((a) => a.usability !== 'unusable' && a.usability !== 'missing'), [acquisitions]);
  const years = useMemo(() => usable.map((a) => yearOf(a.date)), [usable]);
  const autoBefore = years[0];
  const autoAfter = years[years.length - 1];
  const beforeYear = dateMode === 'pair' && pairBefore ? yearOf(pairBefore) : autoBefore;
  const afterYear = dateMode === 'pair' && pairAfter ? yearOf(pairAfter) : autoAfter;
  const dateFor = (y: number) => usable.find((a) => yearOf(a.date) === y)?.date ?? null;
  const imageFor = (y: number) => SCENES.find((s) => s.aoiId === aoiId && yearOf(s.datetime) === y)?.imageUrl;

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [sort, setSort] = useState<FindingSort>('confidence');
  const [controlsOpen, setControlsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [gallery, setGallery] = useState<{ title: string; blurb: string; gates: SuppressionGateId[] } | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [banner, setBanner] = useState(false);

  useEffect(() => {
    setPair(null, null);
    selectCandidate(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aoiId]);

  const analysisDone = stages.every((s) => s.status === 'done');
  const prevRunning = useRef(running);
  useEffect(() => {
    if (prevRunning.current && !running) {
      setRunKey((k) => k + 1);
      setBanner(true);
      const t = window.setTimeout(() => setBanner(false), 4500);
      return () => window.clearTimeout(t);
    }
    prevRunning.current = running;
  }, [running]);
  useEffect(() => { prevRunning.current = running; });

  const reportedPool = useMemo(() => CHANGE_CANDIDATES.filter((c) => c.aoiId === aoiId && c.suppressedBy === null), [aoiId]);
  const suppressedPool = useMemo(() => CHANGE_CANDIDATES.filter((c) => c.aoiId === aoiId && c.suppressedBy !== null), [aoiId]);
  const inWindowAll = useMemo(() => reportedPool.filter((c) => appearsBetween(c, beforeYear, afterYear)), [reportedPool, beforeYear, afterYear]);
  const typeCounts = useMemo(
    () => TYPES.reduce((acc, t) => ({ ...acc, [t]: inWindowAll.filter((c) => c.type === t).length }), {} as Record<ChangeType, number>),
    [inWindowAll]
  );
  const cut = threshold();
  const shown = useMemo(() => inWindowAll.filter((c) => selectedTypes.includes(c.type) && c.confidence >= cut), [inWindowAll, selectedTypes, cut]);
  const inWindowTyped = inWindowAll.filter((c) => selectedTypes.includes(c.type)).length;

  const numberById = useMemo(() => {
    const chrono = [...shown].sort((a, b) => a.earliestIntervalEnd.localeCompare(b.earliestIntervalEnd) || b.confidence - a.confidence);
    return new Map(chrono.map((c, i) => [c.id, i + 1]));
  }, [shown]);

  const sorted = useMemo(
    () =>
      [...shown].sort((a, b) =>
        sort === 'confidence' ? b.confidence - a.confidence : sort === 'area' ? b.areaM2 - a.areaM2 : a.earliestIntervalEnd.localeCompare(b.earliestIntervalEnd)
      ),
    [shown, sort]
  );

  const selectedId = shown.some((c) => c.id === selectedCandidateId) ? selectedCandidateId : null;
  const { precision, recall } = estimatePR(cut);
  const fun = windowFunnel(aoiId, beforeYear, afterYear, years, shown.length);
  const gateCounts = funnel(aoiId).gateDropCounts;

  const totalHa = shown.reduce((s, c) => s + c.areaM2, 0) / 10000;
  const topConf = shown.reduce((m, c) => Math.max(m, c.confidence), 0);

  const progress = stages.reduce((s, st) => s + st.progress, 0) / (stages.length * 100);
  const runningStage = stages.find((s) => s.status === 'running');
  const stageLabel = runningStage ? `${STAGE_INFO[runningStage.id].title} — ${STAGE_INFO[runningStage.id].detail}` : 'Preparing frames…';

  const run = () => {
    if (running) return;
    selectCandidate(null);
    runAnalysis(aoiId);
  };
  const step = (dir: 1 | -1) => {
    if (!sorted.length) return;
    const chrono = [...shown].sort((a, b) => (numberById.get(a.id) ?? 0) - (numberById.get(b.id) ?? 0));
    const idx = chrono.findIndex((c) => c.id === selectedId);
    const next = chrono[(idx + dir + chrono.length) % chrono.length];
    selectCandidate(next.id);
  };

  useShortcuts(
    {
      r: run,
      '1': () => setCompareTool('swipe'),
      '2': () => setCompareTool('blink'),
      '3': () => setCompareTool('fade'),
      '4': () => setCompareTool('sync'),
      arrowleft: () => setSwipePosition(Math.max(0, swipePosition - 5)),
      arrowright: () => setSwipePosition(Math.min(100, swipePosition + 5)),
      j: () => step(1),
      k: () => step(-1),
      escape: () => selectCandidate(null),
    },
    [
      { keys: 'R', label: 'run the analysis' },
      { keys: '1–4', label: 'swipe / blink / fade / side by side' },
      { keys: '← →', label: 'move the comparison divider' },
      { keys: 'J / K', label: 'next / previous finding' },
      { keys: 'Esc', label: 'clear selection and zoom' },
    ]
  );

  const openCategory = (key: string) => {
    const cat = DROP_CATEGORIES.find((c) => c.key === key);
    if (cat) setGallery({ title: cat.title, blurb: cat.blurb, gates: cat.gates });
  };
  const openGate = (g: SuppressionGateId) => setGallery({ title: `${GATE_INFO[g].label} gate`, blurb: GATE_INFO[g].explain, gates: [g] });

  const findings = (
    <FindingsPanel
      findings={sorted}
      numberById={numberById}
      hoveredId={hoveredId}
      selectedId={selectedId}
      onHover={setHoveredId}
      onSelect={(id) => selectCandidate(id)}
      analysisDone={analysisDone}
      running={running}
      inWindow={inWindowTyped}
      sort={sort}
      onSort={setSort}
    />
  );

  return (
    <div className="p-3 sm:p-4 lg:p-5 max-w-[1900px] mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 mb-4">
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <GitCompareArrows size={17} className="text-accent-soft shrink-0" /> Change analysis
          </h2>
          <p className="text-[11px] text-text-muted mt-0.5 truncate sm:whitespace-normal">
            What changed at {aoi.name}, between when and when — and can we believe it.
          </p>
        </div>
        <button
          onClick={() => setControlsOpen((o) => !o)}
          className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-text-secondary"
        >
          <SlidersHorizontal size={13} /> Settings
          <span className="mono text-[10px] text-accent-soft">{beforeYear}→{afterYear}</span>
          <ChevronDown size={13} className={cn('transition-transform', controlsOpen && 'rotate-180')} />
        </button>
        <button
          onClick={() => setHelpOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-text-secondary hover:text-accent-soft hover:border-accent/50 transition-colors"
        >
          <Info size={13} /> How it works
        </button>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_360px] items-start">
        <aside className={cn('lg:sticky lg:top-3 lg:max-h-[calc(100dvh-6.5rem)] lg:overflow-y-auto', controlsOpen ? 'block' : 'hidden lg:block')}>
          <div className="bg-bg-panel border border-border-subtle rounded-xl p-4">
            <ControlsPanel
              years={years}
              dateMode={dateMode}
              onDateMode={setDateMode}
              beforeYear={beforeYear}
              afterYear={afterYear}
              onPickBefore={(y) => setPair(dateFor(y), dateFor(afterYear))}
              onPickAfter={(y) => setPair(dateFor(beforeYear), dateFor(y))}
              selectedTypes={selectedTypes}
              onToggleType={toggleType}
              typeCounts={typeCounts}
              sensitivity={sensitivity}
              onSensitivity={setSensitivity}
              threshold={cut}
              precision={precision}
              recall={recall}
              shown={shown.length}
              inWindow={inWindowTyped}
              running={running}
              analysisDone={analysisDone}
              stages={stages}
              onRun={run}
            />
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2">Before / after <span className="mono text-[11px] text-accent-soft">{beforeYear} → {afterYear}</span></span>}
              subtitle={`${afterYear - beforeYear} year${afterYear - beforeYear === 1 ? '' : 's'} apart · real imagery, offline`}
            />
            <div className="p-3 sm:p-4 space-y-3">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <StatTile icon={<Layers size={11} />} label="findings" delay={0.02}>
                  <AnimatedNumber value={analysisDone ? shown.length : 0} />
                </StatTile>
                <StatTile icon={<Ruler size={11} />} label="area changed" delay={0.06}>
                  <AnimatedNumber value={analysisDone ? Math.round(totalHa) : 0} suffix=" ha" />
                </StatTile>
                <StatTile icon={<ShieldCheck size={11} />} label="top confidence" delay={0.1}>
                  <AnimatedNumber value={analysisDone ? Math.round(topConf * 100) : 0} suffix="%" />
                </StatTile>
                <StatTile icon={<Hourglass size={11} />} label="revisit gap" delay={0.14}>365 d</StatTile>
              </div>

              <AnimatePresence>
                {banner && analysisDone && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -8 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-2 rounded-md border border-status-good/40 bg-status-good/10 px-3 py-2 text-xs text-status-good">
                      <CheckCircle2 size={14} />
                      Analysis complete — {shown.length} real change{shown.length === 1 ? '' : 's'} found between {beforeYear} and {afterYear}.
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <CompareStage
                aoiBbox={aoi.bbox}
                beforeImage={imageFor(beforeYear)}
                afterImage={imageFor(afterYear)}
                beforeYear={beforeYear}
                afterYear={afterYear}
                findings={shown}
                numberById={numberById}
                hoveredId={hoveredId}
                selectedId={selectedId}
                onHover={setHoveredId}
                onSelect={(id) => selectCandidate(id)}
                tool={compareTool}
                onTool={setCompareTool}
                swipe={swipePosition}
                onSwipe={setSwipePosition}
                analysisDone={analysisDone}
                running={running}
                stageLabel={stageLabel}
                progress={progress}
                onRun={run}
                runKey={runKey}
              />
            </div>
          </Card>

          <div className="xl:hidden">
            <Card className="p-3 sm:p-4">{findings}</Card>
          </div>

          <FunnelPanel
            active={analysisDone}
            screened={fun.screened}
            passedQuality={fun.passedQuality}
            persisted={fun.persisted}
            reported={fun.reported}
            gateCounts={gateCounts}
            onInspectCategory={openCategory}
            onInspectGate={openGate}
          />
        </div>

        <aside className="hidden xl:block sticky top-3 max-h-[calc(100dvh-6.5rem)] overflow-y-auto pr-1">
          <div className="bg-bg-panel border border-border-subtle rounded-xl p-3">{findings}</div>
        </aside>
      </div>

      <GalleryDrawer
        open={!!gallery}
        onClose={() => setGallery(null)}
        title={gallery?.title ?? ''}
        blurb={gallery?.blurb ?? ''}
        gates={gallery?.gates ?? []}
        candidates={suppressedPool}
      />
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
