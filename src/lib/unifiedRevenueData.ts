// Static mock data for the Unified Revenue module (Phase 1, frontend only).
import { REVENUE_RECORDS, type RevenueRecord } from "@/lib/unifiedTablesData";

export { REVENUE_RECORDS };
export type { RevenueRecord };

export const TENANTS = [
  { id: "tnt_revcloud", name: "RevCloud" },
  { id: "tnt_demo", name: "Demo Tenant" },
];

export type IssueStatus = "Open" | "Investigating" | "Resolved" | "Ignored";
export type IssueSeverity = "Critical" | "Warning" | "Info";

export interface RevenueIssue {
  id: string;
  severity: IssueSeverity;
  title: string;
  source: string;
  status: IssueStatus;
  created: string;
  whatHappened: string;
  whyDetected: string;
  expected: string;
  actual: string;
  steps: string[];
  affected: number;
  runId: string;
}

export const REVENUE_ISSUES: RevenueIssue[] = [
  { id: "iss_101", affected: 24, runId: "run_2026-09-24_05", severity: "Critical", title: "Revenue rows failed processing", source: "Phonexa", status: "Open", created: "2026-09-24", whatHappened: "24 Phonexa revenue rows failed during revenue processing.", whyDetected: "processing_status = failed on rows loaded in the last run.", expected: "0 failed rows", actual: "24 failed rows", steps: ["Open failed rows in Events filtered by status = failed", "Check raw fields for malformed amounts", "Re-run the pipeline for the affected partition"] },
  { id: "iss_102", affected: 11, runId: "run_2026-09-24_04", severity: "Warning", title: "Missing session IDs", source: "Homelight", status: "Investigating", created: "2026-09-24", whatHappened: "Some Homelight revenue events could not be linked to a session.", whyDetected: "session_id is empty on rows where a lead_id exists.", expected: "< 1% rows missing session_id", actual: "9.1% rows missing session_id", steps: ["Filter Events by Source = Homelight and empty Session ID", "Confirm lead IDs exist in Unified Leads", "Check session stitching window"] },
  { id: "iss_103", affected: 24, runId: "run_2026-09-24_03", severity: "Warning", title: "Invoiced lower than earned", source: "CRM", status: "Open", created: "2026-09-23", whatHappened: "Invoiced revenue is 0 for rows marked earned.", whyDetected: "Lifecycle rule: earned > 0 and invoiced = 0 after 7 days.", expected: "Invoiced ≈ Earned", actual: "Invoiced = $0 on 24 rows", steps: ["Review CRM invoice sync", "Compare with finance ledger"] },
  { id: "iss_104", affected: 0, runId: "run_2026-09-24_02", severity: "Info", title: "New upstream column detected", source: "Homelight", status: "Resolved", created: "2026-09-22", whatHappened: "A new nullable column appeared in Homelight raw data.", whyDetected: "Schema drift check on raw source.", expected: "Schema unchanged", actual: "1 new column: partner_tier", steps: ["Decide whether to map the new column", "Update schema documentation"] },
  { id: "iss_105", affected: 3, runId: "run_2026-09-24_01", severity: "Warning", title: "Refund without original order", source: "Phonexa", status: "Ignored", created: "2026-09-21", whatHappened: "Refund rows reference orders not present in Unified Revenue.", whyDetected: "refund_amount > 0 with unknown order_id.", expected: "All refunds match an order", actual: "3 unmatched refunds", steps: ["Look up order IDs in source system", "Mark as known legacy orders"] },
];

export const SOURCE_META: Record<string, { name: string; connector: string }> = {
  homelight: { name: "Homelight", connector: "S3 Parquet" },
  phonexa: { name: "Phonexa", connector: "REST API" },
  crm: { name: "CRM", connector: "Salesforce" },
};

export function sourceName(id: string) {
  return SOURCE_META[id]?.name ?? id;
}

