import { mulberry32, pick, range, clamp, lerp } from './rng';
import { fauxHash } from './utils';
import type {
  AOI,
  Scene,
  Tile,
  TilePattern,
  Sensor,
  ChangeCandidate,
  ChangeType,
  ChangeDirection,
  SuppressionFactor,
  SuppressionGateId,
  RejectReasonCode,
  Decision,
  Cluster,
  AuditEntry,
  ModelInfo,
  IngestJob,
  IndexStats,
  Acquisition,
  TimeSeriesPoint,
  EvalMetrics,
  SavedQuery,
  AcquisitionUsability,
} from './types';

const rand = mulberry32(20260917);

// ---------------------------------------------------------------------------
// AOI — a single frontier sector, monitored 2016-2025 with real annual imagery.
// Fictional designation; not a real, identifiable installation.
// ---------------------------------------------------------------------------
export const AOIS: AOI[] = [
  {
    id: 'aoi-sector14',
    name: 'Sector-14 · Northern Frontier Watch',
    description:
      'A remote frontier ridge under continuous watch since 2016. Ten years of annual imagery show a forward outpost grow into a fortified airbase and missile battery.',
    bbox: [77.42, 34.55, 77.54, 34.67],
    changeSignature: 'construction',
  },
];

const AOI_ID = AOIS[0].id;
const YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const yearDate = (y: number) => `${y}-06-15`;

// ---------------------------------------------------------------------------
// Scenes — one real captured frame per year.
// ---------------------------------------------------------------------------
export const SCENES: Scene[] = YEARS.map((y) => ({
  id: `scene-sector14-${y}`,
  sensor: 'S2' as Sensor,
  productLevel: 'L2A',
  datetime: yearDate(y),
  crs: 'EPSG:32643',
  footprint: { bbox: AOIS[0].bbox },
  cloudPct: Math.round(lerp(1, 9, rand())),
  sizeMb: Math.round(lerp(410, 520, rand())),
  checksum: fauxHash(`sector14-${y}`).slice(0, 16),
  licence: 'Copernicus (free & open)',
  ingestedAt: `${y}-06-16`,
  aoiId: AOI_ID,
  imageUrl: `/imagery/sector14/${y}.png`,
}));

const ACQUISITION_DATES: Record<string, string[]> = { [AOI_ID]: YEARS.map(yearDate) };

// ---------------------------------------------------------------------------
// Grid — 4x4 cells over the sector, hand-annotated from the real imagery.
// Each cell carries an "era" table: the pattern/labels it should read as from
// a given year onward. This is what makes the tile-by-tile change legible.
// ---------------------------------------------------------------------------
export const GRID = 4;

interface CellEra {
  fromYear: number;
  pattern: TilePattern;
  terms: string[];
}
interface CellDef {
  cx: number;
  cy: number;
  name: string;
  eras: CellEra[];
}

const CELL_DEFS: CellDef[] = [
  { cx: 0, cy: 0, name: 'Southwest approach ridge', eras: [{ fromYear: 2016, pattern: 'bare', terms: ['undeveloped terrain', 'rock outcrop', 'ridge line'] }] },
  { cx: 1, cy: 0, name: 'Southern perimeter track', eras: [
    { fromYear: 2016, pattern: 'bare', terms: ['scrubland', 'dirt track'] },
    { fromYear: 2025, pattern: 'mixed', terms: ['perimeter wall', 'watchtower'] },
  ] },
  { cx: 2, cy: 0, name: 'Southern perimeter', eras: [
    { fromYear: 2016, pattern: 'bare', terms: ['scrubland', 'dirt track'] },
    { fromYear: 2025, pattern: 'mixed', terms: ['perimeter wall', 'watchtower'] },
  ] },
  { cx: 3, cy: 0, name: 'Southeast ridge', eras: [{ fromYear: 2016, pattern: 'bare', terms: ['rock outcrop', 'ridge line'] }] },

  { cx: 0, cy: 1, name: 'Western support area', eras: [
    { fromYear: 2016, pattern: 'bare', terms: ['scrubland'] },
    { fromYear: 2021, pattern: 'urban', terms: ['support buildings', 'vehicle motor pool'] },
  ] },
  { cx: 1, cy: 1, name: 'Apron & control tower', eras: [
    { fromYear: 2016, pattern: 'bare', terms: ['scrubland'] },
    { fromYear: 2019, pattern: 'road', terms: ['graded earth strip'] },
    { fromYear: 2020, pattern: 'airport', terms: ['apron under construction', 'taxiway'] },
    { fromYear: 2021, pattern: 'airport', terms: ['control tower', 'parked aircraft', 'apron'] },
  ] },
  { cx: 2, cy: 1, name: 'Hangars & apron', eras: [
    { fromYear: 2016, pattern: 'bare', terms: ['scrubland'] },
    { fromYear: 2019, pattern: 'road', terms: ['graded earth strip'] },
    { fromYear: 2020, pattern: 'airport', terms: ['apron under construction', 'hangar shells'] },
    { fromYear: 2021, pattern: 'airport', terms: ['aircraft hangars', 'parked aircraft', 'control tower'] },
  ] },
  { cx: 3, cy: 1, name: 'Runway east threshold', eras: [
    { fromYear: 2016, pattern: 'bare', terms: ['scrubland'] },
    { fromYear: 2019, pattern: 'road', terms: ['graded earth strip'] },
    { fromYear: 2020, pattern: 'airport', terms: ['paved runway threshold'] },
  ] },

  { cx: 0, cy: 2, name: 'Runway west threshold', eras: [
    { fromYear: 2016, pattern: 'bare', terms: ['rock outcrop'] },
    { fromYear: 2020, pattern: 'airport', terms: ['paved runway threshold', 'runway markings'] },
  ] },
  { cx: 1, cy: 2, name: 'Runway & taxiway (west)', eras: [
    { fromYear: 2016, pattern: 'bare', terms: ['undeveloped land'] },
    { fromYear: 2019, pattern: 'road', terms: ['graded earth strip', 'airstrip grading'] },
    { fromYear: 2020, pattern: 'airport', terms: ['paved runway', 'taxiway'] },
    { fromYear: 2022, pattern: 'urban', terms: ['paved runway', 'barracks rows'] },
  ] },
  { cx: 2, cy: 2, name: 'Forward staging camp → fuel depot', eras: [
    { fromYear: 2016, pattern: 'bare', terms: ['undeveloped land'] },
    { fromYear: 2017, pattern: 'quarry', terms: ['tented camp', 'support vehicles'] },
    { fromYear: 2019, pattern: 'urban', terms: ['command post', 'walled compound'] },
    { fromYear: 2022, pattern: 'urban', terms: ['fuel storage tanks', 'barracks block'] },
  ] },
  { cx: 3, cy: 2, name: 'Eastern missile pads & motor pool', eras: [
    { fromYear: 2016, pattern: 'bare', terms: ['undeveloped land'] },
    { fromYear: 2022, pattern: 'urban', terms: ['vehicle motor pool', 'fuel storage tanks'] },
    { fromYear: 2024, pattern: 'quarry', terms: ['missile launch pad', 'launch canister'] },
  ] },

  { cx: 0, cy: 3, name: 'Northwest radar station', eras: [
    { fromYear: 2016, pattern: 'bare', terms: ['rock face', 'ridge line'] },
    { fromYear: 2022, pattern: 'mixed', terms: ['radar dome', 'sensor mast'] },
  ] },
  { cx: 1, cy: 3, name: 'Cantonment north block', eras: [
    { fromYear: 2016, pattern: 'bare', terms: ['undeveloped land'] },
    { fromYear: 2022, pattern: 'urban', terms: ['barracks rows', 'solar array'] },
  ] },
  { cx: 2, cy: 3, name: 'Missile battery field', eras: [
    { fromYear: 2016, pattern: 'bare', terms: ['undeveloped land'] },
    { fromYear: 2023, pattern: 'quarry', terms: ['missile launch pad', 'erector launcher'] },
    { fromYear: 2024, pattern: 'quarry', terms: ['missile battery', 'launch canister'] },
  ] },
  { cx: 3, cy: 3, name: 'Missile battery east & tunnel portals', eras: [
    { fromYear: 2016, pattern: 'bare', terms: ['undeveloped land'] },
    { fromYear: 2023, pattern: 'quarry', terms: ['missile launch pad'] },
    { fromYear: 2024, pattern: 'quarry', terms: ['missile battery', 'tunnel portal', 'bunker entrance'] },
    { fromYear: 2025, pattern: 'mixed', terms: ['tunnel portal', 'bunker entrance', 'perimeter wall'] },
  ] },
];

