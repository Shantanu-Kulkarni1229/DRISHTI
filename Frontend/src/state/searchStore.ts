import { create } from 'zustand';
import { TILES, tileById, SAVED_QUERIES } from '../lib/mockData';
import { mulberry32, clamp } from '../lib/rng';
import { useFilterStore } from './filterStore';
import type { SearchResult, SavedQuery, Tile } from '../lib/types';

export type QueryMode = 'text' | 'image' | 'both';

interface SearchState {
  queryText: string;
  mode: QueryMode;
  blend: number; // 0 = pure text, 1 = pure image, used when mode === 'both'
  imageQueryTileId: string | null;
  queryVector: [number, number] | null; // Rocchio-adjusted point in embedding space
  results: SearchResult[];
  feedback: Record<string, 'good' | 'bad'>;
  hoveredTileId: string | null;
  selectedTileId: string | null;
  feedbackRounds: number;
  drawnAoiBbox: [number, number, number, number] | null;
  savedQueries: SavedQuery[];
  recentQueries: string[];
  lastSearchAt: number;

  setQueryText: (t: string) => void;
  setMode: (m: QueryMode) => void;
  setBlend: (b: number) => void;
  setImageQuery: (tileId: string | null) => void;
  setDrawnAoi: (bbox: [number, number, number, number] | null) => void;
  runSearch: () => void;
  markFeedback: (tileId: string, label: 'good' | 'bad') => void;
  resetFeedback: () => void;
  setHovered: (id: string | null) => void;
  setSelected: (id: string | null) => void;
  saveCurrentQuery: (label: string) => void;
  removeSavedQuery: (id: string) => void;
  loadSavedQuery: (sq: SavedQuery) => void;
}

