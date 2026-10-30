// ---------------------------------------------------------------------------
// Identity Metrics / Source Comparison / Auditability — STATIC SAMPLE DATA ONLY.
// No backend, no APIs, no database. Engineering will attach real datasets later.
// All values are deterministic so the UI is stable across renders.
// ---------------------------------------------------------------------------

export type Grain = "daily" | "weekly" | "monthly" | "yoy";

export const PROCESS_DATE = "2026-09-01";

export const DATASETS = [
  {
    key: "session_summary",
    name: "Session Summary",
    role: "Cleaned visit / session information",
    rows: 1_284_930,
    grain: "1 row per session",
    owner: "Data Engineering",
  },
  {
    key: "revenue_leads_plus",
    name: "Revenue Leads Plus",
    role: "CRM lead — source of truth",
    rows: 412_558,
    grain: "1 row per lead",
    owner: "Revenue Ops",
  },
  {
    key: "anonymous_user",
    name: "Anonymous User",
    role: "Identity graph output",
    rows: 968_114,
    grain: "1 row per resolved identity",
    owner: "Identity Platform",
  },
] as const;

export const DATASET_RELATIONSHIPS = [
  { from: "Session Summary", to: "Anonymous User", label: "session_id → identity assignment", cardinality: "N : 1" },
  { from: "Anonymous User", to: "Revenue Leads Plus", label: "person_id ↔ lead_id validation", cardinality: "1 : 1" },
  { from: "Session Summary", to: "Revenue Leads Plus", label: "email / phone direct match", cardinality: "N : 1" },
];

// ------------------------------------------------------------------ helpers

const round = (n: number, d = 1) => Number(n.toFixed(d));
export const pct = (n: number, d = 1) => `${round(n, d)}%`;
export const money = (n: number, d = 2) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
export const num = (n: number) => n.toLocaleString("en-US");

// deterministic pseudo-random
function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

// ------------------------------------------------------------------ headline metrics

export type HeadlineMetric = {
  key: string;
  label: string;
  description: string;
  value: number;
  format: "percent" | "money" | "money4" | "number";
  previous: number;
  previousLabel: string;
  goodDirection: "up" | "down";
};

export const HEADLINE_METRICS: HeadlineMetric[] = [
  {
    key: "resolution_rate",
    label: "Identity Resolution Rate",
    description: "Percentage of sessions/events that received an identity.",
    value: 85.4,
    format: "percent",
    previous: 82.1,
    previousLabel: "prev. 30 days",
    goodDirection: "up",
  },
  {
    key: "failure_rate",
    label: "Identity Failure Rate",
    description: "Percentage of sessions/events without an identity.",
    value: 14.6,
    format: "percent",
    previous: 17.9,
    previousLabel: "prev. 30 days",
    goodDirection: "down",
  },
  {
    key: "accuracy",
    label: "Identity Accuracy",
    description: "Percentage of assigned identities that were correct.",
    value: 90.2,
    format: "percent",
    previous: 88.4,
    previousLabel: "prev. 30 days",
    goodDirection: "up",
  },
  {
    key: "graph_cost",
    label: "Total Identity Graph Cost",
    description: "Spend across identity graph vendors for the period.",
    value: 48_212,
    format: "money",
    previous: 51_430,
    previousLabel: "prev. 30 days",
    goodDirection: "down",
  },
  {
    key: "cost_per_id",
    label: "COST",
    description: "Graph cost divided by identified users.",
    value: 0.0442,
    format: "money4",
    previous: 0.0501,
    previousLabel: "prev. 30 days",
    goodDirection: "down",
  },
  {
    key: "cost_per_k",
    label: "Cost per 1,000 Identified",
    description: "Graph cost per thousand identified users.",
    value: 44.2,
    format: "money",
    previous: 50.1,
    previousLabel: "prev. 30 days",
    goodDirection: "down",
  },
];

export function formatMetric(m: Pick<HeadlineMetric, "format">, v: number) {
  if (m.format === "percent") return pct(v);
  if (m.format === "money") return money(v, v < 100 ? 2 : 0);
  if (m.format === "money4") return `$${v.toFixed(4)}`;
  return num(v);
}

// ------------------------------------------------------------------ time series

export type SeriesPoint = {
  period: string;
  resolutionRate: number;
  failureRate: number;
  accuracy: number;
  matchRate: number;
  costPerId: number;
  priorYear: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];

function build(count: number, label: (i: number) => string, base: number, drift: number, seed: number): SeriesPoint[] {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => {
    const noise = (r() - 0.5) * 2.4;
    const resolution = round(Math.min(97, base + drift * i + noise), 1);
    const accuracy = round(Math.min(98, resolution + 4.4 + (r() - 0.5) * 1.8), 1);
    return {
      period: label(i),
      resolutionRate: resolution,
      failureRate: round(100 - resolution, 1),
      accuracy,
      matchRate: round(Math.min(96, resolution + 2.6 + (r() - 0.5) * 1.5), 1),
      costPerId: round(0.062 - 0.0016 * i + (r() - 0.5) * 0.004, 4),
      priorYear: round(resolution - 9.5 - r() * 2.5, 1),
    };
  });
}

export const SERIES: Record<Grain, SeriesPoint[]> = {
  daily: build(30, (i) => `Aug ${i + 3}`, 81.4, 0.16, 11),
  weekly: build(16, (i) => `W${i + 20}`, 76.5, 0.6, 23),
  monthly: build(9, (i) => MONTHS[i], 70, 1.9, 37),
  yoy: build(9, (i) => MONTHS[i], 70, 1.9, 37),
};

export const GRAIN_LABELS: Record<Grain, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yoy: "Year over Year",
};

// ------------------------------------------------------------------ identity methods

export type MethodRow = {
  method: string;
  records: number;
  matches: number;
  accuracy: number;
  avgConfidence: number;
  costPerId: number;
  trend: number;
};

export const METHODS: MethodRow[] = [
  { method: "Phone", records: 5_000, matches: 4_500, accuracy: 90, avgConfidence: 88, costPerId: 0.021, trend: 0.6 },
  { method: "Email", records: 10_000, matches: 9_500, accuracy: 95, avgConfidence: 94, costPerId: 0.012, trend: 1.4 },
  { method: "Address", records: 3_500, matches: 2_800, accuracy: 80, avgConfidence: 78, costPerId: 0.028, trend: -0.3 },
  { method: "Name", records: 2_700, matches: 2_222, accuracy: 82, avgConfidence: 80, costPerId: 0.032, trend: -0.5 },
  { method: "IP + User Agent", records: 7_400, matches: 3_700, accuracy: 50, avgConfidence: 47, costPerId: 0.006, trend: -2.6 },
];

export const METHOD_WATERFALL = [...METHODS]
  .map((m, i) => ({
    step: i + 1,
    method: m.method,
    accuracy: m.accuracy,
    resolvedHere: m.matches,
    remaining: 0,
  }))
  .map((s, i, arr) => {
    const total = 24_000;
    const consumed = arr.slice(0, i + 1).reduce((a, x) => a + x.resolvedHere, 0);
    return { ...s, remaining: Math.max(0, total - consumed) };
  });

// Identity graph as one record per method (not one wide row).
export type GraphRecord = {
  userId: string;
  method: string;
  value: string;
  accuracy: number;
  source: string;
  observedAt: string;
};

export const GRAPH_RECORDS: GraphRecord[] = [
  { userId: "rev_user_123", method: "Email", value: "john@gmail.com", accuracy: 95, source: "Revenue Leads Plus", observedAt: "2026-08-28" },
  { userId: "rev_user_123", method: "Phone", value: "5555555555", accuracy: 90, source: "Session Summary", observedAt: "2026-08-28" },
  { userId: "rev_user_123", method: "Address", value: "123 Market St, Austin TX", accuracy: 80, source: "Session Summary", observedAt: "2026-08-29" },
  { userId: "rev_user_123", method: "IP + User Agent", value: "24.18.9.4 / Chrome 141", accuracy: 50, source: "Session Summary", observedAt: "2026-08-31" },
  { userId: "rev_user_884", method: "Email", value: "d.alvarez@northwind.io", accuracy: 96, source: "Revenue Leads Plus", observedAt: "2026-08-30" },
  { userId: "rev_user_884", method: "Name", value: "Dana Alvarez", accuracy: 82, source: "Anonymous User", observedAt: "2026-08-30" },
  { userId: "rev_user_884", method: "Address", value: "88 Pine St, Austin TX", accuracy: 79, source: "Session Summary", observedAt: "2026-09-01" },
  { userId: "rev_user_512", method: "Phone", value: "4155550134", accuracy: 91, source: "Revenue Leads Plus", observedAt: "2026-08-27" },
  { userId: "rev_user_512", method: "IP + User Agent", value: "72.44.19.230 / Safari 19", accuracy: 49, source: "Session Summary", observedAt: "2026-09-01" },
];

// ------------------------------------------------------------------ source comparison

export const COMPARISON_SOURCES = [
  "Revenue Leads Plus",
  "Session Summary",
  "Anonymous User",
] as const;
export type ComparisonSource = (typeof COMPARISON_SOURCES)[number];

// Revenue Leads Plus is the fixed reference source every other source is compared against.
export const BASELINE_SOURCE = "Revenue Leads Plus";

export type ComparisonRow = {
  sessionId: string;
  comparedAt: string;
  assignedPersonId: string;
  assignedIdentity: string;
  assignedSource: string;
  sourceAIdentity: string;
  sourceBIdentity: string;
  matchResult: "Matched" | "No Match";
  accuracyResult: "Correct" | "Incorrect" | "Unverified";
  identityMethod: string;
  confidence: number;
  inputsUsed: string[];
  decision: string;
  sourceARecord: Record<string, string>;
  sourceBRecord: Record<string, string>;
};


