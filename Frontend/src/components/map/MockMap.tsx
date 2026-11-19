import { useRef, useState, useCallback, type ReactNode } from 'react';
import { createProjector, normalizeBox } from '../../lib/geo';
import { cn } from '../../lib/utils';
import { Minus, Plus, Maximize2 } from 'lucide-react';

export interface MapTileLayer {
  id: string;
  bbox: [number, number, number, number];
  color: string;
  opacity?: number;
  pattern?: 'stripe' | 'none';
}

export interface MapPolygon {
  id: string;
  bbox: [number, number, number, number];
  color: string;
  label?: string;
  fillOpacity?: number;
  dashed?: boolean;
}

export interface MapPoint {
  id: string;
  lng: number;
  lat: number;
  color: string;
  label?: string;
  radius?: number;
}

interface Props {
  bbox: [number, number, number, number];
  imageUrl?: string; // real full-frame satellite image covering `bbox`, drawn as the base layer
  imageOpacity?: number;
  tiles?: MapTileLayer[];
  polygons?: MapPolygon[];
  points?: MapPoint[];
  hoveredId?: string | null;
  selectedId?: string | null;
  onHoverId?: (id: string | null) => void;
  onSelectId?: (id: string) => void;
  drawMode?: boolean;
  onDrawComplete?: (bbox: [number, number, number, number]) => void;
  drawnBbox?: [number, number, number, number] | null;
  className?: string;
  height?: number | string;
  showCoordinates?: boolean;
  overlay?: ReactNode;
  label?: string;
}

const VIEW_W = 900;
const VIEW_H = 620;

