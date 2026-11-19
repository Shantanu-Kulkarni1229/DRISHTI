import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { CropFraction } from '../../lib/mockData';
import { cn } from '../../lib/utils';

interface Props {
  imageUrl?: string;
  cropFrac?: CropFraction;
  label?: string;
  zoom?: number; // total magnification relative to the full source frame
  lensSize?: number; // px
  className?: string;
  disabled?: boolean;
  children: ReactNode;
}

const DEFAULT_FRAC: CropFraction = { left: 0, right: 1, top: 0, bottom: 1 };

export function ImageMagnifier({
  imageUrl,
  cropFrac = DEFAULT_FRAC,
  label,
  zoom = 10,
  lensSize = 176,
  className,
  disabled,
  children,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [lens, setLens] = useState<{ x: number; y: number; bgX: number; bgY: number } | null>(null);

  const active = !disabled && !!imageUrl;

  const handleMove = (e: React.MouseEvent) => {
    if (!active) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const my = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const fracX = cropFrac.left + mx * (cropFrac.right - cropFrac.left);
    const fracY = cropFrac.top + my * (cropFrac.bottom - cropFrac.top);

    const k = zoom;
    const bgX = Math.min(100, Math.max(0, ((0.5 - fracX * k) / (1 - k)) * 100));
    const bgY = Math.min(100, Math.max(0, ((0.5 - fracY * k) / (1 - k)) * 100));

    const pad = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = e.clientX + 22;
    let top = e.clientY - lensSize / 2;
    if (left + lensSize + pad > vw) left = e.clientX - lensSize - 22;
    top = Math.min(Math.max(top, pad), vh - lensSize - pad);

    setLens({ x: left, y: top, bgX, bgY });
  };

  return (
    <div
      ref={wrapRef}
      className={cn('relative', active && 'cursor-crosshair', className)}
      onMouseMove={handleMove}
      onMouseLeave={() => setLens(null)}
    >
      {children}
      {active &&
        lens &&
        createPortal(
          <div
            className="fixed z-[999] pointer-events-none rounded-full border-2 border-accent-soft shadow-2xl overflow-hidden"
            style={{
              left: lens.x,
              top: lens.y,
              width: lensSize,
              height: lensSize,
              boxShadow: '0 0 0 1px rgba(0,0,0,0.5), 0 8px 28px rgba(0,0,0,0.55), 0 0 24px -4px var(--color-accent-soft)',
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${imageUrl})`,
                backgroundSize: `${zoom * 100}% ${zoom * 100}%`,
                backgroundPosition: `${lens.bgX}% ${lens.bgY}%`,
              }}
            />
            {/* rangefinder reticle */}
            <div className="absolute inset-0">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-accent-soft/40" />
              <div className="absolute top-1/2 left-0 right-0 h-px bg-accent-soft/40" />
              <div className="absolute left-1/2 top-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent-soft" />
              {[
                'top-1.5 left-1.5 border-t border-l',
                'top-1.5 right-1.5 border-t border-r',
                'bottom-1.5 left-1.5 border-b border-l',
                'bottom-1.5 right-1.5 border-b border-r',
              ].map((pos) => (
                <div key={pos} className={cn('absolute w-3 h-3 border-accent-soft/70', pos)} />
              ))}
            </div>
            {label && (
              <div className="absolute bottom-0 left-0 right-0 text-center text-[9px] mono text-white/90 bg-black/60 py-0.5 truncate px-1">
                {label} · {zoom}x
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
