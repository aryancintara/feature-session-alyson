// Revenue Rules (Phase 1): static seed rules + sample source datasets.
// User-created rules live in the client store (revenueRulesStore.ts).
import { REVENUE_RECORDS, type RevenueRecord } from "@/lib/unifiedTablesData";

export type RuleStatus = "Draft" | "Testing" | "Active" | "Archived";
export const RULE_STATUSES: RuleStatus[] = ["Draft", "Testing", "Active", "Archived"];
export type Operator = "equals" | "not_equals" | "gt" | "lt" | "contains" | "exists";
export const OPERATORS: { id: Operator; label: string; symbol: string }[] = [
  { id: "equals", label: "equals", symbol: "=" },
  { id: "not_equals", label: "not equals", symbol: "≠" },
  { id: "gt", label: "greater than", symbol: ">" },
  { id: "lt", label: "less than", symbol: "<" },
  { id: "contains", label: "contains", symbol: "contains" },
  { id: "exists", label: "exists", symbol: "exists" },
];

export interface RuleField { name: string; description: string }
export interface Condition { field: string; op: Operator; value: string }
export interface RuleVersion { version: string; date: string; status: "Active" | "Archived" | "Draft"; note: string }
export interface RuleExecution { id: string; timestamp: string; evaluated: number; matched: number; revenue: number; status: "Successful" | "Failed" }

export interface RevenueRule {
  id: string;
  name: string;
  description: string;
  revenueType: string;
  objectType: string;
  currency: string;
  effectiveDate: string;
  /** revenue_type value on sample revenue records this rule produces */
  recordType: string | null;
  datasetId: string;
  fields: string[];
  logic: "AND" | "OR";
  conditions: Condition[];
  grossField: string;
  deductField: string; // "" = none
  version: string;
  status: RuleStatus;
  createdBy: string;
  created: string;
  updated: string;
  versions: RuleVersion[];
  custom?: boolean;
}

export interface DatasetField { name: string; type: "number" | "string" | "date" | "boolean"; description: string }
export interface SourceDataset { id: string; name: string; totalRecords: number; fields: DatasetField[]; idField: string; rows: Record<string, string | number | boolean>[] }

const pick = <T,>(xs: T[], i: number) => xs[i % xs.length];

function makeRows(n: number, f: (i: number) => Record<string, string | number | boolean>) {
  return Array.from({ length: n }, (_, i) => f(i));
}
const day = (i: number) => `2026-09-${String((i % 24) + 1).padStart(2, "0")}`;

export const DATASETS: SourceDataset[] = [
  {
    id: "unified_leads", name: "Unified Leads", totalRecords: 48_200, idField: "lead_id",
    fields: [
      { name: "lead_id", type: "string", description: "Lead identifier" },
      { name: "expected_revenue", type: "number", description: "Revenue amount from source" },
      { name: "lead_status", type: "string", description: "Current lead lifecycle" },
      { name: "deal_status", type: "string", description: "Status of the associated deal" },
      { name: "close_date", type: "date", description: "Date lead closed" },
      { name: "customer_type", type: "string", description: "New or returning customer" },
      { name: "refund_amount", type: "number", description: "Refunds issued" },
    ],
    rows: makeRows(200, (i) => ({
      lead_id: `lead_${10400 + i}`,
      expected_revenue: pick([0, 45, 120, 80, 210, 0, 35, 150], i),
      lead_status: pick(["closed", "open", "closed", "qualified", "closed", "lost"], i),
      deal_status: pick(["won", "pending", "won", "lost"], i),
      close_date: day(i),
      customer_type: pick(["new", "returning"], i),
      refund_amount: i % 9 === 0 ? 20 : 0,
    })),
  },
  {
    id: "unified_orders", name: "Unified Orders", totalRecords: 21_600, idField: "order_id",
    fields: [
      { name: "order_id", type: "string", description: "Order identifier" },
      { name: "order_total", type: "number", description: "Order amount" },
      { name: "order_status", type: "string", description: "Order state" },
      { name: "refund_amount", type: "number", description: "Refunds issued" },
      { name: "customer_type", type: "string", description: "New or returning customer" },
      { name: "order_date", type: "date", description: "Date of order" },
    ],
    rows: makeRows(200, (i) => ({
      order_id: `ord_${77000 + i}`,
      order_total: pick([320, 89, 1450, 0, 540, 260], i),
      order_status: pick(["completed", "completed", "cancelled", "pending"], i),
      refund_amount: i % 7 === 0 ? 40 : 0,
      customer_type: pick(["new", "returning", "returning"], i),
      order_date: day(i),
    })),
  },
  {
    id: "unified_sessions", name: "Unified Sessions", totalRecords: 312_000, idField: "session_id",
    fields: [
      { name: "session_id", type: "string", description: "Session identifier" },
      { name: "click_id", type: "string", description: "Paid click identifier" },
      { name: "cpc_payout", type: "number", description: "Payout per click from partner" },
      { name: "is_valid_click", type: "boolean", description: "Fraud / validity flag" },
      { name: "utm_source", type: "string", description: "Traffic source" },
      { name: "session_date", type: "date", description: "Session date" },
    ],
    rows: makeRows(200, (i) => ({
      session_id: `sess_${550000 + i}`,
      click_id: i % 5 === 0 ? "" : `clk_${9000 + i}`,
      cpc_payout: pick([0.8, 1.2, 2.5, 0.4, 3.1], i),
      is_valid_click: i % 6 !== 0,
      utm_source: pick(["google", "bing", "facebook", "partner"], i),
      session_date: day(i),
    })),
  },
];

