import { RULES_API_BASE, rulesAuthHeaders } from "@/lib/rulesApi";

export type DailyLead = Record<string, unknown>;
export interface DailySource {
  label: string;
  status: "matched" | "difference" | "failed";
  error?: string | null;
  source_leads?: number | null;
  source_revenue?: number | null;
  loaded_leads?: number | null;
  loaded_revenue?: number | null;
  difference?: number | null;
  missing?: DailyLead[];
  different?: DailyLead[];
}
export interface DailyReport {
  run_at: string;
  start: string;
  end: string;
  difference_found: boolean;
  available_dates: string[];
  sources: DailySource[];
}

export function dailyReportUrl(date = "") {
  return `${RULES_API_BASE}/reconcile/daily${date ? `?date=${encodeURIComponent(date)}` : ""}`;
}

export function parseDailyReport(value: unknown, status = 200): DailyReport | null {
  if (status === 404) return null;
  let payload = value;
  if (payload && typeof payload === "object" && "body" in payload) {
    const wrapper = payload as { statusCode?: number; body: unknown };
    if (wrapper.statusCode === 404) return null;
    status = wrapper.statusCode ?? status;
    payload = typeof wrapper.body === "string" ? JSON.parse(wrapper.body) : wrapper.body;
  }
  if (status >= 400) throw new Error(`Daily report unavailable (${status}).`);
  if (!payload || typeof payload !== "object") throw new Error("The daily report returned an incomplete result.");
  const report = payload as DailyReport;
  if (typeof report.run_at !== "string" || typeof report.start !== "string" || typeof report.end !== "string"
    || typeof report.difference_found !== "boolean" || !Array.isArray(report.available_dates)
    || !report.available_dates.every((date) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date))
    || !Array.isArray(report.sources) || !report.sources.every((source) => source && typeof source.label === "string"
      && ["matched", "difference", "failed"].includes(source.status))) {
    throw new Error("The daily report returned an incomplete result.");
  }
  return report;
}

export async function getDailyReport(date = "", signal?: AbortSignal) {
  const response = await fetch(dailyReportUrl(date), { signal, headers: await rulesAuthHeaders() });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Daily report unavailable (${response.status}).`);
  return parseDailyReport(await response.json());
}

export function dailyReportStatus(report: DailyReport) {
  if (report.difference_found) return "Differences found";
  if (report.sources.length === 0 || report.sources.some((source) => source.status === "failed")) return "Check incomplete";
  if (report.sources.some((source) => source.status === "difference")) return "Differences found";
  return "All sources match";
}

export const DAILY_DETAIL_LIMIT = 200;
export function dailyDetailRows(rows?: DailyLead[]) {
  return (rows ?? []).slice(0, DAILY_DETAIL_LIMIT);
}

export function dailyDetailColumns(rows: DailyLead[], kind: "missing" | "different") {
  const defaults = kind === "missing" ? ["lead_id", "session_id", "revenue"] : ["lead_id", "session_id", "source_revenue", "loaded_revenue"];
  return [...new Set([...defaults, ...rows.flatMap((row) => Object.keys(row))])];
}

export function dailyDetailCsv(rows: DailyLead[], columns: string[]) {
  const cell = (value: unknown) => `"${String(value == null ? "" : typeof value === "object" ? JSON.stringify(value) : value).replace(/"/g, '""')}"`;
  return [columns.map(cell).join(","), ...rows.map((row) => columns.map((key) => cell(row[key])).join(","))].join("\n");
}