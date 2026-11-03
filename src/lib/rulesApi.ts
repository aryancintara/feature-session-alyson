// Browser client for the Cost & Revenue Rules API (AWS). Sends the Cognito ID token and workspace.
import { getLeadsCredentials } from "@/lib/unifiedLeadsAuth";

export const RULES_API_BASE = (import.meta.env.VITE_RULES_API_BASE as string | undefined)?.replace(/\/$/, "") || "https://i4mf0v33aa.execute-api.us-west-2.amazonaws.com";

export async function rulesAuthHeaders(extra?: HeadersInit): Promise<Record<string, string>> {
  const creds = await getLeadsCredentials();
  if (!creds) throw new RulesApiError(401, JSON.stringify({ code: "AUTHENTICATION_REQUIRED", message: "Please sign in." }));
  return {
    "Content-Type": "application/json",
    "x-auth-token": creds.idToken,
    "x-workspace-id": creds.tenant.workspaceId,
    ...(extra as Record<string, string> | undefined),
  };
}

export type RuleType = "COST" | "REVENUE";
export interface RuleCondition { field: string; op: string; value?: string | number | (string | number)[] | null }
export type CalcKind = "revenue_share" | "roas" | "event";
export type RuleCalc =
  | { kind: CalcKind; field: string; percent: number | null; amount?: number | null }
  | { kind: "cents"; field: string; session?: string }
  | { kind: "money"; field: string; session?: string }
  | { kind: "event_based"; amount: number }
  | { kind: "sms_per_count"; per_count: number; amount: number };

export interface ApiRule {
  rule_id: string; rule_version: number; name: string; description?: string; type: RuleType;
  source_id: string; source_table: string; conditions: RuleCondition[]; calculation: RuleCalc;
  status: string; effective_from?: string | null; effective_to?: string | null; created_by?: string; created_at?: string;
}
export interface NewRule { rule_id: string; name: string; description: string; type: RuleType; source_id: string; source_table: string; conditions: RuleCondition[]; calculation: RuleCalc; start_date: string; end_date?: string; created_by: string }

