// Static/dummy dataset backing the Identity Monitoring UI while the backend is unplugged.
// Shapes mirror the (future) Identity UI API contract exactly, so re-attaching APIs is a swap.

import type {
  AccuracyResponse,
  ApiHealthResponse,
  ErrorsResponse,
  ExplorerResult,
  ExplorerSearchResponse,
  IdentityErrorStatus,
  MethodsResponse,
  OverviewResponse,
  PersonResponse,
  AssignmentResponse,
  RemediationEntry,
  RemediationListResponse,
  RemediationPayload,
  ValidationResponse,
} from "./identityApi";

export const DEFAULT_PROCESS_DATE = "2026-09-01";
const d = (processDate?: string) => processDate || DEFAULT_PROCESS_DATE;

/** Deterministic per-date jitter so switching process dates visibly changes numbers. */
function seed(processDate: string) {
  let h = 0;
  for (let i = 0; i < processDate.length; i++) h = (h * 31 + processDate.charCodeAt(i)) % 9973;
  return 0.9 + (h % 200) / 1000; // 0.90 – 1.10
}
const scale = (n: number, s: number) => Math.round(n * s);

export const MOCK_SOURCES = [
  { source: "Segment Events", totalRecords: 41280, shouldHaveIdentity: 39120, identityDelivered: 37840 },
  { source: "Tune Events", totalRecords: 18740, shouldHaveIdentity: 17110, identityDelivered: 15980 },
  { source: "LeadPlus Events", totalRecords: 12460, shouldHaveIdentity: 12460, identityDelivered: 12190 },
  { source: "UCT Events", totalRecords: 15920, shouldHaveIdentity: 14680, identityDelivered: 13720 },
  { source: "Session Summary", totalRecords: 9397, shouldHaveIdentity: 8210, identityDelivered: 7533 },
];

export function mockOverview(processDate?: string): OverviewResponse {
  const pd = d(processDate);
  const s = seed(pd);
  const sources = MOCK_SOURCES.map((r) => {
    const totalRecords = scale(r.totalRecords, s);
    const shouldHaveIdentity = scale(r.shouldHaveIdentity, s);
    const identityDelivered = scale(r.identityDelivered, s);
    return { ...r, totalRecords, shouldHaveIdentity, identityDelivered, noIdentity: shouldHaveIdentity - identityDelivered };
  });
  const total = sources.reduce((a, r) => a + r.totalRecords, 0);
  const should = sources.reduce((a, r) => a + r.shouldHaveIdentity, 0);
  const delivered = sources.reduce((a, r) => a + r.identityDelivered, 0);
  const none = should - delivered;
  return {
    processDate: pd,
    kpis: [
      { label: "Total Identity Events", value: total },
      { label: "Should Have Identity", value: should },
      { label: "Identity Delivered", value: delivered, deliveryRate: delivered / should },
      { label: "No Identity Returned", value: none },
    ],
    identityTypes: [{ type: "People", count: delivered, share: 100 }],
    sources,
  };
}

const METHOD_MIX: [string, number][] = [
  ["email_match", 38.4],
  ["phone_match", 16.1],
  ["name_address_match", 11.7],
  ["new_email", 9.8],
  ["new_phone_name", 5.4],
  ["new_name", 3.6],
  ["new_address", 2.9],
  ["preassigned", 6.3],
  ["no_identity", 5.8],
];

export function mockMethods(processDate?: string): MethodsResponse {
  const pd = d(processDate);
  const total = scale(97797, seed(pd));
  return {
    processDate: pd,
    total,
    methods: METHOD_MIX.map(([method, percentage]) => ({
      method,
      percentage,
      records: Math.round((total * percentage) / 100),
    })),
  };
}

const ERRORS: { errorType: string; example: string; count: number; status: IdentityErrorStatus }[] = [
  { errorType: "Multiple persons for same email", example: "rev_user_8841a2 / rev_user_39c710", count: 1284, status: "open" },
  { errorType: "Person with conflicting phone", example: "rev_user_2f90bb", count: 763, status: "open" },
  { errorType: "Identity delivered without PII", example: "rev_user_71ce04", count: 412, status: "investigating" },
  { errorType: "Duplicate person from same session", example: "sess_9f31c2 → 2 persons", count: 298, status: "investigating" },
  { errorType: "Name/address mismatch on merge", example: "rev_user_5b12de", count: 187, status: "open" },
  { errorType: "Orphaned identity (no events)", example: "rev_user_a0e7f5", count: 94, status: "resolved" },
  { errorType: "Stale preassigned identity", example: "rev_user_cc48d1", count: 61, status: "resolved" },
];

