// Static mock data + mock API for the Unified Tables module (frontend only).

export type TableStatus = "Healthy" | "Warning" | "Error" | "Coming Soon";
export type Severity = "Critical" | "Warning" | "Healthy";

export interface UnifiedTable {
  id: string;
  name: string;
  domain: string;
  description: string;
  records: number;
  sources: string[];
  lastUpdated: string;
  status: TableStatus;
  addedToday: number;
  updatedToday: number;
  missingIds: number;
  qualityScore: number;
}

export interface SchemaColumn {
  name: string;
  type: string;
  group: string;
  description: string;
  nullable: boolean;
  example: string;
}

export interface QualityCheck {
  name: string;
  severity: Severity;
  detail: string;
  affected: number;
}

export interface LineageNode {
  label: string;
  kind: "source" | "transform" | "unified" | "destination";
  detail: string;
}

export interface RevenueRecord {
  tenant_id: string;
  revenue_summary_id: string;
  revenue_object_type: string;
  revenue_object_id: string;
  source_id: string;
  source_event_id: string;
  source_row_id: string;
  source_row_uri: string;
  source_row_hash: string;
  session_id: string;
  lead_id: string;
  order_id: string;
  customer_id: string;
  conversation_id: string;
  transaction_id: string;
  revenue_type: string;
  gross_revenue: number;
  refund_amount: number;
  credit_amount: number;
  other_adjustments: number;
  net_revenue: number;
  estimated_revenue: number;
  earned_revenue: number;
  invoiced_revenue: number;
  received_revenue: number;
  best_current_order_prediction: number;
  best_lifetime_prediction: number;
  currency: string;
  event_timestamp: string;
  processing_status: string;
  created_at: string;
  updated_at: string;
  pipeline_run: string;
}

export const LAST_SYNC = "2 minutes ago";

export const UNIFIED_TABLES: UnifiedTable[] = [
  { id: "revenue", name: "Unified Revenue", domain: "Revenue", description: "Canonical revenue layer combining revenue events, lifecycle amounts, and attribution.", records: 2_400_000, sources: ["Homelight", "Phonexa", "CRM"], lastUpdated: "2 minutes ago", status: "Healthy", addedToday: 18_420, updatedToday: 6_310, missingIds: 1_204, qualityScore: 97.8 },
  { id: "leads", name: "Unified Leads", domain: "Leads", description: "Canonical lead entity from all lead sources.", records: 12_800_000, sources: ["Revenue Leads Plus", "Phonexa", "Web Forms", "CRM"], lastUpdated: "4 minutes ago", status: "Healthy", addedToday: 84_210, updatedToday: 22_904, missingIds: 5_880, qualityScore: 96.4 },
  { id: "sessions", name: "Unified Sessions", domain: "Sessions", description: "Canonical customer journey/session entity.", records: 45_000_000, sources: ["Session Summary", "Anonymous User", "UCT Events"], lastUpdated: "6 minutes ago", status: "Healthy", addedToday: 412_300, updatedToday: 91_020, missingIds: 12_402, qualityScore: 95.1 },
  { id: "customers", name: "Unified Customers", domain: "Identity", description: "Resolved customer/person entity.", records: 8_400_000, sources: ["Identity Resolution", "CRM", "Revenue Leads Plus"], lastUpdated: "18 minutes ago", status: "Warning", addedToday: 31_880, updatedToday: 14_210, missingIds: 9_310, qualityScore: 88.2 },
  { id: "costs", name: "Unified Costs", domain: "Finance", description: "Cost attribution layer.", records: 900_000, sources: ["Ad Platforms", "Finance Ledger"], lastUpdated: "—", status: "Coming Soon", addedToday: 0, updatedToday: 0, missingIds: 0, qualityScore: 0 },
];

export const FEATURE_FLAGS: Record<string, boolean> = {
  "unified.revenue_workers": false,
  "unified.predictions": false,
  "unified.reconciliation": false,
  "unified.drivers": false,
};

export const HIDDEN_FEATURES: Record<string, { flag: string; title: string; description: string }> = {
  "revenue-workers": { flag: "unified.revenue_workers", title: "Revenue Workers", description: "Background workers that compute revenue lifecycle states." },
  predictions: { flag: "unified.predictions", title: "Predictions", description: "Order and lifetime revenue predictions." },
  reconciliation: { flag: "unified.reconciliation", title: "Reconciliation", description: "Match invoiced vs received revenue across sources." },
  drivers: { flag: "unified.drivers", title: "Revenue Drivers", description: "Attribution of revenue to channels, sources, and journeys." },
};

