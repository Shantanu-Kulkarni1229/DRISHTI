import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface Props {
  children: ReactNode;
  color?: string;
  variant?: 'solid' | 'outline' | 'dot';
  className?: string;
}

export function Badge({ children, color, variant = 'outline', className }: Props) {
  if (variant === 'dot') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-xs text-text-secondary', className)}>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color ?? 'var(--color-accent)' }} />
        {children}
      </span>
    );
  }
  if (variant === 'solid') {
    return (
      <span
        className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium text-black', className)}
        style={{ background: color ?? 'var(--color-accent)' }}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium', className)}
      style={{ borderColor: color ? `${color}66` : 'var(--color-border)', color: color ?? 'var(--color-text-secondary)' }}
    >
      {children}
    </span>
  );
}