export function mockErrors(processDate?: string, status: IdentityErrorStatus | "all" = "all"): ErrorsResponse {
  const pd = d(processDate);
  const s = seed(pd);
  const all = ERRORS.map((e) => ({ ...e, count: scale(e.count, s) }));
  const errors = status === "all" ? all : all.filter((e) => e.status === status);
  return {
    processDate: pd,
    totals: {
      records: errors.reduce((a, e) => a + e.count, 0),
      open: all.filter((e) => e.status === "open").reduce((a, e) => a + e.count, 0),
      types: errors.length,
    },
    errors,
  };
}

export function mockValidation(processDate?: string): ValidationResponse {
  const pd = d(processDate);
  const s = seed(pd);
  return {
    processDate: pd,
    validations: [
      { validation: "Email format valid", status: "pass", count: scale(64210, s), detail: "RFC-5322 syntax check on delivered emails" },
      { validation: "Phone is 10-digit US", status: "pass", count: scale(38104, s), detail: "Normalized E.164 after strip" },
      { validation: "Name not null/placeholder", status: "warn", count: scale(2140, s), detail: "Placeholder names like 'test test' detected" },
      { validation: "Fake email domain check", status: "warn", count: scale(986, s), detail: "Disposable/known-fake domains" },
      { validation: "Address has zip + state", status: "fail", count: scale(1732, s), detail: "Missing zip on LeadPlus Events rows" },
      { validation: "Person id present on delivery", status: "pass", count: scale(87263, s), detail: "rev_user_* populated" },
    ],
  };
}

export function mockAccuracy(processDate?: string): AccuracyResponse {
  const pd = d(processDate);
  const s = seed(pd);
  const compared = scale(24810, s);
  const unifiedMatches = Math.round(compared * 0.912);
  return {
    processDate: pd,
    daily: {
      sotQualifiedLeads: scale(31240, s),
      sotJoined: scale(27430, s),
      compared,
      unifiedMatches,
      accuracyPct: 91.2,
      email: { compared: Math.round(compared * 0.86), matches: Math.round(compared * 0.86 * 0.964) },
      name: { compared: Math.round(compared * 0.78), matches: Math.round(compared * 0.78 * 0.902) },
      address: { compared: Math.round(compared * 0.51), matches: Math.round(compared * 0.51 * 0.834) },
    },
    bySource: MOCK_SOURCES.map((r, i) => {
      const c = scale(Math.round(r.shouldHaveIdentity * 0.32), s);
      const acc = [94.1, 89.7, 92.8, 88.4, 86.2][i]!;
      return { source: r.source, compared: c, matches: Math.round((c * acc) / 100), accuracy: acc };
    }),
    byMethod: [
      { method: "email_match", methodFamily: "Email", accuracy: 97.3 },
      { method: "phone_match", methodFamily: "Phone", accuracy: 93.1 },
      { method: "name_address_match", methodFamily: "Address", accuracy: 86.5 },
      { method: "new_email", methodFamily: "Email", accuracy: 90.2 },
      { method: "new_phone_name", methodFamily: "Phone", accuracy: 84.7 },
      { method: "preassigned", methodFamily: "Other", accuracy: 81.9 },
    ].map((m, i) => {
      const c = scale([9120, 4310, 2870, 2140, 1180, 1420][i]!, s);
      return { ...m, compared: c, matches: Math.round((c * m.accuracy) / 100) };
    }),
    waterfall: [
      { step: 1, method: "email_match", accuracy: 97.3 },
      { step: 2, method: "phone_match", accuracy: 93.1 },
      { step: 3, method: "name_address_match", accuracy: 86.5 },
      { step: 4, method: "new_email", accuracy: 90.2 },
      { step: 5, method: "new_phone_name", accuracy: 84.7 },
      { step: 6, method: "no_identity", accuracy: 0 },
    ].map((w, i) => {
      const records = scale([12480, 6210, 3980, 3120, 1760, 2040][i]!, s);
      return { ...w, records, matches: Math.round((records * w.accuracy) / 100) };
    }),
  };
}

// ------------------------------------------------------------------ explorer

const FIRST = ["Avery", "Jordan", "Riley", "Casey", "Morgan", "Taylor", "Quinn", "Devon", "Harper", "Rowan"];
const LAST = ["Nguyen", "Patel", "Alvarez", "Okafor", "Sullivan", "Kim", "Rossi", "Baker", "Duarte", "Hansen"];
const CITIES: [string, string, string][] = [
  ["Austin", "TX", "78701"],
  ["Denver", "CO", "80202"],
  ["Portland", "OR", "97205"],
  ["Tampa", "FL", "33602"],
  ["Columbus", "OH", "43215"],
];

