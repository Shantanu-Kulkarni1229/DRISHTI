import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'xs';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  active?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-soft border border-accent disabled:opacity-40',
  secondary: 'bg-bg-raised text-text-primary hover:bg-bg-hover border border-border',
  outline: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border',
  ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent',
  danger: 'bg-transparent text-status-bad hover:bg-status-bad/10 border border-status-bad/40',
};

const sizeClasses: Record<Size, string> = {
  xs: 'px-2 py-1 text-[11px] gap-1',
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3.5 py-2 text-sm gap-2',
};

export function Button({ variant = 'secondary', size = 'sm', icon, active, className, children, ...rest }: Props) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors whitespace-nowrap',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        active && 'ring-1 ring-accent-soft bg-bg-hover',
        className
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
