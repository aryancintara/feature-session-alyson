// Identity UI data layer — currently served from STATIC/DUMMY data (backend unplugged).
// The query factories below keep the exact API response shapes, so re-attaching the
// live endpoints later is a one-file swap.

export class IdentityApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Simulated latency so skeleton loaders remain visible/testable. */
export const mockDelay = <T,>(value: T, ms = 420): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));


// ------------------------------------------------------------------ helpers

export const fmt = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("en-US") : "—";

export const UI_SOURCES = [
  "Segment Events",
  "Tune Events",
  "LeadPlus Events",
  "UCT Events",
  "Session Summary",
] as const;

export const METHOD_LABELS: Record<string, string> = {
  email_match: "Email Matching",
  phone_match: "Phone Matching",
  name_address_match: "Name + Address Matching",
  new_email: "New Person (Email)",
  new_phone_name: "New Person (Phone + Name)",
  new_name: "New Person (Name)",
  new_address: "New Person (Address)",
  preassigned: "Preassigned (Session Summary)",
  no_identity: "No Identity",
  unknown: "Unknown",
};

export const METHOD_FAMILY: Record<string, string> = {
  email_match: "Email",
  phone_match: "Phone",
  name_address_match: "Address",
  new_email: "Email",
  new_phone_name: "Phone",
  new_name: "Name",
  new_address: "Address",
  preassigned: "Other",
  no_identity: "Other",
  unknown: "Other",
};

export const METHOD_KIND: Record<string, "match" | "mint" | "other"> = {
  email_match: "match",
  phone_match: "match",
  name_address_match: "match",
  new_email: "mint",
  new_phone_name: "mint",
  new_name: "mint",
  new_address: "mint",
  preassigned: "other",
  no_identity: "other",
  unknown: "other",
};

export const methodLabel = (m: string) => METHOD_LABELS[m] ?? m;
export const methodFamily = (m: string) => METHOD_FAMILY[m] ?? "Other";
export const methodKind = (m: string) => METHOD_KIND[m] ?? "other";

// ------------------------------------------------------------------- types

export type OverviewResponse = {
  processDate: string | null;
  kpis: { label: string; value: number; deliveryRate?: number }[];
  identityTypes?: { type: string; count: number; share: number }[];
  sources: {
    source: string;
    totalRecords: number;
    shouldHaveIdentity: number;
    identityDelivered: number;
    noIdentity: number;
  }[];
  message?: string;
};

export type MethodsResponse = {
  processDate: string | null;
  total?: number;
  methods: { method: string; records: number; percentage: number }[];
};

export type IdentityErrorStatus = "open" | "investigating" | "resolved";

export type ErrorsResponse = {
  processDate: string | null;
  totals?: { records: number; open: number; types: number };
  errors: { errorType: string; example: string; count: number; status: IdentityErrorStatus }[];
};

export type ValidationResponse = {
  processDate: string | null;
  validations: { validation: string; status: "pass" | "warn" | "fail"; count: number; detail: string }[];
};

export type AccuracyResponse = {
  processDate: string | null;
  daily: {
    sotQualifiedLeads: number;
    sotJoined: number;
    compared: number;
    unifiedMatches: number;
    accuracyPct: number;
    email: { compared: number; matches: number };
    name: { compared: number; matches: number };
    address: { compared: number; matches: number };
  } | null;
  bySource: { source: string; compared: number; matches: number; accuracy: number }[];
  byMethod: { method: string; methodFamily: string; compared: number; matches: number; accuracy: number }[];
  waterfall: { step: number; method: string; records: number; matches: number; accuracy: number }[];
};

export type ExplorerResult = {
  identityId: string;
  type: string;
  person: string;
  email: string;
  phone: string;
  createdBy: string;
  confidence: number;
  source: string;
  eventCount: number;
  firstEventDate: string;
  lastEventDate: string;
};

export type ExplorerSearchResponse = {
  by: string;
  q: string;
  limit?: number;
  results: ExplorerResult[];
  message?: string;
};

export type PersonResponse = {
  found: boolean;
  personId: string;
  profile?: ExplorerResult;
  details?: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    sourceCount: number;
    sessionCount: number;
    personCreatedAt: string;
    latestIdentityMethod: string;
  };
  recentEvents?: {
    eventId: string;
    entityType: string;
    entityRecordId: string;
    entityRecordDate: string;
    sessionId: string;
    assignmentLabel: string;
    identityMethod: string;
    identityMethodConfidence: string;
    email: string;
    phone: string;
    name: string;
    address: string;
    confidenceScore: number;
  }[];
};

