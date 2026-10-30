// Zustand store that owns mutable identity state (relationships, signal linkage,
// merge/split history, audit log) so that Identity Graph + Identity Console
// actions produce real, visible, reversible state changes.
//
// Every mutation appends an AuditEntry with an inverse patch so `reverse(id)`
// can restore prior state. Consumers subscribe with `useIdentityStore(sel)`.

import { create } from "zustand";
import {
  ENTITY_RELATIONSHIPS, SIGNAL_LINKAGE, MERGE_SPLIT_HISTORY, IDENTITY_DECISIONS,
  CONSOLIDATED_PROFILES, INDIVIDUAL_PROFILES,
  type EntityRelationship, type SignalLinkageEntry, type SharingClass,
  type ConsolidatedProfile, type IndividualProfile, type IndividualProfileType,
} from "./mockData";

export type AuditAction =
  | "remove_link" | "reassign_link" | "add_link"
  | "mark_shared" | "mark_incorrect"
  | "merge" | "split" | "reverse"
  | "classify_profile" | "override_decision"
  | "expand_neighborhood" | "re_render_gr";

export interface AuditEntry {
  id: string;
  ts: string;
  user: string;
  action: AuditAction;
  objectType: string;
  objectId: string;
  reason?: string;
  decisionId?: string;
  reversible: boolean;
  reversedBy?: string; // audit id that reversed this entry
  inverse?: () => void; // closure applied on reverse()
  summary: string;
}

export interface RemovedRel { rel: EntityRelationship; removedAt: string; reason?: string }

interface IdentityState {
  relationships: EntityRelationship[];
  removedRelationships: RemovedRel[];
  signals: SignalLinkageEntry[];
  consolidated: ConsolidatedProfile[];
  individuals: IndividualProfile[];
  merges: typeof MERGE_SPLIT_HISTORY;
  decisions: typeof IDENTITY_DECISIONS;
  audit: AuditEntry[];
  reversedDecisionIds: Set<string>;

  // mutations
  removeRelationship: (relId: string, reason?: string) => string;
  reassignRelationship: (relId: string, newToId: string, reason?: string) => string;
  markSignalSharing: (signalId: string, newClass: SharingClass, reason?: string) => string;
  markSignalIncorrect: (signalId: string, reason: string) => string;
  classifyProfile: (profileId: string, newType: IndividualProfileType, reason?: string) => string;
  merge: (aPersonId: string, bPersonId: string, reason?: string) => string;
  split: (personId: string, individualProfileIds: string[], reason?: string) => string;
  overrideDecision: (decisionId: string, newOutcome: string, reason?: string) => string;
  reverse: (auditId: string) => boolean;
  reset: () => void;
}

let uid = 0;
const nextId = (prefix: string) => `${prefix}_${(Date.now().toString(36))}_${(++uid).toString(36)}`;

function pushAudit(
  state: IdentityState,
  entry: Omit<AuditEntry, "id" | "ts">,
): { audit: AuditEntry[]; id: string } {
  const full: AuditEntry = {
    ...entry,
    id: nextId("aud"),
    ts: new Date().toISOString(),
  };
  return { audit: [full, ...state.audit], id: full.id };
}

