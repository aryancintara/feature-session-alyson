// ---------------------------------------------------------------------------
// API Health — STATIC SAMPLE DATA ONLY. No backend, no APIs, no database.
//
// There is exactly ONE Identity Resolution API. It accepts any available
// combination of search inputs (name, email, phone, address, ip+useragent)
// and returns matching identity records in decreasing order of confidence.
// Different sources call this same API; the API internally picks the best
// method based on the inputs provided.
// ---------------------------------------------------------------------------

export type DateRangeKey = "today" | "yesterday" | "7d" | "30d" | "custom";

export const DATE_RANGES: { key: DateRangeKey; label: string; days: number }[] = [
  { key: "today", label: "Today", days: 1 },
  { key: "yesterday", label: "Yesterday", days: 1 },
  { key: "7d", label: "Last 7 Days", days: 7 },
  { key: "30d", label: "Last 30 Days", days: 30 },
  { key: "custom", label: "Custom Range", days: 14 },
];

function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const r2 = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

export type ApiHealthStatus = "Healthy" | "Warning" | "Degraded";

export interface IdentityApi {
  id: string;
  name: string;
  description: string;
  status: ApiHealthStatus;
  /** per-day baseline calls */
  baseCalls: number;
  successRate: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
  /** per-day baseline cost in USD */
  baseCost: number;
  lastUpdated: string;
  impact: string[];
}

export const IDENTITY_API: IdentityApi = {
  id: "identity_resolution_api",
  name: "Identity Resolution API",
  description:
    "Single API that searches by any available combination of name, email, phone, address and IP + user agent, returning matching identity records ordered by confidence.",
  status: "Healthy",
  baseCalls: 355_000,
  successRate: 98.5,
  avgLatency: 380,
  minLatency: 55,
  maxLatency: 3_400,
  p95Latency: 820,
  baseCost: 173,
  lastUpdated: "Today",
  impact: [
    "All identity assignment stops across every source",
    "Session Summary rows cannot resolve to a person",
    "Downstream audiences, attribution and reactivation go stale",
  ],
};

/** Kept for backward compatibility with consumers that expect an array. */
export const IDENTITY_APIS: IdentityApi[] = [IDENTITY_API];

export interface ApiRangeMetrics {
  api: IdentityApi;
  calls: number;
  successRate: number;
  errorRate: number;
  errors: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
  cost: number;
  costPerCall: number;
  costPerIdentity: number;
  successfulIdentities: number;
  status: ApiHealthStatus;
}

function rangeDays(key: DateRangeKey) {
  return DATE_RANGES.find((d) => d.key === key)?.days ?? 1;
}

function drift(api: IdentityApi, key: DateRangeKey) {
  const rand = seeded(api.id.length * 97 + rangeDays(key) * 13 + (key === "yesterday" ? 7 : 0));
  return 0.92 + rand() * 0.16;
}

export function apiMetrics(api: IdentityApi, key: DateRangeKey): ApiRangeMetrics {
  const days = rangeDays(key);
  const d = drift(api, key);
  const calls = Math.round(api.baseCalls * days * d);
  const successRate = r2(Math.min(99.9, api.successRate * (0.995 + (d - 0.92) * 0.06)), 2);
  const errorRate = r2(100 - successRate, 2);
  const errors = Math.round((calls * errorRate) / 100);
  const successfulIdentities = calls - errors;
  const cost = Math.round(api.baseCost * days * d);
  return {
    api,
    calls,
    successRate,
    errorRate,
    errors,
    avgLatency: Math.round(api.avgLatency * (0.95 + (d - 0.92) * 0.5)),
    minLatency: api.minLatency,
    maxLatency: api.maxLatency,
    p95Latency: api.p95Latency,
    cost,
    costPerCall: r2(cost / Math.max(1, calls), 5),
    costPerIdentity: r2(cost / Math.max(1, successfulIdentities), 5),
    successfulIdentities,
    status: api.status,
  };
}

export function allApiMetrics(key: DateRangeKey) {
  return [apiMetrics(IDENTITY_API, key)];
}

// ------------------------------------------------------------------ sources

