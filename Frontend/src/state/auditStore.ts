import { create } from 'zustand';
import { AUDIT_LOG } from '../lib/mockData';
import { fauxHash } from '../lib/utils';
import type { AuditEntry } from '../lib/types';

interface AuditState {
  entries: AuditEntry[];
  append: (e: Omit<AuditEntry, 'id' | 'createdAt' | 'prevHash' | 'hash' | 'modelVersions'> & { modelVersions?: Record<string, string> }) => AuditEntry;
}

export const useAuditStore = create<AuditState>((set, get) => ({
  entries: [...AUDIT_LOG],

  append: (e) => {
    const entries = get().entries;
    const prevHash = entries[0]?.hash ?? '0'.repeat(64);
    const createdAt = new Date().toISOString();
    const modelVersions = e.modelVersions ?? { remoteclip: 'v1.2', dinov2: 'v1.0', tinycd: 'v0.9' };
    const hash = fauxHash(prevHash + e.actor + e.action + e.targetId + createdAt);
    const entry: AuditEntry = {
      id: `audit-live-${Date.now()}`,
      actor: e.actor,
      action: e.action,
      targetType: e.targetType,
      targetId: e.targetId,
      payload: e.payload,
      modelVersions,
      createdAt,
      prevHash,
      hash,
    };
    set({ entries: [entry, ...entries] });
    return entry;
  },
}));