const FIRST = ["John", "Dana", "Priya", "Marcus", "Elena", "Tom", "Aisha", "Grant", "Nina", "Owen"];
const LAST = ["Smith", "Alvarez", "Raman", "Webb", "Sokolov", "Barrett", "Khan", "Iverson", "Duarte", "Chen"];
const METHOD_NAMES = ["Phone", "Email", "Address", "Name", "IP + User Agent"];

export function buildComparison(a: string, b: string) {
  const r = rng(a.length * 131 + b.length * 17 + 5);
  const rows: ComparisonRow[] = Array.from({ length: 40 }, (_, i) => {
    const f = FIRST[Math.floor(r() * FIRST.length)];
    const l = LAST[Math.floor(r() * LAST.length)];
    const name = `${f} ${l}`;
    const method = METHOD_NAMES[Math.floor(r() * METHOD_NAMES.length)];
    const matched = r() > 0.1;
    const correct = matched ? r() > 0.06 : false;
    const altName = `${FIRST[Math.floor(r() * FIRST.length)]} ${l}`;
    const conf = Math.round(matched ? 72 + r() * 27 : 30 + r() * 30);
    const email = `${f.toLowerCase()}.${l.toLowerCase()}@example.com`;
    const phone = `415555${String(1000 + Math.floor(r() * 8999))}`;
    const dayOffset = i % 5;
    const comparedAt = `2026-08-${String(28 + dayOffset).padStart(2, "0")}`;
    return {
      sessionId: `session_${100 + i}`,
      comparedAt,
      assignedPersonId: `rev_user_${400 + i}`,
      assignedIdentity: name,
      assignedSource: a,
      sourceAIdentity: name,


      sourceBIdentity: matched ? name : altName,
      matchResult: matched ? "Matched" : "No Match",
      accuracyResult: matched ? (correct ? "Correct" : "Incorrect") : "Unverified",
      identityMethod: method,
      confidence: conf,
      inputsUsed: method === "Email" ? [email] : method === "Phone" ? [phone] : [email, phone],
      decision: matched
        ? `${method} exact match on ${a} → ${b} at ${conf}% confidence`
        : `No ${method} overlap between ${a} and ${b}`,
      sourceARecord: { person: name, email, phone, source: a, record_id: `a_${5000 + i}` },
      sourceBRecord: {
        person: matched ? name : altName,
        email: matched ? email : `${altName.split(" ")[0].toLowerCase()}@example.com`,
        phone,
        source: b,
        record_id: `b_${9000 + i}`,
      },
    };
  });

  const compared = 10_000;
  const matches = Math.round(compared * (0.86 + r() * 0.08));
  const correct = Math.round(matches * (0.9 + r() * 0.07));
  return {
    rows,
    summary: {
      recordsCompared: compared,
      matches,
      matchRate: round((matches / compared) * 100, 1),
      correctMatches: correct,
      accuracy: round((correct / matches) * 100, 1),
    },
  };
}

// ------------------------------------------------------------------ audit explorer

export type AuditRecord = {
  sessionId: string;
  personId: string;
  email: string;
  phone: string;
  identityAssigned: string;
  identityMethod: string;
  confidence: number;
  source: string;
  history: { at: string; event: string; detail: string }[];
  methodsTried: { method: string; result: string; confidence: number }[];
  comparison?: {
    sourceA: string;
    sourceB: string;
    sourceAIdentity: string;
    sourceBIdentity: string;
    matchResult: "Matched" | "No Match";
    accuracyResult: "Correct" | "Incorrect" | "Unverified";
    decision: string;
  };
};

export const AUDIT_RECORDS: AuditRecord[] = [
  {
    sessionId: "session_123",
    personId: "rev_user_123",
    email: "john@gmail.com",
    phone: "5555555555",
    identityAssigned: "John Smith",
    identityMethod: "Email",
    confidence: 95,
    source: "Revenue Leads Plus",
    history: [
      { at: "2026-08-28 14:02", event: "Session ingested", detail: "Session Summary · session_123" },
      { at: "2026-08-28 14:02", event: "Waterfall started", detail: "Email → Phone → Address → Name → IP+UA" },
      { at: "2026-08-28 14:02", event: "Email match", detail: "john@gmail.com matched lead_44182 (95%)" },
      { at: "2026-08-28 14:03", event: "Identity assigned", detail: "rev_user_123 · John Smith" },
      { at: "2026-08-30 09:11", event: "Accuracy validated", detail: "Correct — CRM confirmation" },
    ],
    methodsTried: [
      { method: "Email", result: "Match", confidence: 95 },
      { method: "Phone", result: "Skipped (resolved)", confidence: 0 },
    ],
  },
  {
    sessionId: "session_884",
    personId: "rev_user_884",
    email: "d.alvarez@northwind.io",
    phone: "5125550188",
    identityAssigned: "Dana Alvarez",
    identityMethod: "Address",
    confidence: 82,
    source: "Anonymous User",
    history: [
      { at: "2026-08-30 08:41", event: "Session ingested", detail: "Session Summary · session_884" },
      { at: "2026-08-30 08:41", event: "Email match", detail: "No CRM lead for d.alvarez@northwind.io" },
      { at: "2026-08-30 08:41", event: "Address match", detail: "88 Pine St matched Dana Alvarez (82%)" },
      { at: "2026-08-30 08:42", event: "Identity assigned", detail: "rev_user_884 · Dana Alvarez" },
    ],
    methodsTried: [
      { method: "Email", result: "No match", confidence: 0 },
      { method: "Phone", result: "No match", confidence: 0 },
      { method: "Address", result: "Match", confidence: 82 },
    ],
  },
  {
    sessionId: "session_512",
    personId: "rev_user_512",
    email: "—",
    phone: "4155550134",
    identityAssigned: "Priya Raman",
    identityMethod: "Phone",
    confidence: 91,
    source: "Revenue Leads Plus",
    history: [
      { at: "2026-08-27 19:20", event: "Session ingested", detail: "Session Summary · session_512" },
      { at: "2026-08-27 19:20", event: "Phone match", detail: "4155550134 matched lead_10233 (91%)" },
      { at: "2026-08-27 19:21", event: "Identity assigned", detail: "rev_user_512 · Priya Raman" },
      { at: "2026-09-01 07:02", event: "Conflict flagged", detail: "IP+UA suggests rev_user_902" },
    ],
    methodsTried: [
      { method: "Email", result: "Not available", confidence: 0 },
      { method: "Phone", result: "Match", confidence: 91 },
      { method: "IP + User Agent", result: "Conflicting", confidence: 49 },
    ],
  },
  {
    sessionId: "session_777",
    personId: "—",
    email: "unknown@—",
    phone: "—",
    identityAssigned: "No identity",
    identityMethod: "None",
    confidence: 0,
    source: "Session Summary",
    history: [
      { at: "2026-09-01 11:55", event: "Session ingested", detail: "Session Summary · session_777" },
      { at: "2026-09-01 11:55", event: "Waterfall exhausted", detail: "No email, phone, or address present" },
      { at: "2026-09-01 11:55", event: "No identity returned", detail: "Counted in failure rate" },
    ],
    methodsTried: [
      { method: "Email", result: "Not available", confidence: 0 },
      { method: "Phone", result: "Not available", confidence: 0 },
      { method: "IP + User Agent", result: "Below threshold", confidence: 32 },
    ],
  },
];

// Every session shown in Source Comparison must also be auditable here.
function comparisonRowToAudit(row: ComparisonRow, sourceB: string, i: number): AuditRecord {
  const src = sourceB;
  const email = row.sourceARecord.email ?? "";
  const phone = row.sourceARecord.phone ?? "";
  const day = row.comparedAt;
  return {
    sessionId: row.sessionId,
    personId: row.assignedPersonId,
    email,
    phone,
    identityAssigned: row.assignedIdentity,
    identityMethod: row.identityMethod,
    confidence: row.confidence,
    source: src,
    history: [
      { at: `${day} 09:00`, event: "Session ingested", detail: `${src} · ${row.sessionId}` },
      { at: `${day} 09:00`, event: "Waterfall started", detail: METHOD_NAMES.join(" → ") },
      {
        at: `${day} 09:01`,
        event: `${row.identityMethod} evaluated`,
        detail: `${row.inputsUsed.join(", ")} · ${row.confidence}% confidence`,
      },
      {
        at: `${day} 09:01`,
        event: "Identity assigned",
        detail: `${row.assignedPersonId} · ${row.assignedIdentity}`,
      },
      {
        at: `${day} 09:02`,
        event: "Source comparison",
        detail: row.decision,
      },
    ],
    methodsTried: METHOD_NAMES.map((m) => ({
      method: m,
      result:
        m === row.identityMethod
          ? row.matchResult === "Matched"
            ? "Match"
            : "Conflicting"
          : "No match",
      confidence: m === row.identityMethod ? row.confidence : 0,
    })),
    comparison: {
      sourceA: BASELINE_SOURCE,
      sourceB,
      sourceAIdentity: row.sourceAIdentity,
      sourceBIdentity: row.sourceBIdentity,
      matchResult: row.matchResult,
      accuracyResult: row.accuracyResult,
      decision: row.decision,
    },
  };
}

/** Audit record for a session as it appears in a specific Source Comparison pair. */
export function comparisonAuditRecord(sessionId: string, sourceB: string): AuditRecord | null {
  const rows = buildComparison(BASELINE_SOURCE, sourceB).rows;
  const idx = rows.findIndex((r) => r.sessionId === sessionId);
  if (idx === -1) return null;
  return comparisonRowToAudit(rows[idx], sourceB, idx);
}