export const SOURCE_TABLES: Record<string, string> = { homelight: "sampledb.revenue_leads_plus", tune: "raw.raw_tune_clicks", phonexa: "raw.phonexa_ref_raw", uct: "unified.uct_revenue" };
export const SOURCE_LABELS: Record<string, string> = { homelight: "Homelight", tune: "Tune", phonexa: "Phonexa", sms: "SMS", uct: "3P (UCT)" };
export const SOURCE_FIELDS: Record<string, string[]> = {
  homelight: ["id", "user_id", "area_id", "price", "client_id", "email", "name", "referer", "referrer", "search_term", "extra_info", "client_notes", "already_has_agent", "notes_to_agents", "notes_from_agent", "client_ae_id", "agent_ae_id", "onboarding_ae_id", "message", "created_at", "updated_at", "duplicate", "source", "sub_source", "traffic_source", "user_type", "area_type", "property_type", "most_important", "address", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "source_page_type", "source_form", "call_review", "stage", "sell_reason", "owner_id", "fake", "property_use", "zip_code", "adwords_ad_id", "adwords_campaign_id", "adwords_campaign_name", "gclid", "adwords_group_id", "adwords_group_name", "agent_commission", "commission_paid", "commission_split", "lead_status_date", "probability", "wire_fee", "qualification_talked_to_client", "qualification_left_voicemail", "heard_about_homelight_on", "heard_about_homelight_set_by", "entry_controller", "entry_action", "entry_path", "furthest_stage", "is_deal", "revenue_recognition_date", "close_date", "lead_channel_id", "marketing_source", "marketing_campaign", "cleansed_campaign", "vintage_factor", "calculated_value", "probability_v3", "calculated_value_v3", "calculated_value_initial_score_v3", "property_uuid", "qualification_is_an_agent", "concierge_triggered", "probability_v4", "calculated_value_v4", "calculated_value_initial_score_v4", "time_decay", "calculated_value_at", "one_week_calc_val", "two_week_calc_val", "one_month_calc_val", "two_month_calc_val", "three_month_calc_val", "four_month_calc_val", "six_month_calc_val", "outgoing_call_count", "hl_lead", "msa_name", "city_name", "city_slug", "hotfix_id", "timeline", "timeline_sort", "marketing_channel", "departmental_rollup", "marketing_is_branded", "business_product", "state_name", "state_code", "calculated_value_g4_hist", "old_calculated_value_g4", "old_calculated_value_g4_q2_20", "calculated_value_g5", "calculated_value_g4", "expected_revenue", "gg_rev_quick_fix", "calculated_value_g5_2", "calculated_value_g6_4", "calculated_value_g6_5", "datetime_pst", "date_pst", "expected_net_revenue_no_buyer", "phone_verified", "phone_verified_source", "is_talked_to", "intro_type", "1d_meeting", "7d_meeting", "14d_meeting", "30d_meeting", "is_intro_qualified", "is_meeting", "is_listing", "is_closed", "lead_status_category", "knockout_agent_matches_blind_intro_exception", "knockout_agent_needs_phone_verification", "knockout_agent_duplicate", "knockout_agent_is_listed", "knockout_agent_already_talked_to_client", "knockout_agent_deliverable_address", "knockout_agent_disallowed_property_type", "knockout_agent_needs_property_type", "knockout_agent_missing_address_parts", "knockout_agent_already_in_auto_blind_process", "knockout_agent_incorrect_client_name", "knockout_agent_potential_agent", "knockout_agent_auto_intro_rejected", "knockout_agent_interested_event_exists", "knockout_agent_consent_duplicate", "knockout_agent_recently_sold", "knockout_agent_is_homelight_email", "knockout_agent_too_many_blind_attempts", "knockout_agent_needs_price", "knockout_agent_incorrect_client_email", "knockout_agent_deal", "knockout_agent_client_unreachable", "knockout_agent_matches_agent_email", "knockout_agent_matches_agent_phone", "knockout_agent_is_agent", "knockout_agent_email_matches_broker_domain", "knockout_investor_fast_intro_disallowed", "knockout_investor_needs_phone_verification", "knockout_investor_is_listed", "knockout_investor_already_talked_to_client", "knockout_investor_duplicate", "knockout_investor_needs_property_type", "knockout_investor_missing_investor_details", "knockout_investor_missing_address_parts", "knockout_investor_auto_intro_rejected", "knockout_investor_already_in_auto_blind_process", "knockout_investor_incorrect_client_name", "knockout_investor_is_homelight_email", "knockout_investor_needs_price", "knockout_investor_incorrect_client_email", "knockout_investor_deal", "knockout_violated_blind_intro_exception_id", "knockout_legacy_mortgage_siblings_exist", "knockout_legacy_too_many_blind_attempts", "knockout_legacy_qualification_incorrect_voicemail", "knockout_legacy_qualification_incorrect_contact", "knockout_legacy_qualification_incorrect_address", "knockout_legacy_qualification_incomplete_name", "knockout_legacy_qualification_not_a_proper_house", "knockout_legacy_qualification_is_an_agent", "knockout_legacy_qualification_previous_contract", "knockout_legacy_already_deal", "knockout_legacy_matches_blind_intro_exception", "knockout_legacy_disallowed_property_types", "knockout_legacy_not_contactable", "knockout_legacy_matches_agent_phone", "knockout_legacy_matches_agent_email", "knockout_legacy_duplicate", "knockout_legacy_duplicates_by_phone", "knockout_legacy_duplicates_by_email", "knockout_legacy_known_brokerage_domain", "knockout_legacy_was_interested", "knockout_legacy_homelight_email", "knockout_legacy_home_val_ineligible", "knockout_legacy_missing_address_parts", "knockout_legacy_lob_status", "knockout_legacy_listing_status", "knockout_legacy_violated_blind_intro_exception_id", "se_id", "se_ae_id", "se_client_id", "se_agent_id", "se_action", "se_result", "se_created_at", "se_event_count", "se_first_event_at", "se_last_event_at"],
  tune: ["transaction_id", "status", "payout_cents", "revenue_cents", "affiliate_sub1", "affiliate_sub2", "affiliate_sub3", "affiliate_sub4", "affiliate_sub5", "offer_id", "datetime"],
  uct: ["expected_revenue_vendor", "expected_revenue_alyson", "vendor_revenue", "alyson_revenue", "utm_source", "utm_medium", "utm_campaign", "utm_content", "vendor_id", "offer_id", "connector_id", "source_id"],
  phonexa: ["lead_id", "buyer_bid", "publisher_payout", "post_outcome", "publisher", "buyer", "campaign", "date_pst"],
};
export const OPS = ["equals", "not_equals", "greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "in"];
export const OP_LABELS: Record<string, string> = { equals: "equals", not_equals: "not equals", greater_than: "greater than", greater_than_or_equal: "greater than or equal", less_than: "less than", less_than_or_equal: "less than or equal", in: "in", exists: "exists", not_in: "not in", contains: "contains", not_contains: "does not contain", gte: "greater than or equal", lte: "less than or equal", between: "between", is_empty: "is empty", is_not_empty: "is not empty" };
export const KIND_LABELS: Record<string, string> = { revenue_share: "Revenue Share", roas: "ROAS Based", event: "Event Based" };
export const RULE_ID_RE = /^[a-z][a-z0-9_]*$/;
export const FORBIDDEN_MSG = "The rules API rejected this call. Browser access is not signed yet.";

export class RulesApiError extends Error {
  constructor(public status: number, public body: string) {
    let message = body || `Request failed (${status})`;
    try {
      const parsed = JSON.parse(body) as { message?: string; error?: string };
      if (parsed?.message) message = String(parsed.message);
      else if (parsed?.error) message = String(parsed.error);
    } catch { /* use raw body */ }
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${RULES_API_BASE}${path}`, { ...init, headers: await rulesAuthHeaders(init?.headers) });
  const text = await res.text();
  if (!res.ok) throw new RulesApiError(res.status, text);
  return (text ? JSON.parse(text) : {}) as T;
}

const parseMaybe = <T,>(v: unknown, fb: T): T => { if (typeof v === "string") { try { return JSON.parse(v) as T; } catch { return fb; } } return (v ?? fb) as T; };

export async function listRules(): Promise<ApiRule[]> {
  const r = await call<{ rules?: ApiRule[] }>("/rules");
  return (r.rules ?? []).map((x) => ({ ...x, rule_version: Number(x.rule_version), conditions: parseMaybe(x.conditions, []), calculation: parseMaybe(x.calculation, {} as RuleCalc) }));
}
export const createRule = (body: NewRule) => call<{ rule_id: string; rule_version: number; status: string }>("/rules", { method: "POST", body: JSON.stringify(body) });
export const deactivateRule = (rule_id: string, rule_version: number) => call<{ status: string }>("/rules/inactive", { method: "POST", body: JSON.stringify({ rule_id, rule_version }) });
export const deleteRule = (rule_id: string, rule_version: number) =>
  call<{ status: string; events_restored_from_source?: boolean }>("/rules/delete", { method: "POST", body: JSON.stringify({ rule_id, rule_version }) });

// The API may return numbers as strings and null deltas when nothing is stored yet.
export interface ReconcilePreviewRow { source_record_id: string; rule_id: string; rule_version: number | string; stored_amount: number | string | null; calculated_amount: number | string; delta: number | string | null }
export interface ReconcileSummary {
  matched?: number | string; not_stored?: number | string; unchanged?: number | string;
  increased?: number | string; decreased?: number | string;
  stored_total?: number | string; calculated_on_stored?: number | string;
  net_change?: number | string; new_amount?: number | string; type?: string;
}
export interface ReconcilePreviewResponse { month: string; source_id: string; shown?: number; rows: ReconcilePreviewRow[]; summary?: ReconcileSummary }
export const previewReconcile = (month: string, source_id: string, rule_id: string) => call<ReconcilePreviewResponse>("/reconcile/preview", { method: "POST", body: JSON.stringify({ month, source_id, rule_id }) });
export const listReconciliationLog = () => call<{ rows?: unknown[] }>("/reconcile/log");
export const postReconcileCheck = (body: { source_id: string; start: string; end: string; period_kind: "day" | "week" | "month" }) =>
  call<unknown>("/reconcile/check", { method: "POST", body: JSON.stringify(body) });
export const postReconcileLoadMissing = (body: { source_id: string; start: string; end: string; period_kind: "day" | "week" | "month"; lead_ids: string[] }) =>
  call<{ ok?: boolean }>("/reconcile/load-missing", { method: "POST", body: JSON.stringify(body) });

export const slugRuleId = (name: string) => {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return /^[a-z]/.test(s) ? s : `rule_${s}`;
};
export const valueLine = (c?: RuleCalc) => {
  if (!c) return "—";
  if (c.kind === "event_based") return `$${Number(c.amount).toFixed(2)} / event`;
  if (c.kind === "sms_per_count") return `$${c.amount} per ${Number(c.per_count).toLocaleString("en-US")} SMS`;
  if (c.kind === "event") return c.amount != null ? `$${Number(c.amount).toFixed(2)} / event` : "—";
  if (c.kind === "revenue_share" || c.kind === "roas") return c.percent != null ? `${c.percent}%` : "—";
  return "—";
};
export const calcLine = (r: Pick<ApiRule, "type" | "calculation">) => {
  const c = r.calculation as RuleCalc | undefined;
  const lhs = r.type === "COST" ? "Cost" : "Revenue";
  if (c?.kind === "event_based") return `${lhs} = $${c.amount ?? "?"} per event`;
  if (c?.kind === "sms_per_count") return `${lhs} = $${c.amount} per ${Number(c.per_count).toLocaleString("en-US")} SMS`;
  if (!c || (!c.field && c.kind !== "event")) return `${lhs} = —`;
  if (c.kind === "revenue_share") return `${lhs} = ${c.field} × ${c.percent ?? "?"} / 100`;
  if (c.kind === "roas") return `${lhs} = ${c.field} ÷ (${c.percent ?? "?"} / 100)`;
  if (c.kind === "event") return `${lhs} = $${c.amount ?? "?"} per event`;
  return c.kind === "cents" ? `${lhs} = ${c.field} ÷ 100` : `${lhs} = ${c.field}`;
};
export const condLine = (c: RuleCondition) => {
  if (c.op === "exists" || c.op === "is_empty" || c.op === "is_not_empty") return `${c.field} ${OP_LABELS[c.op]}`;
  if (c.op === "between" && Array.isArray(c.value)) return `${c.field} between ${c.value[0]} and ${c.value[1]}`;
  return `${c.field} ${OP_LABELS[c.op] ?? c.op} ${Array.isArray(c.value) ? c.value.join(", ") : String(c.value ?? "").trim()}`;
};
export const isActive = (s: string) => s?.toUpperCase() === "ACTIVE";
export const statusLabel = (s: string) => (isActive(s) ? "Active" : s?.toUpperCase() === "INACTIVE" ? "Inactive" : s || "—");
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
// 400 responses carry a JSON body with an error message; show that message, not the raw body.
export const saveErrMsg = (e: unknown) => {
  if (e instanceof RulesApiError && e.status === 400) {
    try { const b = JSON.parse(e.body); const m = b?.error ?? b?.message ?? (typeof b?.body === "string" ? JSON.parse(b.body)?.error : null); if (m) return String(m); } catch { /* fall through */ }
  }
  return errMsg(e);
};

export interface RuleColumn { name: string; type?: string }
export interface RuleColumnsResponse { source: string; table: string; columns: RuleColumn[]; operators: string[]; connectors?: { id: string; name: string }[] }
export const COLUMN_SOURCES = ["homelight", "uct", "phonexa", "tune", "sms"];
export async function listRuleColumns(source: string): Promise<RuleColumnsResponse> {
  const r = await call<Record<string, unknown>>(`/rules/columns?source=${encodeURIComponent(source)}`);
  const b = (typeof r.body === "string" ? JSON.parse(r.body) : r) as Partial<RuleColumnsResponse>;
  return { source: String(b.source ?? source), table: String(b.table ?? ""), columns: (b.columns ?? []).filter((c) => c && c.name), operators: b.operators ?? [], ...(b.connectors ? { connectors: b.connectors } : {}) };
}

// Distinct vendor_id / offer_id for HL (revenue_events) and UCT (uct_revenue).
export interface FilterOption { id: string; name?: string | null }
export interface RevenueEventFilterOptions { vendors: FilterOption[]; offers: FilterOption[] }
const toOpts = (xs: unknown): FilterOption[] => (Array.isArray(xs) ? xs : []).map((x) => {
  if (x && typeof x === "object") { const o = x as Record<string, unknown>; return { id: String(o.id ?? o.vendor_id ?? o.offer_id ?? "").trim(), name: (o.name ?? o.vendor_name ?? o.offer_name ?? null) as string | null }; }
  return { id: String(x ?? "").trim() };
}).filter((o) => o.id);
export async function listRevenueEventFilterOptions(source: string): Promise<RevenueEventFilterOptions> {
  const r = await call<Record<string, unknown>>(`/rules/filter-options?source=${encodeURIComponent(source)}`);
  const b = (typeof r.body === "string" ? JSON.parse(r.body) : r) as Record<string, unknown>;
  return { vendors: toOpts(b.vendors ?? b.vendor_ids), offers: toOpts(b.offers ?? b.offer_ids) };
}
export const optionLabel = (o: FilterOption) => (o.name && o.name !== o.id ? `${o.name} (${o.id})` : o.id);