function eraForYear(cell: CellDef, year: number): CellEra {
  let active = cell.eras[0];
  for (const era of cell.eras) if (era.fromYear <= year) active = era;
  return active;
}

const CLUSTER_CENTERS: Record<TilePattern, [number, number]> = {
  urban: [2.2, 1.1],
  bare: [-1.4, 2.3],
  vegetation: [-2.8, -1.6],
  water: [3.1, -2.4],
  road: [0.4, 3.2],
  quarry: [-0.6, -3.1],
  airport: [1.6, -0.2],
  mixed: [-3.4, 1.4],
};

const THUMB_COLORS: Record<TilePattern, string> = {
  urban: '#8891A6',
  bare: '#8C8272',
  vegetation: '#6B9B4F',
  water: '#4FA3D1',
  road: '#5B5B63',
  quarry: '#B8863B',
  airport: '#D6DCE5',
  mixed: '#9C8BC4',
};

function cellBbox(cx: number, cy: number): [number, number, number, number] {
  const [minX, minY, maxX, maxY] = AOIS[0].bbox;
  const dx = (maxX - minX) / GRID;
  const dy = (maxY - minY) / GRID;
  return [minX + cx * dx, minY + cy * dy, minX + (cx + 1) * dx, minY + (cy + 1) * dy];
}

// CSS background-position for a GRID x GRID sprite crop of a full AOI frame —
// image row 0 (top) is north, so cy (south-up) maps to row (GRID-1-cy).
function cropPositionFor(cx: number, cy: number): string {
  const row = GRID - 1 - cy;
  const px = (cx / (GRID - 1)) * 100;
  const py = (row / (GRID - 1)) * 100;
  return `${px}% ${py}%`;
}

function embeddingFor(pattern: TilePattern, jitterSeed: number): [number, number] {
  const center = CLUSTER_CENTERS[pattern];
  return [center[0] + (rand() - 0.5) * 1.1 + Math.sin(jitterSeed) * 0.15, center[1] + (rand() - 0.5) * 1.1];
}

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------
export const TILES: Tile[] = [];

for (const cell of CELL_DEFS) {
  const gridCellId = `${AOI_ID}-cell-${cell.cx}-${cell.cy}`;
  const bbox = cellBbox(cell.cx, cell.cy);
  const cropPosition = cropPositionFor(cell.cx, cell.cy);

  YEARS.forEach((year) => {
    const scene = SCENES.find((s) => s.datetime === yearDate(year))!;
    const era = eraForYear(cell, year);
    const cloudFrac = clamp(scene.cloudPct / 100 + (rand() - 0.5) * 0.03, 0, 0.3);
    const validFrac = clamp(1 - cloudFrac * 0.6 - rand() * 0.03, 0.7, 1);

    TILES.push({
      id: `tile-${gridCellId}-${yearDate(year)}`,
      sceneId: scene.id,
      aoiId: AOI_ID,
      gridCellId,
      footprint: { bbox },
      datetime: yearDate(year),
      sensor: scene.sensor,
      gsdM: 10,
      validFrac: Math.round(validFrac * 100) / 100,
      cloudFrac: Math.round(cloudFrac * 100) / 100,
      thumbColor: THUMB_COLORS[era.pattern],
      thumbPattern: era.pattern,
      clusterId: null,
      embedding2d: embeddingFor(era.pattern, cell.cx * 4 + cell.cy),
      conceptTerms: era.terms,
      imageUrl: scene.imageUrl,
      cropPosition,
      label: cell.name,
    });
  });
}

