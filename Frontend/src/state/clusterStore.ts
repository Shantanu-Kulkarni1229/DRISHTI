import { create } from 'zustand';
import { CLUSTERS, TILES } from '../lib/mockData';
import type { Cluster } from '../lib/types';

const CUSTOM_COLORS = ['#F472B6', '#2DD4BF', '#FB923C', '#A3E635', '#60A5FA', '#E879F9'];

interface ClusterState {
  clusters: Cluster[];
  selectedClusterId: string | null;
  lassoSelectedTileIds: string[];
  seedTileId: string | null;
  rename: (id: string, name: string) => void;
  toggleSave: (id: string) => void;
  select: (id: string | null) => void;
  setLassoSelection: (ids: string[]) => void;
  setSeedTile: (id: string | null) => void;
  createCluster: (name: string, tileIds: string[]) => string;
}

export const useClusterStore = create<ClusterState>((set, get) => ({
  clusters: CLUSTERS.map((c) => ({ ...c })),
  selectedClusterId: null,
  lassoSelectedTileIds: [],
  seedTileId: null,

  rename: (id, name) => set((s) => ({ clusters: s.clusters.map((c) => (c.id === id ? { ...c, name } : c)) })),
  toggleSave: (id) => set((s) => ({ clusters: s.clusters.map((c) => (c.id === id ? { ...c, isSaved: !c.isSaved } : c)) })),
  select: (id) => set({ selectedClusterId: id, lassoSelectedTileIds: [] }),
  setLassoSelection: (ids) => set({ lassoSelectedTileIds: ids, selectedClusterId: null }),
  setSeedTile: (id) => set({ seedTileId: id }),

  // A user-defined site type built from a lasso selection.
  createCluster: (name, tileIds) => {
    const members = tileIds.map((id) => TILES.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => !!t);
    const cx = members.reduce((s, t) => s + t.embedding2d[0], 0) / Math.max(1, members.length);
    const cy = members.reduce((s, t) => s + t.embedding2d[1], 0) / Math.max(1, members.length);
    const custom = get().clusters.filter((c) => c.id.startsWith('cl-custom')).length;
    const id = `cl-custom-${Date.now()}`;
    const cluster: Cluster = {
      id,
      name: name.trim() || `Custom site type ${custom + 1}`,
      isSaved: true,
      memberTileIds: members.map((t) => t.id),
      color: CUSTOM_COLORS[custom % CUSTOM_COLORS.length],
      centroid2d: [cx, cy],
    };
    set((s) => ({ clusters: [cluster, ...s.clusters], selectedClusterId: id, lassoSelectedTileIds: [] }));
    return id;
  },
}));