export const useIdentityStore = create<IdentityState>((set, get) => ({
  relationships: [...ENTITY_RELATIONSHIPS],
  removedRelationships: [],
  signals: SIGNAL_LINKAGE.map((s) => ({ ...s })),
  consolidated: CONSOLIDATED_PROFILES.map((c) => ({ ...c })),
  individuals: INDIVIDUAL_PROFILES.map((i) => ({ ...i })),
  merges: [...MERGE_SPLIT_HISTORY],
  decisions: [...IDENTITY_DECISIONS],
  audit: [],
  reversedDecisionIds: new Set(),

  removeRelationship: (relId, reason) => {
    let id = "";
    set((state) => {
      const rel = state.relationships.find((r) => r.id === relId);
      if (!rel) return {};
      const inverse = () => set((s) => ({
        relationships: [...s.relationships, rel],
        removedRelationships: s.removedRelationships.filter((r) => r.rel.id !== relId),
      }));
      const { audit, id: aid } = pushAudit(state, {
        user: "sarah.kim@resolve.io",
        action: "remove_link",
        objectType: "relationship",
        objectId: relId,
        reason,
        reversible: true,
        inverse,
        summary: `Removed ${rel.type} edge ${rel.from} → ${rel.to}`,
      });
      id = aid;
      return {
        relationships: state.relationships.filter((r) => r.id !== relId),
        removedRelationships: [...state.removedRelationships, { rel, removedAt: new Date().toISOString(), reason }],
        audit,
      };
    });
    return id;
  },

  reassignRelationship: (relId, newToId, reason) => {
    let id = "";
    set((state) => {
      const rel = state.relationships.find((r) => r.id === relId);
      if (!rel) return {};
      const prevTo = rel.to;
      const updated = { ...rel, to: newToId, lastObserved: new Date().toISOString() };
      const inverse = () => set((s) => ({
        relationships: s.relationships.map((r) => r.id === relId ? { ...r, to: prevTo } : r),
      }));
      const { audit, id: aid } = pushAudit(state, {
        user: "sarah.kim@resolve.io",
        action: "reassign_link",
        objectType: "relationship",
        objectId: relId,
        reason,
        reversible: true,
        inverse,
        summary: `Reassigned ${rel.type} edge from ${prevTo} → ${newToId}`,
      });
      id = aid;
      return { relationships: state.relationships.map((r) => r.id === relId ? updated : r), audit };
    });
    return id;
  },

  markSignalSharing: (signalId, newClass, reason) => {
    let id = "";
    set((state) => {
      const sig = state.signals.find((s) => s.id === signalId);
      if (!sig) return {};
      const prev = sig.sharingClass;
      const prevConflicts = sig.conflictCount;
      const nextConflicts =
        newClass === "household" || newClass === "company" || newClass === "shared_business_phone" || newClass === "shared_office_device"
          ? 0
          : prevConflicts;
      const inverse = () => set((s) => ({
        signals: s.signals.map((x) => x.id === signalId ? { ...x, sharingClass: prev, conflictCount: prevConflicts } : x),
      }));
      const { audit, id: aid } = pushAudit(state, {
        user: "sarah.kim@resolve.io",
        action: "mark_shared",
        objectType: "signal",
        objectId: signalId,
        reason,
        reversible: true,
        inverse,
        summary: `Signal ${sig.kind}:${sig.value} classified as ${newClass}`,
      });
      id = aid;
      return {
        signals: state.signals.map((s) => s.id === signalId ? { ...s, sharingClass: newClass, conflictCount: nextConflicts } : s),
        audit,
      };
    });
    return id;
  },

  markSignalIncorrect: (signalId, reason) => {
    let id = "";
    set((state) => {
      const sig = state.signals.find((s) => s.id === signalId);
      if (!sig) return {};
      const prev = sig.sharingClass;
      const inverse = () => set((s) => ({
        signals: s.signals.map((x) => x.id === signalId ? { ...x, sharingClass: prev } : x),
      }));
      const { audit, id: aid } = pushAudit(state, {
        user: "sarah.kim@resolve.io",
        action: "mark_incorrect",
        objectType: "signal",
        objectId: signalId,
        reason,
        reversible: true,
        inverse,
        summary: `Signal ${sig.kind}:${sig.value} marked incorrect (${reason})`,
      });
      id = aid;
      return {
        signals: state.signals.map((s) => s.id === signalId ? { ...s, sharingClass: "confirmed_conflict" } : s),
        audit,
      };
    });
    return id;
  },

  classifyProfile: (profileId, newType, reason) => {
    let id = "";
    set((state) => {
      const ip = state.individuals.find((x) => x.id === profileId);
      if (!ip) return {};
      const prev = ip.type;
      const inverse = () => set((s) => ({
        individuals: s.individuals.map((x) => x.id === profileId ? { ...x, type: prev } : x),
      }));
      const { audit, id: aid } = pushAudit(state, {
        user: "sarah.kim@resolve.io",
        action: "classify_profile",
        objectType: "individual_profile",
        objectId: profileId,
        reason,
        reversible: true,
        inverse,
        summary: `Reclassified profile ${ip.label} from ${prev} → ${newType}`,
      });
      id = aid;
      return { individuals: state.individuals.map((x) => x.id === profileId ? { ...x, type: newType } : x), audit };
    });
    return id;
  },

  merge: (aPersonId, bPersonId, reason) => {
    let id = "";
    set((state) => {
      // Create a merge relationship edge (canonical "likely_same_person" made confirmed).
      const mergedRel: EntityRelationship = {
        id: nextId("rel_merge"),
        from: aPersonId, fromKind: "person",
        to: bPersonId, toKind: "person",
        type: "likely_same_person",
        confidence: 97, status: "current",
        firstObserved: new Date().toISOString(),
        lastObserved: new Date().toISOString(),
      };
      const removedDup = state.relationships.filter(
        (r) => r.type === "possible_duplicate" && ((r.from === aPersonId && r.to === bPersonId) || (r.from === bPersonId && r.to === aPersonId)),
      );
      const inverse = () => set((s) => ({
        relationships: s.relationships.filter((r) => r.id !== mergedRel.id).concat(removedDup),
      }));
      const { audit, id: aid } = pushAudit(state, {
        user: "sarah.kim@resolve.io",
        action: "merge",
        objectType: "person_pair",
        objectId: `${aPersonId}+${bPersonId}`,
        reason,
        reversible: true,
        inverse,
        summary: `Merged ${aPersonId} ⇢ ${bPersonId}`,
      });
      id = aid;
      return {
        relationships: state.relationships.filter((r) => !removedDup.includes(r)).concat(mergedRel),
        audit,
      };
    });
    return id;
  },

  split: (personId, individualProfileIds, reason) => {
    let id = "";
    set((state) => {
      const prevSnapshot = state.individuals.filter((ip) => individualProfileIds.includes(ip.id));
      if (prevSnapshot.length === 0) return {};
      const newPersonId = `p_split_${personId.slice(-4)}_${Date.now().toString(36).slice(-4)}`;
      const updated = state.individuals.map((ip) =>
        individualProfileIds.includes(ip.id) ? { ...ip, personId: newPersonId } : ip,
      );
      const inverse = () => set((s) => ({
        individuals: s.individuals.map((ip) => {
          const orig = prevSnapshot.find((o) => o.id === ip.id);
          return orig ? { ...ip, personId: orig.personId } : ip;
        }),
      }));
      const { audit, id: aid } = pushAudit(state, {
        user: "sarah.kim@resolve.io",
        action: "split",
        objectType: "person",
        objectId: personId,
        reason,
        reversible: true,
        inverse,
        summary: `Split ${individualProfileIds.length} profile(s) off ${personId} → ${newPersonId}`,
      });
      id = aid;
      return { individuals: updated, audit };
    });
    return id;
  },

  overrideDecision: (decisionId, newOutcome, reason) => {
    let id = "";
    set((state) => {
      const dec = state.decisions.find((d) => d.id === decisionId);
      if (!dec) return {};
      const prev = dec.outcome;
      const inverse = () => set((s) => ({
        decisions: s.decisions.map((d) => d.id === decisionId ? { ...d, outcome: prev } : d),
      }));
      const { audit, id: aid } = pushAudit(state, {
        user: "sarah.kim@resolve.io",
        action: "override_decision",
        objectType: "decision",
        objectId: decisionId,
        reason,
        decisionId,
        reversible: true,
        inverse,
        summary: `Overrode decision ${decisionId}: ${prev} → ${newOutcome}`,
      });
      id = aid;
      return {
        decisions: state.decisions.map((d) => d.id === decisionId ? { ...d, outcome: newOutcome as typeof d.outcome } : d),
        audit,
      };
    });
    return id;
  },

  reverse: (auditId) => {
    const entry = get().audit.find((a) => a.id === auditId);
    if (!entry || !entry.reversible || entry.reversedBy) return false;
    entry.inverse?.();
    set((state) => {
      const { audit } = pushAudit(state, {
        user: "sarah.kim@resolve.io",
        action: "reverse",
        objectType: entry.objectType,
        objectId: entry.objectId,
        reason: `Reversed ${entry.action}`,
        reversible: false,
        summary: `Reversed: ${entry.summary}`,
      });
      return {
        audit: audit.map((a) => a.id === auditId ? { ...a, reversedBy: audit[0].id } : a),
      };
    });
    return true;
  },

  reset: () => set({
    relationships: [...ENTITY_RELATIONSHIPS],
    removedRelationships: [],
    signals: SIGNAL_LINKAGE.map((s) => ({ ...s })),
    consolidated: CONSOLIDATED_PROFILES.map((c) => ({ ...c })),
    individuals: INDIVIDUAL_PROFILES.map((i) => ({ ...i })),
    merges: [...MERGE_SPLIT_HISTORY],
    decisions: [...IDENTITY_DECISIONS],
    audit: [],
    reversedDecisionIds: new Set(),
  }),
}));
