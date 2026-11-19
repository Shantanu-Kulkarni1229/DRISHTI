// Shared domain types for the Drishti AI prototype.
// The real system is described in SIH-26227-prototype-spec.md — this file
// mirrors the data model in §9 closely enough that swapping mock data for a
// live API later is a matter of changing the fetch layer, not these shapes.

export type Sensor = 'S2' | 'S1' | 'L8' | 'BHUVAN';

export type ChangeType = 'construction' | 'clearance' | 'water' | 'roads';

export type ChangeDirection = 'appearance' | 'disappearance' | 'expansion' | 'contraction';

export type AcquisitionUsability = 'clear' | 'partly_cloudy' | 'unusable' | 'missing';

export type SuppressionGateId =
  | 'validity'
  | 'radiometry'
  | 'registration'
  | 'season'
  | 'persistence'
  | 'cross_sensor'
  | 'geometry';

export interface LngLat {
  lng: number;
  lat: number;
}

export interface Footprint {
  // simple axis-aligned box in a local demo projection (not real EPSG:4326 math,
  // but treated as [minLng, minLat, maxLng, maxLat] for display purposes)
  bbox: [number, number, number, number];
}

export interface AOI {
  id: string;
  name: string;
  description: string;
  bbox: [number, number, number, number];
  changeSignature: string;
}

export interface Scene {
  id: string;
  sensor: Sensor;
  productLevel: string;
  datetime: string; // ISO date
  crs: string;
  footprint: Footprint;
  cloudPct: number;
  sizeMb: number;
  checksum: string;
  licence: string;
  ingestedAt: string;
  aoiId: string;
  imageUrl?: string; // real full-frame source image, when available
}

export interface Tile {
  id: string;
  sceneId: string;
  aoiId: string;
  gridCellId: string;
  footprint: Footprint;
  datetime: string;
  sensor: Sensor;
  gsdM: number;
  validFrac: number;
  cloudFrac: number;
  thumbColor: string; // placeholder "imagery" swatch, used only when imageUrl is absent
  thumbPattern: TilePattern;
  clusterId: string | null;
  embedding2d: [number, number]; // precomputed UMAP-ish position for Discovery
  conceptTerms: string[]; // nearest concept terms in embedding space, for "why this matched"
  imageUrl?: string; // real source scene image (full AOI frame) when available
  cropPosition?: string; // CSS background-position for this tile's crop of imageUrl (sprite-sheet technique)
  label?: string; // human-readable feature name for this grid cell, e.g. "Missile battery field"
}

export type TilePattern = 'urban' | 'bare' | 'vegetation' | 'water' | 'road' | 'quarry' | 'airport' | 'mixed';

export interface SearchResult {
  tile: Tile;
  score: number;
  saliency: { x: number; y: number; r: number }[]; // mock saliency blobs, 0..1 normalized
  textScore?: number;
  imageScore?: number;
  rocchioScore?: number;
}

export interface SuppressionFactor {
  gate: SuppressionGateId;
  label: string;
  value: number; // 0..1 contribution to confidence
}

export interface ChangeCandidate {
  id: string;
  aoiId: string;
  gridCellId: string;
  tileBeforeId: string;
  tileAfterId: string;
  geomCenter: LngLat;
  bbox: [number, number, number, number];
  areaM2: number;
  type: ChangeType;
  direction: ChangeDirection;
  score: number;
  confidence: number;
  factors: SuppressionFactor[];
  status: 'pending' | 'accepted' | 'rejected';
  rejectReason: RejectReasonCode | null;
  suppressedBy: SuppressionGateId | null; // set only for candidates shown in "why dropped" galleries
  assignee: string | null;
  earliestIntervalStart: string;
  earliestIntervalEnd: string;
  revisitGapDays: number;
  jobId: string;
  registrationResidualPx: number;
  seasonalZScore: number;
  sarAgreement: number;
  headline?: string; // short human title, e.g. "First missile launch pad appears"
  narrative?: string; // full natural-language analyst-style description of the change
}

export type RejectReasonCode =
  | 'cloud'
  | 'shadow'
  | 'seasonal'
  | 'misregistration'
  | 'not_of_interest'
  | 'duplicate';

export interface Decision {
  id: string;
  candidateId: string;
  actor: string;
  verdict: 'accepted' | 'rejected';
  reasonCode: RejectReasonCode | null;
  note: string;
  createdAt: string;
}

export interface Cluster {
  id: string;
  name: string;
  isSaved: boolean;
  memberTileIds: string[];
  color: string;
  centroid2d: [number, number];
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  payload: Record<string, unknown>;
  modelVersions: Record<string, string>;
  createdAt: string;
  prevHash: string;
  hash: string;
}

export interface ModelInfo {
  name: string;
  version: string;
  task: string;
  licence: string;
  sourceUrl: string;
  sha256: string;
  sizeMb: number;
}

export interface IngestJob {
  id: string;
  filename: string;
  aoiId: string;
  status: 'queued' | 'masking' | 'normalising' | 'aligning' | 'tiling' | 'embedding' | 'indexing' | 'done' | 'failed';
  progress: number; // 0..100
  tilesProduced: number;
  embedMs: number | null;
  indexInsertMs: number | null;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  retryOf: string | null; // id of the job this one retries, if any
}

export interface IndexStats {
  vectorCount: number;
  indexSizeBytes: number;
  lastBuildMs: number;
  lastIncrementalInsertMs: number;
  meanQueryLatencyMs: number;
  p95QueryLatencyMs: number;
  indexedAreaKm2: number;
  sceneCount: number;
  tileCount: number;
}

export interface Acquisition {
  date: string;
  usability: AcquisitionUsability;
  sensor: Sensor;
  cloudPct: number;
}

export interface TimeSeriesPoint {
  date: string;
  changeScore: number;
  ndvi: number;
  ndwi: number;
  sarBackscatter: number;
  seasonalEnvelopeLow: number;
  seasonalEnvelopeHigh: number;
  usability: AcquisitionUsability;
}

export interface RetrievalQueryResult {
  query: string;
  recallAt1: number;
  recallAt5: number;
  recallAt10: number;
  relevant: number;
  returned: number;
  ap: number;
}

export interface EvalMetrics {
  retrieval: {
    recallAt1: number;
    recallAt5: number;
    recallAt10: number;
    map: number;
    ndcgAt10: number;
    perQuery: RetrievalQueryResult[];
  };
  change: {
    precision: number;
    recall: number;
    f1: number;
    confusion: Record<ChangeType, Record<ChangeType, number>>;
    prCurve: { threshold: number; precision: number; recall: number }[];
    operatingPointThreshold: number;
    falseAlarmByConfounder: { confounder: string; before: number; after: number }[];
    earliestDateAccuracy: number;
    meanIntervalWidthDays: number;
  };
  performance: {
    ingestTilesPerSec: number;
    indexBuildTimeS: number;
    incrementalInsertMs: number;
    storagePerThousandTilesMb: number;
    queryLatencyP50Ms: number;
    queryLatencyP95Ms: number;
    hardware: string;
    gitCommit: string;
  };
}

export interface SavedQuery {
  id: string;
  label: string;
  text: string;
  mode: 'text' | 'image' | 'both';
  blend: number;
}
