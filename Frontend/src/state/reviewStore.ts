import { create } from 'zustand';
import { CHANGE_CANDIDATES, DECISIONS } from '../lib/mockData';
import { useAuditStore } from './auditStore';
import type { Decision, RejectReasonCode } from '../lib/types';

interface StatusEntry {
  status: 'pending' | 'accepted' | 'rejected';
  rejectReason: RejectReasonCode | null;
}

interface HistoryEntry {
  batch: string;
  candidateId: string;
  prev: StatusEntry;
  decisionId: string;
}

interface ReviewState {
  actor: string;
  statusMap: Record<string, StatusEntry>;
  decisions: Decision[];
  assignments: Record<string, string | null>;
  history: HistoryEntry[];
  setActor: (name: string) => void;
  decide: (candidateId: string, verdict: 'accepted' | 'rejected', reasonCode?: RejectReasonCode | null, note?: string) => void;
  bulkDecide: (ids: string[], verdict: 'accepted' | 'rejected', reasonCode?: RejectReasonCode | null) => void;
  undoLast: () => { count: number; verdict: 'accepted' | 'rejected' } | null;
  assign: (ids: string[], name: string | null) => void;
  statusFor: (candidateId: string) => StatusEntry;
}

const initialStatus: Record<string, StatusEntry> = {};
const initialAssign: Record<string, string | null> = {};
CHANGE_CANDIDATES.forEach((c) => {
  initialStatus[c.id] = { status: c.status, rejectReason: c.rejectReason };
  initialAssign[c.id] = c.assignee;
});

let seq = 0;

export const useReviewStore = create<ReviewState>((set, get) => {
  const apply = (candidateId: string, verdict: 'accepted' | 'rejected', reasonCode: RejectReasonCode | null, note: string, batch: string) => {
    const actor = get().actor;
    const prev = get().statusMap[candidateId] ?? { status: 'pending', rejectReason: null };
    const decision: Decision = {
      id: `dec-live-${Date.now()}-${++seq}`,
      candidateId,
      actor,
      verdict,
      reasonCode: verdict === 'rejected' ? reasonCode : null,
      note: note || (verdict === 'accepted' ? 'Accepted from review queue.' : 'Rejected from review queue.'),
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      statusMap: { ...s.statusMap, [candidateId]: { status: verdict, rejectReason: verdict === 'rejected' ? reasonCode : null } },
      decisions: [decision, ...s.decisions],
      history: [{ batch, candidateId, prev, decisionId: decision.id }, ...s.history].slice(0, 80),
    }));
    useAuditStore.getState().append({
      actor,
      action: 'candidate.decision',
      targetType: 'candidate',
      targetId: candidateId,
      payload: { verdict, reasonCode },
    });
  };

  return {
    actor: 'A. Rao',
    statusMap: initialStatus,
    decisions: [...DECISIONS],
    assignments: initialAssign,
    history: [],
    setActor: (name) => set({ actor: name }),

    decide: (candidateId, verdict, reasonCode = null, note = '') => apply(candidateId, verdict, reasonCode, note, `b-${Date.now()}-${++seq}`),

    bulkDecide: (ids, verdict, reasonCode = null) => {
      const batch = `b-${Date.now()}-${++seq}`;
      ids.forEach((id) => apply(id, verdict, reasonCode, `Bulk ${verdict}.`, batch));
    },

    // Reverts the most recent decision (or whole bulk batch). The audit log is
    // append-only, so the revocation is recorded as a new entry, never a deletion.
    undoLast: () => {
      const { history, actor } = get();
      if (!history.length) return null;
      const batch = history[0].batch;
      const entries = history.filter((h) => h.batch === batch);
      const lastVerdict = get().statusMap[entries[0].candidateId]?.status === 'rejected' ? 'rejected' : 'accepted';
      set((s) => {
        const statusMap = { ...s.statusMap };
        entries.forEach((e) => { statusMap[e.candidateId] = e.prev; });
        const undone = new Set(entries.map((e) => e.decisionId));
        return {
          statusMap,
          decisions: s.decisions.filter((d) => !undone.has(d.id)),
          history: s.history.filter((h) => h.batch !== batch),
        };
      });
      entries.forEach((e) =>
        useAuditStore.getState().append({ actor, action: 'candidate.decision_undone', targetType: 'candidate', targetId: e.candidateId, payload: { restored: e.prev.status } })
      );
      return { count: entries.length, verdict: lastVerdict };
    },

    assign: (ids, name) => {
      const actor = get().actor;
      set((s) => {
        const next = { ...s.assignments };
        ids.forEach((id) => { next[id] = name; });
        return { assignments: next };
      });
      ids.forEach((id) =>
        useAuditStore.getState().append({ actor, action: 'candidate.assign', targetType: 'candidate', targetId: id, payload: { assignee: name } })
      );
    },

    statusFor: (candidateId) => get().statusMap[candidateId] ?? { status: 'pending', rejectReason: null },
  };
});
