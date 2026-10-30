import { cachedReportingGet, ensurePipelineMeta } from "./identityReportingCache";

// Live Identity UI API client (v0.4.x).
// Contract: IDENTITY_UI_API_INTEGRATION.md. No auth, CORS open, JSON only.
// Rules: match rate != accuracy; cost fields are always null and must be hidden;
// Revenue Leads Plus is source of truth only.

export const IDENTITY_API_BASE_URL: string =
  (import.meta.env.VITE_IDENTITY_API_BASE_URL as string | undefined) ??
  "https://2t1whzwtjg.execute-api.us-west-2.amazonaws.com";

export const REPORTING_TIMEOUT_MS = 60_000;
export const HEAVY_TIMEOUT_MS = 120_000;

export class IdentityApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "IdentityApiError";
  }
}

type Params = Record<string, string | number | undefined | null>;

export function identityUrl(path: string, params: Params = {}) {
  const url = new URL(path.replace(/^\//, ""), `${IDENTITY_API_BASE_URL.replace(/\/$/, "")}/`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && `${v}` !== "") url.searchParams.set(k, `${v}`);
  });
  return url.toString();
}

export async function apiGet<T>(path: string, params: Params = {}, timeoutMs = REPORTING_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(identityUrl(path, params), {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!res.ok) {
      const msg =
        (body as { error?: string; message?: string } | null)?.error ??
        (body as { message?: string } | null)?.message ??
        `Request failed (${res.status})`;
      throw new IdentityApiError(msg, res.status);
    }
    return body as T;
  } catch (e) {
    if (e instanceof IdentityApiError) throw e;
    if ((e as Error)?.name === "AbortError") {
      throw new IdentityApiError("The request timed out. Athena queries can take up to 2 minutes.", 408);
    }
    throw new IdentityApiError((e as Error)?.message ?? "Network error", 0);
  } finally {
    clearTimeout(timer);
  }
}

/** Opens a server-side CSV export in a new tab. */
export function openCsv(path: string, params: Params = {}) {
  if (typeof window === "undefined") return;
  window.open(identityUrl(path, { ...params, format: "csv" }), "_blank", "noopener");
}

// ------------------------------------------------------------------ types

export type Grain = "daily" | "weekly" | "monthly";

export type PipelineStatus = {
  asOf: string;
  expectedProcessDate: string | null;
  status: "healthy" | "lagging" | "stale" | "unknown";
  identityGraph?: { lastProcessDate: string | null; lagDaysVsExpected: number; job: string };
  accuracy?: { lastProcessDate: string | null; lagDaysVsExpected: number; job: string };
  decisions?: { lastProcessDate: string | null; table: string };
  message?: string;
};

export type OverviewResponse = {
  processDate: string | null;
  kpis: { label: string; value: number; deliveryRate?: number }[];
  resolutionRate: number | null;
  failureRate: number | null;
  accuracyPct: number | null;
  costPerIdentified: number | null;
  baseline30d?: {
    from: string;
    to: string;
    days: number;
    resolutionRate: number | null;
    failureRate: number | null;
    accuracyPct: number | null;
    costPerIdentified: number | null;
  } | null;
  deltasVsBaseline30d?: { resolutionRate: number; failureRate: number; accuracyPct: number } | null;
  identityTypes?: { type: string; count: number; share: number }[];
  sources: {
    source: string;
    totalRecords: number;
    shouldHaveIdentity: number;
    identityDelivered: number;
    noIdentity: number;
  }[];
};

export type OverviewSeriesResponse = {
  grain: Grain;
  from: string;
  to: string;
  points: {
    period: string;
    resolutionRate: number | null;
    failureRate: number | null;
    accuracyPct: number | null;
    matchRate: number | null;
    shouldHaveIdentity?: number;
    identityDelivered?: number;
    noIdentity?: number;
  }[];
};

export type MethodsResponse = {
  processDate: string | null;
  total: number;
  resolvedTotal: number;
  matchRate?: number | null;
  methods: {
    method: string;
    methodFamily: string;
    records: number;
    avgConfidence: number | null;
    percentage: number;
  }[];
  families: { family: string; records: number; share: number; avgConfidence: number | null }[];
  cascade: {
    family: string;
    entering: number;
    resolved: number;
    passed: number;
    matches: number;
    matchRate: number;
    share: number;
    avgConfidence: number | null;
    avgLatencyMs: number | null;
    cost: number | null;
  }[];
};

export type MethodTrendsResponse = {
  grain: Grain;
  from: string;
  to: string;
  series: {
    period: string;
    total: number;
    methods: { method: string; methodFamily: string; records: number; avgConfidence: number | null; share: number }[];
  }[];
};

export type AccuracyResponse = {
  processDate: string | null;
  daily: {
    sotQualifiedLeads: number;
    sotJoined: number;
    compared: number;
    unifiedMatches: number;
    accuracyPct: number;
    matchRate: number;
    email: { compared: number; matches: number };
    name: { compared: number; matches: number };
    address: { compared: number; matches: number };
  } | null;
  bySource: { source: string; compared: number; matches: number; accuracy: number }[];
  byMethod: { method: string; methodFamily: string; compared: number; matches: number; accuracy: number }[];
  waterfall: { step: number; method: string; records: number; matches: number; accuracy: number }[];
};

