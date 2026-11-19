// Export/audit helpers for the Export & audit screen. Pure functions only —
// no React, no store access beyond mockData lookups — so they're easy to
// unit-reason-about and reuse across GeoJSON/CSV/KML/STAC/brief generation.
import { tileById, sceneById, MODELS } from '../../lib/mockData';
import { CHANGE_TYPE_LABELS } from '../../lib/colors';
import type { AuditEntry, ChangeCandidate, Decision } from '../../lib/types';

export type ExportProperties = Record<string, string | number | boolean | null>;

export interface ExportFeature {
  properties: ExportProperties;
  bbox: [number, number, number, number];
  center: { lng: number; lat: number };
}

function modelVersion(name: string): string {
  const m = MODELS.find((mm) => mm.name === name);
  return m ? `${m.name} ${m.version}` : name;
}

/** Builds the flat properties object that every export format (GeoJSON, CSV,
 * KML, STAC) writes out for a single change candidate — source scene IDs +
 * checksums, processing/model versions, confidence and the analyst decision. */
export function buildExportFeature(
  candidate: ChangeCandidate,
  status: { status: string; rejectReason: string | null },
  decision: Decision | undefined
): ExportFeature {
  const tb = tileById(candidate.tileBeforeId);
  const ta = tileById(candidate.tileAfterId);
  const sceneBefore = tb ? sceneById(tb.sceneId) : undefined;
  const sceneAfter = ta ? sceneById(ta.sceneId) : undefined;

  const properties: ExportProperties = {
    candidate_id: candidate.id,
    aoi_id: candidate.aoiId,
    grid_cell_id: candidate.gridCellId,
    type: candidate.type,
    type_label: CHANGE_TYPE_LABELS[candidate.type],
    direction: candidate.direction,
    confidence: candidate.confidence,
    score: candidate.score,
    area_m2: candidate.areaM2,
    status: status.status,
    reject_reason: status.rejectReason ?? '',
    decision_actor: decision?.actor ?? '',
    decision_note: decision?.note ?? '',
    decision_at: decision?.createdAt ?? '',
    scene_before_id: sceneBefore?.id ?? candidate.tileBeforeId,
    scene_before_checksum: sceneBefore?.checksum ?? '',
    scene_before_date: sceneBefore?.datetime ?? tb?.datetime ?? '',
    scene_after_id: sceneAfter?.id ?? candidate.tileAfterId,
    scene_after_checksum: sceneAfter?.checksum ?? '',
    scene_after_date: sceneAfter?.datetime ?? ta?.datetime ?? '',
    earliest_interval_start: candidate.earliestIntervalStart,
    earliest_interval_end: candidate.earliestIntervalEnd,
    revisit_gap_days: candidate.revisitGapDays,
    job_id: candidate.jobId,
    model_remoteclip: modelVersion('RemoteCLIP'),
    model_dinov2: modelVersion('DINOv2'),
    model_tinycd: modelVersion('TinyCD'),
  };

  return { properties, bbox: candidate.bbox, center: candidate.geomCenter };
}

function bboxPolygon(bbox: [number, number, number, number]) {
  const [minX, minY, maxX, maxY] = bbox;
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
        [minX, minY],
      ],
    ],
  };
}