export function revenueSources() {
  return Object.entries(SOURCE_META).map(([id, m]) => {
    const rows = REVENUE_RECORDS.filter((r) => r.source_id === id);
    const failed = rows.filter((r) => r.processing_status === "failed").length;
    return {
      id,
      source: m.name,
      connector: m.connector,
      revenueTypes: Array.from(new Set(rows.map((r) => r.revenue_type))),
      events: rows.length,
      revenue: rows.reduce((s, r) => s + r.net_revenue, 0),
      estimated: rows.reduce((s, r) => s + r.estimated_revenue, 0),
      lastRun: rows.map((r) => r.pipeline_run).sort().at(-1) ?? "—",
      lastEvent: rows.map((r) => r.event_timestamp).sort().at(-1) ?? "—",
      status: failed > 0 ? "Warning" : "Healthy",
      issues: REVENUE_ISSUES.filter((i) => i.source === m.name && (i.status === "Open" || i.status === "Investigating")).length,
    };
  });
}

export function groupSum<K extends keyof RevenueRecord>(key: K) {
  const m = new Map<string, number>();
  for (const r of REVENUE_RECORDS) m.set(String(r[key]), (m.get(String(r[key])) ?? 0) + r.net_revenue);
  return Array.from(m, ([name, value]) => ({ name, value }));
}

export function revenueByHour() {
  const m = new Map<string, number>();
  for (const r of REVENUE_RECORDS) {
    const h = r.event_timestamp.slice(11, 13) + ":00";
    m.set(h, (m.get(h) ?? 0) + r.net_revenue);
  }
  return Array.from(m, ([time, revenue]) => ({ time, revenue })).sort((a, b) => a.time.localeCompare(b.time));
}

export function lifecycleTotals() {
  const sum = (k: keyof RevenueRecord) => REVENUE_RECORDS.reduce((s, r) => s + Number(r[k]), 0);
  return [
    { stage: "Estimated", value: sum("estimated_revenue") },
    { stage: "Earned", value: sum("earned_revenue") },
    { stage: "Invoiced", value: sum("invoiced_revenue") },
    { stage: "Received", value: sum("received_revenue") },
  ];
}

export function issueTone(s: IssueSeverity) {
  return s === "Critical" ? "danger" : s === "Warning" ? "warning" : "info";
}
export function issueStatusTone(s: IssueStatus) {
  return s === "Open" ? "danger" : s === "Investigating" ? "warning" : s === "Resolved" ? "success" : "neutral";
}
export function procTone(s: string) {
  return s === "processed" ? "success" : s === "pending" ? "warning" : "danger";
}

export type RunStatus = "Successful" | "Running" | "Failed";
export interface PipelineRun { id: string; timestamp: string; processed: number; successful: number; failed: number; durationSec: number; status: RunStatus; sources: string[] }

export const PIPELINE_RUNS: PipelineRun[] = Array.from({ length: 12 }, (_, i) => {
  const id = `run_2026-09-24_${String(i % 6).padStart(2, "0")}`;
  const rows = REVENUE_RECORDS.filter((r) => r.pipeline_run === id);
  const status: RunStatus = i === 0 ? "Running" : i === 3 || i === 8 ? "Failed" : "Successful";
  const processed = rows.length * 150 + i * 37;
  const failed = status === "Failed" ? 24 + i : status === "Running" ? 0 : i % 4;
  return {
    id: i < 6 ? id : `run_2026-09-23_${String(i % 6).padStart(2, "0")}`,
    timestamp: new Date(Date.UTC(2026, 8, 24, 23 - i * 4, 5)).toISOString(),
    processed, successful: processed - failed, failed,
    durationSec: status === "Running" ? 0 : 180 + ((i * 73) % 420),
    status,
    sources: Object.keys(SOURCE_META).filter((_, k) => (i + k) % 3 !== 2),
  };
});

export function runTone(s: RunStatus) {
  return s === "Successful" ? "success" : s === "Running" ? "info" : "danger";
}
export function fmtDuration(sec: number) {
  return sec ? `${Math.floor(sec / 60)}m ${sec % 60}s` : "—";
}
export function sourceIdByName(name: string) {
  return Object.entries(SOURCE_META).find(([, m]) => m.name === name)?.[0] ?? "";
}
