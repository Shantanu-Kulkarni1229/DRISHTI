import type { CSSProperties } from 'react';
import { SCENES, tileById } from './mockData';
import { bboxToPercent } from './geo';
import { cn } from './utils';
import type { ChangeCandidate, SuppressionGateId } from './types';

export interface PctBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const yearOf = (iso: string) => new Date(iso).getUTCFullYear();

export function sceneImage(aoiId: string, year: number): string | undefined {
  return SCENES.find((s) => s.aoiId === aoiId && yearOf(s.datetime) === year)?.imageUrl;
}

export function candidateBox(c: ChangeCandidate, aoiBbox: [number, number, number, number]): PctBox {
  return bboxToPercent(c.bbox, aoiBbox);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// How far to zoom so the box fills roughly half the view, centred on the box.
export function focusFor(box: PctBox) {
  const fx = (box.left + box.width / 2) / 100;
  const fy = (box.top + box.height / 2) / 100;
  const s = clamp(0.5 / (Math.max(box.width, box.height) / 100), 1, 6);
  return { fx, fy, s };
}

// CSS background crop of a square source frame, centred on the box.
export function cropStyle(imageUrl: string | undefined, box: PctBox): CSSProperties {
  if (!imageUrl) return {};
  const { fx, fy, s } = focusFor(box);
  const pos = (f: number) => (s === 1 ? 50 : clamp(((0.5 - f * s) / (1 - s)) * 100, 0, 100));
  return {
    backgroundImage: `url(${imageUrl})`,
    backgroundSize: `${s * 100}% ${s * 100}%`,
    backgroundPosition: `${pos(fx)}% ${pos(fy)}%`,
  };
}

export interface QualityCheck {
  label: string;
  value: string;
  ok: boolean;
  note: string;
  gate: SuppressionGateId;
}

// The same four spot-checks shown on the Review focus panel and the Evidence
// page — kept in one place so a rejection can be argued identically everywhere.
export function qualityChecksFor(c: ChangeCandidate): QualityCheck[] {
  const after = tileById(c.tileAfterId);
  return [
    { label: 'Image alignment', value: `${c.registrationResidualPx.toFixed(2)} px`, ok: c.registrationResidualPx <= 1.2, note: 'Residual misalignment — under 1.2 px is clean', gate: 'registration' },
    { label: 'Seasonal deviation', value: `z ${c.seasonalZScore.toFixed(1)}`, ok: c.seasonalZScore >= 2, note: 'How far outside the normal seasonal range — higher is more convincing', gate: 'season' },
    { label: 'Radar agreement', value: `${Math.round(c.sarAgreement * 100)}%`, ok: c.sarAgreement >= 0.55, note: 'Does Sentinel-1 radar see the same change?', gate: 'cross_sensor' },
    { label: 'Valid pixels', value: after ? `${Math.round(after.validFrac * 100)}%` : '—', ok: (after?.validFrac ?? 1) >= 0.85, note: 'Share of the frame free of cloud, shadow and haze', gate: 'validity' },
  ];
}

export function FindingCrop({ imageUrl, box, size, className, tag }: { imageUrl?: string; box: PctBox; size: number | string; className?: string; tag?: string }) {
  return (
    <div
      className={cn('relative shrink-0 overflow-hidden rounded-md ring-1 ring-black/40 bg-bg-raised', className)}
      style={{ width: size, height: size, ...cropStyle(imageUrl, box) }}
    >
      {tag && <span className="absolute bottom-0 left-0 right-0 text-center mono text-[8px] bg-black/60 text-white/85 leading-tight py-px">{tag}</span>}
    </div>
  );
}
