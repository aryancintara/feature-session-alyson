// Buyer Stage colour tiers and labels for the Unified Leads explorer.
// Exact API stages and keyword families map to the design system's Pill
// tones; any unlisted value falls back to neutral (never forced into "New").

export type StageTone = "success" | "danger" | "warning" | "neutral" | "info";

const DANGER_EXACT = new Set(["failed", "removed", "bad_number", "duplicate"]);
const SUCCESS_EXACT = new Set(["connected", "met_in_person", "closed", "closed_paid", "listing", "in_escrow", "escrow"]);
const WARNING_EXACT = new Set(["contacted", "called_no_msg", "called_left_msg", "agent_left_vm", "called_busy", "client_left_vm"]);
const INFO_EXACT = new Set(["introduced", "intro_request", "auto_intro_match", "quiz_match", "investor_qualified", "meeting_scheduled", "qualified"]);
const NEUTRAL_EXACT = new Set(["new", "coming_soon", "claimed", "curious_valuation", "not_interested", "not_transacting", "fake"]);

const DANGER_RE = /fail|remov|bad_number|duplicate/;
const SUCCESS_RE = /connected|closed|paid|listing|escrow/;
const WARNING_RE = /called|contacted|left_msg|_vm\b|_vm_|^vm/;
const INFO_RE = /intro|qualif|meeting/;

export const normalizeStage = (stage: string | null | undefined) => (stage ?? "").trim().toLowerCase().replace(/\s+/g, "_");

export function stageTone(stage: string | null | undefined): StageTone {
  const key = normalizeStage(stage);
  if (!key || NEUTRAL_EXACT.has(key)) return "neutral";
  if (DANGER_EXACT.has(key)) return "danger";
  if (SUCCESS_EXACT.has(key)) return "success";
  if (WARNING_EXACT.has(key)) return "warning";
  if (INFO_EXACT.has(key)) return "info";
  if (DANGER_RE.test(key)) return "danger";
  if (WARNING_RE.test(key)) return "warning";
  if (SUCCESS_RE.test(key)) return "success";
  if (INFO_RE.test(key)) return "info";
  return "neutral";
}

// called_no_msg -> "Called No Msg"; short tokens like vm/id stay uppercase.
export function stageLabel(stage: string | null | undefined): string {
  const key = (stage ?? "").trim();
  if (!key) return "Not reported";
  return key
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => {
      const lower = w.toLowerCase();
      if (["vm", "id", "api"].includes(lower)) return lower.toUpperCase();
      return w[0].toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

/** Sentinel the API accepts for leads with no Buyer Stage. */
export const STAGE_NONE = "__none__";
/** Used only when live facets omit current_stage (older API deploy). */
export const FALLBACK_STAGES = ["new", "contacted", "called_no_msg", "called_left_msg", "agent_left_vm", "connected", "introduced", "intro_request", "meeting_scheduled", "met_in_person", "listing", "in_escrow", "closed", "closed_paid", "failed", "removed"];