export const REVENUE_TYPES = ["Lead Sale", "Click Revenue", "Revenue Share", "Subscription", "Commission", "Order Revenue", "Call Revenue"];
export const OBJECT_TYPES = ["Lead", "Order", "Click", "Subscription", "Call", "Other"];
export const CURRENCIES = ["USD", "EUR", "GBP", "CAD"];

export const OUTPUT_FIELDS: RuleField[] = [
  { name: "Gross Revenue", description: "Original calculated amount" },
  { name: "Net Revenue", description: "Final revenue value after adjustments" },
  { name: "Revenue Status", description: "Lifecycle state (estimated, earned, invoiced, received)" },
  { name: "Currency", description: "Currency of the revenue values" },
];

export function getDataset(id: string) { return DATASETS.find((d) => d.id === id); }

function hist(n: number, dates: string[], notes: string[] = []): RuleVersion[] {
  return Array.from({ length: n }, (_, i) => {
    const v = n - i;
    return { version: `v${v}`, date: dates[i] ?? "2026-01-15", status: i === 0 ? "Active" : "Archived", note: v === 1 ? "Initial version" : notes[i] ?? "Revenue condition updated" };
  });
}

export const SEED_RULES: RevenueRule[] = [
  {
    id: "lead_sale.default", name: "Lead Sale Revenue Rule", description: "Calculates revenue generated from sold leads.",
    revenueType: "Lead Sale", objectType: "Lead", currency: "USD", effectiveDate: "2026-03-02", recordType: "lead_sale",
    datasetId: "unified_leads", fields: ["expected_revenue", "lead_status", "close_date", "refund_amount"], logic: "AND",
    conditions: [{ field: "lead_status", op: "equals", value: "closed" }, { field: "expected_revenue", op: "gt", value: "0" }],
    grossField: "expected_revenue", deductField: "refund_amount",
    version: "v1", status: "Active", createdBy: "Maya Patel", created: "2026-03-02", updated: "2026-03-02", versions: hist(1, ["2026-03-02"]),
  },
  {
    id: "click_revenue.default", name: "Click Revenue Rule", description: "Calculates revenue from paid clicks using the partner's cost-per-click payout.",
    revenueType: "Click Revenue", objectType: "Click", currency: "USD", effectiveDate: "2026-02-10", recordType: null,
    datasetId: "unified_sessions", fields: ["click_id", "cpc_payout", "is_valid_click"], logic: "AND",
    conditions: [{ field: "click_id", op: "exists", value: "" }, { field: "is_valid_click", op: "equals", value: "true" }],
    grossField: "cpc_payout", deductField: "",
    version: "v3", status: "Active", createdBy: "Jordan Lee", created: "2026-02-10", updated: "2026-09-25", versions: hist(3, ["2026-09-25", "2026-08-10", "2026-02-10"], ["Revenue condition updated", "Validity check added"]),
  },
  {
    id: "revenue_share.default", name: "Revenue Share Rule", description: "Calculates the partner's share of closed transaction value.",
    revenueType: "Revenue Share", objectType: "Lead", currency: "USD", effectiveDate: "2026-01-20", recordType: "referral_fee",
    datasetId: "unified_leads", fields: ["expected_revenue", "deal_status", "close_date"], logic: "AND",
    conditions: [{ field: "deal_status", op: "equals", value: "won" }],
    grossField: "expected_revenue", deductField: "",
    version: "v2", status: "Active", createdBy: "Maya Patel", created: "2026-01-20", updated: "2026-08-10", versions: hist(2, ["2026-08-10", "2026-01-20"]),
  },
  {
    id: "subscription.monthly", name: "Subscription Revenue Rule", description: "Recognizes monthly subscription revenue per billing period.",
    revenueType: "Subscription", objectType: "Subscription", currency: "USD", effectiveDate: "2025-11-05", recordType: "subscription",
    datasetId: "unified_orders", fields: ["order_total", "order_status", "refund_amount"], logic: "AND",
    conditions: [{ field: "order_status", op: "equals", value: "completed" }, { field: "customer_type", op: "equals", value: "returning" }],
    grossField: "order_total", deductField: "refund_amount",
    version: "v4", status: "Active", createdBy: "Sam Ortiz", created: "2025-11-05", updated: "2026-09-12", versions: hist(4, ["2026-09-12", "2026-06-01", "2026-02-14", "2025-11-05"]),
  },
  {
    id: "commission.agent", name: "Agent Commission Rule", description: "Calculates commission earned on agent-closed deals.",
    revenueType: "Commission", objectType: "Lead", currency: "USD", effectiveDate: "2026-04-01", recordType: "commission",
    datasetId: "unified_leads", fields: ["expected_revenue", "deal_status"], logic: "AND",
    conditions: [{ field: "deal_status", op: "equals", value: "won" }, { field: "expected_revenue", op: "gt", value: "100" }],
    grossField: "expected_revenue", deductField: "",
    version: "v2", status: "Testing", createdBy: "Jordan Lee", created: "2026-04-01", updated: "2026-09-20", versions: hist(2, ["2026-09-20", "2026-04-01"]),
  },
  {
    id: "order_revenue.default", name: "Order Revenue Rule", description: "Draft rule recognizing completed order revenue net of refunds.",
    revenueType: "Order Revenue", objectType: "Order", currency: "USD", effectiveDate: "2026-10-01", recordType: null,
    datasetId: "unified_orders", fields: ["order_total", "order_status", "refund_amount"], logic: "AND",
    conditions: [{ field: "order_status", op: "equals", value: "completed" }, { field: "order_total", op: "gt", value: "0" }],
    grossField: "order_total", deductField: "refund_amount",
    version: "v1", status: "Draft", createdBy: "Admin", created: "2026-09-22", updated: "2026-09-22", versions: [{ version: "v1", date: "2026-09-22", status: "Draft", note: "Initial version" }],
  },
  {
    id: "call_revenue.legacy", name: "Call Revenue Rule (Legacy)", description: "Legacy rule for billable inbound calls over a duration threshold.",
    revenueType: "Call Revenue", objectType: "Call", currency: "USD", effectiveDate: "2025-08-14", recordType: null,
    datasetId: "unified_sessions", fields: ["cpc_payout", "utm_source"], logic: "OR",
    conditions: [{ field: "utm_source", op: "equals", value: "partner" }],
    grossField: "cpc_payout", deductField: "",
    version: "v1", status: "Archived", createdBy: "Sam Ortiz", created: "2025-08-14", updated: "2026-05-30", versions: [{ version: "v1", date: "2025-08-14", status: "Archived", note: "Initial version" }],
  },
];