export function MockMap({
  bbox,
  imageUrl,
  imageOpacity = 1,
  tiles = [],
  polygons = [],
  points = [],
  hoveredId,
  selectedId,
  onHoverId,
  onSelectId,
  drawMode,
  onDrawComplete,
  drawnBbox,
  className,
  height = 420,
  showCoordinates = true,
  overlay,
  label,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [panning, setPanning] = useState(false);
  const [drawStart, setDrawStart] = useState<[number, number] | null>(null);
  const [drawEnd, setDrawEnd] = useState<[number, number] | null>(null);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const projector = createProjector(bbox, VIEW_W, VIEW_H);

  const toViewPoint = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return [0, 0];
      const px = ((clientX - rect.left) / rect.width) * VIEW_W;
      const py = ((clientY - rect.top) / rect.height) * VIEW_H;
      return [px, py];
    },
    []
  );

  const toWorld = useCallback(
    (px: number, py: number): [number, number] => {
      const wx = (px - tx) / scale;
      const wy = (py - ty) / scale;
      return projector.invert(wx, wy);
    },
    [tx, ty, scale, projector]
  );

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const [px, py] = toViewPoint(e.clientX, e.clientY);
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newScale = Math.min(8, Math.max(1, scale * factor));
    const newTx = px - (newScale * (px - tx)) / scale;
    const newTy = py - (newScale * (py - ty)) / scale;
    setScale(newScale);
    setTx(newScale === 1 ? 0 : newTx);
    setTy(newScale === 1 ? 0 : newTy);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const [px, py] = toViewPoint(e.clientX, e.clientY);
    if (drawMode) {
      const world = toWorld(px, py);
      setDrawStart(world);
      setDrawEnd(world);
    } else {
      setPanning(true);
      lastPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const [px, py] = toViewPoint(e.clientX, e.clientY);
    setCursor(toWorld(px, py));
    if (drawMode && drawStart) {
      setDrawEnd(toWorld(px, py));
      return;
    }
    if (panning && lastPos.current) {
      const dxScreen = ((e.clientX - lastPos.current.x) / (svgRef.current?.getBoundingClientRect().width ?? VIEW_W)) * VIEW_W;
      const dyScreen = ((e.clientY - lastPos.current.y) / (svgRef.current?.getBoundingClientRect().height ?? VIEW_H)) * VIEW_H;
      setTx((v) => v + dxScreen);
      setTy((v) => v + dyScreen);
      lastPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    if (drawMode && drawStart && drawEnd) {
      onDrawComplete?.(normalizeBox(drawStart, drawEnd));
      setDrawStart(null);
      setDrawEnd(null);
    }
    setPanning(false);
    lastPos.current = null;
  };

  const resetView = () => {
    setScale(1);
    setTx(0);
    setTy(0);
  };

  const drawRectView = drawStart && drawEnd ? projector.toRect(normalizeBox(drawStart, drawEnd)) : null;
  const drawnBboxView = drawnBbox ? projector.toRect(drawnBbox) : null;

  return (
    <div className={cn('relative bg-[#060a12] rounded-lg overflow-hidden border border-border-subtle select-none', className)} style={{ height }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className={cn('w-full h-full block', drawMode ? 'cursor-crosshair' : panning ? 'cursor-grabbing' : 'cursor-grab')}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <pattern id="map-graticule" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#111a2b" strokeWidth="1" />
          </pattern>
          <pattern id="stripe" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="transparent" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="black" strokeOpacity="0.15" strokeWidth="2" />
          </pattern>
        </defs>

        <rect width={VIEW_W} height={VIEW_H} fill="url(#map-graticule)" />

        <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
          {imageUrl && (() => {
            const r = projector.toRect(bbox);
            return (
              <image
                href={imageUrl}
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                opacity={imageOpacity}
                preserveAspectRatio="none"
                pointerEvents="none"
              />
            );
          })()}
          {tiles.map((t) => {
            const r = projector.toRect(t.bbox);
            return (
              <g key={t.id}>
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.width}
                  height={r.height}
                  fill={t.color}
                  opacity={t.opacity ?? 0.85}
                  onMouseEnter={() => onHoverId?.(t.id)}
                  onMouseLeave={() => onHoverId?.(null)}
                  onClick={() => onSelectId?.(t.id)}
                  className={onSelectId ? 'cursor-pointer' : undefined}
                />
                {t.pattern === 'stripe' && (
                  <rect x={r.x} y={r.y} width={r.width} height={r.height} fill="url(#stripe)" pointerEvents="none" />
                )}
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.width}
                  height={r.height}
                  fill="none"
                  stroke={hoveredId === t.id || selectedId === t.id ? 'white' : '#000'}
                  strokeOpacity={hoveredId === t.id || selectedId === t.id ? 0.9 : 0.25}
                  strokeWidth={hoveredId === t.id || selectedId === t.id ? 2 : 1}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              </g>
            );
          })}

          {polygons.map((p) => {
            const r = projector.toRect(p.bbox);
            const active = hoveredId === p.id || selectedId === p.id;
            return (
              <g key={p.id}>
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.width}
                  height={r.height}
                  fill={p.color}
                  fillOpacity={p.fillOpacity ?? (active ? 0.45 : 0.28)}
                  stroke={p.color}
                  strokeWidth={active ? 2.5 : 1.5}
                  strokeDasharray={p.dashed ? '4 3' : undefined}
                  vectorEffect="non-scaling-stroke"
                  onMouseEnter={() => onHoverId?.(p.id)}
                  onMouseLeave={() => onHoverId?.(null)}
                  onClick={() => onSelectId?.(p.id)}
                  className={onSelectId ? 'cursor-pointer' : undefined}
                />
              </g>
            );
          })}

          {points.map((pt) => {
            const [x, y] = projector.toXY(pt.lng, pt.lat);
            const active = hoveredId === pt.id || selectedId === pt.id;
            return (
              <circle
                key={pt.id}
                cx={x}
                cy={y}
                r={(pt.radius ?? 5) * (active ? 1.4 : 1)}
                fill={pt.color}
                stroke="#000"
                strokeOpacity={0.4}
                vectorEffect="non-scaling-stroke"
                onMouseEnter={() => onHoverId?.(pt.id)}
                onMouseLeave={() => onHoverId?.(null)}
                onClick={() => onSelectId?.(pt.id)}
                className={onSelectId ? 'cursor-pointer' : undefined}
              />
            );
          })}

          {drawnBboxView && (
            <rect
              x={drawnBboxView.x}
              y={drawnBboxView.y}
              width={drawnBboxView.width}
              height={drawnBboxView.height}
              fill="var(--color-accent)"
              fillOpacity={0.08}
              stroke="var(--color-accent-soft)"
              strokeWidth={2}
              strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
          {drawRectView && (
            <rect
              x={drawRectView.x}
              y={drawRectView.y}
              width={drawRectView.width}
              height={drawRectView.height}
              fill="var(--color-accent)"
              fillOpacity={0.12}
              stroke="var(--color-accent-soft)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
        </g>
      </svg>

      {label && (
        <div className="absolute top-2 left-2 mono text-[10px] text-text-muted bg-black/50 px-1.5 py-0.5 rounded">{label}</div>
      )}

      {overlay}

      <div className="absolute bottom-2 left-2 mono text-[10px] text-text-faint bg-black/40 px-1.5 py-0.5 rounded">
        offline basemap · local raster cache
      </div>

      {showCoordinates && cursor && (
        <div className="absolute bottom-2 right-2 mono text-[10px] text-text-muted bg-black/50 px-1.5 py-0.5 rounded">
          {cursor[1].toFixed(4)}°N {cursor[0].toFixed(4)}°E · {scale.toFixed(1)}x
        </div>
      )}

      <div className="absolute top-2 right-2 flex flex-col gap-1">
        <button
          onClick={() => setScale((s) => Math.min(8, s * 1.3))}
          className="w-6 h-6 flex items-center justify-center bg-bg-panel/90 border border-border rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover"
        >
          <Plus size={12} />
        </button>
        <button
          onClick={() => setScale((s) => Math.max(1, s / 1.3))}
          className="w-6 h-6 flex items-center justify-center bg-bg-panel/90 border border-border rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover"
        >
          <Minus size={12} />
        </button>
        <button
          onClick={resetView}
          className="w-6 h-6 flex items-center justify-center bg-bg-panel/90 border border-border rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover"
        >
          <Maximize2 size={11} />
        </button>
      </div>
    </div>
  );
}
