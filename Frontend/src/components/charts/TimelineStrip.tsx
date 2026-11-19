import { USABILITY_COLORS } from '../../lib/colors';
import { formatDateShort } from '../../lib/utils';
import { Tooltip } from '../ui/Tooltip';
import type { Acquisition } from '../../lib/types';

interface Props {
  acquisitions: Acquisition[];
  selectedDate?: string | null;
  onSelect?: (date: string) => void;
  intervalStart?: string;
  intervalEnd?: string;
  markerDate?: string;
  markerLabel?: string;
}

export function TimelineStrip({ acquisitions, selectedDate, onSelect, intervalStart, intervalEnd, markerDate, markerLabel }: Props) {
  const n = acquisitions.length;
  const idxOf = (d: string) => acquisitions.findIndex((a) => a.date === d);
  const startIdx = intervalStart ? idxOf(intervalStart) : -1;
  const endIdx = intervalEnd ? idxOf(intervalEnd) : -1;
  const markerIdx = markerDate ? idxOf(markerDate) : -1;

  return (
    <div className="w-full">
      {(startIdx >= 0 || markerIdx >= 0) && (
        <div className="relative h-4 mb-0.5">
          {startIdx >= 0 && endIdx >= 0 && (
            <div
              className="absolute h-1.5 bg-status-warn/50 border border-status-warn rounded-full top-1"
              style={{ left: `${(startIdx / n) * 100}%`, width: `${((endIdx - startIdx + 1) / n) * 100}%` }}
              title="Earliest-supported-observation interval"
            />
          )}
          {markerIdx >= 0 && (
            <div
              className="absolute -top-0.5 text-[9px] mono text-accent-soft whitespace-nowrap"
              style={{ left: `${(markerIdx / n) * 100}%` }}
            >
              ▼ {markerLabel ?? 'change point'}
            </div>
          )}
        </div>
      )}
      <div className="flex items-end gap-[2px] h-8">
        {acquisitions.map((a) => (
          <Tooltip key={a.date} content={`${a.date} · ${a.sensor} · ${a.cloudPct}% cloud · ${a.usability.replace('_', ' ')}`}>
            <button
              onClick={() => onSelect?.(a.date)}
              className="flex-1 min-w-[2px] rounded-sm transition-transform hover:scale-y-110 origin-bottom"
              style={{
                height: a.usability === 'clear' ? '100%' : a.usability === 'partly_cloudy' ? '70%' : '40%',
                background: USABILITY_COLORS[a.usability],
                outline: selectedDate === a.date ? '2px solid var(--color-accent-soft)' : 'none',
              }}
            />
          </Tooltip>
        ))}
      </div>
      <div className="flex justify-between text-[10px] mono text-text-faint mt-1">
        <span>{formatDateShort(acquisitions[0]?.date ?? '')}</span>
        <span>{formatDateShort(acquisitions[acquisitions.length - 1]?.date ?? '')}</span>
      </div>
    </div>
  );
}