// ---------------------------------------------------------------------------
// Clusters (Discovery, spec §5.6) — grouped by dominant land-use pattern.
// ---------------------------------------------------------------------------
const CLUSTER_DEFS: { id: string; name: string; pattern: TilePattern; color: string; isSaved: boolean }[] = [
  { id: 'cl-airport', name: 'Airbase — runway & hangars', pattern: 'airport', color: '#E2E8F0', isSaved: true },
  { id: 'cl-quarry', name: 'Excavation & missile pads', pattern: 'quarry', color: '#F59E0B', isSaved: true },
  { id: 'cl-urban', name: 'Cantonment & command', pattern: 'urban', color: '#94A3B8', isSaved: true },
  { id: 'cl-road', name: 'Access tracks & grading', pattern: 'road', color: '#71717A', isSaved: false },
  { id: 'cl-mixed', name: 'Radar, bunkers & perimeter works', pattern: 'mixed', color: '#A78BFA', isSaved: false },
  { id: 'cl-bare', name: 'Undeveloped ridge', pattern: 'bare', color: '#8C8272', isSaved: false },
];

export const CLUSTERS: Cluster[] = CLUSTER_DEFS.map((def) => {
  const members = TILES.filter((t) => t.thumbPattern === def.pattern);
  members.forEach((t) => (t.clusterId = def.id));
  const cx = members.reduce((s, t) => s + t.embedding2d[0], 0) / Math.max(1, members.length);
  const cy = members.reduce((s, t) => s + t.embedding2d[1], 0) / Math.max(1, members.length);
  return {
    id: def.id,
    name: def.name,
    isSaved: def.isSaved,
    memberTileIds: members.map((t) => t.id),
    color: def.color,
    centroid2d: [cx, cy],
  };
});

// ---------------------------------------------------------------------------
// Change candidates — hand-authored from the real 2016-2025 imagery. Each one
// is a genuine, visually-traceable detection; a handful of deliberately
// suppressed false positives are included so the suppression gauntlet (§5.4)
// still has real content to show.
// ---------------------------------------------------------------------------
const GATES: SuppressionGateId[] = ['validity', 'radiometry', 'registration', 'season', 'persistence', 'cross_sensor', 'geometry'];

function factorsFor(confidence: number, weakGate?: SuppressionGateId): SuppressionFactor[] {
  const defs: { gate: SuppressionGateId; label: string }[] = [
    { gate: 'validity', label: 'Valid-pixel fraction' },
    { gate: 'radiometry', label: 'Post-normalisation signal' },
    { gate: 'registration', label: 'Registration quality' },
    { gate: 'season', label: 'Seasonal deviation' },
    { gate: 'persistence', label: 'Persistence across later dates' },
    { gate: 'cross_sensor', label: 'SAR (S1) agreement' },
    { gate: 'geometry', label: 'Geometry sanity' },
  ];
  return defs.map((d) => ({
    gate: d.gate,
    label: d.label,
    value:
      d.gate === weakGate
        ? clamp(confidence - 0.55 + (rand() - 0.5) * 0.1, 0.02, 0.5)
        : clamp(confidence + (rand() - 0.5) * 0.1, 0.05, 0.99),
  }));
}

interface CandidateSpec {
  cx: number;
  cy: number;
  fromYear: number;
  toYear: number;
  type: ChangeType;
  direction: ChangeDirection;
  confidence: number;
  areaM2: number;
  headline: string;
  narrative: string;
  // Hand-measured box on the real feature, as [x0, y0, x1, y1] fractions of the
  // source frame (top-left origin). cx/cy only anchor which tile pair is shown.
  imgBox?: [number, number, number, number];
  suppressedBy?: SuppressionGateId;
  rejectReason?: RejectReasonCode;
}

