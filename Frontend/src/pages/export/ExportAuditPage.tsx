import { useMemo, useState } from 'react';
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileCode2,
  FileText,
  ShieldCheck,
  ShieldAlert,
  ListChecks,
  History,
  Database,
} from 'lucide-react';
import { CHANGE_CANDIDATES } from '../../lib/mockData';
import { CHANGE_TYPE_COLORS, CHANGE_TYPE_LABELS } from '../../lib/colors';
import { useReviewStore } from '../../state/reviewStore';
import { useAuditStore } from '../../state/auditStore';
import { formatDate, formatNumber, downloadTextFile } from '../../lib/utils';
import { Tabs } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader } from '../../components/ui/Card';
import { Tooltip } from '../../components/ui/Tooltip';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  buildExportFeature,
  buildBriefHTML,
  toGeoJSON,
  toCSV,
  toKML,
  toSTACItems,
  toAuditCSV,
  toAuditJSON,
} from './exportFormats';
import type { ChangeCandidate } from '../../lib/types';

const STATUS_COLOR: Record<string, string> = {
  accepted: 'var(--color-status-good)',
  rejected: 'var(--color-status-bad)',
  pending: 'var(--color-text-muted)',
};

type ExportFormat = 'geojson' | 'csv' | 'kml' | 'stac' | 'brief';

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export function ExportAuditPage() {
  const [tab, setTab] = useState<'export' | 'audit'>('export');
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 pt-3 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-text-primary">Export &amp; audit</h1>
          <p className="text-[11px] text-text-muted">Get results out with their history intact.</p>
        </div>
        <Tabs
          tabs={[
            { id: 'export', label: 'Export' },
            { id: 'audit', label: 'Audit log' },
          ]}
          active={tab}
          onChange={(id) => setTab(id as 'export' | 'audit')}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {tab === 'export' ? <ExportTab /> : <AuditTab />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export tab
// ---------------------------------------------------------------------------

function ExportTab() {
  const { statusMap, decisions, actor, statusFor } = useReviewStore();
  const append = useAuditStore((s) => s.append);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Only "reported" candidates (survived suppression) are realistic export
  // material — suppressed ones were dropped as noise, not confirmed changes.
  const candidates = useMemo(() => CHANGE_CANDIDATES.filter((c) => c.suppressedBy === null), []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllAccepted = () => {
    setSelected(new Set(candidates.filter((c) => statusFor(c.id).status === 'accepted').map((c) => c.id)));
  };
  const clearSelection = () => setSelected(new Set());

  const selectedCandidates = useMemo(
    () => candidates.filter((c) => selected.has(c.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidates, selected, statusMap]
  );

  const features = useMemo(
    () =>
      selectedCandidates.map((c) =>
        buildExportFeature(c, statusFor(c.id), decisions.find((d) => d.candidateId === c.id))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCandidates, decisions]
  );

  function runExport(format: ExportFormat) {
    if (selectedCandidates.length === 0) return;
    const stamp = timestamp();
    let filename = '';
    let content = '';
    let mime = 'text/plain';
    switch (format) {
      case 'geojson':
        filename = `drishti-export-${stamp}.geojson`;
        content = toGeoJSON(features);
        mime = 'application/geo+json';
        break;
      case 'csv':
        filename = `drishti-export-${stamp}.csv`;
        content = toCSV(features.map((f) => f.properties));
        mime = 'text/csv';
        break;
      case 'kml':
        filename = `drishti-export-${stamp}.kml`;
        content = toKML(features);
        mime = 'application/vnd.google-earth.kml+xml';
        break;
      case 'stac':
        filename = `drishti-export-${stamp}.stac.json`;
        content = toSTACItems(features);
        mime = 'application/json';
        break;
      case 'brief':
        filename = `drishti-brief-${stamp}.html`;
        content = buildBriefHTML(selectedCandidates, statusFor, decisions);
        mime = 'text/html';
        break;
    }
    downloadTextFile(filename, content, mime);
    append({
      actor,
      action: `export.${format === 'brief' ? 'brief_html' : format}`,
      targetType: 'export',
      targetId: filename,
      payload: { candidateIds: selectedCandidates.map((c) => c.id), count: selectedCandidates.length },
    });
  }

  const acceptedCount = candidates.filter((c) => statusFor(c.id).status === 'accepted').length;

  return (
    <div className="grid grid-cols-[1fr_360px] gap-4 h-full min-h-0">
      <Card className="flex flex-col min-h-0">
        <CardHeader
          title={`Candidates (${candidates.length})`}
          subtitle={`${acceptedCount} accepted · ${selected.size} selected`}
          right={
            <div className="flex gap-1.5">
              <Button size="xs" variant="outline" icon={<ListChecks size={12} />} onClick={selectAllAccepted}>
                select all accepted
              </Button>
              <Button size="xs" variant="ghost" onClick={clearSelection} disabled={selected.size === 0}>
                clear
              </Button>
            </div>
          }
        />
        <div className="overflow-y-auto flex-1 min-h-0">
          <table className="w-full text-[11px] border-collapse">
            <thead className="sticky top-0 bg-bg-panel z-10">
              <tr className="text-text-muted">
                <th className="w-8 px-2 py-1.5 text-left"></th>
                <th className="px-2 py-1.5 text-left">ID</th>
                <th className="px-2 py-1.5 text-left">Type</th>
                <th className="px-2 py-1.5 text-right">Confidence</th>
                <th className="px-2 py-1.5 text-left">Status</th>
                <th className="px-2 py-1.5 text-right">Area (m²)</th>
                <th className="px-2 py-1.5 text-left">Before</th>
                <th className="px-2 py-1.5 text-left">After</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <CandidateRow
                  key={c.id}
                  candidate={c}
                  checked={selected.has(c.id)}
                  onToggle={() => toggle(c.id)}
                  status={statusFor(c.id).status}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-col gap-3 min-h-0">
        <Card className="p-3 space-y-2">
          <div className="text-[11px] font-medium text-text-muted">Export selected ({selected.size})</div>
          <div className="grid grid-cols-2 gap-1.5">
            <Button size="sm" variant="secondary" icon={<FileJson size={13} />} disabled={selected.size === 0} onClick={() => runExport('geojson')}>
              GeoJSON
            </Button>
            <Button size="sm" variant="secondary" icon={<FileSpreadsheet size={13} />} disabled={selected.size === 0} onClick={() => runExport('csv')}>
              CSV
            </Button>
            <Button size="sm" variant="secondary" icon={<FileCode2 size={13} />} disabled={selected.size === 0} onClick={() => runExport('kml')}>
              KML
            </Button>
            <Button size="sm" variant="secondary" icon={<Database size={13} />} disabled={selected.size === 0} onClick={() => runExport('stac')}>
              STAC items
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<FileText size={13} />}
              disabled={selected.size === 0}
              onClick={() => runExport('brief')}
              className="col-span-2"
            >
              Export brief (HTML)
            </Button>
          </div>
          <Tooltip content="GeoPackage is a binary SQLite container — not honestly producible client-side in this prototype.">
            <span className="inline-flex">
              <Button size="sm" variant="ghost" disabled className="col-span-2 opacity-40 cursor-not-allowed">
                GeoPackage (unavailable)
              </Button>
            </span>
          </Tooltip>
        </Card>

        <Card className="flex-1 min-h-0 flex flex-col">
          <CardHeader title="Attribute preview" subtitle="What will be written to the export file" />
          <div className="flex-1 min-h-0 overflow-auto p-0">
            {features.length === 0 ? (
              <EmptyState title="No candidates selected" description="Check rows on the left, or use “select all accepted”." />
            ) : (
              <table className="text-[11px] border-collapse w-max">
                <thead className="sticky top-0 bg-bg-panel">
                  <tr>
                    {Object.keys(features[0].properties).map((k) => (
                      <th key={k} className="text-left px-2 py-1 border-b border-border-subtle text-text-muted whitespace-nowrap">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {features.map((f) => (
                    <tr key={String(f.properties.candidate_id)} className="border-b border-border-subtle/60">
                      {Object.values(f.properties).map((v, i) => (
                        <td key={i} className="px-2 py-1 mono whitespace-nowrap text-text-secondary">
                          {String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function CandidateRow({
  candidate,
  checked,
  onToggle,
  status,
}: {
  candidate: ChangeCandidate;
  checked: boolean;
  onToggle: () => void;
  status: string;
}) {
  return (
    <tr className={checked ? 'bg-bg-hover' : 'hover:bg-bg-hover/50'}>
      <td className="px-2 py-1">
        <input type="checkbox" checked={checked} onChange={onToggle} className="accent-[var(--color-accent)]" />
      </td>
      <td className="px-2 py-1 mono text-text-secondary">{candidate.id}</td>
      <td className="px-2 py-1">
        <Badge color={CHANGE_TYPE_COLORS[candidate.type]} variant="dot">
          {CHANGE_TYPE_LABELS[candidate.type]}
        </Badge>
      </td>
      <td className="px-2 py-1 mono text-right text-text-secondary">{Math.round(candidate.confidence * 100)}%</td>
      <td className="px-2 py-1">
        <Badge color={STATUS_COLOR[status]}>{status}</Badge>
      </td>
      <td className="px-2 py-1 text-right text-text-secondary">{formatNumber(candidate.areaM2)}</td>
      <td className="px-2 py-1 mono text-text-faint">{candidate.earliestIntervalStart}</td>
      <td className="px-2 py-1 mono text-text-faint">{candidate.earliestIntervalEnd}</td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Audit log tab
// ---------------------------------------------------------------------------

function checkChain(entries: { prevHash: string; hash: string }[]): { intact: boolean; breakAt: number | null } {
  for (let i = 0; i < entries.length - 1; i++) {
    if (entries[i].prevHash !== entries[i + 1].hash) return { intact: false, breakAt: i };
  }
  return { intact: true, breakAt: null };
}

function AuditTab() {
  const { entries, append } = useAuditStore();
  const actor = useReviewStore((s) => s.actor);
  const [filterActor, setFilterActor] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const actors = useMemo(() => Array.from(new Set(entries.map((e) => e.actor))).sort(), [entries]);
  const actions = useMemo(() => Array.from(new Set(entries.map((e) => e.action))).sort(), [entries]);

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        if (filterActor !== 'all' && e.actor !== filterActor) return false;
        if (filterAction !== 'all' && e.action !== filterAction) return false;
        const day = e.createdAt.slice(0, 10);
        if (dateFrom && day < dateFrom) return false;
        if (dateTo && day > dateTo) return false;
        return true;
      }),
    [entries, filterActor, filterAction, dateFrom, dateTo]
  );

  const chain = useMemo(() => checkChain(entries), [entries]);

  function exportLog(format: 'csv' | 'json') {
    const stamp = timestamp();
    if (format === 'csv') {
      downloadTextFile(`drishti-audit-${stamp}.csv`, toAuditCSV(filtered), 'text/csv');
    } else {
      downloadTextFile(`drishti-audit-${stamp}.json`, toAuditJSON(filtered), 'application/json');
    }
    append({
      actor,
      action: `export.audit_log_${format}`,
      targetType: 'export',
      targetId: `drishti-audit-${stamp}.${format}`,
      payload: { count: filtered.length, filterActor, filterAction, dateFrom, dateTo },
    });
  }

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <Card className="p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <History size={13} className="text-text-faint" />
          <span className="text-[11px] text-text-muted">Actor</span>
          <select
            value={filterActor}
            onChange={(e) => setFilterActor(e.target.value)}
            className="bg-bg-raised border border-border rounded px-2 py-1 text-[11px]"
          >
            <option value="all">All</option>
            {actors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-text-muted">Action</span>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-bg-raised border border-border rounded px-2 py-1 text-[11px]"
          >
            <option value="all">All</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-text-muted">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-bg-raised border border-border rounded px-2 py-1 text-[11px] mono"
          />
          <span className="text-[11px] text-text-muted">To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-bg-raised border border-border rounded px-2 py-1 text-[11px] mono"
          />
        </div>

        <div className="ml-auto flex items-center gap-3">
          {chain.intact ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-status-good">
              <ShieldCheck size={13} /> chain intact
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-status-bad">
              <ShieldAlert size={13} /> break detected at entry {chain.breakAt}
            </span>
          )}
          <Button size="xs" variant="outline" icon={<Download size={12} />} onClick={() => exportLog('csv')}>
            export CSV
          </Button>
          <Button size="xs" variant="outline" icon={<Download size={12} />} onClick={() => exportLog('json')}>
            export JSON
          </Button>
        </div>
      </Card>

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader title={`Audit entries (${filtered.length} of ${entries.length})`} subtitle="Append-only, hash-chained newest first" />
        <div className="flex-1 min-h-0 overflow-auto">
          {filtered.length === 0 ? (
            <EmptyState title="No entries match these filters" />
          ) : (
            <table className="w-full text-[11px] border-collapse">
              <thead className="sticky top-0 bg-bg-panel z-10">
                <tr className="text-text-muted">
                  <th className="px-2 py-1.5 text-left">Timestamp</th>
                  <th className="px-2 py-1.5 text-left">Actor</th>
                  <th className="px-2 py-1.5 text-left">Action</th>
                  <th className="px-2 py-1.5 text-left">Target</th>
                  <th className="px-2 py-1.5 text-left">Model versions</th>
                  <th className="px-2 py-1.5 text-left">Prev hash</th>
                  <th className="px-2 py-1.5 text-left">Hash</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-bg-hover/50 border-b border-border-subtle/60">
                    <td className="px-2 py-1 mono text-text-faint whitespace-nowrap">{formatDate(e.createdAt)}</td>
                    <td className="px-2 py-1 text-text-secondary whitespace-nowrap">{e.actor}</td>
                    <td className="px-2 py-1 text-text-secondary whitespace-nowrap">{e.action}</td>
                    <td className="px-2 py-1 mono text-text-faint whitespace-nowrap">
                      {e.targetType}:{e.targetId}
                    </td>
                    <td className="px-2 py-1 mono text-text-faint whitespace-nowrap">
                      {Object.entries(e.modelVersions)
                        .map(([k, v]) => `${k}:${v}`)
                        .join(' ')}
                    </td>
                    <td className="px-2 py-1 mono text-text-faint whitespace-nowrap">{e.prevHash.slice(0, 12)}</td>
                    <td className="px-2 py-1 mono text-text-secondary whitespace-nowrap">{e.hash.slice(0, 12)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