export type ErrorSeverity = "critical" | "high" | "medium" | "low";

export type ErrorsResponse = {
  processDate: string | null;
  totals?: { records: number; open: number; types: number } | null;
  errors: {
    errorType: string;
    severity: string;
    example: string | null;
    examples?: string[];
    count: number;
    status: string;
  }[];
};

export type Decision = {
  processDate: string;
  decidedAt: string;
  sessionId: string;
  entityRecordId: string;
  anonymousUserId: string;
  personId: string;
  source: string;
  winningMethod: string;
  methodFamily: string;
  confidence: string;
  status: string;
  email: string;
  phone: string;
  name: string;
  address: string;
};

export type DecisionsResponse = {
  by: string;
  q: string;
  from: string | null;
  to: string | null;
  source: string | null;
  limit: number;
  offset: number;
  total: number;
  decisions: Decision[];
};

export type DecisionDetailResponse = {
  found: boolean;
  sessionId: string;
  processDate: string | null;
  personId: string;
  source: string;
  winningMethod: string;
  methodFamily: string;
  confidence: string;
  status: string;
  profile?: {
    email?: string;
    phone?: string;
    name?: string;
    address?: string;
    ipAddress?: string;
    userAgent?: string;
  } | null;
  history?: { processDate: string; winningMethod: string; decidedAt: string }[] | null;
  sotComparison?: Record<string, unknown> | null;
};

export type ApiHealthResponse = {
  windowHours: number;
  logGroup: string;
  api: string;
  endpoint: string;
  sampling: { twoXxSampleRate: number; note: string };
  counts: {
    byStatus: Record<string, number>;
    logged2xx: number;
    logged4xx: number;
    logged5xx: number;
    estimated2xxVolume: number;
    estimatedTotalVolume: number;
  };
  successRate: number;
  errorRate: number;
  cost: number | null;
  latencyMs: { source: string; samples: number; avg: number; p50: number; p95: number; p99: number; max: number };
  series: {
    bucket: string;
    estimated2xx: number;
    logged4xx: number;
    logged5xx: number;
    estimatedTotal: number;
    successRate: number;
    errorRate: number;
  }[];
  byMethodFamily?: { family: string; calls: number; avgLatencyMs: number; p95LatencyMs: number }[];
  errorBreakdown?: { status: number; count: number }[];
  recentServerErrors: {
    timestamp: string;
    status: number;
    durationMs: number;
    requestId: string;
    endpoint: string;
    errorType?: string;
    errorMessage: string;
  }[];
};

export type CompareResponse = {
  processDate: string | null;
  sourceA: string;
  sourceB: string;
  note?: string;
  summary: {
    overlapSampled: number;
    emailAgreement: number;
    nameAgreement: number;
    addressAgreement: number;
    bySourceAccuracy?: { source: string; compared: number; matches: number; accuracyPct: number } | null;
  };
  rows: {
    sotLeadId: string;
    graphSource: string;
    personId: string;
    sessionId: string;
    identityMethod: string;
    emailAgree: boolean;
    nameAgree: boolean;
    addressAgree: boolean;
  }[];
};

// -------------------------------------------------------- query factories

const key = (...parts: unknown[]) => ["identity-api", ...parts];

/** Reporting data changes once per day — served from the daily localStorage cache. */
const DAY_MS = 24 * 60 * 60 * 1000;