AUDIT_RECORDS.push(
  ...buildComparison(BASELINE_SOURCE, "Session Summary").rows.map((row, i) =>
    comparisonRowToAudit(row, "Session Summary", i),
  ),
);



// ------------------------------------------------------------------ errors

export type ErrorSourceRow = {
  source: string;
  personId: string;
  name: string;
  method: string;
  value: string;
  confidence: number;
  lastSeen: string;
  flag: "ok" | "conflict" | "missing" | "stale";
};

export type ErrorExample = {
  sessionId: string;
  personId: string;
  detail: string;
  detectedAt: string;
  /** Detailed, data-level explanation */
  sources: ErrorSourceRow[];
  expected: string;
  actual: string;
  rootCause: string;
  impact: string;
  suggestedFix: string;
  checks: { label: string; value: string; pass: boolean }[];
};

export type ErrorCategory = "assignment" | "wrong-identity" | "reporting";

export type ErrorGroup = {
  errorType: string;
  category: ErrorCategory;
  count: number;
  severity: "critical" | "high" | "medium" | "low";
  trend: number;
  description: string;
  examples: ErrorExample[];
};

export const ERROR_CATEGORY_LABEL: Record<ErrorCategory, string> = {
  assignment: "Assignment errors",
  "wrong-identity": "Wrong identity assigned",
  reporting: "Reporting & model issues",
};

export const ERROR_CATEGORY_BLURB: Record<ErrorCategory, string> = {
  assignment: "Why a session ends up with no person ID, an Unknown method, or a bad match. Blank ID = coverage gap.",
  "wrong-identity": "How the wrong revcloud_person_id gets assigned, and the damage it causes. Wrong ID = accuracy failure.",
  reporting: "Issues with how identity metrics are defined, trended and audited.",
};

/** Damage caused when the wrong revcloud_person_id is assigned. */
export const WRONG_IDENTITY_IMPACT: { area: string; impact: string }[] = [
  { area: "Person profile / history", impact: "Session events, leads and devices attached to the wrong person." },
  { area: "Marketing / CRM", impact: "Wrong email or phone used for follow-up, SMS and offers." },
  { area: "Journey & revenue", impact: "Funnel stages and expected revenue attributed to the wrong individual." },
  { area: "Accuracy vs SOT (Leads Plus)", impact: "Match rate and accuracy drop — headline accuracy numbers look broken." },
  { area: "Merges / remediation", impact: "Later merge or split gets harder; one person absorbs another's history." },
  { area: "Trust", impact: "Dashboard says identified, but the ID is incorrect — worse than blank." },
];

const ERR_FIRST = ["Grant", "Elena", "Marcus", "Priya", "Dana", "Owen", "Iris", "Theo"];
const ERR_LAST = ["Barrett", "Duarte", "Okafor", "Nair", "Whitfield", "Sato", "Lindqvist", "Mendes"];
const ERR_SOURCES = ["Revenue Leads Plus", "Session Summary", "Anonymous User"];
const ERR_METHODS = ["Email", "Phone", "Address", "Name", "IP + User Agent"];

function errName(seed: number) {
  return `${ERR_FIRST[seed % ERR_FIRST.length]} ${ERR_LAST[(seed >> 2) % ERR_LAST.length]}`;
}
function errValue(method: string, name: string, seed: number) {
  const [first, last] = name.toLowerCase().split(" ");
  switch (method) {
    case "Email":
      return `${first}.${last}@${["acme.io", "northline.co", "vertexlabs.com"][seed % 3]}`;
    case "Phone":
      return `+1 (415) ${200 + (seed % 700)}-${1000 + (seed % 8999)}`;
    case "Address":
      return `${100 + (seed % 800)} Market St, Austin TX`;
    case "Name":
      return name;
    case "IP + User Agent":
      return `10.${seed % 255}.${(seed * 3) % 255}.${(seed * 11) % 255} · Chrome/128 macOS`;
    default:
      return `${name} · ${100 + (seed % 800)} Market St`;
  }
}
function errDate(offset: number) {
  const d = new Date(Date.UTC(2026, 8, 1) - offset * 86_400_000);
  return d.toISOString().slice(0, 10);
}

type ErrKind = "conflict" | "multiple" | "invalid" | "orphan" | "stale";

function buildErrorExample(kind: ErrKind, i: number): ErrorExample {
  const seed = i * 13 + kind.length;
  const sessionId = `session_${300 + seed}`;
  const nameA = errName(seed);
  const nameB = errName(seed + 3);
  const method = ERR_METHODS[seed % ERR_METHODS.length];
  const altMethod = ERR_METHODS[(seed + 2) % ERR_METHODS.length];
  const personA = `rev_user_${1000 + seed}`;
  const personB = `rev_user_${2000 + seed}`;
  const detected = errDate(i % 5);

  const truth: ErrorSourceRow = {
    source: "Revenue Leads Plus",
    personId: personA,
    name: nameA,
    method,
    value: errValue(method, nameA, seed),
    confidence: 94 - (seed % 5),
    lastSeen: detected,
    flag: "ok",
  };

  if (kind === "conflict") {
    const other = ERR_SOURCES[1 + (seed % 3)];
    return {
      sessionId,
      personId: personA,
      detail: `${other} returned ${nameB} (${personB}) instead of ${nameA}`,
      detectedAt: detected,
      sources: [
        truth,
        {
          source: other,
          personId: personB,
          name: nameB,
          method: altMethod,
          value: errValue(altMethod, nameB, seed + 5),
          confidence: 71 - (seed % 9),
          lastSeen: errDate((i % 5) + 2),
          flag: "conflict",
        },
      ],
      expected: `All sources resolve session to ${personA} (${nameA})`,
      actual: `${other} resolved to ${personB} (${nameB}) using ${altMethod}`,
      rootCause: `${altMethod} matched a household/shared attribute, so ${other} attached the session to a different person than the source of truth.`,
      impact: "Session events split across two profiles — inflates identity count and dilutes audience membership.",
      suggestedFix: `Down-rank ${altMethod} below ${method} for this source and re-run resolution for the session.`,
      checks: [
        { label: "Person ID equal", value: `${personA} vs ${personB}`, pass: false },
        { label: "Matched value equal", value: `${method} vs ${altMethod}`, pass: false },
        { label: "Confidence ≥ 70%", value: `${71 - (seed % 9)}%`, pass: 71 - (seed % 9) >= 70 },
        { label: "Seen within 90 days", value: errDate((i % 5) + 2), pass: true },
      ],
    };
  }

  if (kind === "multiple") {
    return {
      sessionId,
      personId: `${personA} / ${personB}`,
      detail: `2 identities attached to one session (${method} + ${altMethod})`,
      detectedAt: detected,
      sources: [
        truth,
        {
          source: "Session Summary",
          personId: personB,
          name: nameB,
          method: altMethod,
          value: errValue(altMethod, nameB, seed + 2),
          confidence: 83 - (seed % 6),
          lastSeen: detected,
          flag: "conflict",
        },
      ],
      expected: "Exactly 1 identity per session id",
      actual: `2 identities: ${personA} and ${personB}`,
      rootCause: "A shared device or stale session key was re-used after a profile switch, so a second identity was appended instead of replacing the first.",
      impact: "Duplicate person rows and double-counted sessions in downstream metrics.",
      suggestedFix: "Apply last-write-wins on the session key and merge the two profiles if deterministic identifiers agree.",
      checks: [
        { label: "Identity count = 1", value: "2", pass: false },
        { label: "Deterministic IDs agree", value: "email differs", pass: false },
        { label: "Same device fingerprint", value: "yes", pass: true },
      ],
    };
  }

  if (kind === "invalid") {
    const conf = 38 + (seed % 20);
    return {
      sessionId,
      personId: personA,
      detail: `${altMethod} assignment accepted at ${conf}% confidence (threshold 70%)`,
      detectedAt: detected,
      sources: [
        {
          ...truth,
          method: altMethod,
          value: errValue(altMethod, nameA, seed + 1),
          confidence: conf,
          flag: "conflict",
        },
      ],
      expected: "Assignment confidence ≥ 70%",
      actual: `${conf}% via ${altMethod}`,
      rootCause: "No deterministic identifier was present on the session, so a weak probabilistic signal produced the assignment.",
      impact: "Likely wrong person attached — pollutes audiences and attribution.",
      suggestedFix: "Reject below threshold and hold the session as unresolved until an email or phone is observed.",
      checks: [
        { label: "Confidence ≥ 70%", value: `${conf}%`, pass: false },
        { label: "Deterministic identifier present", value: "none", pass: false },
        { label: "Value format valid", value: "yes", pass: true },
      ],
    };
  }

  if (kind === "orphan") {
    return {
      sessionId: "—",
      personId: personA,
      detail: `Identity present in Anonymous User output with no linked session`,
      detectedAt: detected,
      sources: [
        { ...truth, source: "Anonymous User", flag: "missing", value: "—", method: "—", confidence: 0 },
      ],
      expected: "Every identity row links to at least 1 session id",
      actual: "0 linked sessions",
      rootCause: "Session record was dropped during ingestion, leaving the identity row without its parent event.",
      impact: "Identity counts overstate reachable audience; profile has no behaviour to activate on.",
      suggestedFix: "Backfill the missing session partition for the process date and re-link, or expire the orphan row.",
      checks: [
        { label: "Linked sessions ≥ 1", value: "0", pass: false },
        { label: "Identity row valid", value: "yes", pass: true },
      ],
    };
  }

  const lastSeen = errDate(95 + (seed % 60));
  return {
    sessionId,
    personId: personA,
    detail: `Mapping last validated ${lastSeen} (>90 days)`,
    detectedAt: detected,
    sources: [{ ...truth, lastSeen, flag: "stale", confidence: 62 + (seed % 10) }],
    expected: "Mapping revalidated within 90 days",
    actual: `Last validated ${lastSeen}`,
    rootCause: "No new deterministic signal has been observed for this person, so the mapping was never refreshed.",
    impact: "The device or session may now belong to someone else — risk of misattribution grows over time.",
    suggestedFix: "Expire the mapping and require a fresh email/phone match before reuse.",
    checks: [
      { label: "Revalidated ≤ 90 days", value: lastSeen, pass: false },
      { label: "Confidence ≥ 70%", value: `${62 + (seed % 10)}%`, pass: false },
      { label: "Person still active", value: "yes", pass: true },
    ],
  };
}

