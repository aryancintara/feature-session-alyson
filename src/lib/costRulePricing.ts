import type { RuleCalc, RuleType } from "./rulesApi";

// SMS cost sources share source_id "sms"; each wizard choice maps to one connector.
export const SMS_CONNECTORS: Record<string, { connector: string; label: string }> = {
  sms_57: { connector: "57", label: "PitchPrfct SMS" },
  sms_67: { connector: "67", label: "Trumpia SMS" },
  sms_77: { connector: "77", label: "Klaviyo SMS" },
};
export const SMS_SOURCE_TABLE = "unified.uct_events";
export const isSmsSource = (source: string) => source in SMS_CONNECTORS;
export const apiSourceId = (source: string) => (isSmsSource(source) ? "sms" : source);
export const smsKeyForConnector = (connector: unknown) => Object.keys(SMS_CONNECTORS).find((k) => SMS_CONNECTORS[k].connector === String(connector ?? "")) ?? "";
type RuleLike = { source_id: string; conditions?: { field: string; value?: unknown }[] };
export const ruleSmsKey = (r: RuleLike) => (r.source_id === "sms" ? smsKeyForConnector((r.conditions ?? []).find((c) => c.field === "connector_id")?.value) : "");
export const ruleSourceLabel = (r: RuleLike, labels: Record<string, string>) => {
  const k = ruleSmsKey(r);
  return k ? SMS_CONNECTORS[k].label : labels[r.source_id] ?? r.source_id;
};

export const RULE_SOURCES: Record<RuleType, string[]> = {
  REVENUE: ["homelight", "uct", "phonexa"],
  COST: ["tune", "phonexa", "sms_57", "sms_67", "sms_77"],
};
export const hasCostModifier = (type: RuleType, source: string) => type === "COST" && isSmsSource(source);
export const isDirectCost = (type: RuleType, source: string) => type === "COST" && (source === "tune" || source === "phonexa");
export function smsPerSend(amount: string, quantity: string | number): number | null {
  const n = Number(amount);
  const q = Number(quantity);
  if (!amount.trim() || !Number.isFinite(n) || n < 0) return null;
  if (!Number.isFinite(q) || q <= 0) return null;
  return n / q;
}
export function ruleWizardSteps(type: RuleType, source: string): number[] {
  if (isDirectCost(type, source)) return [0];
  // "Other filters" (step 3) is a Revenue-only stage; SMS cost rules go modifier → time period → review.
  return type === "REVENUE" ? [0, 1, 2, 3, 4] : [0, 1, 2, 4];
}

export const ruleDatesValid = (start: string, end: string) => !!start && (!end || end >= start);
export const ruleSaveDates = (start: string, end: string) => ({ start_date: start, ...(end ? { end_date: end } : {}) });
export function ruleSaveCalculation(type: RuleType, source: string, field: string, kind: "revenue_share" | "roas" | "event", percent: number, amount: number, quantity: number, previous?: RuleCalc): RuleCalc {
  if (hasCostModifier(type, source)) return { kind: "sms_per_count", per_count: quantity, amount };
  if (isDirectCost(type, source)) {
    if (source === "phonexa") return { kind: "money", field: "publisher_payout" };
    return { kind: "cents", field: previous?.kind === "cents" ? previous.field : "payout_cents", session: previous?.kind === "cents" ? previous.session ?? "affiliate_sub1" : "affiliate_sub1" };
  }
  return kind === "event" ? { kind: "event_based", amount } : { kind, field, percent };
}
