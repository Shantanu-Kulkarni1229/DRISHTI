import { AOI_FUNNEL_BASE, estimatePR } from '../../lib/mockData';
import type { ChangeCandidate, ChangeType, SuppressionGateId } from '../../lib/types';
import type { StageId } from '../../state/changeStore';

export { estimatePR };

export const yearOf = (iso: string) => new Date(iso).getUTCFullYear();

// A change "appears" in the first frame that shows it (the end of its interval).
// It belongs to a before/after comparison if that frame falls inside the window.
export function appearsBetween(c: ChangeCandidate, beforeYear: number, afterYear: number) {
  const y = yearOf(c.earliestIntervalEnd);
  return y > beforeYear && y <= afterYear;
}

export const TYPES: ChangeType[] = ['construction', 'clearance', 'water', 'roads'];

export const GATE_INFO: Record<SuppressionGateId, { label: string; explain: string }> = {
  validity: {
    label: 'Validity',
    explain: 'Rejects a candidate if clouds, cirrus, shadow, snow or dust haze cover it on either date, or too few valid pixels remain.',
  },
  radiometry: {
    label: 'Radiometry',
    explain: 'Normalises brightness between the two dates. If the "change" disappears after normalisation, it was only a lighting difference.',
  },
  registration: {
    label: 'Registration',
    explain: 'Measures how well the two images line up. Thin slivers hugging edges are almost always misalignment, not real change.',
  },
  season: {
    label: 'Season',
    explain: 'Compares like with like. A difference that stays inside the normal seasonal envelope (snowmelt, scree, vegetation) is not reported.',
  },
  persistence: {
    label: 'Persistence',
    explain: 'The change must still be there in later clear images. Real construction persists; vehicles, shadows and haze do not.',
  },
  cross_sensor: {
    label: 'Cross-sensor',
    explain: 'Checks radar (Sentinel-1) over the same spot. Hard new structures raise backscatter; disagreement lowers confidence.',
  },
  geometry: {
    label: 'Geometry',
    explain: 'Sanity-checks shape and size: minimum area, maximum fragmentation, and no polygons hugging scene edges.',
  },
};

export const DROP_CATEGORIES: { key: string; title: string; gates: SuppressionGateId[]; blurb: string }[] = [
  {
    key: 'quality',
    title: 'Dropped for image quality',
    gates: ['validity', 'radiometry', 'registration'],
    blurb: 'Candidates that failed because the imagery itself was not trustworthy — haze, lighting or misalignment.',
  },
  {
    key: 'season',
    title: 'Dropped as seasonal',
    gates: ['season'],
    blurb: 'Differences explained by the normal seasonal cycle rather than by anything built or removed.',
  },
  {
    key: 'reported',
    title: 'Dropped before reporting',
    gates: ['persistence', 'cross_sensor', 'geometry'],
    blurb: 'Candidates that looked real at first but did not persist, disagreed with radar, or had implausible geometry.',
  },
];

export const STAGE_INFO: Record<StageId, { title: string; detail: string }> = {
  masking: { title: 'Masking', detail: 'Finding clouds, shadow, snow and haze so they are never mistaken for change.' },
  normalising: { title: 'Normalising', detail: 'Matching brightness between dates (IR-MAD) so lighting differences vanish.' },
  aligning: { title: 'Aligning', detail: 'Co-registering both frames to the same grid, down to sub-pixel accuracy.' },
  scoring: { title: 'Scoring', detail: 'Embedding distance screens every tile pair, then a Siamese model confirms survivors.' },
  suppressing: { title: 'Suppressing', detail: 'Running the seven-gate gauntlet so only real, persistent changes are reported.' },
};


// Funnel numbers for a chosen window: full-scale counts shrink with the span
// of time compared, while "reported" is the real number of findings shown.
export function windowFunnel(aoiId: string, beforeYear: number, afterYear: number, allYears: number[], reported: number) {
  const base = AOI_FUNNEL_BASE[aoiId];
  const span = Math.max(1, afterYear - beforeYear);
  const total = Math.max(1, allYears[allYears.length - 1] - allYears[0]);
  const frac = Math.min(1, span / total);
  const persisted = Math.max(Math.round(base.persisted * frac), reported);
  const passedQuality = Math.max(Math.round(base.passedQuality * frac), persisted);
  const screened = Math.max(Math.round(base.screened * frac), passedQuality);
  return { screened, passedQuality, persisted, reported };
}
