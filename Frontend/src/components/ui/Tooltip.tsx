import { useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {children}
      {open && (
        <span
          className={cn(
            'absolute z-50 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-bg-raised border border-border px-2 py-1 text-[11px] text-text-primary shadow-lg pointer-events-none',
            side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
