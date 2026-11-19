import { AOIS } from '../../lib/mockData';
import { useFilterStore } from '../../state/filterStore';
import { useIngestStore } from '../../state/ingestStore';
import { formatBytes, formatNumber } from '../../lib/utils';
import { OfflineBadge } from './OfflineBadge';
import type { Sensor } from '../../lib/types';

const SENSOR_OPTIONS: Sensor[] = ['S2', 'S1', 'L8'];

export function TopBar() {
  const { aoiId, dateFrom, dateTo, sensors, maxCloud, setAoi, setDateRange, toggleSensor, setMaxCloud } = useFilterStore();
  const indexStats = useIngestStore((s) => s.indexStats);

  return (
    <header className="shrink-0 border-b border-border-subtle bg-bg-base flex flex-wrap items-center gap-x-3 gap-y-2 px-3 sm:px-4 py-2 min-h-14">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-accent/20 border border-accent/40 flex items-center justify-center">
          <span className="text-accent-soft text-xs font-bold">D</span>
        </div>
        <span className="text-sm font-semibold tracking-tight hidden lg:inline">Drishti AI</span>
      </div>

      <div className="h-6 w-px bg-border-subtle hidden lg:block" />

      <label className="flex items-center gap-1.5 text-xs text-text-muted min-w-0">
        <span className="hidden sm:inline">AOI</span>
        <select
          value={aoiId}
          onChange={(e) => setAoi(e.target.value)}
          className="bg-bg-raised border border-border rounded px-2 py-1 text-xs text-text-primary max-w-[150px] sm:max-w-[220px] focus:outline-none focus:ring-1 focus:ring-accent-soft"
        >
          {AOIS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-xs text-text-muted">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateRange(e.target.value, dateTo)}
          className="bg-bg-raised border border-border rounded px-1.5 py-1 text-[11px] mono text-text-primary w-[112px] focus:outline-none focus:ring-1 focus:ring-accent-soft"
        />
        <span>&rarr;</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateRange(dateFrom, e.target.value)}
          className="bg-bg-raised border border-border rounded px-1.5 py-1 text-[11px] mono text-text-primary w-[112px] focus:outline-none focus:ring-1 focus:ring-accent-soft"
        />
      </label>

      <div className="flex items-center gap-1">
        {SENSOR_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => toggleSensor(s)}
            className={`px-2 py-1 text-[11px] rounded border font-medium mono transition-colors ${
              sensors.includes(s)
                ? 'bg-accent/20 border-accent/50 text-accent-soft'
                : 'bg-transparent border-border text-text-faint hover:text-text-muted'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-1.5 text-xs text-text-muted">
        cloud &le;
        <input
          type="range"
          min={0}
          max={100}
          value={maxCloud}
          onChange={(e) => setMaxCloud(parseInt(e.target.value))}
          className="w-16 accent-[var(--color-accent)]"
        />
        <span className="mono text-text-secondary w-8">{maxCloud}%</span>
      </label>

      <div className="flex-1" />

      <div className="hidden 2xl:flex items-center gap-3 text-[11px] mono text-text-muted">
        <span>{formatNumber(indexStats.tileCount)} tiles</span>
        <span className="text-text-faint">·</span>
        <span>{formatBytes(indexStats.indexSizeBytes)}</span>
      </div>

      <OfflineBadge />
    </header>
  );
}