export function toGeoJSON(features: ExportFeature[]): string {
  const fc = {
    type: 'FeatureCollection',
    features: features.map((f) => ({
      type: 'Feature',
      geometry: bboxPolygon(f.bbox),
      properties: f.properties,
    })),
  };
  return JSON.stringify(fc, null, 2);
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(rows: ExportProperties[]): string {
  if (rows.length === 0) return '';
  const columns = Object.keys(rows[0]);
  const header = columns.join(',');
  const body = rows.map((r) => columns.map((c) => csvEscape(r[c])).join(','));
  return [header, ...body].join('\n');
}

function xmlEscape(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function toKML(features: ExportFeature[]): string {
  const placemarks = features
    .map((f) => {
      const [minX, minY, maxX, maxY] = f.bbox;
      const coords = `${minX},${minY},0 ${maxX},${minY},0 ${maxX},${maxY},0 ${minX},${maxY},0 ${minX},${minY},0`;
      const data = Object.entries(f.properties)
        .map(([k, v]) => `      <Data name="${xmlEscape(k)}"><value>${xmlEscape(v)}</value></Data>`)
        .join('\n');
      return `  <Placemark>
    <name>${xmlEscape(f.properties.candidate_id)}</name>
    <ExtendedData>
${data}
    </ExtendedData>
    <Polygon>
      <outerBoundaryIs>
        <LinearRing>
          <coordinates>${coords}</coordinates>
        </LinearRing>
      </outerBoundaryIs>
    </Polygon>
  </Placemark>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
<name>Drishti AI change export</name>
${placemarks}
</Document>
</kml>`;
}

export function toSTACItems(features: ExportFeature[]): string {
  const items = features.map((f) => {
    const [minX, minY, maxX, maxY] = f.bbox;
    return {
      type: 'Feature',
      stac_version: '1.0.0',
      id: String(f.properties.candidate_id),
      geometry: bboxPolygon(f.bbox),
      bbox: [minX, minY, maxX, maxY],
      properties: {
        datetime: f.properties.scene_after_date || new Date().toISOString(),
        ...f.properties,
      },
      links: [],
      assets: {},
    };
  });
  return JSON.stringify(items, null, 2);
}

/** A print-ready HTML "brief" — before/after plates rendered as colour swatches
 * from the mock tile pattern data (there's no real imagery in this prototype)
 * plus the full attribute table per candidate. Honestly labelled as HTML, not
 * a literal PDF, since client-side PDF generation isn't practical here. */
export function buildBriefHTML(
  candidates: ChangeCandidate[],
  statusFor: (id: string) => { status: string; rejectReason: string | null },
  decisions: Decision[]
): string {
  const sections = candidates
    .map((c) => {
      const tb = tileById(c.tileBeforeId);
      const ta = tileById(c.tileAfterId);
      const status = statusFor(c.id);
      const decision = decisions.find((d) => d.candidateId === c.id);
      const feature = buildExportFeature(c, status, decision);
      const rows = Object.entries(feature.properties)
        .map(([k, v]) => `<tr><th>${xmlEscape(k)}</th><td>${xmlEscape(v)}</td></tr>`)
        .join('');
      return `
  <section class="candidate">
    <h2>${xmlEscape(c.id)} &mdash; ${xmlEscape(CHANGE_TYPE_LABELS[c.type])}</h2>
    <div class="plates">
      <div class="plate" style="background:${tb?.thumbColor ?? '#333'}">
        <span>BEFORE &middot; ${xmlEscape(tb?.datetime ?? '?')}</span>
        <span class="pattern">${xmlEscape(tb?.thumbPattern ?? '')}</span>
      </div>
      <div class="plate" style="background:${ta?.thumbColor ?? '#333'}">
        <span>AFTER &middot; ${xmlEscape(ta?.datetime ?? '?')}</span>
        <span class="pattern">${xmlEscape(ta?.thumbPattern ?? '')}</span>
      </div>
    </div>
    <table>${rows}</table>
  </section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Drishti AI — export brief</title>
<style>
  body { font-family: -apple-system, Segoe UI, Arial, sans-serif; background:#0b0f16; color:#e6e9ef; padding:24px; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .meta { color:#9aa4b2; font-size:12px; margin-bottom: 20px; }
  .candidate { border: 1px solid #2a3140; border-radius: 8px; padding: 14px; margin-bottom: 16px; page-break-inside: avoid; }
  .candidate h2 { font-size: 13px; margin: 0 0 8px; }
  .plates { display:flex; gap:8px; margin: 8px 0 12px; }
  .plate { flex:1; height:80px; border-radius:6px; display:flex; flex-direction:column; justify-content:space-between; padding:6px; font-size:11px; color:#111; font-weight:600; text-shadow: 0 1px 1px rgba(255,255,255,0.35); }
  table { width:100%; border-collapse: collapse; font-size:11px; }
  th, td { text-align:left; padding:3px 6px; border-bottom: 1px solid #232a37; }
  th { color:#9aa4b2; font-weight:500; width:200px; }
  @media print {
    body { background:#fff; color:#111; }
    .candidate { border-color:#ccc; }
    th, td { border-color:#ddd; }
    .meta { color:#555; }
  }
</style>
</head>
<body>
  <h1>Drishti AI &mdash; change detection export brief</h1>
  <p class="meta">Generated ${new Date().toISOString()} &middot; ${candidates.length} candidate(s)</p>
  ${sections}
</body>
</html>`;
}

export function toAuditCSV(entries: AuditEntry[]): string {
  const rows = entries.map((e) => ({
    id: e.id,
    actor: e.actor,
    action: e.action,
    target_type: e.targetType,
    target_id: e.targetId,
    created_at: e.createdAt,
    model_versions: Object.entries(e.modelVersions)
      .map(([k, v]) => `${k}:${v}`)
      .join(' '),
    prev_hash: e.prevHash,
    hash: e.hash,
  }));
  return toCSV(rows);
}

export function toAuditJSON(entries: AuditEntry[]): string {
  return JSON.stringify(entries, null, 2);
}