export const REVENUE_SCHEMA: SchemaColumn[] = [
  ["tenant_id", "string", "Identity", "Tenant that owns the record", false, "tnt_resolve"],
  ["revenue_summary_id", "string", "Identity", "Unique unified revenue row ID", false, "rev_000123"],
  ["revenue_object_type", "string", "Identity", "Kind of object revenue is attached to", false, "order"],
  ["revenue_object_id", "string", "Identity", "ID of the revenue object", false, "ord_58213"],
  ["source_id", "string", "Lineage", "Originating source system", false, "homelight"],
  ["source_event_id", "string", "Lineage", "Event ID in the source", true, "evt_hl_99812"],
  ["source_row_id", "string", "Lineage", "Original row ID in raw data", false, "row_7781"],
  ["source_row_uri", "string", "Lineage", "Location of the raw row", true, "s3://raw/homelight/2026-09-24/part-01.parquet"],
  ["source_row_hash", "string", "Lineage", "Hash of the raw row for change detection", false, "9f2c…a1"],
  ["session_id", "string", "Context", "Linked session", true, "ses_4a1d"],
  ["lead_id", "string", "Context", "Linked lead", true, "lead_88123"],
  ["order_id", "string", "Context", "Linked order", true, "ord_58213"],
  ["customer_id", "string", "Context", "Resolved customer", true, "rev_user_1029"],
  ["conversation_id", "string", "Context", "Linked conversation", true, "conv_311"],
  ["revenue_type", "string", "Revenue", "Revenue category", false, "referral_fee"],
  ["gross_revenue", "decimal", "Revenue", "Revenue before adjustments", false, "1250.00"],
  ["refund_amount", "decimal", "Revenue", "Refunded amount", true, "0.00"],
  ["credit_amount", "decimal", "Revenue", "Credits issued", true, "25.00"],
  ["other_adjustments", "decimal", "Revenue", "Other adjustments", true, "0.00"],
  ["net_revenue", "decimal", "Revenue", "Revenue after adjustments", false, "1225.00"],
  ["estimated_revenue", "decimal", "Lifecycle", "Estimated revenue", true, "1300.00"],
  ["earned_revenue", "decimal", "Lifecycle", "Earned revenue", true, "1225.00"],
  ["invoiced_revenue", "decimal", "Lifecycle", "Invoiced revenue", true, "1225.00"],
  ["received_revenue", "decimal", "Lifecycle", "Cash received", true, "1000.00"],
  ["best_current_order_prediction", "decimal", "Predictions", "Best predicted value of current order", true, "1310.00"],
  ["best_lifetime_prediction", "decimal", "Predictions", "Best predicted lifetime value", true, "4120.00"],
  ["currency", "string", "Metadata", "ISO currency code", false, "USD"],
  ["event_timestamp", "timestamp", "Metadata", "When the revenue event happened", false, "2026-09-24T14:21:08Z"],
  ["processing_status", "string", "Metadata", "Pipeline processing status", false, "processed"],
  ["created_at", "timestamp", "Metadata", "Row created in unified table", false, "2026-09-24T14:25:00Z"],
  ["updated_at", "timestamp", "Metadata", "Row last updated", false, "2026-09-24T15:02:11Z"],
].map(([name, type, group, description, nullable, example]) => ({ name, type, group, description, nullable, example }) as SchemaColumn);

const GENERIC_SCHEMA: SchemaColumn[] = [
  { name: "tenant_id", type: "string", group: "Identity", description: "Tenant that owns the record", nullable: false, example: "tnt_resolve" },
  { name: "entity_id", type: "string", group: "Identity", description: "Unified entity ID", nullable: false, example: "ent_000123" },
  { name: "source_id", type: "string", group: "Lineage", description: "Originating source system", nullable: false, example: "crm" },
  { name: "source_row_id", type: "string", group: "Lineage", description: "Original row ID", nullable: false, example: "row_1182" },
  { name: "created_at", type: "timestamp", group: "Metadata", description: "Row created", nullable: false, example: "2026-09-24T14:25:00Z" },
  { name: "updated_at", type: "timestamp", group: "Metadata", description: "Row last updated", nullable: false, example: "2026-09-24T15:02:11Z" },
];

export function schemaFor(id: string) {
  return id === "revenue" ? REVENUE_SCHEMA : GENERIC_SCHEMA;
}

export function lineageFor(t: UnifiedTable): LineageNode[] {
  return [
    ...t.sources.map((s) => ({ label: `${s} Raw Data`, kind: "source" as const, detail: `raw.${s.toLowerCase().replace(/\W+/g, "_")}` })),
    { label: `Optimized ${t.domain} Events`, kind: "transform", detail: "Dedupe, normalize, type-cast" },
    { label: t.name, kind: "unified", detail: `unified.${t.id}` },
    { label: `${t.domain} Analytics`, kind: "destination", detail: "Dashboards & audiences" },
  ];
}

