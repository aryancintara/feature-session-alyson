/** Browser client for the Unified Property UI API. Never talks to the warehouse directly. */
export const PROPERTY_API_BASE_URL = ((import.meta.env.VITE_UNIFIED_PROPERTY_UI_API_BASE_URL as string | undefined) ?? "").replace(/\/$/, "");
const API_KEY = (import.meta.env.VITE_UNIFIED_PROPERTY_API_KEY as string | undefined) ?? "";
export const propertyApiConfigured = !!PROPERTY_API_BASE_URL;

type Params = Record<string, string | number | undefined | null>;
export function propertyUrl(path: string, params: Params = {}) {
  const url = new URL(path.replace(/^\//, ""), `${PROPERTY_API_BASE_URL}/`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== "") url.searchParams.set(k, String(v));
  });
  return url.toString();
}

async function request(path: string, params: Params, accept: string) {
  if (!propertyApiConfigured) throw new Error("The Unified Properties service is not configured yet.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const headers: Record<string, string> = { accept };
    if (path.startsWith("/v1/") && API_KEY) headers["x-api-key"] = API_KEY;
    const res = await fetch(propertyUrl(path, params), { signal: controller.signal, headers });
    if (!res.ok) {
      let msg = `Request failed (${res.status})`;
      try { const body = await res.json(); if (body?.error) msg = String(body.error); } catch { /* ignore */ }
      throw new Error(msg);
    }
    return res;
  } catch (e) {
    if (controller.signal.aborted) throw new Error("The request timed out. Please try again.");
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export async function propertyGet<T>(path: string, params: Params = {}): Promise<T> {
  return (await (await request(path, params, "application/json")).json()) as T;
}
export async function propertyCsv(path: string, params: Params = {}): Promise<Blob> {
  return (await request(path, { ...params, format: "csv" }, "text/csv")).blob();
}

const SOURCE_LABELS: Record<string, string> = {
  HOMELIGHT_TRANSACTIONS: "Homelight",
  ZILLOW_RAPIDAPI: "Zillow",
  ZILLOW_FSBO: "Zillow FSBO",
  RENTCAST: "RentCast",
  SMARTY: "Smarty",
};
export const sourceLabel = (v: string | null | undefined) => (v ? SOURCE_LABELS[v] ?? v.replace(/_/g, " ") : "—");
export const humanize = (v: string | null | undefined) => (v ? v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "—");

export function formatAddress(p: Partial<PropertyRow>) {
  if (p.address) return p.address;
  const street = [p.address_line_1, p.address_line_2].filter(Boolean).join(" ");
  const tail = [p.state, p.zip].filter(Boolean).join(" ");
  return [street, p.city, tail].filter(Boolean).join(", ") || "—";
}

export function fmtPst(v: string | null | undefined) {
  if (!v) return "—";
  // API returns "YYYY-MM-DD HH:MM:SS.ffffff" in UTC without a zone; normalise before parsing.
  const iso = /^\d{4}-\d{2}-\d{2} \d/.test(v) ? v.replace(" ", "T").replace(/(\.\d{3})\d+/, "$1") + (/[zZ]|[+-]\d{2}:?\d{2}$/.test(v) ? "" : "Z") : v;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" }) + " PST";
}
export function relTime(v: string | null | undefined) {
  if (!v) return "—";
  const ms = Date.now() - new Date(v).getTime();
  if (isNaN(ms)) return "—";
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} days ago`;
}

export interface PropertyRow {
  property_id: string;
  property_source: string;
  source_record_id?: string | null;
  source_property_id?: string | null;
  observed_at?: string | null;
  address?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  county?: string | null;
  property_type?: string | null;
  property_sub_type?: string | null;
  home_status?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  list_price?: number | null;
  updated_at?: string | null;
  [key: string]: unknown;
}
export interface PropertiesResponse { total: number; limit: number; offset: number; items?: PropertyRow[]; properties?: PropertyRow[] }
export interface PropertyEvent {
  event_id: string;
  property_id: string;
  event_type: string;
  event_date: string | null;
  event_source: string | null;
  source_record_id?: string | null;
  source_property_id?: string | null;
  source_listing_id?: string | null;
  source_mls_id?: string | null;
  event_attributes?: unknown;
}
export interface EventsResponse { total: number; truncated?: boolean; items?: PropertyEvent[]; events?: PropertyEvent[] }
export type Facets = Record<string, unknown>;

export type PipelineState = "healthy" | "lagging" | "stale" | "failed" | "unknown" | "running";
export interface PipelineStatusResponse {
  asOf: string;
  overallStatus: Exclude<PipelineState, "running">;
  expectedCadenceHours?: number;
  pipelines: {
    id: "property_events" | "property_data";
    label: string;
    description?: string;
    status: PipelineState;
    lastSuccessfulAt: string | null;
    lastAttemptAt: string | null;
    lastAttemptStatus: "SUCCEEDED" | "FAILED" | "RUNNING" | "ABORTED" | "TIMED_OUT" | null;
    lagHours: number | null;
    message?: string | null;
  }[];
  recentRuns?: { pipelineId: string; startedAt: string; stoppedAt?: string | null; status: string; durationMs?: number | null }[];
}
export const pipelineTone = (s: string | undefined): "success" | "warning" | "danger" | "neutral" =>
  s === "healthy" || s === "running" ? "success" : s === "lagging" ? "warning" : s === "stale" || s === "failed" ? "danger" : "neutral";

export interface ApiHealthResponse {
  successRate?: number;
  counts?: { estimatedTotalVolume?: number; logged2xx?: number; logged5xx?: number; total?: number; byStatus?: Record<string, number> | { status: string | number; count: number }[] };
  latencyMs?: { p95?: number };
  series?: { ts?: string; bucket?: string; calls?: number; estimatedTotal?: number; logged5xx?: number; errorRate?: number }[];
  byMethodFamily?: { family: string; calls: number; serverErrors: number; errorRate: number; avgLatencyMs: number; p95LatencyMs: number }[];
  recentErrors?: ServerError[];
  recentServerErrors?: ServerError[];
}
type ServerError = { timestamp?: string; ts?: string; status: number; durationMs?: number; endpoint?: string; path?: string; message?: string; errorMessage?: string };
export const HIDDEN_PATHS = new Set(["/health", "/health/ready", "/v1/health", "/v1/pipeline/status", "/v1/api-health", "/v1/meta/facets"]);