export const MOCK_PEOPLE: ExplorerResult[] = Array.from({ length: 24 }).map((_, i) => {
  const first = FIRST[i % FIRST.length]!;
  const last = LAST[(i * 3) % LAST.length]!;
  const method = METHOD_MIX[i % (METHOD_MIX.length - 1)]![0];
  return {
    identityId: `rev_user_${(100000 + i * 7331).toString(16)}`,
    type: "People",
    person: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    phone: `(${480 + (i % 40)}) 555-${(1000 + i * 37).toString().slice(0, 4)}`,
    createdBy: method,
    confidence: Math.round((78 + ((i * 13) % 21)) * 10) / 10,
    source: MOCK_SOURCES[i % MOCK_SOURCES.length]!.source,
    eventCount: 3 + ((i * 11) % 47),
    firstEventDate: "2026-06-14",
    lastEventDate: DEFAULT_PROCESS_DATE,
  };
});

export function mockExplorerSearch(by: string, q: string, limit = 25): ExplorerSearchResponse {
  const needle = q.trim().toLowerCase();
  const results = MOCK_PEOPLE.filter((p) => {
    const hay =
      by === "email" ? p.email : by === "phone" ? p.phone : by === "person_id" ? p.identityId : `${p.person} ${p.email} ${p.phone} ${p.identityId}`;
    return hay.toLowerCase().includes(needle);
  }).slice(0, limit);
  return { by, q, limit, results, message: results.length ? undefined : "No matching identities in the sample dataset." };
}

export function mockPerson(id: string): PersonResponse {
  const profile = MOCK_PEOPLE.find((p) => p.identityId === id) ?? MOCK_PEOPLE[0]!;
  const idx = MOCK_PEOPLE.indexOf(profile);
  const [city, state, zip] = CITIES[idx % CITIES.length]!;
  return {
    found: true,
    personId: profile.identityId,
    profile,
    details: {
      address: `${100 + idx * 7} Maple Ave`,
      city,
      state,
      zipCode: zip,
      sourceCount: 1 + (idx % 4),
      sessionCount: 2 + (idx % 9),
      personCreatedAt: "2026-06-14T09:22:11Z",
      latestIdentityMethod: profile.createdBy,
    },
    recentEvents: Array.from({ length: 6 }).map((_, i) => ({
      eventId: `evt_${idx}_${i}`,
      entityType: MOCK_SOURCES[(idx + i) % MOCK_SOURCES.length]!.source,
      entityRecordId: `rec_${(10000 + idx * 91 + i).toString(16)}`,
      entityRecordDate: `2026-08-${String(20 + (i % 10)).padStart(2, "0")}`,
      sessionId: `sess_${(50000 + idx * 13 + i).toString(16)}`,
      assignmentLabel: i % 2 ? "Matched existing person" : "Preassigned from session",
      identityMethod: profile.createdBy,
      identityMethodConfidence: i % 3 === 0 ? "high" : i % 3 === 1 ? "medium" : "low",
      email: profile.email,
      phone: profile.phone,
      name: profile.person,
      address: `${100 + idx * 7} Maple Ave, ${city}, ${state}`,
      confidenceScore: Math.round((70 + ((idx + i * 5) % 30)) * 10) / 10,
    })),
  };
}

export function mockAssignment(id: string): AssignmentResponse {
  const profile = MOCK_PEOPLE.find((p) => p.identityId === id) ?? MOCK_PEOPLE[0]!;
  const idx = MOCK_PEOPLE.indexOf(profile);
  return {
    personId: profile.identityId,
    howCreated: [
      {
        identityMethod: profile.createdBy,
        assignmentLabel: "Initial assignment",
        eventCount: profile.eventCount,
        sourceCount: 1 + (idx % 4),
        sessionCount: 2 + (idx % 9),
        firstSeen: profile.firstEventDate,
        lastSeen: profile.lastEventDate,
        avgConfidenceScore: profile.confidence,
        maxMethodConfidence: "high",
      },
      {
        identityMethod: "phone_match",
        assignmentLabel: "Subsequent match",
        eventCount: Math.max(1, Math.round(profile.eventCount / 3)),
        sourceCount: 1,
        sessionCount: 1 + (idx % 3),
        firstSeen: "2026-07-02",
        lastSeen: profile.lastEventDate,
        avgConfidenceScore: Math.round((profile.confidence - 4.2) * 10) / 10,
        maxMethodConfidence: "medium",
      },
    ],
    personMatches: Array.from({ length: 4 }).map((_, i) => ({
      matchId: `match_${idx}_${i}`,
      revcloudIdentityId: MOCK_PEOPLE[(idx + i + 1) % MOCK_PEOPLE.length]!.identityId,
      confidence: Math.round((60 + ((idx * 7 + i * 9) % 38)) * 10) / 10,
      matchCriteria: ["email exact", "phone exact", "name + zip", "ip + user agent"][i]!,
      matchFamily: ["Email", "Phone", "Address", "Device"][i]!,
      createdAt: `2026-08-${String(10 + i * 3).padStart(2, "0")}T14:0${i}:00Z`,
    })),
  };
}

