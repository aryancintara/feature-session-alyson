/** Browser client for the read-only Unified Leads UI API. Never calls Athena directly. */
import { getLeadsCredentials, logoutUnifiedLeads } from "@/lib/unifiedLeadsAuth";
export const UNIFIED_LEADS_API_BASE_URL =
  (import.meta.env.VITE_UNIFIED_LEADS_UI_API_BASE_URL as string | undefined) ||
  "https://uw2mvfnhoc.execute-api.us-west-2.amazonaws.com";

type Params = Record<string, string | number | undefined | null>;
export function leadsUrl(path: string, params: Params = {}) {
  const url = new URL(path.replace(/^\//, ""), `${UNIFIED_LEADS_API_BASE_URL.replace(/\/$/, "")}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") url.searchParams.set(key, String(value));
  });
  return url.toString();
}

const SESSION_ENDED = "Your session has ended. Please sign in again.";
/** Credentials are resolved fresh per request; tenant ids override anything the caller passed. */
async function authedFetch(path: string, params: Params, accept: string, signal?: AbortSignal) {
  const creds = await getLeadsCredentials();
  if (!creds) { await logoutUnifiedLeads(); throw new Error(SESSION_ENDED); }
  const { idToken, tenant } = creds;
  const headers: Record<string, string> = { Accept: accept, Authorization: `Bearer ${idToken}`, "x-client-id": tenant.clientId, "x-workspace-id": tenant.workspaceId };
  const finalParams = { ...params, client_id: tenant.clientId, workspace_id: tenant.workspaceId };
  const response = await fetch(leadsUrl(path, finalParams), { signal, headers });
  if (response.status === 401) { await logoutUnifiedLeads(); throw new Error(SESSION_ENDED); }
  if (!response.ok) throw new Error(`Unified Leads request failed (${response.status})`);
  return response;
}

export async function leadsGet<T>(path: string, params: Params = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await authedFetch(path, params, "application/json", controller.signal);
    return await response.json() as T;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("The request timed out. Please try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** CSV needs the Bearer header, so fetch it and download via a Blob (no window.open). */
export interface CsvExportInfo { matchedTotal: number | null; truncated: boolean; rowCount: number | null }
export async function leadsDownloadCsv(path: string, params: Params = {}, filename = "unified-leads.csv"): Promise<CsvExportInfo> {
  const response = await authedFetch(path, params, "text/csv");
  const num = (h: string) => { const v = response.headers.get(h); return v == null || v === "" || isNaN(Number(v)) ? null : Number(v); };
  const info: CsvExportInfo = { matchedTotal: num("X-Export-Matched-Total"), truncated: /^(1|true|yes)$/i.test(response.headers.get("X-Export-Truncated") ?? ""), rowCount: num("X-Export-Row-Count") };
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return info;
}

export interface Lead {
  id: string;
  date_pst: string | null;
  datetime_pst: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  person_id: string | null;
  buyer_name: string | null;
  buyer_id: string | null;
  buyer_lead_id: string | null;
  source: string | null;
  source_detail: string | null;
  submission_method: string | null;
  channel: string | null;
  channel_detail: string | null;
  campaign: string | null;
  campaign_detail: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  marketing_source: string | null;
  marketing_channel: string | null;
  lead_user_type: string | null;
  lead_score: number | null;
  phone_verified: boolean | null;
  phone_verified_source: string | null;
  address_line_1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  property_type: string | null;
  property_price: number | null;
  source_page_type: string | null;
  source_form: string | null;
  publisher: string | null;
  publisher_channel: string | null;
  referrer: string | null;
  client_notes: string | null;
  notes_from_agent: string | null;
  notes_to_agents: string | null;
  client_id: string | null;
  workspace_id: string | null;
  vertical_id: string | null;
  sub_vertical_id: string | null;
  offer_id: string | null;
  sub_offer_id: string | null;
  alyson_session_id: string | null;
  routing_platform_lead_id: string | null;
  client_lead_id: string | null;
  buyer_date: string | null;
  closed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  custom_attributes: unknown;
  current_stage?: string | null;
  stage_at?: string | null;
  stage_source?: "crm" | "event" | string | null;
}
export interface Facets {
  date_pst?: { min: string | null; max: string | null };
  lead_count?: number;
  buyers?: { buyer_id: string; buyer_name: string }[];
  [key: string]: unknown;
}
export interface LeadsResponse { total: number; limit: number; offset: number; leads: Lead[] }
export interface LeadDetail {
  lead: Lead;
  buyer_name: string | null;
  bridge: Record<string, unknown> | null;
  current_stage: string | null;
  stage_at: string | null;
  stage_source?: "crm" | "event" | string | null;
  events_count: number;
}
export interface LeadEvent {
  id: string;
  event_type: string;
  event_subtype: string | null;
  event_source: string | null;
  event_timestamp: string | null;
  old_value: string | null;
  new_value: string | null;
  event_payload: unknown;
  source_event_id: string | null;
}
export interface EventsResponse { total: number; limit: number; offset: number; events: LeadEvent[] }

export interface LeadsPipelineStatus {
  asOf: string;
  overallStatus: "healthy" | "lagging" | "stale" | "failed" | "unknown";
  expectedCadenceMinutes?: number;
  pipelines: { id: string; label: string; description?: string; status: string; lastSuccessfulAt: string | null; lastAttemptAt: string | null; lastAttemptStatus: string | null; lagMinutes: number | null; message?: string | null }[];
  recentRuns?: { pipelineId: string; startedAt: string; stoppedAt?: string | null; status: string; durationMs?: number | null }[];
}
export const LEADS_HIDDEN_PATHS = new Set(["/health", "/health/ready", "/v1/health", "/v1/pipeline/status", "/v1/api-health", "/v1/meta/facets"]);