const CANDIDATE_SPECS: CandidateSpec[] = [
  {
    cx: 2, cy: 2, fromYear: 2016, toYear: 2017, type: 'construction', direction: 'appearance', confidence: 0.81, areaM2: 2100,
    headline: 'Tented staging camp appears',
    narrative: 'A small tented encampment with two support vehicles appears beside the ridge trail — the first sign of activity at a previously undisturbed site.',
    imgBox: [0.655, 0.31, 0.76, 0.41],
  },
  {
    cx: 2, cy: 2, fromYear: 2017, toYear: 2019, type: 'construction', direction: 'expansion', confidence: 0.85, areaM2: 15400,
    headline: 'Camp consolidates into a walled compound',
    narrative: 'The temporary camp is replaced by a graded, fenced compound with a loop access road — consistent with a forward command post.',
    imgBox: [0.62, 0.28, 0.83, 0.44],
  },
  {
    cx: 2, cy: 1, fromYear: 2016, toYear: 2019, type: 'roads', direction: 'appearance', confidence: 0.88, areaM2: 81000,
    headline: 'Airstrip graded across the valley floor',
    narrative: 'An 1,800 m earthen strip is graded end-to-end along the valley floor — the classic precursor to a military airstrip.',
    imgBox: [0.2, 0.32, 0.78, 0.64],
  },
  {
    cx: 2, cy: 1, fromYear: 2019, toYear: 2020, type: 'construction', direction: 'expansion', confidence: 0.93, areaM2: 143000,
    headline: 'Runway paved, taxiway and hangar shells added',
    narrative: 'The graded strip is paved with runway markings and a parallel taxiway; two hangar shells rise beside the apron.',
    imgBox: [0.06, 0.28, 0.98, 0.66],
  },
  {
    cx: 2, cy: 1, fromYear: 2020, toYear: 2021, type: 'construction', direction: 'expansion', confidence: 0.96, areaM2: 168000,
    headline: 'Airbase becomes operational',
    narrative: 'A control tower, three completed hangars and multiple parked aircraft confirm the airbase is now operational.',
    imgBox: [0.36, 0.47, 0.78, 0.68],
  },
  {
    cx: 1, cy: 3, fromYear: 2021, toYear: 2022, type: 'construction', direction: 'appearance', confidence: 0.94, areaM2: 96500,
    headline: 'Cantonment springs up north of the runway',
    narrative: 'Dense rows of barracks-style buildings and a vehicle motor pool appear immediately north of the airbase, alongside a solar array.',
    imgBox: [0.16, 0.08, 0.66, 0.36],
  },
  {
    cx: 2, cy: 2, fromYear: 2021, toYear: 2022, type: 'construction', direction: 'appearance', confidence: 0.90, areaM2: 12300,
    headline: 'Fuel depot installed',
    narrative: 'Eight cylindrical and spherical fuel storage tanks are installed beside the cantonment, indicating sustained logistics support.',
    imgBox: [0.64, 0.31, 0.81, 0.43],
  },
  {
    cx: 0, cy: 3, fromYear: 2021, toYear: 2022, type: 'construction', direction: 'appearance', confidence: 0.83, areaM2: 800,
    headline: 'Radar dome erected',
    narrative: 'A radar dome and sensor building appear on the northwest ridge, giving line-of-sight coverage over the approach valley.',
    imgBox: [0.06, 0.07, 0.17, 0.17],
  },
  {
    cx: 2, cy: 3, fromYear: 2022, toYear: 2023, type: 'construction', direction: 'appearance', confidence: 0.92, areaM2: 3500,
    headline: 'First missile launch pad identified',
    narrative: 'A hardened circular launch pad with an erector-launcher vehicle appears — the first confirmed missile position at this site.',
    imgBox: [0.66, 0.085, 0.76, 0.17],
  },
  {
    cx: 3, cy: 3, fromYear: 2023, toYear: 2024, type: 'construction', direction: 'expansion', confidence: 0.97, areaM2: 27600,
    headline: 'Missile battery expands to six pads',
    narrative: 'Five additional launch pads are constructed around the first, forming a dispersed six-pad missile battery.',
    imgBox: [0.63, 0.07, 0.95, 0.36],
  },
  {
    cx: 3, cy: 2, fromYear: 2023, toYear: 2024, type: 'construction', direction: 'expansion', confidence: 0.91, areaM2: 9100,
    headline: 'Battery extends east',
    narrative: 'A seventh launch pad and support road extend the missile battery toward the eastern ridge.',
    imgBox: [0.85, 0.29, 0.97, 0.39],
  },
  {
    cx: 3, cy: 3, fromYear: 2023, toYear: 2024, type: 'clearance', direction: 'appearance', confidence: 0.86, areaM2: 1200,
    headline: 'Tunnel portals cut into the ridge',
    narrative: 'Excavation opens two tunnel-like portals into the northeastern ridge face, consistent with hardened storage or shelter construction.',
    imgBox: [0.83, 0.035, 0.96, 0.12],
  },
  {
    cx: 1, cy: 0, fromYear: 2024, toYear: 2025, type: 'construction', direction: 'appearance', confidence: 0.95, areaM2: 41000,
    headline: 'Perimeter wall and watchtowers completed',
    narrative: "A fortified perimeter wall with corner watchtowers now encloses the entire complex, formalising the site's defensive posture.",
    imgBox: [0.0, 0.03, 0.99, 0.86],
  },
  {
    cx: 3, cy: 3, fromYear: 2024, toYear: 2025, type: 'clearance', direction: 'expansion', confidence: 0.84, areaM2: 950,
    headline: 'Tunnel complex extended',
    narrative: 'Both tunnel entrances are reworked and a service road is added, suggesting the hardened storage is now in active use.',
    imgBox: [0.8, 0.07, 0.96, 0.17],
  },
  // deliberately suppressed false positives — keep the suppression gauntlet honest
  {
    cx: 0, cy: 0, fromYear: 2016, toYear: 2017, type: 'water', direction: 'appearance', confidence: 0.38, areaM2: 4200,
    headline: 'Bright scree slope (suppressed)',
    narrative: 'A bright scree slope was briefly misread as a snowmelt-related change; suppressed after seasonal modelling.',
    suppressedBy: 'season', rejectReason: 'seasonal',
  },
  {
    cx: 3, cy: 0, fromYear: 2018, toYear: 2019, type: 'construction', direction: 'appearance', confidence: 0.31, areaM2: 300,
    headline: 'Ridge-edge sliver (suppressed)',
    narrative: 'A thin sliver along a ridge edge, consistent with sub-pixel misregistration; rejected before reaching review.',
    suppressedBy: 'registration', rejectReason: 'misregistration',
  },
  {
    cx: 0, cy: 3, fromYear: 2019, toYear: 2020, type: 'clearance', direction: 'appearance', confidence: 0.29, areaM2: 600,
    headline: 'Dust-haze patch (suppressed)',
    narrative: 'Transient dust haze over the ridge reduced valid-pixel fraction below threshold; rejected.',
    suppressedBy: 'validity', rejectReason: 'cloud',
  },
  {
    cx: 1, cy: 3, fromYear: 2020, toYear: 2021, type: 'construction', direction: 'appearance', confidence: 0.34, areaM2: 150,
    headline: 'Transient bright object (suppressed)',
    narrative: 'A bright patch did not persist in the next two clear acquisitions — likely a vehicle or temporary object.',
    suppressedBy: 'persistence', rejectReason: 'not_of_interest',
  },
];

export const JOB_ID_DEFAULT = 'job-sector14-2025';