/** Reporting/model issues raised in the identity review meeting. */
type IssueSpec = {
  errorType: string;
  category?: ErrorCategory;
  count: number;
  severity: ErrorGroup["severity"];
  trend: number;
  description: string;
  expected: string;
  actual: string;
  rootCause: string;
  impact: string;
  suggestedFix: string;
  checks: { label: string; value: string; pass: boolean }[];
  details: string[];
};

function issueGroup(spec: IssueSpec, seedBase: number): ErrorGroup {
  const examples: ErrorExample[] = spec.details.map((detail, i) => {
    const seed = seedBase + i * 7;
    const name = errName(seed);
    const method = ERR_METHODS[seed % ERR_METHODS.length];
    return {
      sessionId: `session_${400 + seed}`,
      personId: `rev_user_${3000 + seed}`,
      detail,
      detectedAt: errDate(i % 5),
      sources: [
        {
          source: "Revenue Leads Plus",
          personId: `rev_user_${3000 + seed}`,
          name,
          method,
          value: errValue(method, name, seed),
          confidence: 93 - (seed % 6),
          lastSeen: errDate(i % 5),
          flag: "ok",
        },
        {
          source: ERR_SOURCES[1 + (seed % 2)],
          personId: `rev_user_${4000 + seed}`,
          name: errName(seed + 4),
          method: ERR_METHODS[(seed + 3) % ERR_METHODS.length],
          value: errValue(ERR_METHODS[(seed + 3) % ERR_METHODS.length], errName(seed + 4), seed + 4),
          confidence: 68 - (seed % 8),
          lastSeen: errDate((i % 5) + 2),
          flag: "conflict",
        },
      ],
      expected: spec.expected,
      actual: spec.actual,
      rootCause: spec.rootCause,
      impact: spec.impact,
      suggestedFix: spec.suggestedFix,
      checks: spec.checks,
    };
  });
  return {
    errorType: spec.errorType,
    category: spec.category ?? "reporting",
    count: spec.count,
    severity: spec.severity,
    trend: spec.trend,
    description: spec.description,
    examples,
  };
}