export type AssignmentResponse = {
  personId: string;
  howCreated: {
    identityMethod: string;
    assignmentLabel: string;
    eventCount: number;
    sourceCount: number;
    sessionCount: number;
    firstSeen: string;
    lastSeen: string;
    avgConfidenceScore: number;
    maxMethodConfidence: string;
  }[];
  personMatches: {
    matchId: string;
    revcloudIdentityId: string;
    confidence: number;
    matchCriteria: string;
    matchFamily: string;
    createdAt: string;
  }[];
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
  latencyMs: { source: string; samples: number; avg: number; p50: number; p95: number; p99: number; max: number };
  recentServerErrors: {
    timestamp: string;
    status: number;
    durationMs: number;
    requestId: string;
    endpoint: string;
    errorMessage: string;
  }[];
};

export type RemediationEntry = {
  remediationId: string;
  action: string;
  status: string;
  errorType: string | null;
  example: string | null;
  revcloudPersonId: string | null;
  relatedPersonId: string | null;
  reason: string | null;
  actor: string | null;
  createdAt: string;
};

export type RemediationListResponse = { remediations: RemediationEntry[]; queryExecutionId?: string };

export type RemediationPayload = {
  action: string;
  status?: string;
  errorType?: string;
  example?: string;
  revcloudPersonId?: string;
  relatedPersonId?: string;
  entityType?: string;
  entityRecordId?: string;
  sessionId?: string;
  reason?: string;
  actor?: string;
  metadata?: Record<string, unknown>;
};

export const REMEDIATION_ACTIONS = ["merge", "split", "flag", "unflag", "status_change", "note"] as const;
export const REMEDIATION_STATUSES = ["open", "investigating", "resolved", "cancelled"] as const;

// ------------------------------------------- query options (static data now)

import {
  mockAccuracy,
  mockApiHealth,
  mockAssignment,
  mockCreateRemediation,
  mockErrors,
  mockExplorerSearch,
  mockMethods,
  mockOverview,
  mockPerson,
  mockRemediationList,
  mockValidation,
} from "./identityMockData";

export const overviewQuery = (processDate?: string) => ({
  queryKey: ["identity", "overview", processDate ?? "latest"],
  queryFn: () => mockDelay(mockOverview(processDate)),
});

export const methodsQuery = (processDate?: string) => ({
  queryKey: ["identity", "methods", processDate ?? "latest"],
  queryFn: () => mockDelay(mockMethods(processDate)),
});

export const errorsQuery = (processDate?: string, status: IdentityErrorStatus | "all" = "all") => ({
  queryKey: ["identity", "errors", processDate ?? "latest", status],
  queryFn: () => mockDelay(mockErrors(processDate, status)),
});

export const validationQuery = (processDate?: string) => ({
  queryKey: ["identity", "validation", processDate ?? "latest"],
  queryFn: () => mockDelay(mockValidation(processDate)),
});

export const accuracyQuery = (processDate?: string) => ({
  queryKey: ["identity", "accuracy", processDate ?? "latest"],
  queryFn: () => mockDelay(mockAccuracy(processDate)),
});

export const explorerSearchQuery = (by: string, q: string, limit = 25) => ({
  queryKey: ["identity", "explorer", by, q, limit],
  queryFn: () => mockDelay(mockExplorerSearch(by, q, limit)),
  enabled: q.trim().length > 0,
  retry: false,
});

export const personQuery = (id: string | null) => ({
  queryKey: ["identity", "person", id],
  queryFn: () => mockDelay(mockPerson(id!)),
  enabled: !!id,
  retry: false,
});

export const assignmentQuery = (id: string | null) => ({
  queryKey: ["identity", "assignment", id],
  queryFn: () => mockDelay(mockAssignment(id!)),
  enabled: !!id,
  retry: false,
});

export const apiHealthQuery = (hours: number) => ({
  queryKey: ["identity", "api-health", hours],
  queryFn: () => mockDelay(mockApiHealth(hours)),
});

export const remediationListQuery = (limit = 50) => ({
  queryKey: ["identity", "remediation", limit],
  queryFn: () => mockDelay(mockRemediationList(limit)),
});

export const createRemediation = (payload: RemediationPayload) => mockDelay(mockCreateRemediation(payload), 300);