export interface ApiSource {
  id: string;
  name: string;
  /** approximate share of total API calls */
  share: number;
  /** per-day baseline calls from this source */
  baseCalls: number;
  successRate: number;
  avgLatency: number;
}

export const API_SOURCES: ApiSource[] = [
  { id: "session_summary", name: "Session Summary", share: 100, baseCalls: 355_000, successRate: 98.5, avgLatency: 380 },

];

export interface ApiSourceMetrics extends ApiSource {
  calls: number;
  errors: number;
  errorRate: number;
  cost: number;
}

export function apiSourceMetrics(key: DateRangeKey): ApiSourceMetrics[] {
  const days = rangeDays(key);
  const totalCalls = apiMetrics(IDENTITY_API, key).calls;
  return API_SOURCES.map((s) => {
    const rand = seeded(s.id.length * 61 + rangeDays(key) * 17);
    const d = 0.94 + rand() * 0.12;
    const calls = Math.round(s.baseCalls * days * d);
    const errorRate = r2(100 - s.successRate, 2);
    const errors = Math.round((calls * errorRate) / 100);
    const cost = Math.round((calls / Math.max(1, totalCalls)) * apiMetrics(IDENTITY_API, key).cost * (0.9 + rand() * 0.2));
    return { ...s, calls, errors, errorRate, cost };
  });
}

// ------------------------------------------------------------------ methods

export interface ApiMethod {
  id: string;
  name: string;
  inputs: string[];
  /** position in the cascade — the API tries step 1 first, then falls down the list */
  step: number;
  /** which endpoint (or table) serves this step */
  endpoint: string;
  /** why this step sits where it does */
  note: string;
  /** approximate share of sessions resolved AT this step (first hit wins) */
  share: number;
  /** per-day baseline calls using this method */
  baseCalls: number;
  successRate: number;
  avgLatency: number;
}

export const API_METHODS: ApiMethod[] = [
  { id: "email", name: "Email", inputs: ["email"], step: 1, endpoint: "/search/bulk", note: "Strongest signal — tried first whenever an email is present", share: 35, baseCalls: 124_000, successRate: 99.1, avgLatency: 180 },
  { id: "phone", name: "Phone", inputs: ["phone"], step: 2, endpoint: "/search/bulk", note: "Strong — used when email is missing or returns no person ID", share: 15, baseCalls: 53_000, successRate: 98.5, avgLatency: 220 },
  { id: "address", name: "Address", inputs: ["address"], step: 3, endpoint: "/search/bulk", note: "Medium — helpful with or without a name", share: 12, baseCalls: 43_000, successRate: 97.6, avgLatency: 380 },
  { id: "name", name: "Name", inputs: ["name"], step: 4, endpoint: "/search/bulk", note: "Weak alone — many people share a name, so it runs last on PII", share: 8, baseCalls: 28_000, successRate: 96.4, avgLatency: 420 },
  { id: "ip_ua", name: "IP + User Agent", inputs: ["ip", "user_agent"], step: 5, endpoint: "/search/ip-ua/bulk", note: "Separate endpoint — used when no PII is available", share: 18, baseCalls: 64_000, successRate: 95.0, avgLatency: 700 },
  { id: "anonymous_user", name: "anonymous_user table", inputs: ["ip", "user_agent"], step: 6, endpoint: "anonymous_user table (no API call)", note: "Last backup lookup — IP + user agent matched against stored anonymous users", share: 12, baseCalls: 43_000, successRate: 92.0, avgLatency: 90 },
];


export interface ApiMethodMetrics extends ApiMethod {
  calls: number;
  errors: number;
  errorRate: number;
  cost: number;
}

export function apiMethodMetrics(key: DateRangeKey): ApiMethodMetrics[] {
  const days = rangeDays(key);
  const totalCalls = apiMetrics(IDENTITY_API, key).calls;
  return API_METHODS.map((m) => {
    const rand = seeded(m.id.length * 73 + rangeDays(key) * 19);
    const d = 0.94 + rand() * 0.12;
    const calls = Math.round(m.baseCalls * days * d);
    const errorRate = r2(100 - m.successRate, 2);
    const errors = Math.round((calls * errorRate) / 100);
    const cost = Math.round((calls / Math.max(1, totalCalls)) * apiMetrics(IDENTITY_API, key).cost * (0.9 + rand() * 0.2));
    return { ...m, calls, errors, errorRate, cost };
  });
}