export const ERROR_GROUPS: ErrorGroup[] = [
  issueGroup(
    {
      errorType: "Source of truth compared against itself",
      count: 1_120,
      severity: "critical",
      trend: 3.6,
      description: "Revenue Leads Plus compared with Revenue Leads Plus reports below 100% accuracy.",
      expected: "Revenue Leads Plus vs Revenue Leads Plus = 100% accuracy (A / A)",
      actual: "Reported accuracy 57% for the source of truth against itself",
      rootCause: "Join keys are normalised differently on each side, so identical records fail the equality check.",
      impact: "Every downstream accuracy number is understated and the source of truth looks unreliable.",
      suggestedFix: "Normalise keys before comparison and force self-comparison to resolve at 100%.",
      checks: [
        { label: "Self comparison = 100%", value: "57%", pass: false },
        { label: "Join key normalised", value: "no", pass: false },
        { label: "Same record count both sides", value: "yes", pass: true },
      ],
      details: [
        "Lead Plus vs Lead Plus accuracy reported as 57% instead of 100%",
        "Email casing difference caused a false mismatch on the source of truth",
        "Trailing whitespace in address key dropped 214 self-matches",
      ],
    },
    11,
  ),
  issueGroup(
    {
      errorType: "Match rate reported as accuracy",
      count: 964,
      severity: "critical",
      trend: 2.4,
      description: "Two different concepts are collapsed into a single accuracy number.",
      expected: "Match rate (did both sources find the same person?) and accuracy (was the identity correct?) reported separately",
      actual: "One combined number labelled 'accuracy' covering both measures",
      rootCause: "The comparison job stops at the match step and never scores correctness on the matched set.",
      impact: "Accuracy looks higher or lower than reality and cannot be acted on.",
      suggestedFix: "Report match rate and accuracy as two metrics on every source comparison.",
      checks: [
        { label: "Match rate present", value: "yes", pass: true },
        { label: "Accuracy scored on matched set", value: "no", pass: false },
        { label: "Both metrics shown in UI", value: "no", pass: false },
      ],
      details: [
        "90% match rate shown as 90% accuracy on the comparison summary",
        "Matched records never scored for correctness",
        "Unmatched records excluded from the denominator without being labelled",
      ],
    },
    23,
  ),
  issueGroup(
    {
      errorType: "Counts reported instead of metrics",
      count: 731,
      severity: "high",
      trend: 1.8,
      description: "Raw totals shown where a percentage is required.",
      expected: "Resolution rate, failure rate and accuracy expressed as percentages",
      actual: "Total identity events, identities assigned and unresolved shown as raw counts",
      rootCause: "Panels were built from event counters with no denominator attached.",
      impact: "10 identities and 1,000,000 identities read the same — the number carries no meaning.",
      suggestedFix: "Attach a denominator to every counter and surface the percentage first.",
      checks: [
        { label: "Denominator defined", value: "missing", pass: false },
        { label: "Percentage displayed", value: "no", pass: false },
        { label: "Raw count available on drill-down", value: "yes", pass: true },
      ],
      details: [
        "Total identity events shown without total sessions",
        "Unresolved identities count has no failure-rate percentage",
        "Identities assigned reported daily with no rate",
      ],
    },
    31,
  ),
  issueGroup(
    {
      errorType: "Metric missing a time dimension",
      count: 612,
      severity: "high",
      trend: 0.9,
      description: "Single point-in-time percentage with no daily, weekly, monthly or year-over-year trend.",
      expected: "Every headline metric charted over time with daily / weekly / monthly / YoY views",
      actual: "Identity resolution rate shown as a single 82% with no history",
      rootCause: "Only the latest process date is retained for these metrics.",
      impact: "No way to tell whether identity quality is improving or declining.",
      suggestedFix: "Persist daily snapshots and chart every headline metric over time.",
      checks: [
        { label: "Daily history retained", value: "1 day", pass: false },
        { label: "Weekly / monthly rollups", value: "missing", pass: false },
        { label: "Year-over-year comparison", value: "missing", pass: false },
      ],
      details: [
        "Identity resolution rate has no trend line",
        "Accuracy stored only for the latest process date",
        "No year-over-year comparison available for any method",
      ],
    },
    43,
  ),
  issueGroup(
    {
      errorType: "Metric not auditable to raw rows",
      count: 508,
      severity: "high",
      trend: -0.6,
      description: "A published metric cannot be traced back to the rows and formula behind it.",
      expected: "Click any metric to see inputs, formula, calculation and the underlying rows",
      actual: "Accuracy 63% shown with no drill-down and no exportable dataset",
      rootCause: "The metric is computed upstream and only the aggregate is stored.",
      impact: "Numbers cannot be verified or defended in review.",
      suggestedFix: "Store the row-level comparison set and expose View Data plus CSV export on every table.",
      checks: [
        { label: "Row-level drill-down", value: "missing", pass: false },
        { label: "Formula shown", value: "no", pass: false },
        { label: "CSV export available", value: "no", pass: false },
      ],
      details: [
        "Accuracy 63% has no supporting row list",
        "No export for the accuracy dataset",
        "Formula and denominator not published with the metric",
      ],
    },
    57,
  ),
  issueGroup(
    {
      errorType: "Identity methods flattened into one row",
      count: 447,
      severity: "medium",
      trend: 1.2,
      description: "Email, phone, address, name and IP + user agent stored as columns on a single user row.",
      expected: "One row per user per method: user id, method, value, accuracy",
      actual: "Single row per user with method values as columns and no per-method accuracy",
      rootCause: "The graph schema treats a person as one wide record rather than a set of method observations.",
      impact: "Per-method accuracy and contribution cannot be measured or ranked.",
      suggestedFix: "Reshape the identity graph output to one row per method observation.",
      checks: [
        { label: "One row per method", value: "no", pass: false },
        { label: "Per-method accuracy stored", value: "no", pass: false },
        { label: "Method value retained", value: "yes", pass: true },
      ],
      details: [
        "Email, phone, cookie and IP held as columns on one user row",
        "No accuracy attached to individual method values",
        "Method-level contribution cannot be derived from the current shape",
      ],
    },
    67,
  ),
  issueGroup(
    {
      errorType: "Waterfall not ranked by accuracy",
      count: 389,
      severity: "medium",
      trend: -1.4,
      description: "Cascade order does not follow measured method accuracy.",
      expected: "Most accurate method wins — order the cascade by measured accuracy",
      actual: "A lower-accuracy method resolved the session before a higher-accuracy method was tried",
      rootCause: "Cascade order is hard-coded rather than driven by the current accuracy ranking.",
      impact: "Avoidable misassignments on sessions where a stronger identifier was available.",
      suggestedFix: "Re-order the cascade from the accuracy table and refresh the ranking on each run.",
      checks: [
        { label: "Order matches accuracy ranking", value: "no", pass: false },
        { label: "Higher-accuracy method available", value: "yes", pass: true },
        { label: "Ranking refreshed daily", value: "no", pass: false },
      ],
      details: [
        "IP + user agent resolved a session where email was available",
        "Cascade order fixed in config, not derived from accuracy",
        "Method accuracy ranking not refreshed with new data",
      ],
    },
    79,
  ),
  issueGroup(
    {
      errorType: "Missing identity cost metric",
      count: 264,
      severity: "low",
      trend: 0.3,
      description: "No cost per thousand identified users reported against target.",
      expected: "Total identity cost and cost per 1,000 identified users tracked against target",
      actual: "Only total monthly spend is available, with no unit cost",
      rootCause: "Spend is not joined to identified-user volume for the same period.",
      impact: "Efficiency of the identity graph cannot be judged or compared over time.",
      suggestedFix: "Publish cost per 1,000 identified users alongside spend, charted over time.",
      checks: [
        { label: "Cost per 1,000 identified", value: "missing", pass: false },
        { label: "Target defined", value: "no", pass: false },
        { label: "Spend total available", value: "yes", pass: true },
      ],
      details: [
        "Monthly spend reported without identified-user volume",
        "No target unit cost to compare against",
        "Cost not charted over time",
      ],
    },
    89,
  ),
  issueGroup(
    {
      errorType: "No usable PII",
      category: "assignment",
      count: 4820,
      severity: "high",
      trend: 1.4,
      description: "No email, phone or name + address on the session, so nothing can be searched.",
      expected: "At least one usable identifier present on the session",
      actual: "no_identity returned, revcloud_person_id left blank",
      rootCause: "The session carried no form fill, no prepop and no enrichment, so the cascade had nothing to search on.",
      impact: "Coverage gap — session is never attributed to a person.",
      suggestedFix: "Capture identifiers earlier in the journey and fall back to the anonymous_user table only when a signal exists.",
      checks: [
        { label: "Any PII present", value: "none", pass: false },
        { label: "Person ID assigned", value: "blank", pass: false },
        { label: "Table fallback attempted", value: "yes", pass: true },
      ],
      details: [
        "Session had no email, phone or address",
        "Prepop fields empty on quiz start",
        "Enrichment returned no contact record",
      ],
    },
    101,
  ),
  issueGroup(
    {
      errorType: "Fake or junk PII",
      category: "assignment",
      count: 3140,
      severity: "high",
      trend: -0.8,
      description: "Fake email or fake name scrubbed by validation, leaving no good match.",
      expected: "Identifiers pass validation before entering the cascade",
      actual: "Value scrubbed as fake, cascade continued with no usable input",
      rootCause: "Test, placeholder or deliberately fake values were submitted in the form.",
      impact: "Coverage gap plus wasted API calls on values that can never match.",
      suggestedFix: "Block known fake patterns at capture and record the scrub reason on the session.",
      checks: [
        { label: "Email valid", value: "test@test.com", pass: false },
        { label: "Name plausible", value: "asdf asdf", pass: false },
        { label: "Value scrubbed", value: "yes", pass: true },
      ],
      details: [
        "test@test.com submitted on quiz",
        "Name field filled with keyboard mash",
        "Disposable domain rejected by validation",
      ],
    },
    113,
  ),
  issueGroup(
    {
      errorType: "Same email or phone maps to many people",
      category: "assignment",
      count: 2150,
      severity: "critical",
      trend: 2.8,
      description: "One identifier resolves to several people in the graph.",
      expected: "One deterministic identifier maps to exactly one person",
      actual: "One email returned multiple candidate people",
      rootCause: "Shared household or business identifiers were never disambiguated in the graph.",
      impact: "Graph conflict — the wrong person can be selected from the candidate list.",
      suggestedFix: "Flag multi-person identifiers and require a second signal before assigning.",
      checks: [
        { label: "Candidates = 1", value: "3", pass: false },
        { label: "Second signal used", value: "no", pass: false },
        { label: "Identifier valid", value: "yes", pass: true },
      ],
      details: [
        "One email returned three people",
        "Shared office phone mapped to five people",
        "Candidate list ordered only by confidence",
      ],
    },
    175,
  ),
  issueGroup(
    {
      errorType: "Person ID mismatch across systems",
      category: "assignment",
      count: 3460,
      severity: "critical",
      trend: 3.1,
      description: "The graph writes one person ID and summary enrichment writes another.",
      expected: "Graph and Session Summary write the same revcloud_person_id",
      actual: "Graph holds ID A while summary enrichment wrote ID B — around 29% agreement when both are filled",
      rootCause: "Two pipelines resolve independently and neither reconciles against the other.",
      impact: "Downstream consumers pick different people for the same session.",
      suggestedFix: "Make one pipeline authoritative and reconcile the other against it before write.",
      checks: [
        { label: "IDs agree", value: "29%", pass: false },
        { label: "Single writer", value: "no", pass: false },
        { label: "Both fields populated", value: "yes", pass: true },
      ],
      details: [
        "Graph ID A vs summary ID B on the same session",
        "Only 29% agreement when both IDs are filled",
        "No reconciliation step between pipelines",
      ],
    },
    199,
  ),
  issueGroup(
    {
      errorType: "LeadPlus join key wrong",
      category: "assignment",
      count: 1580,
      severity: "high",
      trend: 1.0,
      description: "Bad entity_record_id or utm_content stops truth and graph lining up for accuracy.",
      expected: "Join key links the graph record to the qualified lead",
      actual: "entity_record_id or utm_content malformed — records do not line up",
      rootCause: "The join key is written inconsistently across capture points.",
      impact: "Accuracy cannot be computed on the trusted overlap sample.",
      suggestedFix: "Normalise and validate the join key at capture and reject malformed values.",
      checks: [
        { label: "Join key valid", value: "malformed", pass: false },
        { label: "Overlap matched", value: "no", pass: false },
        { label: "Lead record exists", value: "yes", pass: true },
      ],
      details: [
        "utm_content truncated on the landing page",
        "entity_record_id carried trailing whitespace",
        "Overlap sample lost 214 rows to bad keys",
      ],
    },
    235,
  ),
  issueGroup(
    {
      errorType: "Shared identifiers",
      category: "wrong-identity",
      count: 2910,
      severity: "critical",
      trend: 2.6,
      description: "Same email, phone, cookie or IP used by more than one person.",
      expected: "Each identifier belongs to one person",
      actual: "A shared identifier resolved the session to the wrong household member",
      rootCause: "Household and workplace identifiers are treated as personal identifiers.",
      impact: "Wrong person's profile, CRM contact and revenue attribution.",
      suggestedFix: "Detect shared identifiers and require a second confirming signal.",
      checks: [
        { label: "Identifier unique", value: "no", pass: false },
        { label: "Second signal used", value: "no", pass: false },
        { label: "Assignment made", value: "yes", pass: true },
      ],
      details: [
        "Family email attached the session to the spouse",
        "Shared work phone matched a colleague",
        "Household cookie reused on a second person",
      ],
    },
    301,
  ),
  issueGroup(
    {
      errorType: "Weak waterfall step wins",
      category: "wrong-identity",
      count: 2240,
      severity: "critical",
      trend: 1.8,
      description: "IP + user agent or name matches before a stronger check is available.",
      expected: "Strongest available method decides the assignment",
      actual: "A weak step resolved the session and the cascade stopped",
      rootCause: "Cascade order is fixed rather than driven by measured accuracy.",
      impact: "Accuracy failure — the wrong person's history and metrics are updated.",
      suggestedFix: "Rank the cascade by measured accuracy and refresh the ranking each run.",
      checks: [
        { label: "Strongest method used", value: "no", pass: false },
        { label: "Confidence >= 70%", value: "52%", pass: false },
        { label: "Cascade completed", value: "yes", pass: true },
      ],
      details: [
        "IP + user agent won over an available email",
        "Name match assigned before phone was tried",
        "Cascade order not derived from accuracy",
      ],
    },
    313,
  ),
  issueGroup(
    {
      errorType: "Stale or duplicate graph rows",
      category: "wrong-identity",
      count: 1460,
      severity: "high",
      trend: -0.9,
      description: "An old person ID is reused for a device that changed hands.",
      expected: "Mappings expire and are revalidated before reuse",
      actual: "A stale person ID from an old mapping was reused",
      rootCause: "Mappings are never expired, so an old device-to-person link keeps winning.",
      impact: "Sessions from the new owner land on the previous person's profile.",
      suggestedFix: "Expire mappings after 90 days and require a fresh deterministic match.",
      checks: [
        { label: "Revalidated <= 90 days", value: "187 days", pass: false },
        { label: "Duplicate rows", value: "3", pass: false },
        { label: "Person still active", value: "yes", pass: true },
      ],
      details: [
        "Device reassigned but old person ID reused",
        "Three stale graph rows for one device",
        "No expiry policy on device mappings",
      ],
    },
    325,
  ),
  issueGroup(
    {
      errorType: "PII mismatch with truth",
      category: "wrong-identity",
      count: 1820,
      severity: "high",
      trend: 1.3,
      description: "Quiz or prepop email differs from the Lead Plus email but the system still links them.",
      expected: "Linked records agree on the trusted identifier",
      actual: "Quiz email differs from the Lead Plus email yet the records were linked",
      rootCause: "Fuzzy matching accepted a near-match against the trusted record.",
      impact: "Accuracy against Lead Plus drops and the wrong lead is credited.",
      suggestedFix: "Require exact agreement on the trusted identifier before linking to a qualified lead.",
      checks: [
        { label: "Trusted identifier equal", value: "no", pass: false },
        { label: "Fuzzy match used", value: "yes", pass: false },
        { label: "Lead qualified", value: "yes", pass: true },
      ],
      details: [
        "Prepop email differs from the Lead Plus email",
        "Nickname accepted as a name match",
        "Address matched but contact details differ",
      ],
    },
    337,
  ),
  issueGroup(
    {
      errorType: "Two pipelines disagree",
      category: "wrong-identity",
      count: 1670,
      severity: "critical",
      trend: 2.9,
      description: "Glue graph and Session Summary enrichment write different person IDs.",
      expected: "Both pipelines converge on one person ID",
      actual: "Glue graph and Session Summary enrichment wrote different IDs for the same session",
      rootCause: "Each pipeline resolves independently with no reconciliation.",
      impact: "Consumers disagree on who the session belongs to; metrics cannot be trusted.",
      suggestedFix: "Nominate one authoritative writer and reconcile the other before publish.",
      checks: [
        { label: "IDs agree", value: "no", pass: false },
        { label: "Authoritative writer defined", value: "no", pass: false },
        { label: "Both pipelines ran", value: "yes", pass: true },
      ],
      details: [
        "Glue graph wrote ID A, enrichment wrote ID B",
        "No reconciliation between the two writers",
        "Consumers read whichever landed last",
      ],
    },
    349,
  ),
];



