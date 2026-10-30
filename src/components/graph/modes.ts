// 5-mode graph builders. Each returns { nodes, edges } for React Flow, laid out
// with dagre so edges are visible and non-overlapping. Every mode's edges use
// a deterministic semantic → edgeStyle mapping.

import dagre from "dagre";
import { Position, type Node, type Edge } from "@xyflow/react";
import {
  PEOPLE, CONSOLIDATED_PROFILES, INDIVIDUAL_PROFILES, GOLDEN_RECORDS,
  ENTITY_RELATIONSHIPS, SIGNAL_LINKAGE, HOUSEHOLDS, COMPANIES, PLACES, LEGAL_CASES,
  SOURCE_PROFILES,
  type GoldenRecordPurpose, type EntityRelationship, type SignalLinkageEntry,
} from "@/lib/mockData";
import type { GNodeData, GEdgeData, NodeKind } from "./GraphCanvas";
import type { EdgeSemantic } from "./edgeStyle";

export type Mode = "entity" | "consolidated" | "golden_record" | "profile_detail" | "signal";

type LayoutDir = "TB" | "LR" | "BT" | "RL";

const NODE_W = 180;
const NODE_H = 60;

function layout(nodes: Node<GNodeData>[], edges: Edge<GEdgeData>[], dir: LayoutDir = "TB"): { nodes: Node<GNodeData>[]; edges: Edge<GEdgeData>[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: dir, nodesep: 30, ranksep: 60, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return {
    nodes: nodes.map((n) => {
      const p = g.node(n.id);
      return {
        ...n,
        position: { x: (p?.x ?? 0) - NODE_W / 2, y: (p?.y ?? 0) - NODE_H / 2 },
        sourcePosition: dir === "LR" ? Position.Right : Position.Bottom,
        targetPosition: dir === "LR" ? Position.Left : Position.Top,
      };
    }),
    edges,
  };
}

// Radial: place N items on a circle around center at index 0.
function radialLayout(nodes: Node<GNodeData>[], edges: Edge<GEdgeData>[], radius = 320) {
  if (nodes.length === 0) return { nodes, edges };
  const [center, ...rest] = nodes;
  center.position = { x: 0, y: 0 };
  rest.forEach((n, i) => {
    const a = (i / rest.length) * Math.PI * 2 - Math.PI / 2;
    n.position = { x: Math.cos(a) * radius, y: Math.sin(a) * radius };
  });
  return { nodes, edges };
}

function mkNode(id: string, data: GNodeData, opts: { center?: boolean } = {}): Node<GNodeData> {
  return {
    id, type: "g",
    position: { x: 0, y: 0 },
    data: { ...data, ...(opts.center ? { center: true } : {}) } as GNodeData,
  };
}

function mkEdge(
  id: string, source: string, target: string,
  semantic: EdgeSemantic, label: string, confidence = 80,
  status: "current" | "historical" = "current",
): Edge<GEdgeData> {
  return {
    id, source, target, type: "g",
    data: { semantic, label, confidence, status },
  };
}

// -------- MODE: Entity Relationships --------

export function buildEntityMode(
  personId: string,
  relationships: EntityRelationship[],
  opts: { showHistorical?: boolean } = {},
) {
  const person = PEOPLE.find((p) => p.id === personId) ?? PEOPLE[0];
  const nodes: Node<GNodeData>[] = [];
  const edges: Edge<GEdgeData>[] = [];
  nodes.push(mkNode(person.id, { kind: "person", label: person.name, sub: person.id }, { center: true }));

  const rels = relationships.filter((r) => (r.from === person.id || r.to === person.id) && (opts.showHistorical || r.status === "current"));
  const seen = new Set<string>([person.id]);
  rels.forEach((r) => {
    const isOut = r.from === person.id;
    const otherId = isOut ? r.to : r.from;
    const otherKind = isOut ? r.toKind : r.fromKind;
    if (!seen.has(otherId)) {
      seen.add(otherId);
      const label =
        otherKind === "person" ? PEOPLE.find((p) => p.id === otherId)?.name ?? otherId
        : otherKind === "household" ? HOUSEHOLDS.find((h) => h.id === otherId)?.label ?? otherId
        : otherKind === "company" ? COMPANIES.find((c) => c.id === otherId)?.label ?? otherId
        : otherKind === "place" ? PLACES.find((p) => p.id === otherId)?.label ?? otherId
        : LEGAL_CASES.find((l) => l.id === otherId)?.label ?? otherId;
      const sub =
        otherKind === "person" ? PEOPLE.find((p) => p.id === otherId)?.id
        : otherKind === "household" ? HOUSEHOLDS.find((h) => h.id === otherId)?.sub
        : otherKind === "company" ? COMPANIES.find((c) => c.id === otherId)?.sub
        : otherKind === "place" ? PLACES.find((p) => p.id === otherId)?.sub
        : LEGAL_CASES.find((l) => l.id === otherId)?.sub;
      nodes.push(mkNode(otherId, { kind: otherKind as NodeKind, label, sub, status: r.status }));
    }
    const semantic: EdgeSemantic =
      r.conflict ? "conflict"
      : r.type === "possible_duplicate" ? "conflict"
      : r.status === "historical" ? "historical"
      : r.confidence >= 90 ? "confirmed" : "probable";
    edges.push(mkEdge(r.id, r.from, r.to, semantic, r.type.replace(/_/g, " "), r.confidence, r.status));
  });
  return radialLayout(nodes, edges, 340);
}

// -------- MODE: Consolidated Profile --------

export function buildConsolidatedMode(personId: string, opts: { showSources?: boolean; showHistorical?: boolean } = {}) {
  const person = PEOPLE.find((p) => p.id === personId) ?? PEOPLE[0];
  const cp = CONSOLIDATED_PROFILES.find((c) => c.personId === person.id);
  const nodes: Node<GNodeData>[] = [];
  const edges: Edge<GEdgeData>[] = [];
  nodes.push(mkNode(person.id, { kind: "person", label: person.name, sub: person.id }, { center: true }));
  if (!cp) return layout(nodes, edges);
  nodes.push(mkNode(cp.id, {
    kind: "consolidated", label: cp.label, sub: `hygiene: ${cp.hygiene}`,
    score: cp.scores.overall, hygiene: cp.hygiene,
  }));
  edges.push(mkEdge(`e_${person.id}_${cp.id}`, person.id, cp.id, "membership", "consolidated of", 98));

  const ips = INDIVIDUAL_PROFILES.filter((ip) => ip.consolidatedId === cp.id && (opts.showHistorical || ip.status === "current"));
  ips.forEach((ip) => {
    nodes.push(mkNode(ip.id, {
      kind: "individual", label: ip.label, sub: `${ip.type} · ${ip.completeness}%`,
      score: ip.scores.overall, hygiene: ip.hygiene, status: ip.status,
      warning: ip.conflictCount > 0,
    }));
    const semantic: EdgeSemantic =
      ip.status === "historical" ? "historical"
      : ip.conflictCount > 0 ? "conflict"
      : "membership";
    edges.push(mkEdge(`e_${cp.id}_${ip.id}`, cp.id, ip.id, semantic, `${ip.type} profile`, ip.scores.overall, ip.status));

    if (opts.showSources) {
      ip.sourceProfileIds.forEach((spId) => {
        const sp = SOURCE_PROFILES.find((s) => s.id === spId);
        if (!sp) return;
        if (!nodes.find((n) => n.id === sp.id)) {
          nodes.push(mkNode(sp.id, { kind: "source", label: sp.source, sub: sp.hash.slice(0, 12) }));
        }
        edges.push(mkEdge(`e_${ip.id}_${sp.id}`, ip.id, sp.id, "provenance", "supports", 85));
      });
    }
  });
  return layout(nodes, edges, "TB");
}

// -------- MODE: Golden Record --------

export function buildGoldenRecordMode(
  personId: string,
  purpose: GoldenRecordPurpose,
  opts: { showAlternatives?: boolean } = {},
) {
  const gr = GOLDEN_RECORDS.find((g) => g.personId === personId && g.purpose === purpose)
    ?? GOLDEN_RECORDS.find((g) => g.personId === personId)
    ?? GOLDEN_RECORDS[0];
  const nodes: Node<GNodeData>[] = [];
  const edges: Edge<GEdgeData>[] = [];
  nodes.push(mkNode(gr.id, {
    kind: "golden_record", label: `Golden Record`, sub: `${gr.purpose} · ${gr.suitability}%`,
    score: gr.suitability, warning: gr.warnings.length > 0,
  }, { center: true }));

  gr.fields.forEach((f) => {
    const fieldNodeId = `${gr.id}::${f.key}`;
    nodes.push(mkNode(fieldNodeId, {
      kind: "gr_field", label: f.key, sub: f.value,
      score: f.fieldAccuracy, warning: Boolean(f.warning),
    }));
    edges.push(mkEdge(`e_${gr.id}_${f.key}`, gr.id, fieldNodeId, "membership", "contains", 98));

    const ip = INDIVIDUAL_PROFILES.find((i) => i.id === f.selectedFromIndividualProfileId);
    if (ip && !nodes.find((n) => n.id === ip.id)) {
      nodes.push(mkNode(ip.id, {
        kind: "individual", label: ip.label, sub: ip.type,
        score: ip.scores.overall, hygiene: ip.hygiene,
      }));
    }
    if (ip) edges.push(mkEdge(`e_${fieldNodeId}_${ip.id}`, fieldNodeId, ip.id, "confirmed", "selected from", f.fieldAccuracy));

    const sp = SOURCE_PROFILES.find((s) => s.id === f.selectedFromSourceProfileId);
    if (sp) {
      if (!nodes.find((n) => n.id === sp.id)) {
        nodes.push(mkNode(sp.id, { kind: "source", label: sp.source, sub: sp.hash.slice(0, 12) }));
      }
      if (ip) edges.push(mkEdge(`e_${ip.id}_${sp.id}_${f.key}`, ip.id, sp.id, "provenance", "supported by", 80));
    }

    if (opts.showAlternatives) {
      f.alternatives.forEach((alt, ai) => {
        const altId = `${fieldNodeId}::alt${ai}`;
        nodes.push(mkNode(altId, {
          kind: "gr_field", label: `alt: ${alt.value}`,
          sub: alt.rejectionReason, score: alt.fieldAccuracy,
        }));
        edges.push(mkEdge(`e_${fieldNodeId}_alt${ai}`, fieldNodeId, altId, "weak", "rejected", alt.fieldAccuracy));
      });
    }
  });
  return layout(nodes, edges, "LR");
}

// -------- MODE: Profile Detail --------

export function buildProfileDetailMode(profileId: string) {
  const ip = INDIVIDUAL_PROFILES.find((x) => x.id === profileId) ?? INDIVIDUAL_PROFILES[0];
  const nodes: Node<GNodeData>[] = [];
  const edges: Edge<GEdgeData>[] = [];
  nodes.push(mkNode(ip.id, {
    kind: "individual", label: ip.label, sub: `${ip.type} · hygiene ${ip.hygiene}`,
    score: ip.scores.overall, hygiene: ip.hygiene, status: ip.status,
    warning: ip.conflictCount > 0,
  }, { center: true }));

  Object.entries(ip.fields).forEach(([k, v]) => {
    if (v === "—") return;
    const fid = `${ip.id}::${k}`;
    nodes.push(mkNode(fid, { kind: "gr_field", label: k, sub: v }));
    edges.push(mkEdge(`e_${ip.id}_${fid}`, ip.id, fid, "membership", k, 90));
  });
  ip.sourceProfileIds.forEach((spId) => {
    const sp = SOURCE_PROFILES.find((s) => s.id === spId);
    if (!sp) return;
    nodes.push(mkNode(sp.id, { kind: "source", label: sp.source, sub: sp.hash.slice(0, 12) }));
    edges.push(mkEdge(`e_${ip.id}_${sp.id}`, ip.id, sp.id, "provenance", "supported by", 82));
  });
  return radialLayout(nodes, edges, 260);
}

// -------- MODE: Signal Linkage --------

export function buildSignalMode(signalId: string, signals: SignalLinkageEntry[]) {
  const sig = signals.find((s) => s.id === signalId) ?? signals[0];
  const nodes: Node<GNodeData>[] = [];
  const edges: Edge<GEdgeData>[] = [];
  nodes.push(mkNode(sig.id, {
    kind: "signal", label: sig.value, sub: `${sig.kind} · ${sig.sharingClass}`,
    warning: sig.conflictCount > 0, signalKind: sig.kind,
  }, { center: true }));

  const semanticFor = (): EdgeSemantic =>
    sig.sharingClass === "confirmed_conflict" ? "conflict"
    : sig.sharingClass === "suspicious" ? "fraud"
    : sig.sharingClass === "unexplained" ? "probable"
    : sig.sharingClass === "historical_reuse" ? "historical"
    : "confirmed";

  sig.connectedPersonIds.forEach((pid) => {
    const pp = PEOPLE.find((p) => p.id === pid);
    if (!pp) return;
    nodes.push(mkNode(pp.id, { kind: "person", label: pp.name, sub: pp.id }));
    edges.push(mkEdge(`e_${sig.id}_${pp.id}`, sig.id, pp.id, semanticFor(), "linked to", sig.confidence));
  });
  sig.connectedProfileIds.slice(0, 6).forEach((ipId) => {
    const ip = INDIVIDUAL_PROFILES.find((x) => x.id === ipId);
    if (!ip) return;
    nodes.push(mkNode(ip.id, { kind: "individual", label: ip.label, sub: ip.type, score: ip.scores.overall }));
    edges.push(mkEdge(`e_${sig.id}_${ip.id}`, sig.id, ip.id, "membership", "profile", 80));
  });
  sig.connectedHouseholdIds.forEach((hh) => {
    const h = HOUSEHOLDS.find((x) => x.id === hh);
    if (!h) return;
    nodes.push(mkNode(h.id, { kind: "household", label: h.label, sub: h.sub }));
    edges.push(mkEdge(`e_${sig.id}_${h.id}`, sig.id, h.id, "membership", "household", 85));
  });
  sig.connectedCompanyIds.forEach((co) => {
    const c = COMPANIES.find((x) => x.id === co);
    if (!c) return;
    nodes.push(mkNode(c.id, { kind: "company", label: c.label, sub: c.sub }));
    edges.push(mkEdge(`e_${sig.id}_${c.id}`, sig.id, c.id, "membership", "company", 82));
  });
  return radialLayout(nodes, edges, 320);
}
