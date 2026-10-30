// Single source of truth for graph edge styles.
// Every mode maps its relationship type → EdgeStyle here so visuals stay consistent.

export type EdgeSemantic =
  | "confirmed" | "probable" | "weak" | "historical"
  | "conflict" | "fraud" | "membership" | "provenance";

export interface EdgeStyle {
  stroke: string;
  strokeDasharray?: string;
  strokeWidth: number;
  animated?: boolean;
}

const COLOR: Record<EdgeSemantic, string> = {
  confirmed: "hsl(var(--primary))",
  probable: "hsl(215 20% 45%)",
  weak: "hsl(215 15% 65%)",
  historical: "hsl(215 15% 75%)",
  conflict: "hsl(var(--destructive))",
  fraud: "hsl(30 90% 50%)",
  membership: "hsl(270 55% 55%)",
  provenance: "hsl(200 80% 45%)",
};

const DASH: Partial<Record<EdgeSemantic, string>> = {
  probable: "6 3",
  weak: "2 3",
  historical: "3 4",
};

export function edgeStyle(semantic: EdgeSemantic, confidence = 80): EdgeStyle {
  const w = 1 + (Math.max(0, Math.min(100, confidence)) / 100) * 2.5;
  return {
    stroke: COLOR[semantic],
    strokeDasharray: DASH[semantic],
    strokeWidth: semantic === "conflict" || semantic === "fraud" ? Math.max(w, 2.2) : w,
    animated: semantic === "conflict",
  };
}

export const SEMANTIC_LABEL: Record<EdgeSemantic, string> = {
  confirmed: "Confirmed",
  probable: "Probable",
  weak: "Weak evidence",
  historical: "Historical",
  conflict: "Conflict",
  fraud: "Fraud concern",
  membership: "Membership",
  provenance: "Provenance",
};