// ------------------------------------------------------------------ validation

export type ValidationGroup = {
  field: "Email validation" | "Phone validation" | "Address validation";
  checked: number;
  passed: number;
  failed: number;
  examples: { value: string; reason: string; sessionId: string }[];
};

export const VALIDATION: ValidationGroup[] = [
  {
    field: "Email validation",
    checked: 412_880,
    passed: 396_240,
    failed: 16_640,
    examples: [
      { value: "john@@gmail.com", reason: "Malformed address", sessionId: "session_1120" },
      { value: "test@test.com", reason: "Known placeholder domain", sessionId: "session_1188" },
      { value: "asdf@asdf", reason: "Missing TLD", sessionId: "session_1201" },
    ],
  },
  {
    field: "Phone validation",
    checked: 288_450,
    passed: 261_900,
    failed: 26_550,
    examples: [
      { value: "0000000000", reason: "Placeholder number", sessionId: "session_2044" },
      { value: "555123", reason: "Too few digits", sessionId: "session_2109" },
      { value: "+1 (555) 555-5555", reason: "Reserved test range", sessionId: "session_2212" },
    ],
  },
  {
    field: "Address validation",
    checked: 194_310,
    passed: 165_160,
    failed: 29_150,
    examples: [
      { value: "123 Main St, , ", reason: "Missing city/state", sessionId: "session_3011" },
      { value: "PO BOX 998", reason: "Non-deliverable for match", sessionId: "session_3080" },
      { value: "88 Pine St, Austin, ZZ", reason: "Invalid state code", sessionId: "session_3144" },
    ],
  },
];

// ------------------------------------------------------------------ api health

export const API_STATUS = {
  status: "Operational" as "Operational" | "Degraded" | "Down",
  calls: 3_482_991,
  p50: 84,
  p95: 268,
  errorRate: 0.42,
  cost: 12_940,
  uptime: 99.97,
};

export const API_TREND = SERIES.daily.map((p, i) => {
  const r = rng(90 + i)();
  return {
    period: p.period,
    calls: Math.round(96_000 + r * 34_000),
    latency: Math.round(70 + r * 60),
    errorRate: round(0.2 + r * 0.6, 2),
    cost: Math.round(360 + r * 180),
  };
});

export const API_ENDPOINTS = [
  { endpoint: "POST /identity/resolve", calls: 2_611_004, p95: 244, errorRate: 0.31, cost: 9_120 },
  { endpoint: "GET /identity/{person_id}", calls: 612_330, p95: 128, errorRate: 0.12, cost: 1_840 },
  { endpoint: "POST /identity/validate", calls: 208_991, p95: 302, errorRate: 0.88, cost: 1_310 },
  { endpoint: "GET /identity/audit", calls: 50_666, p95: 410, errorRate: 1.24, cost: 670 },
];

// ------------------------------------------------------------------ csv

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ------------------------------------------------------------------ metric auditability
// Every headline metric is backed by a formula, the datasets used, the exact
// numerator/denominator, and the raw rows the number was computed from.

export type AuditRow = {
  session_id: string;
  source_a: string;
  source_b: string;
  source_a_identity: string;
  source_b_identity: string;
  identity_method: string;
  identity_value: string;
  confidence: number;
  match_result: "Matched" | "No Match";
  accuracy_result: "Correct" | "Incorrect" | "Unverified";
  decision_reason: string;
};

const AUDIT_SOURCE_A = "Session Summary";
const AUDIT_SOURCE_B = "Revenue Leads Plus";

export const METRIC_AUDIT_ROWS: AuditRow[] = (() => {
  const r = rng(4021);
  return Array.from({ length: 60 }, (_, i) => {
    const f = FIRST[Math.floor(r() * FIRST.length)];
    const l = LAST[Math.floor(r() * LAST.length)];
    const name = `${f} ${l}`;
    const method = METHOD_NAMES[Math.floor(r() * METHOD_NAMES.length)];
    const matched = r() > 0.13;
    const correct = matched ? r() > 0.08 : false;
    const conf = Math.round(matched ? 70 + r() * 29 : 22 + r() * 34);
    const email = `${f.toLowerCase()}.${l.toLowerCase()}@example.com`;
    const phone = `415555${String(1000 + Math.floor(r() * 8999))}`;
    const value =
      method === "Email"
        ? email
        : method === "Phone"
          ? phone
          : method === "Address"
            ? `${100 + i} Pine St, Austin TX`
            : method === "Name"
              ? name
              : method === "IP + User Agent"
                ? `24.18.${Math.floor(r() * 250)}.${Math.floor(r() * 250)} / Chrome 141`
                : "—";
    const otherName = `${FIRST[Math.floor(r() * FIRST.length)]} ${l}`;
    return {
      session_id: `session_${100 + i}`,
      source_a: AUDIT_SOURCE_A,
      source_b: AUDIT_SOURCE_B,
      source_a_identity: matched ? email : value,
      source_b_identity: matched ? email : `${otherName.split(" ")[0].toLowerCase()}@example.com`,
      identity_method: method,
      identity_value: value,
      confidence: conf,
      match_result: matched ? "Matched" : "No Match",
      accuracy_result: matched ? (correct ? "Correct" : "Incorrect") : "Unverified",
      decision_reason: matched
        ? `${method} exact match against ${AUDIT_SOURCE_B} at ${conf}% confidence`
        : `No ${method} overlap; waterfall exhausted for this session`,
    } as AuditRow;
  });
})();

export type MetricAudit = {
  formula: string;
  inputDataset: string;
  comparedAgainst: string;
  plainEnglish: string;
  terms: { label: string; value: string }[];
  result: string;
};

export const METRIC_AUDITS: Record<string, MetricAudit> = {
  resolution_rate: {
    formula: "Sessions With Identity / Total Sessions",
    inputDataset: "Session Summary",
    comparedAgainst: "Anonymous User (identity graph output)",
    plainEnglish: "Of all sessions processed on this date, how many received an identity.",
    terms: [
      { label: "Total Sessions", value: num(1_284_930) },
      { label: "Sessions With Identity", value: num(1_097_331) },
      { label: "Sessions Without Identity", value: num(187_599) },
    ],
    result: "85.4%",
  },
  failure_rate: {
    formula: "Sessions Without Identity / Total Sessions",
    inputDataset: "Session Summary",
    comparedAgainst: "Anonymous User (identity graph output)",
    plainEnglish: "The inverse of resolution rate — sessions the waterfall could not identify.",
    terms: [
      { label: "Total Sessions", value: num(1_284_930) },
      { label: "Sessions Without Identity", value: num(187_599) },
    ],
    result: "14.6%",
  },
  accuracy: {
    formula: "Correct Matches / Total Evaluated Records",
    inputDataset: "Revenue Leads Plus",
    comparedAgainst: "Session Summary",
    plainEnglish: "Of the identities we assigned and were able to verify, how many were right.",
    terms: [
      { label: "Total Evaluated", value: num(10_000) },
      { label: "Matched", value: num(9_000) },
      { label: "Correct", value: num(8_280) },
    ],
    result: "92%",
  },
  graph_cost: {
    formula: "SUM(vendor_invoice_amount) for the period",
    inputDataset: "Identity vendor invoices",
    comparedAgainst: "Anonymous User (billed lookups)",
    plainEnglish: "Total spend across identity graph vendors for the selected period.",
    terms: [
      { label: "Billed Lookups", value: num(1_090_432) },
      { label: "Blended Rate", value: "$0.0442" },
      { label: "Total Cost", value: money(48_212, 0) },
    ],
    result: money(48_212, 0),
  },
  cost_per_id: {
    formula: "Total Identity Graph Cost / Identified Users",
    inputDataset: "Identity vendor invoices",
    comparedAgainst: "Anonymous User",
    plainEnglish: "What each successful identification costs.",
    terms: [
      { label: "Total Cost", value: money(48_212, 0) },
      { label: "Identified Users", value: num(1_090_432) },
    ],
    result: "$0.0442",
  },
  cost_per_k: {
    formula: "(Total Identity Graph Cost / Identified Users) × 1000",
    inputDataset: "Identity vendor invoices",
    comparedAgainst: "Anonymous User",
    plainEnglish: "Cost normalised to one thousand identified users.",
    terms: [
      { label: "Total Cost", value: money(48_212, 0) },
      { label: "Identified Users", value: num(1_090_432) },
    ],
    result: money(44.2, 2),
  },
};

// ------------------------------------------------------------------ waterfall usage