export function qualityFor(t: UnifiedTable): QualityCheck[] {
  const warn = t.status === "Warning";
  return [
    { name: "Duplicate Records", severity: "Healthy", detail: "No duplicate primary keys detected", affected: 0 },
    { name: "Missing IDs", severity: t.missingIds > 5000 ? "Warning" : "Healthy", detail: "Rows without a linked session or lead", affected: t.missingIds },
    { name: "Null Critical Fields", severity: warn ? "Critical" : "Healthy", detail: "Required fields containing nulls", affected: warn ? 412 : 0 },
    { name: "Freshness Delay", severity: warn ? "Warning" : "Healthy", detail: warn ? "Last load 18 min behind schedule" : "Within 10 min SLA", affected: 0 },
    { name: "Schema Changes", severity: "Warning", detail: "1 new nullable column detected upstream", affected: 1 },
  ];
}

export function recordsOverTime(t: UnifiedTable) {
  const days = ["Sep 18", "Sep 19", "Sep 20", "Sep 21", "Sep 22", "Sep 23", "Sep 24"];
  return days.map((d, i) => ({ day: d, records: Math.round(t.records * (0.94 + i * 0.01)) }));
}

export function recordsBySource(t: UnifiedTable) {
  const weights = [0.46, 0.3, 0.16, 0.08];
  return t.sources.map((s, i) => ({ source: s, records: Math.round(t.records * (weights[i] ?? 0.05)) }));
}

// Deterministic revenue records
const SOURCES = ["homelight", "phonexa", "crm"];
const TYPES = ["referral_fee", "lead_sale", "subscription", "commission"];
const STATUSES = ["processed", "processed", "processed", "pending", "failed"];

export const REVENUE_RECORDS: RevenueRecord[] = Array.from({ length: 120 }, (_, i) => {
  const gross = 200 + ((i * 137) % 2400);
  const refund = i % 9 === 0 ? Math.round(gross * 0.1) : 0;
  const credit = i % 7 === 0 ? 25 : 0;
  const net = gross - refund - credit;
  const src = SOURCES[i % 3];
  const ts = new Date(Date.UTC(2026, 8, 24, 23 - (i % 24), (i * 7) % 60)).toISOString();
  return {
    tenant_id: "tnt_resolve",
    revenue_summary_id: `rev_${String(100000 + i)}`,
    revenue_object_type: ["Lead", "Order", "Click", "Subscription", "Call", "Other"][i % 6],
    revenue_object_id: `ord_${58000 + i}`,
    source_id: src,
    source_event_id: `evt_${src.slice(0, 2)}_${90000 + i * 3}`,
    source_row_id: `row_${7000 + i}`,
    source_row_uri: `s3://raw/${src}/2026-09-24/part-${String(i % 8).padStart(2, "0")}.parquet`,
    source_row_hash: `${(i * 2654435761 >>> 0).toString(16)}`,
    session_id: i % 11 === 0 ? "" : `ses_${(i * 97).toString(16)}`,
    lead_id: `lead_${88000 + i}`,
    order_id: `ord_${58000 + i}`,
    customer_id: `rev_user_${1000 + (i % 60)}`,
    conversation_id: `conv_${300 + i}`,
    transaction_id: `txn_${(i * 7919 + 40000).toString(36)}`,
    revenue_type: TYPES[i % 4],
    gross_revenue: gross,
    refund_amount: refund,
    credit_amount: credit,
    other_adjustments: 0,
    net_revenue: net,
    estimated_revenue: Math.round(gross * 1.05),
    earned_revenue: net,
    invoiced_revenue: i % 5 === 0 ? 0 : net,
    received_revenue: i % 3 === 0 ? Math.round(net * 0.8) : net,
    best_current_order_prediction: Math.round(gross * 1.07),
    best_lifetime_prediction: Math.round(gross * 3.3),
    currency: "USD",
    event_timestamp: ts,
    processing_status: STATUSES[i % 5],
    created_at: ts,
    updated_at: ts,
    pipeline_run: `run_2026-09-24_${String(i % 6).padStart(2, "0")}`,
  };
});

// Mock API layer (simulated latency)
const wait = <T,>(v: T, ms = 250) => new Promise<T>((r) => setTimeout(() => r(v), ms));
export const unifiedApi = {
  listTables: () => wait(UNIFIED_TABLES),
  getTable: (id: string) => wait(UNIFIED_TABLES.find((t) => t.id === id) ?? null),
  listRecords: (id: string) => wait(id === "revenue" ? REVENUE_RECORDS : []),
};

export function fmtCompact(n: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
export function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function statusTone(s: TableStatus) {
  return s === "Healthy" ? "success" : s === "Warning" ? "warning" : s === "Error" ? "danger" : "neutral";
}