function dist2(a: [number, number], b: [number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function detectRoute(text: string) {
  const t = text.toLowerCase();
  const temporal = /(new|newly|recent|recently)\b/.test(t);
  const underground = /(underground|tunnel|bunker|buried)/.test(t);
  return { temporal, underground };
}

function textScore(tile: Tile, text: string): number {
  if (!text.trim()) return 0.3;
  const t = text.toLowerCase();
  const words = t.split(/\s+/).filter(Boolean);
  let hits = 0;
  const haystack = [tile.thumbPattern, ...tile.conceptTerms].join(' ').toLowerCase();
  for (const w of words) {
    if (haystack.includes(w)) hits += 1;
  }
  const { temporal, underground } = detectRoute(text);
  let bonus = 0;
  if (temporal && (tile.thumbPattern === 'quarry' || tile.thumbPattern === 'airport' || tile.thumbPattern === 'road')) bonus += 0.25;
  if (underground && tile.thumbPattern === 'mixed') bonus += 0.35;
  const base = clamp(hits / Math.max(2, words.length), 0, 1);
  return clamp(base * 0.7 + bonus, 0, 1);
}

export const useSearchStore = create<SearchState>((set, get) => ({
  queryText: 'missile launch pad or erector launcher',
  mode: 'text',
  blend: 0.5,
  imageQueryTileId: null,
  queryVector: null,
  results: [],
  feedback: {},
  hoveredTileId: null,
  selectedTileId: null,
  feedbackRounds: 0,
  drawnAoiBbox: null,
  savedQueries: [...SAVED_QUERIES],
  recentQueries: [],
  lastSearchAt: 0,

  setQueryText: (t) => set({ queryText: t }),
  setMode: (m) => set({ mode: m }),
  setBlend: (b) => set({ blend: b }),
  setImageQuery: (tileId) => set({ imageQueryTileId: tileId, mode: tileId ? 'image' : 'text' }),
  setDrawnAoi: (bbox) => set({ drawnAoiBbox: bbox }),
  setHovered: (id) => set({ hoveredTileId: id }),
  setSelected: (id) => set({ selectedTileId: id }),

  runSearch: () => {
    const { queryText, mode, blend, imageQueryTileId, queryVector, recentQueries } = get();
    const { aoiId, dateFrom, dateTo, sensors, maxCloud } = useFilterStore.getState();

    const seed = mulberry32(queryText.length * 131 + (imageQueryTileId?.length ?? 0));
    const imgSeed = imageQueryTileId ? tileById(imageQueryTileId) : null;

    let pool = TILES.filter(
      (t) =>
        t.aoiId === aoiId &&
        t.datetime >= dateFrom &&
        t.datetime <= dateTo &&
        sensors.includes(t.sensor) &&
        t.cloudFrac * 100 <= maxCloud
    );
    if (pool.length === 0) pool = TILES.filter((t) => t.aoiId === aoiId);

    const scored = pool.map((tile) => {
      const txt = textScore(tile, queryText);
      const img = imgSeed ? clamp(1 - dist2(tile.embedding2d, imgSeed.embedding2d) / 6, 0, 1) : txt;
      let score = mode === 'text' ? txt : mode === 'image' ? img : txt * (1 - blend) + img * blend;

      let rocchio: number | undefined;
      if (queryVector) {
        rocchio = clamp(1 - dist2(tile.embedding2d, queryVector) / 6, 0, 1);
        score = score * 0.55 + rocchio * 0.45;
      }
      score = clamp(score + (seed() - 0.5) * 0.06, 0.02, 0.99);
      return { tile, score, txt, img: mode === 'text' ? undefined : img, rocchio };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 24);

    const results: SearchResult[] = top.map(({ tile, score, txt, img, rocchio }) => {
      const sRand = mulberry32(tile.id.length * 977 + Math.round(score * 1000));
      const nBlobs = 2 + Math.floor(sRand() * 2);
      const saliency = Array.from({ length: nBlobs }, () => ({
        x: sRand(),
        y: sRand(),
        r: 0.12 + sRand() * 0.16,
      }));
      return {
        tile,
        score: Math.round(score * 100) / 100,
        saliency,
        textScore: Math.round(txt * 100) / 100,
        imageScore: img !== undefined ? Math.round(img * 100) / 100 : undefined,
        rocchioScore: rocchio !== undefined ? Math.round(rocchio * 100) / 100 : undefined,
      };
    });

    const trimmed = queryText.trim();
    const nextRecent = trimmed && mode !== 'image'
      ? [trimmed, ...recentQueries.filter((q) => q !== trimmed)].slice(0, 6)
      : recentQueries;

    set({ results, recentQueries: nextRecent, lastSearchAt: Date.now() });
  },

  markFeedback: (tileId, label) => {
    const { feedback, results, queryVector } = get();
    const nextFeedback = { ...feedback, [tileId]: label };

    const good = results.filter((r) => nextFeedback[r.tile.id] === 'good').map((r) => r.tile.embedding2d);
    const bad = results.filter((r) => nextFeedback[r.tile.id] === 'bad').map((r) => r.tile.embedding2d);

    const seedVec: [number, number] = queryVector ?? centroid(results.slice(0, 5).map((r) => r.tile.embedding2d));
    const alpha = 1;
    const beta = 0.6;
    const gamma = 0.4;
    const goodC = good.length ? centroid(good) : [0, 0];
    const badC = bad.length ? centroid(bad) : [0, 0];
    const nextVec: [number, number] = [
      alpha * seedVec[0] + (good.length ? beta * goodC[0] : 0) - (bad.length ? gamma * badC[0] : 0),
      alpha * seedVec[1] + (good.length ? beta * goodC[1] : 0) - (bad.length ? gamma * badC[1] : 0),
    ];
    const norm = 1 + (good.length ? beta : 0) + (bad.length ? gamma : 0);

    set({
      feedback: nextFeedback,
      queryVector: [nextVec[0] / norm, nextVec[1] / norm],
      feedbackRounds: get().feedbackRounds + 1,
    });
    get().runSearch();
  },

  resetFeedback: () => set({ feedback: {}, queryVector: null, feedbackRounds: 0 }),

  saveCurrentQuery: (label) => {
    const { queryText, mode, blend, savedQueries } = get();
    const sq: SavedQuery = { id: `sq-${Date.now()}`, label: label || queryText.slice(0, 32) || 'Untitled query', text: queryText, mode, blend };
    set({ savedQueries: [sq, ...savedQueries] });
  },
  removeSavedQuery: (id) => set((s) => ({ savedQueries: s.savedQueries.filter((q) => q.id !== id) })),
  loadSavedQuery: (sq) => set({ queryText: sq.text, mode: sq.mode, blend: sq.blend }),
}));

function centroid(pts: [number, number][]): [number, number] {
  if (!pts.length) return [0, 0];
  const sx = pts.reduce((s, p) => s + p[0], 0);
  const sy = pts.reduce((s, p) => s + p[1], 0);
  return [sx / pts.length, sy / pts.length];
}