const WATERFALL_TOTAL = METHODS.reduce((a, m) => a + m.matches, 0);
export const WATERFALL_STEPS = METHOD_WATERFALL.map((s) => {
  const m = METHODS.find((x) => x.method === s.method)!;
  return {
    ...s,
    successRate: round((m.matches / m.records) * 100, 1),
    usedPct: round((m.matches / WATERFALL_TOTAL) * 100, 1),
    records: m.records,
  };
});

// ------------------------------------------------------------------ identity profiles

export type IdentitySource = {
  method: string;
  value: string;
  confidence: number;
  createdDate: string;
  source: string;
};

export type IdentityProfile = {
  personId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  sessions: string[];
  sources: IdentitySource[];
};

export const PROFILES: IdentityProfile[] = [
  {
    personId: "rev_user_123",
    name: "John Smith",
    email: "john@gmail.com",
    phone: "5555555555",
    address: "412 Harrison St, San Francisco, CA 94105",
    sessions: ["session_123"],
    sources: [
      { method: "Email", value: "john@gmail.com", confidence: 95, createdDate: "2026-08-28", source: "Revenue Leads Plus" },
      { method: "Phone", value: "5555555555", confidence: 90, createdDate: "2026-08-28", source: "Session Summary" },
      { method: "Address", value: "412 Harrison St, San Francisco, CA 94105", confidence: 80, createdDate: "2026-08-29", source: "Session Summary" },
      { method: "IP + User Agent", value: "24.18.9.4 / Chrome 141", confidence: 50, createdDate: "2026-08-31", source: "Session Summary" },
    ],
  },
  {
    personId: "rev_user_884",
    name: "Dana Alvarez",
    email: "d.alvarez@northwind.io",
    phone: "5125550188",
    address: "88 Pine St, Austin, TX 78701",
    sessions: ["session_884"],
    sources: [
      { method: "Email", value: "d.alvarez@northwind.io", confidence: 96, createdDate: "2026-08-30", source: "Revenue Leads Plus" },
      { method: "Address", value: "88 Pine St, Austin, TX 78701", confidence: 82, createdDate: "2026-08-30", source: "Anonymous User" },
      { method: "Name", value: "Dana Alvarez", confidence: 79, createdDate: "2026-09-01", source: "Session Summary" },
    ],
  },
  {
    personId: "rev_user_512",
    name: "Priya Raman",
    email: "—",
    phone: "4155550134",
    address: "1900 Market St, Philadelphia, PA 19103",
    sessions: ["session_512"],
    sources: [
      { method: "Phone", value: "4155550134", confidence: 91, createdDate: "2026-08-27", source: "Revenue Leads Plus" },
      { method: "IP + User Agent", value: "72.44.19.230 / Safari 19", confidence: 49, createdDate: "2026-09-01", source: "Session Summary" },
    ],
  },
];

export const DATASET_FLOW = [
  { name: "Revenue Leads Plus", role: "CRM source of truth", joinKey: "email / phone / lead_id" },
  { name: "Session Summary", role: "Session data", joinKey: "session_id" },
  { name: "Anonymous User", role: "Identity graph output", joinKey: "rev_user_id" },
];

// ------------------------------------------------------------------ identity resolution details (per record)

export type MethodContribution = {
  method: string;
  share: number;
  accuracy: number;
  identitiesCreated: number;
  attempted: number;
  matched: number;
  noMatch: number;
  avgConfidence: number;
  avgLatencyMs: number;
  compared: number;
  correct: number;
  joinKey: string;
  note: string;
};

export const METHOD_CONTRIBUTION: MethodContribution[] = [
  {
    method: "Phone Match",
    share: 25,
    accuracy: 90,
    identitiesCreated: 25_000,
    attempted: 48_100,
    matched: 25_000,
    noMatch: 23_100,
    avgConfidence: 0.91,
    avgLatencyMs: 168,
    compared: 260,
    correct: 234,
    joinKey: "phone_e164",
    note: "Runs when email is absent or returns no hit; shared household numbers cause most errors.",
  },
  {
    method: "Email Match",
    share: 55,
    accuracy: 95,
    identitiesCreated: 55_000,
    attempted: 92_400,
    matched: 55_000,
    noMatch: 37_400,
    avgConfidence: 0.96,
    avgLatencyMs: 142,
    compared: 620,
    correct: 589,
    joinKey: "email",
    note: "Strongest signal — exact email match against the trusted lead set.",
  },
  {
    method: "Address Match",
    share: 10,
    accuracy: 80,
    identitiesCreated: 10_000,
    attempted: 31_500,
    matched: 10_000,
    noMatch: 21_500,
    avgConfidence: 0.78,
    avgLatencyMs: 110,
    compared: 120,
    correct: 96,
    joinKey: "address",
    note: "Street-level match; requires a complete address in both the event and the trusted lead set.",
  },
  {
    method: "Name",
    share: 5,
    accuracy: 50,
    identitiesCreated: 5_000,
    attempted: 27_800,
    matched: 5_000,
    noMatch: 22_800,
    avgConfidence: 0.52,
    avgLatencyMs: 88,
    compared: 60,
    correct: 30,
    joinKey: "ip + user_agent",
    note: "Last-resort probabilistic method; only used when no deterministic key is present.",
  },
  {
    method: "IP + User Agent",
    share: 5,
    accuracy: 82,
    identitiesCreated: 5_000,
    attempted: 27_800,
    matched: 5_000,
    noMatch: 22_800,
    avgConfidence: 0.80,
    avgLatencyMs: 105,
    compared: 60,
    correct: 49,
    joinKey: "name",
    note: "Name-only match; useful when PII signals are sparse but prone to household collisions.",
  },
];


export const RESOLUTION_ORDER = ["Phone", "Email", "Address", "IP + User Agent", "Name"];

export type ResolutionStep = {
  step: number;
  method: string;
  status: "Success" | "Evaluated" | "Not available";
  result: string;
  confidence: number;
};

export type ResolutionDetail = {
  personId: string;
  status: "Identified" | "Unidentified";
  winningMethod: string;
  confidence: number;
  methodsEvaluated: number;
  methodsUsed: string[];
  steps: ResolutionStep[];
  inputs: { label: string; value: string }[];
  reason: string;
};

const BASE_CONFIDENCE: Record<string, number> = {
  Email: 95,
  Phone: 90,
  Address: 80,
  Name: 82,
  "IP + User Agent": 50,
};

export function resolutionDetail(r: AuditRecord): ResolutionDetail {
  const tried = new Map(r.methodsTried.map((m) => [m.method, m]));
  const order = RESOLUTION_ORDER.filter((m) => tried.has(m) || m === r.identityMethod);
  const identified = r.identityMethod !== "None";

  const steps: ResolutionStep[] = order.map((method, i) => {
    const t = tried.get(method);
    const won = identified && method === r.identityMethod;
    const available =
      (method === "Email" && r.email !== "—" && !r.email.startsWith("unknown")) ||
      (method === "Phone" && r.phone !== "—") ||
      method === "Address" ||
      method === "Name" ||
      method === "IP + User Agent";
    const confidence = won ? r.confidence : t?.confidence || (available ? BASE_CONFIDENCE[method] ?? 0 : 0);
    return {
      step: i + 1,
      method,
      status: won ? "Success" : available ? "Evaluated" : "Not available",
      result: won ? "Identity Created" : available ? "Not Used" : "No input available",
      confidence,
    };
  });

  return {
    personId: identified ? r.personId : "—",
    status: identified ? "Identified" : "Unidentified",
    winningMethod: identified ? `${r.identityMethod} Match` : "None",
    confidence: r.confidence,
    methodsEvaluated: steps.length,
    methodsUsed: steps.map((s) => s.method),
    steps,
    inputs: [
      { label: "Email", value: r.email && r.email !== "—" && !r.email.startsWith("unknown") ? r.email : "Not provided" },
      { label: "Phone", value: r.phone !== "—" ? r.phone : "Not provided" },
      { label: "IP", value: "192.168.xxx.xxx" },
      { label: "User Agent", value: "Chrome · Windows" },
    ],
    reason: identified
      ? `Highest confidence available method — ${r.identityMethod} matched at ${r.confidence}% and stopped the waterfall.`
      : "No method produced a match above the confidence threshold, so no identity was assigned.",
  };
}

// ------------------------------------------------------------------ per-record source comparison

export type RecordSourceRow = {
  source: string;
  identityReturned: string;
  personId: string;
  method: string;
  methodValue: string;
  confidence: number;
  lastSeen: string;
  agreement: "Agrees" | "Conflicts" | "No opinion";
  chosen: boolean;
  issue: string | null;
  issueSeverity: "high" | "medium" | null;
  conflictReason: string | null;
  conflictFactors: string[];
};

