import type { CSSProperties, ReactNode } from 'react';
import type { Tile, TilePattern } from '../../lib/types';
import { cn } from '../../lib/utils';

const PATTERN_TEXTURE: Record<TilePattern, string> = {
  urban:
    'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 2px, transparent 2px 9px), repeating-linear-gradient(90deg, rgba(0,0,0,0.18) 0 2px, transparent 2px 9px)',
  bare: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12), transparent 45%), radial-gradient(circle at 70% 65%, rgba(0,0,0,0.15), transparent 40%)',
  vegetation:
    'radial-gradient(circle at 20% 20%, rgba(0,0,0,0.12) 0 3px, transparent 4px), radial-gradient(circle at 55% 50%, rgba(0,0,0,0.12) 0 3px, transparent 4px), radial-gradient(circle at 80% 75%, rgba(0,0,0,0.12) 0 3px, transparent 4px)',
  water: 'repeating-linear-gradient(100deg, rgba(255,255,255,0.10) 0 3px, transparent 3px 14px)',
  road: 'linear-gradient(100deg, transparent 42%, rgba(255,255,255,0.35) 46%, rgba(255,255,255,0.35) 50%, transparent 54%)',
  quarry:
    'radial-gradient(circle at 35% 40%, rgba(0,0,0,0.28) 0 12%, transparent 13%), radial-gradient(circle at 65% 60%, rgba(0,0,0,0.22) 0 10%, transparent 11%)',
  airport: 'linear-gradient(180deg, transparent 46%, rgba(0,0,0,0.35) 48%, rgba(0,0,0,0.35) 52%, transparent 54%)',
  mixed: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 4px, transparent 4px 12px)',
};

interface Props {
  tile: Tile;
  size?: number | string;
  saliency?: { x: number; y: number; r: number }[];
  selected?: boolean;
  hovered?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  cornerBadge?: ReactNode;
  className?: string;
  rounded?: string;
}

export function TileThumb({
  tile,
  size = '100%',
  saliency,
  selected,
  hovered,
  onClick,
  onMouseEnter,
  onMouseLeave,
  cornerBadge,
  className,
  rounded = 'rounded-md',
}: Props) {
  // A percentage size only fixes the width; height comes from the caller's h-* class,
  // since a percentage height inside an auto-height parent collapses to zero.
  const dims: CSSProperties = typeof size === 'number' ? { width: size, height: size } : { width: size };
  const imageStyle: CSSProperties = tile.imageUrl
    ? {
        ...dims,
        backgroundImage: `url(${tile.imageUrl})`,
        backgroundSize: '400% 400%', // 4x4 sprite crop — see cropPositionFor in mockData.ts
        backgroundPosition: tile.cropPosition ?? '0% 0%',
      }
    : { ...dims, background: tile.thumbColor, backgroundImage: PATTERN_TEXTURE[tile.thumbPattern] };

  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'relative overflow-hidden shrink-0 transition-shadow',
        rounded,
        onClick && 'cursor-pointer',
        selected ? 'ring-2 ring-accent-soft' : hovered ? 'ring-2 ring-white/60' : 'ring-1 ring-black/40',
        className
      )}
      style={imageStyle}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
      {saliency?.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${b.x * 100}%`,
            top: `${b.y * 100}%`,
            width: `${b.r * 200}%`,
            height: `${b.r * 200}%`,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(255,80,60,0.55) 0%, rgba(255,80,60,0.0) 70%)',
            mixBlendMode: 'screen',
          }}
        />
      ))}
      {cornerBadge && <div className="absolute top-1 right-1">{cornerBadge}</div>}
      {tile.cloudFrac > 0.3 && (
        <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px]" title="Partly cloudy" />
      )}
    </div>
  );
}