export function mockApiHealth(hours: number): ApiHealthResponse {
  const f = hours / 24;
  const logged2xx = Math.round(18420 * f) || 780;
  const logged4xx = Math.round(612 * f) || 24;
  const logged5xx = Math.round(37 * f) || 2;
  return {
    windowHours: hours,
    logGroup: "/aws/apigw/identity-resolution",
    api: "Identity Resolution API",
    endpoint: "POST /v1/resolve",
    sampling: { twoXxSampleRate: 0.1, note: "2xx responses are sampled at 10%; volumes are extrapolated." },
    counts: {
      byStatus: { "200": logged2xx, "400": Math.round(logged4xx * 0.7), "404": Math.round(logged4xx * 0.3), "500": logged5xx },
      logged2xx,
      logged4xx,
      logged5xx,
      estimated2xxVolume: logged2xx * 10,
      estimatedTotalVolume: logged2xx * 10 + logged4xx + logged5xx,
    },
    latencyMs: {
      source: "API Gateway access logs",
      samples: logged2xx,
      avg: 148,
      p50: 121,
      p95: 386,
      p99: 742,
      max: 1984,
    },
    recentServerErrors: Array.from({ length: 5 }).map((_, i) => ({
      timestamp: `2026-09-01T0${i + 1}:1${i}:22Z`,
      status: i === 3 ? 502 : 500,
      durationMs: 1200 + i * 310,
      requestId: `req_${(700000 + i * 4211).toString(16)}`,
      endpoint: "POST /v1/resolve",
      errorMessage: ["Athena query timeout", "Downstream throttled", "Null pointer in scorer", "Upstream gateway reset", "Query execution failed"][i]!,
    })),
  };
}

// --------------------------------------------------------------- remediation

let REMEDIATIONS: RemediationEntry[] = [
  {
    remediationId: "rem_0001",
    action: "merge",
    status: "resolved",
    errorType: "Multiple persons for same email",
    example: "rev_user_8841a2 / rev_user_39c710",
    revcloudPersonId: "rev_user_8841a2",
    relatedPersonId: "rev_user_39c710",
    reason: "Same email + same household address",
    actor: "data.ops@revcloud.io",
    createdAt: "2026-08-29T16:04:00Z",
  },
  {
    remediationId: "rem_0002",
    action: "flag",
    status: "investigating",
    errorType: "Person with conflicting phone",
    example: "rev_user_2f90bb",
    revcloudPersonId: "rev_user_2f90bb",
    relatedPersonId: null,
    reason: "Two active phones from different states",
    actor: "identity.qa@revcloud.io",
    createdAt: "2026-08-31T11:47:00Z",
  },
  {
    remediationId: "rem_0003",
    action: "note",
    status: "open",
    errorType: "Identity delivered without PII",
    example: "rev_user_71ce04",
    revcloudPersonId: "rev_user_71ce04",
    relatedPersonId: null,
    reason: "Awaiting source backfill from LeadPlus Events",
    actor: "data.ops@revcloud.io",
    createdAt: "2026-09-01T08:12:00Z",
  },
];

export function mockRemediationList(limit = 50): RemediationListResponse {
  return { remediations: REMEDIATIONS.slice(0, limit) };
}

export function mockCreateRemediation(payload: RemediationPayload) {
  const entry: RemediationEntry = {
    remediationId: `rem_${String(REMEDIATIONS.length + 1).padStart(4, "0")}`,
    action: payload.action,
    status: payload.status ?? "open",
    errorType: payload.errorType ?? null,
    example: payload.example ?? null,
    revcloudPersonId: payload.revcloudPersonId ?? null,
    relatedPersonId: payload.relatedPersonId ?? null,
    reason: payload.reason ?? null,
    actor: payload.actor ?? "demo.user@revcloud.io",
    createdAt: new Date().toISOString(),
  };
  REMEDIATIONS = [entry, ...REMEDIATIONS];
  return { remediationId: entry.remediationId, action: entry.action, status: entry.status, createdAt: entry.createdAt };
}
