import { cn } from '../../lib/utils';

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface Props {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className }: Props) {
  return (
    <div className={cn('flex items-center gap-1 border-b border-border-subtle', className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5',
            active === t.id
              ? 'border-accent text-text-primary'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-raised text-text-muted">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
