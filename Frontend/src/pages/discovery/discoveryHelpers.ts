import type { Cluster, Tile } from '../../lib/types';

export const yearOfTile = (t: Tile) => new Date(t.datetime).getUTCFullYear();

// A perceptual "time" ramp: deep violet (oldest) through teal to yellow (newest).
const STOPS = ['#6d3fd4', '#2f7fd6', '#22b8a5', '#a3d94a', '#fde047'];

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function ramp(t: number, stops: string[] = STOPS): string {
  const c = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(c));
  const f = c - i;
  const a = hexToRgb(stops[i]);
  const b = hexToRgb(stops[i + 1]);
  const m = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
}

export const yearColor = (year: number, minY: number, maxY: number) => ramp((year - minY) / Math.max(1, maxY - minY));
export const SIM_STOPS = ['#334155', '#6366f1', '#a5b4fc', '#ffffff'];

export function similarityPct(a: [number, number], b: [number, number]): number {
  return Math.round(100 * Math.exp(-Math.hypot(a[0] - b[0], a[1] - b[1]) / 1.8));
}

export interface SiteMatch {
  tile: Tile;
  sim: number;
}

// "More sites like this": for every OTHER location, its single best-matching frame,
// ranked by similarity. Locations, not years, are what an analyst wants more of.
export function nearestOtherSites(seed: Tile, pool: Tile[], k: number): SiteMatch[] {
  const best = new Map<string, SiteMatch>();
  for (const t of pool) {
    if (t.gridCellId === seed.gridCellId) continue;
    const sim = similarityPct(t.embedding2d, seed.embedding2d);
    const cur = best.get(t.gridCellId);
    if (!cur || sim > cur.sim) best.set(t.gridCellId, { tile: t, sim });
  }
  return [...best.values()].sort((a, b) => b.sim - a.sim).slice(0, k);
}

export interface Aggregate {
  count: number;
  byYear: Record<number, number>;
  byCluster: Record<string, number>;
  terms: [string, number][];
  medoid: Tile | null;
}

export function aggregate(tiles: Tile[]): Aggregate {
  const byYear: Record<number, number> = {};
  const byCluster: Record<string, number> = {};
  const termCount = new Map<string, number>();
  let cx = 0;
  let cy = 0;
  for (const t of tiles) {
    const y = yearOfTile(t);
    byYear[y] = (byYear[y] ?? 0) + 1;
    const cid = t.clusterId ?? 'none';
    byCluster[cid] = (byCluster[cid] ?? 0) + 1;
    t.conceptTerms.forEach((term) => termCount.set(term, (termCount.get(term) ?? 0) + 1));
    cx += t.embedding2d[0];
    cy += t.embedding2d[1];
  }
  const n = Math.max(1, tiles.length);
  const centre: [number, number] = [cx / n, cy / n];
  const medoid = tiles.length
    ? tiles.reduce((best, t) => (similarityPct(t.embedding2d, centre) > similarityPct(best.embedding2d, centre) ? t : best), tiles[0])
    : null;
  return {
    count: tiles.length,
    byYear,
    byCluster,
    terms: [...termCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    medoid,
  };
}

export function clusterMembers(cluster: Cluster, tileIndex: Map<string, Tile>): Tile[] {
  return cluster.memberTileIds.map((id) => tileIndex.get(id)).filter((t): t is Tile => !!t);
}

// Where a location changed "identity" (jumped to a different cluster) over time.
export function identityChanges(cellTiles: Tile[], clusters: Cluster[]) {
  const name = (t: Tile) => clusters.find((c) => c.id === t.clusterId)?.name ?? 'Unclassified';
  const out: { year: number; from: string; to: string }[] = [];
  for (let i = 1; i < cellTiles.length; i++) {
    if (cellTiles[i].clusterId !== cellTiles[i - 1].clusterId) {
      out.push({ year: yearOfTile(cellTiles[i]), from: name(cellTiles[i - 1]), to: name(cellTiles[i]) });
    }
  }
  return out;
}
