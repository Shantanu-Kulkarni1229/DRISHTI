import type { SuppressionFactor } from '../../lib/types';
import { ProgressBar } from '../ui/ProgressBar';

function colorFor(v: number) {
  if (v >= 0.75) return 'var(--color-status-good)';
  if (v >= 0.5) return 'var(--color-status-warn)';
  return 'var(--color-status-bad)';
}

export function ConfidenceBars({ factors }: { factors: SuppressionFactor[] }) {
  return (
    <div className="space-y-2.5">
      {factors.map((f) => (
        <div key={f.gate}>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-text-secondary">{f.label}</span>
            <span className="mono text-text-muted">{Math.round(f.value * 100)}%</span>
          </div>
          <ProgressBar value={f.value * 100} color={colorFor(f.value)} thin />
        </div>
      ))}
    </div>
  );
}