// ------------------------------------------------------------------ trends

export interface ApiTrendPoint {
  [k: string]: string | number;
  period: string;
  calls: number;
  latency: number;
  errors: number;
  cost: number;
}

function periodLabels(key: DateRangeKey): string[] {
  const days = rangeDays(key);
  if (key === "today" || key === "yesterday") {
    return Array.from({ length: 12 }, (_, i) => `${String(i * 2).padStart(2, "0")}:00`);
  }
  const end = new Date("2026-09-01T00:00:00Z");
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (days - 1 - i));
    return d.toISOString().slice(5, 10);
  });
}

export function apiTrend(key: DateRangeKey, apiId?: string): ApiTrendPoint[] {
  const labels = periodLabels(key);
  const api = apiId ? IDENTITY_APIS.find((a) => a.id === apiId) ?? IDENTITY_API : IDENTITY_API;
  const buckets = key === "today" || key === "yesterday" ? 12 : 1;
  return labels.map((period, i) => {
    const rand = seeded(i * 31 + api.id.length * 907 + rangeDays(key));
    const f = 0.82 + rand() * 0.36;
    const calls = Math.round((api.baseCalls / buckets) * f);
    const latency = Math.round(api.avgLatency * f);
    const errors = Math.round((calls * (100 - api.successRate)) / 100);
    const cost = r2((api.baseCost / buckets) * f, 2);
    return { period, calls, latency, errors, cost };
  });
}

// ------------------------------------------------------------------ errors

export const ERROR_TYPES = [
  "API Timeout",
  "500 Server Error",
  "Authentication failure",
  "Invalid response",
  "Empty response",
] as const;

export interface ApiErrorRow {
  [k: string]: string | number;
  apiId: string;
  apiName: string;
  errorType: string;
  count: number;
  percentage: number;
  lastOccurrence: string;
}

export function apiErrors(key: DateRangeKey, apiId?: string): ApiErrorRow[] {
  const rows: ApiErrorRow[] = [];
  const api = apiId ? IDENTITY_APIS.find((a) => a.id === apiId) ?? IDENTITY_API : IDENTITY_API;
  const m = apiMetrics(api, key);
  const weights = ERROR_TYPES.map((_, ei) => 0.1 + seeded(api.id.length * 53 + ei * 17 + rangeDays(key))());
  const total = weights.reduce((x, y) => x + y, 0);
  ERROR_TYPES.forEach((t, ei) => {
    const count = Math.round((m.errors * weights[ei]) / total);
    if (count <= 0) return;
    const hh = String((ei * 3 + api.id.length * 2) % 24).padStart(2, "0");
    rows.push({
      apiId: api.id,
      apiName: api.name,
      errorType: t,
      count,
      percentage: r2((count / Math.max(1, m.errors)) * 100, 1),
      lastOccurrence: key === "today" || key === "yesterday" ? `${hh}:42` : `2026-08-${String(28 - ei).padStart(2, "0")} ${hh}:42`,
    });
  });
  return rows.sort((a, b) => b.count - a.count);
}

// ------------------------------------------------------------------ timeline

export interface HealthPoint {
  date: string;
  status: ApiHealthStatus;
  uptime: number;
}

export function healthTimeline(api: IdentityApi, key: DateRangeKey): HealthPoint[] {
  const labels = periodLabels(key === "today" || key === "yesterday" ? "7d" : key).slice(-14);
  return labels.map((date, i) => {
    const rand = seeded(api.id.length * 71 + i * 29)();
    const status: ApiHealthStatus =
      api.status === "Warning" ? (rand > 0.55 ? "Warning" : rand > 0.12 ? "Healthy" : "Degraded") : rand > 0.9 ? "Warning" : "Healthy";
    return { date, status, uptime: r2(status === "Healthy" ? 99.6 + rand * 0.39 : status === "Warning" ? 98 + rand : 94 + rand * 3, 2) };
  });
}
