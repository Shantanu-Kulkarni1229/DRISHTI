/**
 * DRISHTI API Client
 * Connects the React frontend to the FastAPI modular monolith backend.
 * Endpoints are routed through Vite's development proxy configured in vite.config.ts.
 */

import type {
  AuditEntry,
  ChangeCandidate,
  Cluster,
  IngestJob,
  ModelInfo,
  SearchResult,
  Tile,
} from './types';

const API_BASE = '/api';

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('drishti_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson.detail) {
        errorDetail = errorJson.detail;
      }
    } catch {
      // Non-JSON error body
    }
    throw new ApiError(response.status, errorDetail);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // System Health
  async health(): Promise<{ status: string; version: string; offline_mode: boolean }> {
    return request('/health');
  },

  // Search & Retrieval
  async search(params: {
    queryText?: string;
    mode?: 'text' | 'image' | 'both';
    blend?: number;
    imageQueryTileId?: string | null;
    aoiId?: string;
    dateFrom?: string;
    dateTo?: string;
    sensors?: string[];
    maxCloud?: number;
    k?: number;
  }): Promise<{ queryId: string; results: SearchResult[] }> {
    return request('/search', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async feedback(params: {
    queryId: string;
    tileId: string;
    label: 'good' | 'bad';
  }): Promise<{ status: string; message: string }> {
    return request('/search/feedback', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // Tiles & Visual Similarity
  async getTile(tileId: string): Promise<Tile> {
    return request(`/tiles/${tileId}`);
  },

  async getSimilarTiles(tileId: string, k = 12, space = 'dino'): Promise<Tile[]> {
    return request(`/tiles/${tileId}/similar?k=${k}&space=${space}`);
  },

  // Temporal Change Candidates & Decisions
  async getCandidates(aoiId?: string): Promise<ChangeCandidate[]> {
    const url = aoiId ? `/candidates?aoi_id=${encodeURIComponent(aoiId)}` : '/candidates';
    return request(url);
  },

  async getCandidate(candidateId: string): Promise<ChangeCandidate> {
    return request(`/candidates/${candidateId}`);
  },

  async getEarliestObservation(candidateId: string): Promise<{
    candidateId: string;
    earliestIntervalStart: string;
    earliestIntervalEnd: string;
    revisitGapDays: number;
    cloudGapDetected: boolean;
  }> {
    return request(`/candidates/${candidateId}/earliest`);
  },

  async recordDecision(
    candidateId: string,
    decision: { verdict: 'accepted' | 'rejected'; reasonCode?: string; note?: string }
  ): Promise<{ id: string; candidateId: string; verdict: string; note: string; createdAt: string }> {
    return request(`/candidates/${candidateId}/decision`, {
      method: 'POST',
      body: JSON.stringify(decision),
    });
  },

  // Unsupervised Discovery Clusters
  async getClusters(aoiId?: string): Promise<Cluster[]> {
    const url = aoiId ? `/clusters?aoi_id=${encodeURIComponent(aoiId)}` : '/clusters';
    return request(url);
  },

  async renameCluster(clusterId: string, name: string): Promise<Cluster> {
    return request(`/clusters/${clusterId}/name`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  // Tamper-Evident Audit Trail
  async getAuditLog(): Promise<AuditEntry[]> {
    return request('/audit');
  },

  async verifyAudit(): Promise<{ valid: boolean; records_verified: number; latest_hash: string }> {
    return request('/audit/verify');
  },

  // Models & System Metrics
  async getModels(): Promise<ModelInfo[]> {
    return request('/admin/models');
  },

  async getIndexStats(): Promise<{
    vectorCount: number;
    indexSizeBytes: number;
    meanQueryLatencyMs: number;
    indexedAreaKm2: number;
    sceneCount: number;
    tileCount: number;
  }> {
    return request('/admin/index/stats');
  },

  // Ingestion Jobs
  async getIngestJobs(): Promise<IngestJob[]> {
    return request('/ingest/jobs');
  },

  async triggerWatchFolder(watchPath: string, aoiId?: string): Promise<{ jobId: string }> {
    return request('/ingest/watch', {
      method: 'POST',
      body: JSON.stringify({ watch_path: watchPath, aoi_id: aoiId }),
    });
  },

  // Multi-Format Export
  async exportCandidates(
    candidateIds: string[],
    format: 'geojson' | 'csv' | 'kml' | 'stac' | 'geopackage' = 'geojson'
  ): Promise<{ export_id: string; format: string; item_count: number; download_url: string; file_size_bytes: number }> {
    return request('/export', {
      method: 'POST',
      body: JSON.stringify({ candidateIds, format }),
    });
  },
};