export const REPORTING_QUERY_OPTIONS = {
  staleTime: DAY_MS,
  gcTime: DAY_MS,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

const fetchPipeline = () => apiGet<PipelineStatus>("/v1/pipeline/status");

/** Cached GET for Athena-backed reporting endpoints. */
function reportingGet<T>(path: string, params: Params = {}, timeoutMs = REPORTING_TIMEOUT_MS) {
  return cachedReportingGet<T>(path, params as Record<string, unknown>, () => apiGet<T>(path, params, timeoutMs), fetchPipeline);
}

/**
 * Inclusive date range (max 7 days) shared by every Identity endpoint.
 * Empty from/to means "latest available day" for snapshot endpoints.
 */
export type DateRangeParams = { from?: string; to?: string };

/** Normalises a UI range into API query params (`from`/`to`, YYYY-MM-DD). */
export function rangeParams(range?: DateRangeParams): Params {
  const from = range?.from || undefined;
  const to = range?.to || undefined;
  if (from && to) return { from, to };
  if (from) return { from, to: from };
  if (to) return { from: to, to };
  return {};
}

const rangeKey = (range?: DateRangeParams) => `${range?.from || ""}~${range?.to || ""}` || "latest";

export const pipelineStatusQuery = () => ({
  queryKey: key("pipeline"),
  queryFn: async () => (await ensurePipelineMeta(fetchPipeline)).pipeline,
  ...REPORTING_QUERY_OPTIONS,
  refetchInterval: false as const,
});

export const overviewQuery = (range?: DateRangeParams) => ({
  queryKey: key("overview", rangeKey(range)),
  queryFn: () => reportingGet<OverviewResponse>("/v1/overview", rangeParams(range)),
  ...REPORTING_QUERY_OPTIONS,
});

export const overviewSeriesQuery = (grain: Grain, range?: DateRangeParams) => ({
  queryKey: key("overview-series", grain, rangeKey(range)),
  queryFn: () => reportingGet<OverviewSeriesResponse>("/v1/overview/series", { grain, ...rangeParams(range) }),
  ...REPORTING_QUERY_OPTIONS,
});

export const methodsQuery = (range?: DateRangeParams) => ({
  queryKey: key("methods", rangeKey(range)),
  queryFn: () => reportingGet<MethodsResponse>("/v1/methods", rangeParams(range)),
  ...REPORTING_QUERY_OPTIONS,
});

export const methodTrendsQuery = (grain: Grain, range?: DateRangeParams) => ({
  queryKey: key("method-trends", grain, rangeKey(range)),
  queryFn: () => reportingGet<MethodTrendsResponse>("/v1/methods/trends", { grain, ...rangeParams(range) }),
  ...REPORTING_QUERY_OPTIONS,
});

export const accuracyQuery = (range?: DateRangeParams) => ({
  queryKey: key("accuracy", rangeKey(range)),
  queryFn: () => reportingGet<AccuracyResponse>("/v1/accuracy", rangeParams(range)),
  ...REPORTING_QUERY_OPTIONS,
});

export const errorsQuery = (range?: DateRangeParams, status = "all") => ({
  queryKey: key("errors", rangeKey(range), status),
  queryFn: () => reportingGet<ErrorsResponse>("/v1/errors", { ...rangeParams(range), status }),
  ...REPORTING_QUERY_OPTIONS,
});

export const decisionsQuery = (args: {
  by: string;
  q?: string;
  range?: DateRangeParams;
  source?: string;
  limit: number;
  offset: number;
}) => ({
  queryKey: key("decisions", { ...args, range: rangeKey(args.range) }),
  queryFn: () =>
    reportingGet<DecisionsResponse>(
      "/v1/decisions",
      {
        by: args.by,
        q: args.q,
        ...rangeParams(args.range),
        source: args.source,
        limit: args.limit,
        offset: args.offset,
      },
      HEAVY_TIMEOUT_MS,
    ),
  ...REPORTING_QUERY_OPTIONS,
});

/** Detail lookup id may be a session id, anonymous user id or entity record id (API v0.5.1+). */
export const decisionDetailQuery = (decisionId: string | null) => ({
  queryKey: key("decision", decisionId),
  queryFn: () =>
    reportingGet<DecisionDetailResponse>(
      `/v1/decisions/${encodeURIComponent(decisionId!)}`,
      {},
      HEAVY_TIMEOUT_MS,
    ),
  enabled: Boolean(decisionId && decisionId.trim()),
  retry: false,
  ...REPORTING_QUERY_OPTIONS,
});

/** API health prefers from/to (UTC day bounds); falls back to an hours window (max 168). */
export const apiHealthQuery = (arg: number | DateRangeParams) => {
  const range = typeof arg === "number" ? undefined : arg;
  const params = range ? rangeParams(range) : {};
  const hours = typeof arg === "number" ? Math.min(arg, 168) : undefined;
  return {
    queryKey: key("api-health", hours ?? rangeKey(range)),
    // API health is live traffic data — never long-cached.
    queryFn: () =>
      apiGet<ApiHealthResponse>("/v1/api-health", Object.keys(params).length ? params : { hours: hours ?? 24 }),
    staleTime: 60_000,
  };
};

export const compareQuery = (sourceB: string, range?: DateRangeParams, limit = 200) => ({
  queryKey: key("compare", sourceB, rangeKey(range), limit),
  queryFn: () =>
    reportingGet<CompareResponse>(
      "/v1/compare",
      { source_b: sourceB, ...rangeParams(range), limit },
      HEAVY_TIMEOUT_MS,
    ),
  ...REPORTING_QUERY_OPTIONS,
});

// ------------------------------------------------------------------ format

export const num = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("en-US") : "—";

/** Value already expressed in percent points (e.g. 51.34 → "51.3%"). */
export const pctPoints = (n: number | null | undefined, d = 1) =>
  typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(d)}%` : "—";

/** Value expressed as a 0–1 ratio (e.g. 0.85 → "85.0%"). */
export const pctRatio = (n: number | null | undefined, d = 1) =>
  typeof n === "number" && Number.isFinite(n) ? `${(n * 100).toFixed(d)}%` : "—";

export const COMPARE_SOURCES = [
  "Session Summary",
  "Anonymous User",
  "Segment Events",
  "Tune Events",
  "UCT Events",
  "LeadPlus Events",
] as const;

export const UI_SOURCES = [
  "Segment Events",
  "Tune Events",
  "LeadPlus Events",
  "UCT Events",
  "Session Summary",
] as const;

export function severityTone(sev: string): "danger" | "warning" | "info" | "neutral" {
  const s = sev.toLowerCase();
  if (s === "critical") return "danger";
  if (s === "high") return "warning";
  if (s === "medium") return "info";
  return "neutral";
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