function bboxFromSpec(spec: CandidateSpec): [number, number, number, number] {
  if (spec.imgBox) {
    const [minX, minY, maxX, maxY] = AOIS[0].bbox;
    const [x0, y0, x1, y1] = spec.imgBox;
    const w = maxX - minX;
    const h = maxY - minY;
    return [minX + x0 * w, maxY - y1 * h, minX + x1 * w, maxY - y0 * h]; // image y grows downward, latitude upward
  }
  const [x0, y0, x1, y1] = cellBbox(spec.cx, spec.cy);
  const pad = (x1 - x0) * 0.18;
  return [x0 + pad, y0 + pad, x1 - pad, y1 - pad];
}

export const CHANGE_CANDIDATES: ChangeCandidate[] = CANDIDATE_SPECS.map((spec, i) => {
  const gridCellId = `${AOI_ID}-cell-${spec.cx}-${spec.cy}`;
  const before = yearDate(spec.fromYear);
  const after = yearDate(spec.toYear);
  const tileBefore = TILES.find((t) => t.gridCellId === gridCellId && t.datetime === before)!;
  const tileAfter = TILES.find((t) => t.gridCellId === gridCellId && t.datetime === after)!;
  const bbox = bboxFromSpec(spec);
  const geomCenter = { lng: (bbox[0] + bbox[2]) / 2, lat: (bbox[1] + bbox[3]) / 2 };
  const suppressed = spec.suppressedBy ?? null;

  return {
    id: `cand-${(i + 1).toString().padStart(4, '0')}`,
    aoiId: AOI_ID,
    gridCellId,
    tileBeforeId: tileBefore.id,
    tileAfterId: tileAfter.id,
    geomCenter,
    bbox,
    areaM2: spec.areaM2,
    type: spec.type,
    direction: spec.direction,
    score: Math.round(clamp(spec.confidence + (rand() - 0.5) * 0.05, 0.05, 0.99) * 100) / 100,
    confidence: spec.confidence,
    factors: factorsFor(spec.confidence, spec.suppressedBy),
    status: 'pending',
    rejectReason: spec.rejectReason ?? null,
    suppressedBy: suppressed,
    assignee: suppressed ? null : pick(rand, ['A. Rao', 'S. Verma', 'K. Nair', 'M. Iyer']),
    earliestIntervalStart: before,
    earliestIntervalEnd: after,
    revisitGapDays: 365,
    jobId: JOB_ID_DEFAULT,
    registrationResidualPx: Math.round((spec.suppressedBy === 'registration' ? lerp(1.6, 2.4, rand()) : lerp(0.2, 0.9, rand())) * 100) / 100,
    seasonalZScore: Math.round((spec.suppressedBy === 'season' ? lerp(0.2, 0.9, rand()) : lerp(1.8, 4.2, rand())) * 100) / 100,
    sarAgreement: Math.round((spec.suppressedBy ? lerp(0.15, 0.5, rand()) : lerp(0.75, 0.98, rand())) * 100) / 100,
    headline: spec.headline,
    narrative: spec.narrative,
  };
});

// Pre-seed decisions matching the escalating real-world narrative: everything
// through 2023 has already been reviewed, the most recent findings are still
// live in the queue, and one borderline call was rejected for realism.
const DECISION_VERDICTS: Record<string, { verdict: 'accepted' | 'rejected'; reasonCode?: RejectReasonCode; note: string; actor: string }> = {
  'cand-0001': { verdict: 'accepted', note: 'Confirmed — first activity at this site.', actor: 'A. Rao' },
  'cand-0002': { verdict: 'accepted', note: 'Confirmed against evidence page.', actor: 'A. Rao' },
  'cand-0003': { verdict: 'accepted', note: 'Airstrip grading confirmed, elongated feature matches road-development transition.', actor: 'S. Verma' },
  'cand-0004': { verdict: 'accepted', note: 'Runway paving and hangar shells confirmed.', actor: 'S. Verma' },
  'cand-0005': { verdict: 'accepted', note: 'Airbase operational status confirmed — aircraft visible on apron.', actor: 'K. Nair' },
  'cand-0006': { verdict: 'accepted', note: 'Cantonment expansion confirmed.', actor: 'K. Nair' },
  'cand-0007': { verdict: 'accepted', note: 'Fuel depot confirmed, cross-checked against SAR backscatter.', actor: 'M. Iyer' },
  'cand-0008': { verdict: 'rejected', reasonCode: 'not_of_interest', note: 'Insufficient resolution to distinguish from a natural rock formation; flagged for re-observation.', actor: 'M. Iyer' },
  'cand-0009': { verdict: 'accepted', note: 'First missile pad confirmed — high-priority finding.', actor: 'A. Rao' },
  'cand-0010': { verdict: 'accepted', note: 'Six-pad battery confirmed, escalated to command.', actor: 'A. Rao' },
  'cand-0012': { verdict: 'accepted', note: 'Tunnel portal confirmed against evidence page.', actor: 'S. Verma' },
};

export const DECISIONS: Decision[] = Object.entries(DECISION_VERDICTS).map(([candidateId, d], i) => {
  const candidate = CHANGE_CANDIDATES.find((c) => c.id === candidateId)!;
  candidate.status = d.verdict;
  if (d.reasonCode) candidate.rejectReason = d.reasonCode;
  return {
    id: `dec-${i}`,
    candidateId,
    actor: d.actor,
    verdict: d.verdict,
    reasonCode: d.reasonCode ?? null,
    note: d.note,
    createdAt: new Date(Date.now() - (Object.keys(DECISION_VERDICTS).length - i) * 3600_000 * 8).toISOString(),
  };
});

// ---------------------------------------------------------------------------
// Suppression funnel headline numbers (spec demo script §14).
// ---------------------------------------------------------------------------
export interface FunnelBase {
  screened: number;
  passedQuality: number;
  persisted: number;
  reportedBase: number;
  confirmedRatio: number;
}