export function recordSourceComparison(r: AuditRecord): RecordSourceRow[] {
  const identified = r.identityMethod !== "None";
  const mismatch = r.comparison?.matchResult === "No Match";
  const hasEmail = r.email !== "—" && !r.email.startsWith("unknown");
  const hasPhone = r.phone !== "—";

  const seed = r.sessionId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const cookie = `rc_${(seed * 997).toString(16).slice(0, 6)}`;
  const ip = `24.${(seed % 253) + 1}.${((seed * 7) % 253) + 1}.${((seed * 13) % 253) + 1}`;
  const ua = seed % 2 === 0 ? "Chrome 141 / Windows" : "Safari 19 / macOS";

  const valueFor = (method: string, identity?: string) => {
    const who = identity ?? r.identityAssigned;
    const alt = identity !== undefined && identity !== r.identityAssigned;
    switch (method) {
      case "Email":
        if (alt) return `${who.split(" ")[0].toLowerCase()}@example.com`;
        return hasEmail ? r.email : "—";
      case "Phone":
        if (alt) return hasPhone ? `${r.phone.slice(0, -2)}${(seed % 90) + 10}` : "—";
        return hasPhone ? r.phone : "—";
      case "Address":
        return alt ? `${r.sessionId.slice(-3)} Oak St, Austin TX` : `${r.sessionId.slice(-3)} Market St`;
      case "Name":
        return alt ? `${who} (alt)` : who;
      case "IP + User Agent":
        return `${ip} / ${ua}`;
      default:
        return "—";
    }
  };


  // The source of truth reports the method that actually won the waterfall.
  const truthMethod = identified ? r.identityMethod : "None";

  const rows: Omit<RecordSourceRow, "issue" | "issueSeverity" | "conflictReason" | "conflictFactors">[] = [
    {
      source: "Revenue Leads Plus",
      identityReturned: identified ? r.identityAssigned : "No identity",
      personId: identified ? r.personId : "—",
      method: truthMethod,
      methodValue: valueFor(truthMethod),
      confidence: identified ? r.confidence : 0,
      lastSeen: "2026-09-01",
      agreement: identified ? "Agrees" : "No opinion",
      chosen: identified && (mismatch || r.source === "Revenue Leads Plus"),
    },
    {
      source: "Session Summary",
      identityReturned: mismatch
        ? r.comparison!.sourceBIdentity
        : identified
          ? r.identityAssigned
          : "No identity",
      personId: mismatch ? `${r.personId}_alt` : identified ? r.personId : "—",
      method: truthMethod,
      methodValue: valueFor(
        truthMethod,
        mismatch ? r.comparison!.sourceBIdentity : undefined,
      ),

      confidence: identified ? Math.max(0, r.confidence - 3) : 0,
      lastSeen: "2026-09-01",
      agreement: mismatch ? "Conflicts" : identified ? "Agrees" : "No opinion",
      chosen: !mismatch && identified && r.source !== "Revenue Leads Plus",
    },
    {
      source: "Anonymous User",
      identityReturned: identified ? r.identityAssigned : "Unresolved",
      personId: identified ? r.personId : "—",
      method: "IP + User Agent",
      methodValue: `${ip} / ${ua}`,
      confidence: 50,
      lastSeen: "2026-08-30",
      agreement: identified ? "Agrees" : "No opinion",
      chosen: false,
    },
  ];
  const truth = rows[0];
  return rows.map((row) => {
    let issue: string | null = null;
    let severity: "high" | "medium" | null = null;

    // Which factors caused this source to disagree with the source of truth
    const factors: string[] = [];
    if (row.source !== truth.source && row.agreement === "Conflicts") {
      if (row.identityReturned !== truth.identityReturned) {
        factors.push(`Different identity — ${truth.identityReturned} vs ${row.identityReturned}`);
      }
      if (row.personId !== truth.personId) {
        factors.push(`Different person ID — ${truth.personId} vs ${row.personId}`);
      }
      if (row.methodValue !== truth.methodValue) {
        factors.push(`${row.method} value differs — "${truth.methodValue}" vs "${row.methodValue}"`);
      }
      if (row.method !== truth.method) {
        factors.push(`Matched on a different method — ${truth.method} vs ${row.method}`);
      }
      if (row.lastSeen !== truth.lastSeen) {
        factors.push(`Data recency differs — ${truth.lastSeen} vs ${row.lastSeen}`);
      }
      if (factors.length === 0) factors.push("Conflicting record returned by this source");
    }

    if (row.agreement === "Conflicts") {
      issue = "Conflicts with the source of truth identity";
      severity = "high";
    } else if (
      row.personId !== "—" &&
      truth.personId !== "—" &&
      row.personId !== truth.personId
    ) {
      issue = `Different person ID than source of truth (${truth.personId})`;
      severity = "high";
    } else if (row.identityReturned === "No identity" || row.identityReturned === "Unresolved") {
      issue = "No identity returned by this source";
      severity = "medium";
    } else if (row.methodValue === "—") {
      issue = "No matching value available for this method";
      severity = "medium";
    } else if (row.confidence > 0 && row.confidence < 60) {
      issue = `Low confidence match (${row.confidence}%)`;
      severity = "medium";
    } else if (row.lastSeen < "2026-09-01") {
      issue = `Stale data — last seen ${row.lastSeen}`;
      severity = "medium";
    }

    return {
      ...row,
      issue,
      issueSeverity: severity,
      conflictReason: factors.length ? factors[0] : null,
      conflictFactors: factors,
    };
  });
}

// ------------------------------------------------------------------ accuracy overlap sample
// Accuracy is only computable where a record can be joined to a trusted
// qualified LeadPlus lead (source of truth). That intersection is a small,
// biased-but-trusted sample; the match rate measured on it is used as the
// accuracy estimate for the remaining, unjoinable records of the same
// source / method.

export type OverlapGroup = {
  name: string;
  records: number; // all identity records from this source / method
  overlap: number; // records that also exist as qualified LeadPlus leads
  compared: number; // overlap rows with enough fields to compare
  matches: number; // identity agrees with the lead
  joinKeys: string[];
};

const overlapAccuracy = (g: OverlapGroup) => round((g.matches / Math.max(1, g.compared)) * 100, 1);
export const overlapCoverage = (g: OverlapGroup) => round((g.overlap / Math.max(1, g.records)) * 100, 2);
export const overlapRate = overlapAccuracy;

export const OVERLAP_BY_SOURCE: OverlapGroup[] = [
  { name: "Session Summary", records: 10_000, overlap: 100, compared: 98, matches: 89, joinKeys: ["PII from segment_events"] },
];

export const OVERLAP_BY_METHOD: OverlapGroup[] = [
  { name: "Email", records: 10_000, overlap: 96, compared: 95, matches: 90, joinKeys: ["email"] },
  { name: "Phone", records: 5_000, overlap: 52, compared: 50, matches: 45, joinKeys: ["phone (SMS verified)"] },
  { name: "Address", records: 3_500, overlap: 32, compared: 31, matches: 25, joinKeys: ["address"] },
  { name: "Name", records: 2_700, overlap: 26, compared: 25, matches: 20, joinKeys: ["name"] },
  { name: "IP + User Agent", records: 7_400, overlap: 18, compared: 17, matches: 9, joinKeys: ["session_id ↔ utm_content"] },
];

export function overlapTotals(groups: OverlapGroup[]) {
  const records = groups.reduce((s, g) => s + g.records, 0);
  const overlap = groups.reduce((s, g) => s + g.overlap, 0);
  const compared = groups.reduce((s, g) => s + g.compared, 0);
  const matches = groups.reduce((s, g) => s + g.matches, 0);
  return {
    records,
    overlap,
    compared,
    matches,
    accuracy: round((matches / Math.max(1, compared)) * 100, 1),
    coverage: round((overlap / Math.max(1, records)) * 100, 2),
    inherited: records - overlap,
  };
}

// ------------------------------------------------------------------ method analysis (detailed tab)

export type MethodTrendPoint = { period: string; accuracy: number; matchRate: number; volume: number };

export function methodTrend(method: string, days = 30): MethodTrendPoint[] {
  const m = METHOD_CONTRIBUTION.find((x) => x.method === method) ?? METHOD_CONTRIBUTION[0];
  const r = rng(method.length * 977 + m.identitiesCreated);
  return Array.from({ length: days }, (_, i) => {
    const drift = (i - days / 2) * 0.04;
    return {
      period: `Aug ${i + 3}`,
      accuracy: round(Math.max(35, Math.min(99, m.accuracy + drift + (r() - 0.5) * 3.2)), 1),
      matchRate: round(
        Math.max(20, Math.min(99, (m.matched / m.attempted) * 100 + drift + (r() - 0.5) * 4)),
        1,
      ),
      volume: Math.round((m.identitiesCreated / days) * (0.85 + r() * 0.3)),
    };
  });
}

export type MethodFailure = { reason: string; records: number; share: number };

const FAILURE_REASONS: Record<string, string[]> = {
  "Email Match": ["No email on the session", "Role/shared inbox", "Typo or invalid domain", "Email changed since lead"],
  "Phone Match": ["No phone captured", "Shared household number", "Formatting / country code", "Recycled number"],
  "Address Match": ["Partial address", "Address moved", "Street mismatch", "Unit / apartment omitted"],
  "Name Match": ["Household with same surname", "Name spelling variance", "Nickname vs formal name", "Middle name mismatch"],
  "IP + User Agent Match": ["Shared corporate IP", "Mobile carrier NAT", "Generic user agent", "VPN / proxy"],
};

export function methodFailureBreakdown(m: MethodContribution): MethodFailure[] {
  const reasons = FAILURE_REASONS[m.method] ?? ["No signal available", "Ambiguous match", "Stale data", "Other"];
  const r = rng(m.method.length * 131 + m.noMatch);
  const weights = reasons.map(() => 0.15 + r());
  const total = weights.reduce((a, b) => a + b, 0);
  return reasons.map((reason, i) => ({
    reason,
    records: Math.round((weights[i] / total) * m.noMatch),
    share: round((weights[i] / total) * 100, 1),
  }));
}

export function methodMatchRate(m: MethodContribution) {
  return round((m.matched / m.attempted) * 100, 1);
}

export function methodTotals() {
  const created = METHOD_CONTRIBUTION.reduce((a, m) => a + m.identitiesCreated, 0);
  const attempted = METHOD_CONTRIBUTION.reduce((a, m) => a + m.attempted, 0);
  const compared = METHOD_CONTRIBUTION.reduce((a, m) => a + m.compared, 0);
  const correct = METHOD_CONTRIBUTION.reduce((a, m) => a + m.correct, 0);
  return {
    created,
    attempted,
    compared,
    correct,
    matchRate: round((created / attempted) * 100, 1),
    accuracy: round((correct / Math.max(1, compared)) * 100, 1),
  };
}
