import type { AcquisitionUsability, ChangeType, TilePattern } from './types';

// Okabe-Ito colourblind-safe hues, kept identical across the map, the funnel,
// the confusion matrix and the export legend (spec §7).
export const CHANGE_TYPE_COLORS: Record<ChangeType, string> = {
  construction: '#E69F00',
  clearance: '#D55E00',
  water: '#56B4E9',
  roads: '#CC79A7',
};

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  construction: 'Construction',
  clearance: 'Clearance',
  water: 'Water extent',
  roads: 'Road development',
};

// Single accent colour, reserved for interactive elements only.
export const ACCENT = '#6366F1';
export const ACCENT_SOFT = '#818CF8';

export const USABILITY_COLORS: Record<AcquisitionUsability, string> = {
  clear: '#34D399',
  partly_cloudy: '#FBBF24',
  unusable: '#64748B',
  missing: '#334155',
};

export const TILE_PATTERN_COLORS: Record<TilePattern, string> = {
  urban: '#94A3B8',
  bare: '#C2A878',
  vegetation: '#4ADE80',
  water: '#38BDF8',
  road: '#71717A',
  quarry: '#F59E0B',
  airport: '#E2E8F0',
  mixed: '#A78BFA',
};

export function confidenceColor(conf: number): string {
  if (conf >= 0.85) return '#34D399';
  if (conf >= 0.6) return '#FBBF24';
  return '#F87171';
}

export function scoreToOpacity(score: number, min = 0.15): number {
  return min + (1 - min) * score;
}