export const AOI_FUNNEL_BASE: Record<string, FunnelBase> = {
  [AOI_ID]: { screened: 1842, passedQuality: 214, persisted: 61, reportedBase: 14, confirmedRatio: 0.64 },
};

export interface FunnelResult {
  screened: number;
  passedQuality: number;
  persisted: number;
  reported: number;
  confirmed: number;
  gateDropCounts: Record<SuppressionGateId, number>;
}

// Sensitivity in [0,1]; 0 favours recall (low confidence threshold), 1 favours
// precision (high threshold) — the trade-off the brief explicitly asks for.
export function sensitivityToThreshold(sensitivity: number): number {
  return Math.round((0.35 + sensitivity * 0.5) * 100) / 100;
}

// Precision/recall the model would operate at for a given confidence
// threshold, read off the held-out evaluation curve so every gauge that
// quotes a trade-off (Change analysis, Evaluation) tells the same truth.
export function estimatePR(threshold: number): { precision: number; recall: number } {
  const curve = EVAL_METRICS.change.prCurve;
  const t = Math.min(1, Math.max(0, threshold));
  const idx = t * (curve.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(curve.length - 1, lo + 1);
  const f = idx - lo;
  return {
    precision: curve[lo].precision + (curve[hi].precision - curve[lo].precision) * f,
    recall: curve[lo].recall + (curve[hi].recall - curve[lo].recall) * f,
  };
}

export function funnelForAoi(aoiId: string, sensitivity: number): FunnelResult {
  const base = AOI_FUNNEL_BASE[aoiId] ?? AOI_FUNNEL_BASE[AOI_ID];
  const threshold = sensitivityToThreshold(sensitivity);
  const candidates = CHANGE_CANDIDATES.filter((c) => c.aoiId === aoiId);
  const survivorPool = candidates.filter((c) => c.suppressedBy === null);
  const fractionPass = survivorPool.length
    ? survivorPool.filter((c) => c.confidence >= threshold).length / survivorPool.length
    : 1;
  const reported = Math.max(1, Math.round(base.reportedBase * fractionPass));
  const confirmed = Math.round(reported * base.confirmedRatio);

  const gateDropCounts = GATES.reduce((acc, g) => {
    acc[g] = candidates.filter((c) => c.suppressedBy === g).length;
    return acc;
  }, {} as Record<SuppressionGateId, number>);

  return { screened: base.screened, passedQuality: base.passedQuality, persisted: base.persisted, reported, confirmed, gateDropCounts };
}

// ---------------------------------------------------------------------------
// Acquisitions / time series (Change analysis timeline strip, Site timeline)
// ---------------------------------------------------------------------------
export function acquisitionsFor(aoiId: string): Acquisition[] {
  return SCENES.filter((s) => s.aoiId === aoiId)
    .sort((a, b) => a.datetime.localeCompare(b.datetime))
    .map((s) => ({
      date: s.datetime,
      sensor: s.sensor,
      cloudPct: s.cloudPct,
      usability: (s.cloudPct > 70 ? 'unusable' : s.cloudPct > 30 ? 'partly_cloudy' : 'clear') as AcquisitionUsability,
    }));
}

export function timeSeriesFor(aoiId: string, gridCellId?: string): TimeSeriesPoint[] {
  const acqs = acquisitionsFor(aoiId);
  const tRand = mulberry32(aoiId.length * 7919 + (gridCellId?.length ?? 0));
  const cell = CELL_DEFS.find((c) => gridCellId === `${AOI_ID}-cell-${c.cx}-${c.cy}`);

  return acqs.map((a) => {
    const year = new Date(a.date).getUTCFullYear();
    const era = cell ? eraForYear(cell, year) : null;
    const developed = era ? era.pattern !== 'bare' : false;
    const ndvi = clamp(0.18 + (tRand() - 0.5) * 0.06, 0.05, 0.3); // arid ridge — low, flat vegetation index all year
    const ndwi = clamp(-0.2 + (tRand() - 0.5) * 0.05, -0.4, -0.05); // no water bodies in this sector
    const sar = clamp((developed ? -6 : -14) + (tRand() - 0.5) * 1.5, -18, -3);
    const changeScore = clamp((year - 2016) / 9 + (tRand() - 0.5) * 0.05, 0, 1);
    return {
      date: a.date,
      changeScore: Math.round(changeScore * 100) / 100,
      ndvi: Math.round(ndvi * 100) / 100,
      ndwi: Math.round(ndwi * 100) / 100,
      sarBackscatter: Math.round(sar * 100) / 100,
      seasonalEnvelopeLow: 0.1,
      seasonalEnvelopeHigh: 0.3,
      usability: a.usability,
    };
  });
}

// ---------------------------------------------------------------------------
// Audit log — append-only, hash-chained
// ---------------------------------------------------------------------------
export const AUDIT_LOG: AuditEntry[] = [];
{
  let prevHash = '0'.repeat(64);
  const actions: { actor: string; action: string; targetType: string; targetId: string }[] = [
    { actor: 'system', action: 'ingest.scene', targetType: 'scene', targetId: SCENES[0].id },
    { actor: 'A. Rao', action: 'search.query', targetType: 'query', targetId: 'q-001' },
    { actor: 'A. Rao', action: 'candidate.decision', targetType: 'candidate', targetId: 'cand-0009' },
    { actor: 'S. Verma', action: 'candidate.decision', targetType: 'candidate', targetId: 'cand-0004' },
    { actor: 'K. Nair', action: 'cluster.name', targetType: 'cluster', targetId: 'cl-quarry' },
    { actor: 'system', action: 'index.incremental_insert', targetType: 'index', targetId: 'primary' },
    { actor: 'M. Iyer', action: 'export.geojson', targetType: 'export', targetId: 'exp-001' },
  ];
  actions.forEach((a, i) => {
    const createdAt = new Date(Date.now() - (actions.length - i) * 3600_000 * 9).toISOString();
    const payload = { note: `${a.action} recorded for prototype demo` };
    const modelVersions = { remoteclip: 'v1.2', dinov2: 'v1.0', tinycd: 'v0.9' };
    const hash = fauxHash(prevHash + a.actor + a.action + a.targetId + createdAt);
    AUDIT_LOG.push({ id: `audit-${i}`, ...a, payload, modelVersions, createdAt, prevHash, hash });
    prevHash = hash;
  });
}

// ---------------------------------------------------------------------------
// Model registry
// ---------------------------------------------------------------------------
export const MODELS: ModelInfo[] = [
  { name: 'RemoteCLIP', version: 'ViT-L/14', task: 'Text ↔ image retrieval', licence: 'Apache-2.0', sourceUrl: 'huggingface.co/chendelong/RemoteCLIP', sha256: fauxHash('remoteclip-vitl14'), sizeMb: 1710 },
  { name: 'DINOv2', version: 'ViT-B/14', task: 'Visual similarity / clustering', licence: 'Apache-2.0', sourceUrl: 'github.com/facebookresearch/dinov2', sha256: fauxHash('dinov2-vitb14'), sizeMb: 346 },
  { name: 'TinyCD', version: 'LEVIR-CD pretrained', task: 'Bi-temporal change confirmation', licence: 'MIT', sourceUrl: 'github.com/AndreaCodegoni/Tiny_model_4_CD', sha256: fauxHash('tinycd-levir'), sizeMb: 18 },
  { name: 'BIT', version: 'bitemporal-transformer-r18', task: 'Change confirmation (fallback)', licence: 'MIT', sourceUrl: 'github.com/justchenhao/BIT_CD', sha256: fauxHash('bit-r18'), sizeMb: 92 },
  { name: 's2cloudless', version: '1.7.1', task: 'Cloud / shadow / snow masking', licence: 'CC-BY-SA-4.0', sourceUrl: 'github.com/sentinel-hub/sentinel2-cloud-detector', sha256: fauxHash('s2cloudless'), sizeMb: 4 },
  { name: 'HDBSCAN + UMAP', version: 'hdbscan 0.8 / umap 0.5', task: 'Unsupervised clustering & 2-D layout', licence: 'BSD-3-Clause', sourceUrl: 'github.com/scikit-learn-contrib/hdbscan', sha256: fauxHash('hdbscan-umap'), sizeMb: 6 },
];

// ---------------------------------------------------------------------------
// Ingest jobs + index stats (Data manager)
// ---------------------------------------------------------------------------
export const INGEST_JOBS: IngestJob[] = SCENES.slice(-6).map((s, i) => ({
  id: `ingest-${i}`,
  filename: `${s.id}.tif`,
  aoiId: s.aoiId,
  status: 'done',
  progress: 100,
  tilesProduced: GRID * GRID,
  embedMs: Math.round(lerp(800, 2400, rand())),
  indexInsertMs: Math.round(lerp(40, 220, rand())),
  startedAt: new Date(Date.now() - (6 - i) * 86400_000).toISOString(),
  finishedAt: new Date(Date.now() - (6 - i) * 86400_000 + 60_000).toISOString(),
  error: null,
  retryOf: null,
}));

export const INDEX_STATS: IndexStats = {
  vectorCount: TILES.length,
  indexSizeBytes: TILES.length * 768 * 4 * 2, // two embedding columns, float32
  lastBuildMs: 21_400,
  lastIncrementalInsertMs: 88,
  meanQueryLatencyMs: 24,
  p95QueryLatencyMs: 71,
  indexedAreaKm2: Math.round((AOIS[0].bbox[2] - AOIS[0].bbox[0]) * 111 * (AOIS[0].bbox[3] - AOIS[0].bbox[1]) * 111),
  sceneCount: SCENES.length,
  tileCount: TILES.length,
};

// ---------------------------------------------------------------------------
// Evaluation metrics
// ---------------------------------------------------------------------------
const QUERIES = [
  'missile launch pad or erector launcher',
  'underground bunker or tunnel entrance',
  'military airstrip or runway',
  'barracks or troop housing',
  'fuel storage tanks',
  'radar or sensor mast',
  'fortified perimeter wall with watchtowers',
  'forward staging camp',
  'vehicle motor pool',
  'aircraft hangar',
  'newly graded airstrip',
  'control tower',
];

export const EVAL_METRICS: EvalMetrics = {
  retrieval: {
    recallAt1: 0.71,
    recallAt5: 0.89,
    recallAt10: 0.95,
    map: 0.74,
    ndcgAt10: 0.83,
    perQuery: QUERIES.map((q) => {
      const r1 = clamp(0.55 + rand() * 0.42, 0, 1);
      return {
        query: q,
        recallAt1: Math.round(r1 * 100) / 100,
        recallAt5: Math.round(clamp(r1 + rand() * 0.25, 0, 1) * 100) / 100,
        recallAt10: Math.round(clamp(r1 + rand() * 0.35, 0, 1) * 100) / 100,
        relevant: 2 + Math.floor(rand() * 5),
        returned: 10,
        ap: Math.round(clamp(r1 + (rand() - 0.3) * 0.2, 0, 1) * 100) / 100,
      };
    }),
  },
  change: {
    precision: 0.93,
    recall: 0.78,
    f1: 0.85,
    confusion: {
      construction: { construction: 22, clearance: 1, water: 0, roads: 1 },
      clearance: { construction: 1, clearance: 9, water: 0, roads: 0 },
      water: { construction: 0, clearance: 0, water: 2, roads: 0 },
      roads: { construction: 1, clearance: 0, water: 0, roads: 6 },
    },
    prCurve: range(21).map((i) => {
      const t = i / 20;
      const recall = clamp(1 - t * 0.85, 0, 1);
      const precision = clamp(0.6 + t * 0.38, 0, 1);
      return { threshold: Math.round(t * 100) / 100, precision: Math.round(precision * 100) / 100, recall: Math.round(recall * 100) / 100 };
    }),
    operatingPointThreshold: 0.6,
    falseAlarmByConfounder: [
      { confounder: 'Seasonal snowmelt / scree', before: 27, after: 3 },
      { confounder: 'Dust haze', before: 19, after: 2 },
      { confounder: 'Shadow (ridge terrain)', before: 24, after: 4 },
      { confounder: 'View angle', before: 13, after: 4 },
      { confounder: 'Radiometry drift', before: 11, after: 2 },
      { confounder: 'Misregistration', before: 22, after: 3 },
    ],
    earliestDateAccuracy: 0.87,
    meanIntervalWidthDays: 365,
  },
  performance: {
    ingestTilesPerSec: 38.6,
    indexBuildTimeS: 21.4,
    incrementalInsertMs: 88,
    storagePerThousandTilesMb: 198,
    queryLatencyP50Ms: 24,
    queryLatencyP95Ms: 71,
    hardware: '1x RTX 4070 (12GB) + Ryzen 7, 32GB RAM, NVMe SSD',
    gitCommit: fauxHash('drishti-ai-prototype').slice(0, 12),
  },
};

export const SAVED_QUERIES: SavedQuery[] = [
  { id: 'sq-1', label: 'Missile launch pads', text: 'missile launch pad or erector launcher', mode: 'text', blend: 1 },
  { id: 'sq-2', label: 'Tunnel & bunker entrances', text: 'underground bunker or tunnel entrance', mode: 'text', blend: 1 },
  { id: 'sq-3', label: 'Airbase similarity', text: 'military airstrip or runway', mode: 'both', blend: 0.6 },
];

// ---------------------------------------------------------------------------
// Live incremental ingest — proves capability 2.2.6 (no rebuild). A freshly
// dropped scene has no real photograph yet, so its tiles render with the
// synthetic swatch fallback at each cell's most current known state.
// ---------------------------------------------------------------------------
export function ingestNewScene(aoiId: string, filename: string): { scene: Scene; tiles: Tile[] } {
  const aoi = aoiById(aoiId) ?? AOIS[0];
  const now = new Date().toISOString().slice(0, 10);
  const scene: Scene = {
    id: `scene-live-${Date.now()}`,
    sensor: 'S2',
    productLevel: 'L2A',
    datetime: now,
    crs: 'EPSG:32643',
    footprint: { bbox: aoi.bbox },
    cloudPct: Math.round(lerp(1, 10, rand())),
    sizeMb: Math.round(lerp(410, 520, rand())),
    checksum: fauxHash(`${filename}-${now}`).slice(0, 16),
    licence: 'Copernicus (free & open)',
    ingestedAt: new Date().toISOString(),
    aoiId,
  };
  SCENES.push(scene);
  ACQUISITION_DATES[aoiId] = [...(ACQUISITION_DATES[aoiId] ?? []), now];

  const newTiles: Tile[] = [];
  const nowYear = new Date().getUTCFullYear();
  for (const cell of CELL_DEFS) {
    const gridCellId = `${aoiId}-cell-${cell.cx}-${cell.cy}`;
    const era = eraForYear(cell, nowYear);
    const tile: Tile = {
      id: `tile-${gridCellId}-${now}-live`,
      sceneId: scene.id,
      aoiId,
      gridCellId,
      footprint: { bbox: cellBbox(cell.cx, cell.cy) },
      datetime: now,
      sensor: scene.sensor,
      gsdM: 10,
      validFrac: Math.round(lerp(0.9, 0.99, rand()) * 100) / 100,
      cloudFrac: Math.round(lerp(0.01, 0.08, rand()) * 100) / 100,
      thumbColor: THUMB_COLORS[era.pattern],
      thumbPattern: era.pattern,
      clusterId: null,
      embedding2d: embeddingFor(era.pattern, cell.cx * 4 + cell.cy),
      conceptTerms: era.terms,
      label: cell.name,
    };
    TILES.push(tile);
    newTiles.push(tile);
    const cluster = CLUSTERS.find((c) => c.id === CLUSTER_DEFS.find((d) => d.pattern === era.pattern)?.id);
    if (cluster) cluster.memberTileIds.push(tile.id);
  }

  INDEX_STATS.sceneCount = SCENES.length;
  INDEX_STATS.tileCount = TILES.length;
  INDEX_STATS.vectorCount = TILES.length;
  INDEX_STATS.indexSizeBytes = TILES.length * 768 * 4 * 2;
  INDEX_STATS.lastIncrementalInsertMs = Math.round(lerp(60, 140, rand()));

  return { scene, tiles: newTiles };
}

// Fractional bounds (0..1, top-left origin) that a tile's sprite crop occupies
// within its full source image — lets a magnifier zoom further into the exact
// same real pixels the thumbnail is already cropped from.
export interface CropFraction {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function tileCropFraction(tile: Tile): CropFraction {
  const parts = tile.gridCellId.split('-');
  const cy = Number(parts.pop());
  const cx = Number(parts.pop());
  if (Number.isNaN(cx) || Number.isNaN(cy)) return { left: 0, right: 1, top: 0, bottom: 1 };
  const row = GRID - 1 - cy; // image row 0 = north = top
  return {
    left: cx / GRID,
    right: (cx + 1) / GRID,
    top: row / GRID,
    bottom: (row + 1) / GRID,
  };
}

export function tileById(id: string): Tile | undefined {
  return TILES.find((t) => t.id === id);
}
export function sceneById(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id);
}
export function latestSceneFor(aoiId: string): Scene | undefined {
  return SCENES.filter((s) => s.aoiId === aoiId).sort((a, b) => b.datetime.localeCompare(a.datetime))[0];
}
export function candidateById(id: string): ChangeCandidate | undefined {
  return CHANGE_CANDIDATES.find((c) => c.id === id);
}
export function aoiById(id: string): AOI | undefined {
  return AOIS.find((a) => a.id === id);
}
