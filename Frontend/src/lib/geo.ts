// Minimal "contain" projector from a geographic bbox into a fixed SVG
// viewBox. Not a real map projection — it's a local equirectangular fit
// good enough for small demo AOIs, which is all the offline mock map needs.
export interface Projector {
  toXY: (lng: number, lat: number) => [number, number];
  toRect: (bbox: [number, number, number, number]) => { x: number; y: number; width: number; height: number };
  invert: (x: number, y: number) => [number, number];
  viewW: number;
  viewH: number;
}

export function createProjector(bbox: [number, number, number, number], viewW: number, viewH: number, padFrac = 0.06): Projector {
  const [minX, minY, maxX, maxY] = bbox;
  const w = maxX - minX || 0.001;
  const h = maxY - minY || 0.001;
  const padX = w * padFrac;
  const padY = h * padFrac;
  const gMinX = minX - padX;
  const gMaxX = maxX + padX;
  const gMinY = minY - padY;
  const gMaxY = maxY + padY;
  const gw = gMaxX - gMinX;
  const gh = gMaxY - gMinY;

  const scale = Math.min(viewW / gw, viewH / gh);
  const drawW = gw * scale;
  const drawH = gh * scale;
  const offX = (viewW - drawW) / 2;
  const offY = (viewH - drawH) / 2;

  const toXY = (lng: number, lat: number): [number, number] => {
    const x = offX + (lng - gMinX) * scale;
    const y = offY + (gMaxY - lat) * scale; // flip Y: latitude increases upward
    return [x, y];
  };

  const toRect = (b: [number, number, number, number]) => {
    const [x0, y0] = toXY(b[0], b[3]);
    const [x1, y1] = toXY(b[2], b[1]);
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  };

  const invert = (x: number, y: number): [number, number] => {
    const lng = gMinX + (x - offX) / scale;
    const lat = gMaxY - (y - offY) / scale;
    return [lng, lat];
  };

  return { toXY, toRect, invert, viewW, viewH };
}

export function bboxCenter(bbox: [number, number, number, number]): [number, number] {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

export function normalizeBox(a: [number, number], b: [number, number]): [number, number, number, number] {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
}

// Maps a geographic bbox onto CSS percentages of a frame that covers `aoiBbox`
// exactly (north-up, top-left origin) — used to overlay boxes on a real photo.
export function bboxToPercent(bbox: [number, number, number, number], aoiBbox: [number, number, number, number]) {
  const [minX, minY, maxX, maxY] = aoiBbox;
  const [x0, y0, x1, y1] = bbox;
  const left = ((x0 - minX) / (maxX - minX)) * 100;
  const right = ((x1 - minX) / (maxX - minX)) * 100;
  const top = ((maxY - y1) / (maxY - minY)) * 100;
  const bottom = ((maxY - y0) / (maxY - minY)) * 100;
  return { left, top, width: Math.max(right - left, 1.4), height: Math.max(bottom - top, 1.4) };
}
