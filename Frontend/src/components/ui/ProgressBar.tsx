import { cn } from '../../lib/utils';

export function ProgressBar({ value, color, className, thin }: { value: number; color?: string; className?: string; thin?: boolean }) {
  return (
    <div className={cn('w-full bg-bg-raised rounded-full overflow-hidden', thin ? 'h-1' : 'h-1.5', className)}>
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color ?? 'var(--color-accent)' }}
      />
    </div>
  );
}