/** Back-compat for Events filters. */
export const REVENUE_RULES = SEED_RULES;

export function opSymbol(op: Operator) { return OPERATORS.find((o) => o.id === op)?.symbol ?? op; }

function test(row: Record<string, unknown>, c: Condition) {
  const v = row[c.field];
  if (c.op === "exists") return v !== undefined && v !== null && v !== "";
  const s = String(v ?? "").toLowerCase();
  const t = c.value.trim().toLowerCase();
  if (c.op === "equals") return s === t;
  if (c.op === "not_equals") return s !== t;
  if (c.op === "contains") return s.includes(t);
  const n = Number(v), m = Number(c.value);
  if (Number.isNaN(n) || Number.isNaN(m)) return false;
  return c.op === "gt" ? n > m : n < m;
}

export type RuleDraft = Pick<RevenueRule, "datasetId" | "logic" | "conditions" | "grossField" | "deductField">;

export function calc(rule: RuleDraft, row: Record<string, unknown>) {
  const gross = Number(row[rule.grossField] ?? 0) || 0;
  const ded = rule.deductField ? Number(row[rule.deductField] ?? 0) || 0 : 0;
  return { gross, net: gross - ded };
}

export function previewImpact(rule: RuleDraft) {
  const ds = getDataset(rule.datasetId);
  if (!ds) return { matched: 0, revenue: 0, sampleMatched: 0, sample: [] as { id: string; inputs: Record<string, unknown>; gross: number; net: number }[] };
  const valid = rule.conditions.filter((c) => c.field);
  const hits = ds.rows.filter((r) => valid.length === 0 || (rule.logic === "AND" ? valid.every((c) => test(r, c)) : valid.some((c) => test(r, c))));
  const scale = ds.totalRecords / ds.rows.length;
  const sampleRev = hits.reduce((s, r) => s + calc(rule, r).net, 0);
  const inputKeys = Array.from(new Set([...valid.map((c) => c.field), rule.grossField, rule.deductField].filter(Boolean)));
  return {
    matched: Math.round(hits.length * scale),
    revenue: Math.round(sampleRev * scale),
    sampleMatched: hits.length,
    sample: hits.slice(0, 8).map((r) => ({ id: String(r[ds.idField]), inputs: Object.fromEntries(inputKeys.map((k) => [k, r[k]])), ...calc(rule, r) })),
  };
}

