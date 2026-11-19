import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, ArrowUpDown, Info, Search as SearchIcon, ChevronDown, Copy, CopyCheck, Database, ExternalLink, Percent, Hash } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useChangeStore } from '../../state/changeStore';
import { useSearchStore } from '../../state/searchStore';
import { useIngestStore } from '../../state/ingestStore';
import { EVAL_METRICS, MODELS, sensitivityToThreshold, estimatePR } from '../../lib/mockData';
import { downloadTextFile, copyText, cn } from '../../lib/utils';
import { Card, CardHeader } from '../../components/ui/Card';
import { Slider } from '../../components/ui/Slider';
import { Button } from '../../components/ui/Button';
import { Drawer } from '../../components/ui/Drawer';
import { Tooltip } from '../../components/ui/Tooltip';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import { ConfusionMatrix } from '../../components/charts/ConfusionMatrix';
import { PRCurve } from '../../components/charts/PRCurve';
import type { ChangeType, RetrievalQueryResult } from '../../lib/types';

type EvalTab = 'retrieval' | 'change' | 'performance';
const TABS: { id: EvalTab; label: string }[] = [
  { id: 'retrieval', label: 'Retrieval' },
  { id: 'change', label: 'Change detection' },
  { id: 'performance', label: 'Performance' },
];

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function StatTile({ label, value, sub, tone, hint, delay = 0 }: { label: string; value: number; suffix?: string; sub?: string; tone?: 'good' | 'warn' | 'bad'; hint?: string; delay?: number }) {
  const toneClass = tone === 'good' ? 'text-status-good' : tone === 'warn' ? 'text-status-warn' : tone === 'bad' ? 'text-status-bad' : 'text-text-primary';
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.3 }}>
      <Card className="p-3 h-full">
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-text-muted mb-1">
          <span className="truncate">{label}</span>
          {hint && <Tooltip content={hint}><Info size={10} className="text-text-faint shrink-0" /></Tooltip>}
        </div>
        <AnimatedNumber value={value} className={cn('mono text-lg font-semibold leading-tight', toneClass)} />
        {sub && <div className="text-[10px] text-text-faint mt-0.5">{sub}</div>}
      </Card>
    </motion.div>
  );
}

