export type ReviewStatus = "Reconciled" | "Warning" | "Failed" | "Awaiting Evidence" | "Not Checked";

export interface ReconciliationIntegrity {
  missing_source_leads?: { count?: number; leads?: { lead_id: string; revenue: number; session_id: string | null }[] };
  session_id_coverage?: { loaded_rows?: number; with_session_id?: number; in_click_bridge?: number };
  duplicates?: { count?: number; leads?: { lead_id: string; rows: number }[] };
  timestamp?: { request_timezone?: string; source_date_column?: string; source_date_basis?: string };
  join_validation?: { path?: string; source_rows?: number; after_lead_bridge?: number; after_click_bridge?: number; matched_loaded?: number };
}

export function reconciliationIntegrityChecks(integrity?: ReconciliationIntegrity | null) {
  const number = (value: number | undefined) => typeof value === "number" && Number.isFinite(value) && value >= 0;
  const show = (value: string | number | undefined) => value === undefined ? "Not returned" : String(value);
  const missing = integrity?.missing_source_leads;
  const coverage = integrity?.session_id_coverage;
  const duplicates = integrity?.duplicates;
  const timestamp = integrity?.timestamp;
  const join = integrity?.join_validation;
  const result = (passed: boolean): "Pass" | "Fail" | "Not checked" => !integrity ? "Not checked" : passed ? "Pass" : "Fail";
  return [
    { label: "Missing source leads", result: result(missing?.count === 0), evidence: integrity ? `Count: ${show(missing?.count)}` : "No integrity returned", details: Array.isArray(missing?.leads) ? missing.leads.map((lead) => `Lead ID: ${lead.lead_id} · Revenue: ${lead.revenue} · Session ID: ${lead.session_id || "—"}`) : [] },
    { label: "Session ID coverage", result: result(number(coverage?.loaded_rows) && number(coverage?.with_session_id) && number(coverage?.in_click_bridge) && coverage?.with_session_id === coverage?.loaded_rows && coverage?.in_click_bridge === coverage?.loaded_rows), evidence: integrity ? `Loaded rows: ${show(coverage?.loaded_rows)} · With session ID: ${show(coverage?.with_session_id)} · In click bridge: ${show(coverage?.in_click_bridge)}` : "No integrity returned", details: [] },
    { label: "Duplicate records", result: result(duplicates?.count === 0), evidence: integrity ? `Count: ${show(duplicates?.count)}` : "No integrity returned", details: Array.isArray(duplicates?.leads) ? duplicates.leads.map((lead) => `Lead ID: ${lead.lead_id} · Rows: ${lead.rows}`) : [] },
    { label: "Timestamp / timezone", result: result(timestamp?.request_timezone === "UTC" && !!timestamp.source_date_column?.trim() && !!timestamp.source_date_basis?.trim()), evidence: integrity ? `Request timezone: ${show(timestamp?.request_timezone)} · Source date column: ${show(timestamp?.source_date_column)} · Source date basis: ${show(timestamp?.source_date_basis)} · Request dates: UTC; end exclusive` : "No integrity returned", details: [] },
    { label: "Joined-query validation", result: result(number(join?.after_click_bridge) && number(join?.matched_loaded) && join?.after_click_bridge === join?.matched_loaded), evidence: integrity ? `Path: ${show(join?.path)} · Source rows: ${show(join?.source_rows)} · After lead bridge: ${show(join?.after_lead_bridge)} · After click bridge: ${show(join?.after_click_bridge)} · Matched loaded: ${show(join?.matched_loaded)}` : "No integrity returned", details: [] },
  ];
}

export function reconciliationReviewStatus(input: { matched?: boolean; manual: boolean; approved: boolean; integrityVerified?: boolean }): ReviewStatus {
  if (input.manual && !input.approved) return "Awaiting Evidence";
  if (input.matched === undefined) return "Not Checked";
  if (!input.matched) return "Failed";
  return input.integrityVerified ? "Reconciled" : "Warning";
}

export function reconciliationDifferences(result: { source_revenue: number; loaded_revenue: number; source_leads: number; loaded_leads: number; difference: number }) {
  return {
    absolute: Math.abs(result.difference),
    percentage: result.source_revenue === 0 ? result.difference === 0 ? 0 : null : Math.abs(result.difference / result.source_revenue) * 100,
    leads: result.source_leads - result.loaded_leads,
  };
}

export function reportInstructions(source: string, start: string, end: string, account: string) {
  return `Source: ${source}\nAccount: ${account.trim() || "Specify the source account"}\nPeriod: ${start || "Select start date"} through ${end || "Select end date"} (inclusive)\nTimezone: UTC\nMetrics: expected revenue (USD) and lead count, for the same source and period as the loaded totals.\nFilters: revenue > 0; record any source-specific filters and exclusions. Keep our_session = no and blank utm_content exclusions explicit where applicable.\nPrecision: revenue to two decimal places; whole-number lead counts.\nInclude the original report, report generation time, account, applied filters and date basis. Do not substitute predictions for actual revenue.`;
}