export function ruleIdForRecord(r: RevenueRecord) {
  return SEED_RULES.find((x) => x.recordType === r.revenue_type)?.id ?? "";
}
export function ruleRecords(rule: RevenueRule) {
  return rule.recordType ? REVENUE_RECORDS.filter((r) => r.revenue_type === rule.recordType) : [];
}
/** Records impacted / revenue generated. Draft & Testing rules aren't applied yet. */
export function ruleStats(rule: RevenueRule) {
  if (rule.status === "Draft" || rule.status === "Testing") return { records: 0, revenue: 0 };
  const rows = ruleRecords(rule);
  if (rows.length) return { records: rows.length, revenue: rows.reduce((s, r) => s + r.net_revenue, 0) };
  const p = previewImpact(rule);
  return { records: p.matched, revenue: p.revenue };
}

export function ruleExecutions(rule: RevenueRule): RuleExecution[] {
  if (rule.status === "Draft") return [];
  const ds = getDataset(rule.datasetId);
  const p = previewImpact(rule);
  const base = rule.status === "Archived" ? new Date(rule.updated + "T10:00:00Z") : new Date("2026-09-24T23:05:00Z");
  return Array.from({ length: 6 }, (_, i) => {
    const f = 1 - i * 0.03;
    const failed = rule.status !== "Archived" && i === 3;
    const evaluated = Math.round(((ds?.totalRecords ?? 0) / 30) * f);
    const matched = failed ? 0 : Math.round((p.matched / 30) * f);
    return {
      id: `exec_${rule.id.replace(/\W/g, "_")}_${String(6 - i).padStart(2, "0")}`,
      timestamp: new Date(base.getTime() - i * 4 * 3600_000).toISOString(),
      evaluated, matched, revenue: failed ? 0 : Math.round((p.revenue / 30) * f),
      status: failed ? "Failed" : "Successful",
    };
  });
}

export function ruleStatusTone(s: RuleStatus) {
  return s === "Active" ? "success" : s === "Testing" ? "info" : s === "Draft" ? "warning" : "neutral";
}

export function slugId(name: string, revenueType: string) {
  const base = (revenueType || name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `${base || "rule"}.custom_${Date.now().toString(36).slice(-4)}`;
}
