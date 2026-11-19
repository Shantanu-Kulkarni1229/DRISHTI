import { ChevronRight } from 'lucide-react';
import { formatNumber } from '../../lib/utils';
import { cn } from '../../lib/utils';

export interface FunnelStage {
  id: string;
  label: string;
  count: number;
  droppedLabel?: string;
  clickable?: boolean;
}

export function SuppressionFunnel({ stages, onInspect }: { stages: FunnelStage[]; onInspect?: (id: string) => void }) {
  const maxCount = Math.max(...stages.map((s) => s.count), 1);
  const widthFor = (count: number) => Math.max(6, (Math.log(count + 1) / Math.log(maxCount + 1)) * 100);

  return (
    <div className="space-y-2.5">
      {stages.map((stage, i) => {
        const prev = stages[i - 1];
        const dropped = prev ? prev.count - stage.count : 0;
        return (
          <div key={stage.id}>
            <button
              disabled={!stage.clickable}
              onClick={() => stage.clickable && onInspect?.(stage.id)}
              className={cn(
                'w-full text-left group',
                stage.clickable && 'cursor-pointer'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-secondary">{stage.label}</span>
                <span className="mono text-xs text-text-primary font-medium">{formatNumber(stage.count)}</span>
              </div>
              <div className="h-5 bg-bg-raised rounded overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded bg-accent/70 transition-all duration-300',
                    stage.clickable && 'group-hover:bg-accent-soft'
                  )}
                  style={{ width: `${widthFor(stage.count)}%` }}
                />
              </div>
            </button>
            {i > 0 && dropped > 0 && (
              <button
                onClick={() => stage.clickable && onInspect?.(stages[i - 1].id)}
                className="flex items-center gap-1 text-[11px] text-text-muted hover:text-accent-soft mt-1 pl-1"
              >
                <ChevronRight size={11} />
                why were {formatNumber(dropped)} dropped{stage.droppedLabel ? ` — ${stage.droppedLabel}` : ''}?
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
