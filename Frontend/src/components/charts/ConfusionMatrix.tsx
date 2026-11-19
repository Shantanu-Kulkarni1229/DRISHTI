import { CHANGE_TYPE_COLORS, CHANGE_TYPE_LABELS } from '../../lib/colors';
import type { ChangeType } from '../../lib/types';

const TYPES: ChangeType[] = ['construction', 'clearance', 'water', 'roads'];

export function ConfusionMatrix({ confusion }: { confusion: Record<ChangeType, Record<ChangeType, number>> }) {
  const max = Math.max(...TYPES.flatMap((r) => TYPES.map((c) => confusion[r][c])));

  return (
    <div className="overflow-x-auto">
      <table className="text-[11px] border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-24" />
            <th colSpan={TYPES.length} className="text-text-muted font-normal pb-1">
              Predicted
            </th>
          </tr>
          <tr>
            <th className="text-text-muted font-normal text-right pr-2">Actual</th>
            {TYPES.map((t) => (
              <th key={t} className="font-medium pb-1 px-1" style={{ color: CHANGE_TYPE_COLORS[t] }}>
                {CHANGE_TYPE_LABELS[t].split(' ')[0]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TYPES.map((r) => (
            <tr key={r}>
              <td className="text-right pr-2 font-medium" style={{ color: CHANGE_TYPE_COLORS[r] }}>
                {CHANGE_TYPE_LABELS[r].split(' ')[0]}
              </td>
              {TYPES.map((c) => {
                const v = confusion[r][c];
                const intensity = v / (max || 1);
                const isDiag = r === c;
                return (
                  <td key={c} className="w-12 h-10 text-center rounded mono font-medium"
                    style={{
                      background: isDiag
                        ? `color-mix(in srgb, var(--color-status-good) ${20 + intensity * 60}%, var(--color-bg-raised))`
                        : v > 0
                        ? `color-mix(in srgb, var(--color-status-bad) ${20 + intensity * 50}%, var(--color-bg-raised))`
                        : 'var(--color-bg-raised)',
                      color: v > 0 ? 'var(--color-text-primary)' : 'var(--color-text-faint)',
                    }}
                  >
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