function Seg({ value, options, onChange }: { value: string; options: { id: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="relative flex bg-bg-raised rounded-lg p-1">
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} className={cn('relative flex-1 sm:flex-none px-3 py-1.5 rounded-md text-[12px] font-medium z-10 transition-colors', value === o.id ? 'text-white' : 'text-text-muted hover:text-text-secondary')}>
          {value === o.id && <motion.span layoutId="eval-tab-pill" className="absolute inset-0 bg-accent rounded-md" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

type SortKey = keyof Pick<RetrievalQueryResult, 'recallAt1' | 'recallAt5' | 'recallAt10' | 'ap' | 'relevant' | 'returned'>;
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'recallAt1', label: 'R@1' }, { key: 'recallAt5', label: 'R@5' }, { key: 'recallAt10', label: 'R@10' },
  { key: 'relevant', label: 'Relevant' }, { key: 'returned', label: 'Returned' }, { key: 'ap', label: 'AP' },
];
const TYPES = Object.keys(EVAL_METRICS.change.confusion) as ChangeType[];

function buildReportMarkdown(sensitivity: number): string {
  const { retrieval, change, performance } = EVAL_METRICS;
  const threshold = sensitivityToThreshold(sensitivity);
  const lines: string[] = [];
  lines.push('# Drishti AI — Reproducible Evaluation Report', '', `Generated: ${new Date().toISOString()}`, `Git commit: \`${performance.gitCommit}\``, `Hardware: ${performance.hardware}`, `Change-detection operating point at export time: sensitivity ${sensitivity.toFixed(2)} → threshold ${threshold.toFixed(2)}`, '');
  lines.push('## Retrieval', '', `- Recall@1: ${pct(retrieval.recallAt1)}`, `- Recall@5: ${pct(retrieval.recallAt5)}`, `- Recall@10: ${pct(retrieval.recallAt10)}`, `- mAP: ${pct(retrieval.map)}`, `- nDCG@10: ${pct(retrieval.ndcgAt10)}`, '');
  lines.push('| Query | Recall@1 | Recall@5 | Recall@10 | Relevant | Returned | AP |', '|---|---|---|---|---|---|---|');
  retrieval.perQuery.forEach((q) => lines.push(`| ${q.query} | ${pct(q.recallAt1)} | ${pct(q.recallAt5)} | ${pct(q.recallAt10)} | ${q.relevant} | ${q.returned} | ${pct(q.ap)} |`));
  lines.push('');
  lines.push('## Change detection', '', `- Precision: ${pct(change.precision)}`, `- Recall: ${pct(change.recall)}`, `- F1: ${pct(change.f1)}`, `- Earliest-date accuracy: ${pct(change.earliestDateAccuracy)}`, `- Mean interval width: ${change.meanIntervalWidthDays} days`, `- Operating threshold used for this report: ${threshold.toFixed(2)}`, '');
  lines.push('### Confusion matrix (rows = actual, columns = predicted)', '');
  lines.push(`| actual \\ predicted | ${TYPES.join(' | ')} |`, `|---|${TYPES.map(() => '---').join('|')}|`);
  TYPES.forEach((r) => lines.push(`| ${r} | ${TYPES.map((c) => change.confusion[r][c]).join(' | ')} |`));
  lines.push('', '### False-alarm rate by confounder, before vs. after suppression gates', '', '| Confounder | Before | After | Reduction |', '|---|---|---|---|');
  change.falseAlarmByConfounder.forEach((c) => lines.push(`| ${c.confounder} | ${c.before} | ${c.after} | ${c.before > 0 ? `${Math.round((1 - c.after / c.before) * 100)}%` : '—'} |`));
  lines.push('');
  lines.push('## Performance', '', `- Ingest throughput: ${performance.ingestTilesPerSec} tiles/sec`, `- Index build time: ${performance.indexBuildTimeS} s`, `- Incremental insert: ${performance.incrementalInsertMs} ms`, `- Storage per 1,000 tiles: ${performance.storagePerThousandTilesMb} MB`, `- Query latency p50: ${performance.queryLatencyP50Ms} ms`, `- Query latency p95: ${performance.queryLatencyP95Ms} ms`, `- Hardware: ${performance.hardware}`, `- Git commit: ${performance.gitCommit}`, '');
  lines.push('## Model registry (configuration & checksums)', '', '| Model | Version | Licence | SHA-256 |', '|---|---|---|---|');
  MODELS.forEach((m) => lines.push(`| ${m.name} | ${m.version} | ${m.licence} | \`${m.sha256}\` |`));
  lines.push('');
  return lines.join('\n');
}

export function EvaluationPage() {
  const navigate = useNavigate();
  const { sensitivity, setSensitivity } = useChangeStore();
  const setQueryText = useSearchStore((s) => s.setQueryText);
  const setSearchMode = useSearchStore((s) => s.setMode);
  const ingestJobs = useIngestStore((s) => s.jobs);

  const [tab, setTab] = useState<EvalTab>('retrieval');
  const [sortKey, setSortKey] = useState<SortKey>('ap');
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);
  const [matrixMode, setMatrixMode] = useState<'count' | 'pct'>('count');
  const [helpOpen, setHelpOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { retrieval, change, performance } = EVAL_METRICS;
  const threshold = sensitivityToThreshold(sensitivity);
  const live = estimatePR(threshold);

  const sortedQueries = useMemo(() => {
    const rows = [...retrieval.perQuery];
    rows.sort((a, b) => (sortAsc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]));
    return rows;
  }, [retrieval.perQuery, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(true); }
  }

  const tryQuery = (q: string) => {
    setQueryText(q);
    setSearchMode('text');
    navigate('/search');
  };

  const reportMarkdown = useMemo(() => buildReportMarkdown(sensitivity), [sensitivity]);
  const copyReport = () => copyText(reportMarkdown).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600); });
  const downloadReport = () => downloadTextFile('drishti-evaluation-report.md', reportMarkdown, 'text/markdown');

  const accuracy = useMemo(() => {
    let correct = 0, total = 0;
    TYPES.forEach((r) => TYPES.forEach((c) => { total += change.confusion[r][c]; if (r === c) correct += change.confusion[r][c]; }));
    return total ? correct / total : 0;
  }, [change.confusion]);

  const overallReduction = useMemo(() => {
    const before = change.falseAlarmByConfounder.reduce((s, c) => s + c.before, 0);
    const after = change.falseAlarmByConfounder.reduce((s, c) => s + c.after, 0);
    return before > 0 ? 1 - after / before : 0;
  }, [change.falseAlarmByConfounder]);

  const embedTimeline = ingestJobs.filter((j) => j.embedMs !== null).slice(0, 12).reverse();
  const maxEmbed = Math.max(1, ...embedTimeline.map((j) => j.embedMs ?? 0));
  const totalModelMb = MODELS.reduce((s, m) => s + m.sizeMb, 0);

  return (
    <div className="p-3 sm:p-4 lg:p-5 max-w-[1500px] mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <h1 className="text-base font-semibold text-text-primary">Evaluation report</h1>
          <p className="text-xs text-text-muted mt-0.5">Retrieval, change-detection and performance metrics for the held-out query set — generated from the running system, not typed by hand.</p>
        </div>
        <button onClick={() => setHelpOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-text-secondary hover:text-accent-soft hover:border-accent/50 transition-colors"><Info size={13} /> How it works</button>
        <Button variant="primary" size="sm" icon={<Download size={13} />} onClick={() => setPreviewOpen(true)}>Export report</Button>
      </div>

      <Seg value={tab} onChange={(v) => setTab(v as EvalTab)} options={TABS} />

      <AnimatePresence mode="wait">
        {tab === 'retrieval' && (
          <motion.div key="retrieval" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              <StatTile label="Recall@1" value={Math.round(retrieval.recallAt1 * 100)} sub="%" hint="Fraction of held-out queries whose single best match was actually relevant." />
              <StatTile label="Recall@5" value={Math.round(retrieval.recallAt5 * 100)} sub="%" delay={0.04} />
              <StatTile label="Recall@10" value={Math.round(retrieval.recallAt10 * 100)} sub="%" delay={0.08} />
              <StatTile label="mAP" value={Math.round(retrieval.map * 100)} sub="%" hint="Mean average precision — rewards relevant results appearing near the top." delay={0.12} />
              <StatTile label="nDCG@10" value={Math.round(retrieval.ndcgAt10 * 100)} sub="%" hint="Normalised discounted cumulative gain — like recall, but position-aware." delay={0.16} />
            </div>

            <Card>
              <CardHeader title="Per-query breakdown" subtitle="Sort any column, or open a row to try that query yourself" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-[11px]">
                  <thead>
                    <tr className="text-left text-text-muted border-b border-border-subtle">
                      <th className="px-4 py-2 font-normal w-6" />
                      <th className="px-2 py-2 font-normal">Query</th>
                      {COLUMNS.map((c) => (
                        <th key={c.key} className="px-2 py-2 font-normal text-right cursor-pointer select-none" onClick={() => toggleSort(c.key)}>
                          <span className="inline-flex items-center gap-1 justify-end w-full">{c.label}<ArrowUpDown size={10} className={sortKey === c.key ? 'text-accent' : 'text-text-faint'} /></span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedQueries.map((q) => {
                      const open = expandedQuery === q.query;
                      return (
                        <>
                          <tr key={q.query} onClick={() => setExpandedQuery(open ? null : q.query)} className="border-b border-border-subtle/60 last:border-0 hover:bg-bg-hover cursor-pointer">
                            <td className="px-4 py-2 text-text-faint"><ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} /></td>
                            <td className="px-2 py-2 text-text-secondary">{q.query}</td>
                            <td className="px-2 py-2 text-right mono" style={{ color: q.recallAt1 < 0.6 ? 'var(--color-status-bad)' : 'var(--color-text-primary)' }}>{pct(q.recallAt1)}</td>
                            <td className="px-2 py-2 text-right mono text-text-secondary">{pct(q.recallAt5)}</td>
                            <td className="px-2 py-2 text-right mono text-text-secondary">{pct(q.recallAt10)}</td>
                            <td className="px-2 py-2 text-right mono text-text-muted">{q.relevant}</td>
                            <td className="px-2 py-2 text-right mono text-text-muted">{q.returned}</td>
                            <td className="px-2 py-2 text-right mono" style={{ color: q.ap < 0.5 ? 'var(--color-status-bad)' : 'var(--color-text-primary)' }}>{pct(q.ap)}</td>
                          </tr>
                          <AnimatePresence>
                            {open && (
                              <tr>
                                <td colSpan={8} className="p-0 border-b border-border-subtle/60">
                                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                    <div className="px-4 py-3 bg-bg-raised/40 flex flex-wrap items-center gap-4">
                                      <div className="flex-1 min-w-[220px] space-y-1.5">
                                        {[['R@1', q.recallAt1], ['R@5', q.recallAt5], ['R@10', q.recallAt10], ['AP', q.ap]].map(([l, v]) => (
                                          <div key={l as string} className="flex items-center gap-2">
                                            <span className="text-[10px] text-text-faint w-8">{l}</span>
                                            <div className="flex-1 h-1.5 rounded-full bg-bg-panel overflow-hidden"><motion.div className="h-full bg-accent-soft rounded-full" initial={{ width: 0 }} animate={{ width: `${(v as number) * 100}%` }} transition={{ duration: 0.5 }} /></div>
                                            <span className="mono text-[10px] text-text-secondary w-9 text-right">{pct(v as number)}</span>
                                          </div>
                                        ))}
                                      </div>
                                      <Button size="sm" variant="outline" icon={<SearchIcon size={12} />} onClick={() => tryQuery(q.query)}>Try this search</Button>
                                    </div>
                                  </motion.div>
                                </td>
                              </tr>
                            )}
                          </AnimatePresence>
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        )}

        {tab === 'change' && (
          <motion.div key="change" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              <StatTile label="Precision" value={Math.round(change.precision * 100)} sub="%" tone="good" hint="Of everything reported, the share that was real." />
              <StatTile label="Recall" value={Math.round(change.recall * 100)} sub="%" hint="Of everything that really changed, the share caught." delay={0.04} />
              <StatTile label="F1" value={Math.round(change.f1 * 100)} sub="%" delay={0.08} />
              <StatTile label="Earliest-date accuracy" value={Math.round(change.earliestDateAccuracy * 100)} sub="%" delay={0.12} />
              <StatTile label="Mean interval width" value={change.meanIntervalWidthDays} sub="days" delay={0.16} />
            </div>

            <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-2">
              <Card className="p-4">
                <CardHeader
                  title="Confusion matrix" subtitle={`${Math.round(accuracy * 100)}% agreement across ${TYPES.length} change types`}
                  right={
                    <div className="flex bg-bg-raised rounded-md p-0.5">
                      {(['count', 'pct'] as const).map((m) => (
                        <button key={m} onClick={() => setMatrixMode(m)} className={cn('px-2 py-1 rounded text-[10px] flex items-center gap-1', matrixMode === m ? 'bg-accent/20 text-accent-soft' : 'text-text-faint')}>
                          {m === 'count' ? <Hash size={10} /> : <Percent size={10} />}{m}
                        </button>
                      ))}
                    </div>
                  }
                />
                <div className="p-3">
                  <ConfusionMatrix confusion={matrixMode === 'count' ? change.confusion : percentify(change.confusion)} />
                </div>
              </Card>

              <Card className="p-4">
                <CardHeader title="Precision–recall curve" subtitle="Operating point tracks the sensitivity slider everywhere in the app" />
                <div className="p-3 space-y-3">
                  <PRCurve points={change.prCurve} operatingThreshold={threshold} />
                  <Slider value={sensitivity} onChange={setSensitivity} leftLabel="precision" rightLabel="recall" />
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-text-muted">at threshold <span className="mono text-text-primary">{threshold.toFixed(2)}</span></span>
                    <span className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-text-muted">precision <AnimatedNumber value={Math.round(live.precision * 100)} suffix="%" className="mono text-status-good font-medium" /></span>
                      <span className="flex items-center gap-1 text-text-muted">recall <AnimatedNumber value={Math.round(live.recall * 100)} suffix="%" className="mono text-accent-soft font-medium" /></span>
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="p-4">
              <CardHeader title="False-alarm rate by confounder" subtitle="Before vs. after the suppression gates" />
              <div className="p-3 space-y-3">
                <div className="rounded-md border border-status-good/30 bg-status-good/10 px-3 py-2 text-[12px] text-text-secondary">
                  Across every confounder, the suppression gauntlet cuts false alarms by <AnimatedNumber value={Math.round(overallReduction * 100)} suffix="%" className="mono text-status-good font-semibold" /> overall.
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={change.falseAlarmByConfounder} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
                    <CartesianGrid stroke="var(--color-border-subtle)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="confounder" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} stroke="var(--color-border)" interval={0} angle={-12} textAnchor="end" height={56} />
                    <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} stroke="var(--color-border)" />
                    <RTooltip contentStyle={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)', fontSize: 11, borderRadius: 6 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="before" name="Before gates" fill="var(--color-status-bad)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="after" name="After gates" fill="var(--color-status-good)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </motion.div>
        )}

        {tab === 'performance' && (
          <motion.div key="performance" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <StatTile label="Ingest throughput" value={performance.ingestTilesPerSec} sub="tiles/s" />
              <StatTile label="Index build time" value={performance.indexBuildTimeS} sub="s" delay={0.03} />
              <StatTile label="Incremental insert" value={performance.incrementalInsertMs} sub="ms" delay={0.06} />
              <StatTile label="Storage / 1,000 tiles" value={performance.storagePerThousandTilesMb} sub="MB" delay={0.09} />
              <StatTile label="Query latency p50" value={performance.queryLatencyP50Ms} sub="ms" delay={0.12} />
              <StatTile label="Query latency p95" value={performance.queryLatencyP95Ms} sub="ms" delay={0.15} />
            </div>

            <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-2">
              <Card className="p-4">
                <div className="grid grid-cols-2 gap-4 text-[11px]">
                  <div><div className="text-text-faint mb-1">Hardware</div><div className="mono text-text-secondary">{performance.hardware}</div></div>
                  <div><div className="text-text-faint mb-1">Git commit</div><div className="mono text-text-secondary">{performance.gitCommit}</div></div>
                </div>
              </Card>

              <Card className="p-4">
                <CardHeader title="Recent embed times" subtitle="Last 12 ingest jobs, most recent on the right" />
                {embedTimeline.length === 0 ? (
                  <div className="p-3 text-[11px] text-text-faint">No ingest jobs yet — drop a scene in Data manager.</div>
                ) : (
                  <div className="p-3 flex items-end gap-1 h-20">
                    {embedTimeline.map((j) => (
                      <Tooltip key={j.id} content={`${j.filename} · ${((j.embedMs ?? 0) / 1000).toFixed(2)} s`}>
                        <motion.div initial={{ height: 0 }} animate={{ height: `${((j.embedMs ?? 0) / maxEmbed) * 100}%` }} transition={{ duration: 0.5 }} className="flex-1 min-w-[6px] bg-accent-soft/70 hover:bg-accent-soft rounded-t-sm" />
                      </Tooltip>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[12px] text-text-secondary">
                <Database size={14} className="text-accent-soft" />
                <span><span className="mono text-text-primary font-medium">{MODELS.length}</span> models registered, <span className="mono text-text-primary font-medium">{(totalModelMb / 1024).toFixed(1)} GB</span> on disk.</span>
              </div>
              <RouterButton onClick={() => navigate('/data')}>Model registry <ExternalLink size={12} /></RouterButton>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Drawer open={previewOpen} onClose={() => setPreviewOpen(false)} title="Evaluation report preview" subtitle="Exactly what will be downloaded" width="w-[620px]">
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" icon={copied ? <CopyCheck size={12} /> : <Copy size={12} />} onClick={copyReport}>{copied ? 'Copied' : 'Copy markdown'}</Button>
            <Button size="sm" variant="primary" icon={<Download size={12} />} onClick={downloadReport}>Download .md</Button>
          </div>
          <pre className="text-[10px] mono text-text-secondary bg-bg-raised border border-border rounded-lg p-3 overflow-auto max-h-[70vh] whitespace-pre-wrap">{reportMarkdown}</pre>
        </div>
      </Drawer>

      <Drawer open={helpOpen} onClose={() => setHelpOpen(false)} title="How this report works" subtitle="What every number means, and where it comes from" width="w-[520px]">
        <div className="p-4 space-y-4 text-[12px] text-text-secondary leading-relaxed">
          {[
            ['Recall@k', 'Out of every held-out query, the share where a truly relevant tile appeared in the top k results. Recall@1 is the hardest and most honest of the three.'],
            ['mAP & nDCG@10', 'Average precision rewards relevant tiles appearing early, averaged across all queries. nDCG does the same but discounts results the further down the list they sit.'],
            ['Precision vs. recall (change)', 'Precision asks "when it reports something, is it right?" Recall asks "does it miss anything?" The two trade off — the slider here moves the same confidence cut-off used on the Change analysis screen, and every screen that quotes it agrees.'],
            ['Confusion matrix', 'Rows are the true type, columns are what the system called it. The diagonal is agreement; anything off it is a specific kind of mistake worth looking at.'],
            ['False-alarm rate', 'The no-change test suite, broken down by what could have fooled a naive system — season, cloud, shadow, angle, drift, misregistration — measured before and after the suppression gates run.'],
            ['Performance', "Ingest throughput, build and query times, and storage footprint — read live from the same index Data manager reports on, plus the exact model checksums that produced these numbers."],
            ['Export report', 'Bundles every number on this page, plus the git commit and model checksums, into one Markdown document — so a result can always be traced back to exactly the code and weights that produced it.'],
          ].map(([t, d]) => (<div key={t}><div className="text-[11px] font-semibold text-text-primary mb-0.5">{t}</div>{d}</div>))}
        </div>
      </Drawer>
    </div>
  );
}

function percentify(confusion: Record<ChangeType, Record<ChangeType, number>>): Record<ChangeType, Record<ChangeType, number>> {
  const out = {} as Record<ChangeType, Record<ChangeType, number>>;
  TYPES.forEach((r) => {
    const total = TYPES.reduce((s, c) => s + confusion[r][c], 0) || 1;
    out[r] = {} as Record<ChangeType, number>;
    TYPES.forEach((c) => { out[r][c] = Math.round((confusion[r][c] / total) * 100); });
  });
  return out;
}

function RouterButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" onClick={onClick}>
      <span className="flex items-center gap-1.5">{children}</span>
    </Button>
  );
}
