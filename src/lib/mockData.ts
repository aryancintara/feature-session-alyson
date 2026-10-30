// Mock data fixtures for the Identity & Audience Intelligence Platform

export type RepeatBucket = "1 visit" | "2-3 visits" | "4-10 visits" | "10+ visits";
export type AccuracyGrade = "A+" | "A" | "B" | "C" | "D" | "F";
export type EventType =
  | "ad_impression"
  | "page_view"
  | "quiz_started"
  | "quiz_question_answered"
  | "partial_lead"
  | "lead_submitted"
  | "sms_sent"
  | "sms_clicked"
  | "email_opened"
  | "email_clicked"
  | "appointment_set"
  | "meeting_held"
  | "sale"
  | "heartbeat_exit_detected"
  | "reactivation_eligible"
  | "reactivation_lead_created"
  | "reactivation_sent_to_destination"
  | "reactivation_contact_attempt"
  | "reactivation_conversion";

export type FunnelStage =
  | "Impression"
  | "Visit"
  | "Quiz Start"
  | "Partial Lead"
  | "Lead"
  | "MQL"
  | "SQL"
  | "Appointment"
  | "Meeting"
  | "Opportunity"
  | "Sale";

export interface IdentitySignal {
  id: string;
  type: "email" | "phone" | "address" | "cookie" | "device" | "maid" | "ip" | "geo" | "partner_id";
  value: string;
  source: string;
  confidence: number; // 0-100
  grade: AccuracyGrade;
  firstSeen: string;
  lastSeen: string;
}

export interface PersonEvent {
  id: string;
  type: EventType;
  timestamp: string;
  source: string;
  sessionId?: string;
  meta?: Record<string, string | number>;
}

export interface Session {
  id: string;
  personId: string;
  startTime: string;
  endTime: string;
  exitReason: "inactivity_timeout" | "heartbeat_exit";
  pageViews: number;
  events: number;
  device: string;
  source: string;
}

export interface Person {
  id: string;
  placeId: string;
  name: string;
  primaryEmail: string;
  primaryPhone: string;
  city: string;
  state: string;
  repeatBucket: RepeatBucket;
  visits: number;
  consent: {
    platform: boolean;
    partner: boolean;
    sms: boolean;
    call: boolean;
    email: boolean;
    unsubscribed: boolean;
    litigationRisk: boolean;
  };
  sourceOfTruth: boolean;
  furthestStage: FunnelStage;
  currentStage: FunnelStage;
  propensity: {
    purchase: number;
    churn: number;
    engagement: number;
  };
  audiences: string[];
  signals: IdentitySignal[];
  events: PersonEvent[];
  sessions: Session[];
  identityScore: number; // 0-100
  lastSeen: string;
}

export interface Audience {
  id: string;
  name: string;
  type: "system" | "event" | "funnel" | "propensity" | "consent" | "custom";
  size: number;
  growth7d: number;
  description: string;
  updated: string;
}

export interface EventMapping {
  id: string;
  sourceEvent: EventType;
  actions: Array<{
    type: "audience_add" | "audience_remove" | "funnel_update" | "identity_update" | "trigger";
    target: string;
  }>;
  enabled: boolean;
  triggered24h: number;
}

export interface DataSource {
  id: string;
  name: string;
  category: "web" | "ad" | "email" | "sms" | "form" | "partner" | "identity" | "device";
  status: "healthy" | "degraded" | "down";
  events24h: number;
  lastEvent: string;
}

const FIRST = ["Sarah", "James", "Emily", "Michael", "Jessica", "David", "Ashley", "Daniel", "Jennifer", "Christopher", "Amanda", "Matthew", "Lauren", "Andrew", "Megan", "Joshua"];
const LAST = ["Mitchell", "Patel", "Rodriguez", "Chen", "Thompson", "Williams", "Garcia", "Anderson", "Nguyen", "Brooks", "Foster", "Kim", "Sullivan", "Walsh", "Romero", "Bennett"];
const CITIES: [string, string][] = [["Austin", "TX"], ["Denver", "CO"], ["Seattle", "WA"], ["Miami", "FL"], ["Brooklyn", "NY"], ["Portland", "OR"], ["Atlanta", "GA"], ["Phoenix", "AZ"], ["Boston", "MA"], ["Chicago", "IL"]];
const SOURCES = ["website_tracker", "meta_ads", "google_ads", "tiktok_ads", "klaviyo", "twilio", "quiz_engine", "experian", "liveramp"];
const DEVICES = ["iPhone 15 Pro · Safari", "MacBook Pro · Chrome", "Pixel 8 · Chrome", "iPad · Safari", "Windows · Edge"];

function rand<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

// Fixed reference clock so SSR and client render identical timestamps.
export const NOW_MS = Date.UTC(2026, 7, 3, 12, 0, 0);

function hours(n: number): string {
  return new Date(NOW_MS - n * 3600 * 1000).toISOString();
}

function gradeFromConfidence(c: number): AccuracyGrade {
  if (c >= 95) return "A+";
  if (c >= 88) return "A";
  if (c >= 78) return "B";
  if (c >= 65) return "C";
  if (c >= 50) return "D";
  return "F";
}

function buildSignals(seed: number): IdentitySignal[] {
  const types: IdentitySignal["type"][] = ["email", "phone", "address", "cookie", "device", "ip", "geo", "maid", "partner_id"];
  return types.slice(0, 6 + (seed % 3)).map((t, i) => {
    const conf = 60 + ((seed * 7 + i * 13) % 40);
    const valueMap: Record<IdentitySignal["type"], string> = {
      email: `user${seed}@example.com`,
      phone: `+1 (512) 555-${String(1000 + ((seed * 11) % 8999)).padStart(4, "0")}`,
      address: `${100 + (seed % 800)} Maple Ave`,
      cookie: `_lvbl=${(seed * 9301 + 49297).toString(36)}`,
      device: `dev_${(seed * 7).toString(16)}`,
      ip: `73.${seed % 255}.${(seed * 3) % 255}.${(seed * 11) % 255}`,
      geo: `30.26°N, 97.74°W`,
      maid: `maid-${(seed * 31).toString(16)}-a3f9`,
      partner_id: `lr_${(seed * 17).toString(36)}`,
    };
    return {
      id: `sig_${seed}_${i}`,
      type: t,
      value: valueMap[t],
      source: rand(SOURCES, seed + i),
      confidence: conf,
      grade: gradeFromConfidence(conf),
      firstSeen: hours(24 * 30 + i * 5),
      lastSeen: hours((seed + i) % 72),
    };
  });
}

function buildEvents(seed: number, personId: string): PersonEvent[] {
  const types: EventType[] = ["ad_impression", "page_view", "page_view", "quiz_started", "quiz_question_answered", "quiz_question_answered", "partial_lead", "email_opened", "lead_submitted", "sms_sent", "sms_clicked", "appointment_set", "meeting_held"];
  const sliceLen = 6 + (seed % 8);
  return types.slice(0, sliceLen).map((t, i) => ({
    id: `evt_${seed}_${i}`,
    type: t,
    timestamp: hours(sliceLen * 6 - i * 5 + (seed % 4)),
    source: rand(SOURCES, seed + i),
    sessionId: `ses_${personId}_${Math.floor(i / 3)}`,
    meta: t === "page_view" ? { url: `/products/item-${(seed + i) % 24}` } : undefined,
  }));
}

function buildSessions(seed: number, personId: string): Session[] {
  const count = 1 + (seed % 4);
  return Array.from({ length: count }).map((_, i) => ({
    id: `ses_${personId}_${i}`,
    personId,
    startTime: hours(i * 24 + 3),
    endTime: hours(i * 24 + 2.5),
    exitReason: i % 2 === 0 ? "inactivity_timeout" : "heartbeat_exit",
    pageViews: 3 + ((seed * (i + 1)) % 14),
    events: 5 + ((seed * 3 + i) % 22),
    device: rand(DEVICES, seed + i),
    source: rand(SOURCES, seed + i),
  }));
}

function buildPerson(seed: number): Person {
  const first = rand(FIRST, seed);
  const last = rand(LAST, seed * 3 + 1);
  const [city, state] = rand(CITIES, seed);
  const visits = 1 + (seed * 7) % 24;
  const repeatBucket: RepeatBucket = visits === 1 ? "1 visit" : visits <= 3 ? "2-3 visits" : visits <= 10 ? "4-10 visits" : "10+ visits";
  const stages: FunnelStage[] = ["Impression", "Visit", "Quiz Start", "Partial Lead", "Lead", "MQL", "SQL", "Appointment", "Meeting", "Opportunity", "Sale"];
  const furthestIdx = (seed * 5) % stages.length;
  const id = `prs_${(seed * 982451653).toString(36).slice(0, 10)}`;
  return {
    id,
    placeId: `plc_${((seed * 31) >> 1).toString(36).slice(0, 8)}`,
    name: `${first} ${last}`,
    primaryEmail: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    primaryPhone: `+1 (${200 + (seed % 700)}) 555-${String(1000 + ((seed * 13) % 8999)).padStart(4, "0")}`,
    city,
    state,
    repeatBucket,
    visits,
    consent: {
      platform: true,
      partner: seed % 4 !== 0,
      sms: seed % 3 !== 0,
      call: seed % 5 !== 0,
      email: seed % 7 !== 0,
      unsubscribed: seed % 11 === 0,
      litigationRisk: seed % 23 === 0,
    },
    sourceOfTruth: furthestIdx >= 6,
    furthestStage: stages[furthestIdx],
    currentStage: stages[Math.max(0, furthestIdx - ((seed % 3) === 0 ? 1 : 0))],
    propensity: {
      purchase: 30 + ((seed * 17) % 70),
      churn: 10 + ((seed * 11) % 60),
      engagement: 20 + ((seed * 23) % 80),
    },
    audiences: [
      "All Visitors",
      ...(visits > 1 ? ["Repeat Visitors"] : []),
      ...(furthestIdx >= 4 ? ["Leads"] : []),
      ...(furthestIdx >= 6 ? ["SQL Audience"] : []),
      ...(seed % 2 === 0 ? ["High Intent"] : []),
    ],
    signals: buildSignals(seed),
    events: buildEvents(seed, id),
    sessions: buildSessions(seed, id),
    identityScore: 60 + ((seed * 19) % 40),
    lastSeen: hours((seed * 3) % 240),
  };
}

export const PEOPLE: Person[] = Array.from({ length: 24 }).map((_, i) => buildPerson(i + 1));

// Inject synthetic reactivation event chains for a subset of people who left without a lead.
// These show up in /events as filterable chips and in /identity-console timelines.
const REACTIVATION_CHAINS: Array<{
  types: EventType[];
  hourOffset: number;
}> = [
  { types: ["heartbeat_exit_detected", "reactivation_eligible", "reactivation_lead_created", "reactivation_sent_to_destination", "reactivation_contact_attempt", "reactivation_conversion"], hourOffset: 2 },
  { types: ["heartbeat_exit_detected", "reactivation_eligible", "reactivation_lead_created", "reactivation_sent_to_destination", "reactivation_contact_attempt"], hourOffset: 6 },
  { types: ["heartbeat_exit_detected", "reactivation_eligible", "reactivation_lead_created", "reactivation_sent_to_destination"], hourOffset: 12 },
  { types: ["heartbeat_exit_detected", "reactivation_eligible", "reactivation_lead_created"], hourOffset: 20 },
  { types: ["heartbeat_exit_detected", "reactivation_eligible"], hourOffset: 30 },
  { types: ["heartbeat_exit_detected"], hourOffset: 44 },
];

PEOPLE.forEach((person, idx) => {
  // Only inject for identified people with consent and no fresh lead — matches reactivation rule logic.
  if (!person.consent.platform || person.consent.unsubscribed) return;
  if (person.identityScore < 65) return;
  if (idx % 5 === 4) return; // skip ~20% to keep diversity

  const chain = REACTIVATION_CHAINS[idx % REACTIVATION_CHAINS.length];
  const sessionId = person.sessions[0]?.id ?? `ses_${person.id}_0`;
  const destination = ["dialer_five9", "salesforce_crm", "leadmarket_xyz", "hubspot_crm"][idx % 4];
  const triggerEventId = `evt_rx_${idx}_trigger`;

  chain.types.forEach((type, step) => {
    person.events.push({
      id: `evt_rx_${idx}_${step}`,
      type,
      timestamp: hours(chain.hourOffset - step * 0.25),
      source: type === "heartbeat_exit_detected" ? "website_tracker" : "reactivation_engine",
      sessionId,
      meta: {
        reactivation_lead_id: `rxl_${person.id.slice(-6)}`,
        destination,
        trigger_event_id: triggerEventId,
        ...(type === "reactivation_conversion" ? { revenue: 100 + ((idx * 47) % 900) } : {}),
      },
    });
  });
});

export const AUDIENCES: Audience[] = [
  { id: "aud_001", name: "All Visitors", type: "system", size: 204_318_991, growth7d: 1.4, description: "Anyone with at least one resolved identity signal", updated: hours(0.2) },
  { id: "aud_002", name: "Repeat Visitors", type: "system", size: 38_412_004, growth7d: 2.1, description: "≥2 sessions in trailing 30 days", updated: hours(0.3) },
  { id: "aud_003", name: "Quiz Started", type: "event", size: 4_812_226, growth7d: 6.8, description: "Triggered quiz_started event", updated: hours(0.1) },
  { id: "aud_004", name: "Partial Leads", type: "funnel", size: 1_204_991, growth7d: 4.2, description: "Captured PII but no lead submission", updated: hours(0.5) },
  { id: "aud_005", name: "Leads", type: "funnel", size: 884_512, growth7d: 3.6, description: "Submitted a lead form", updated: hours(0.4) },
  { id: "aud_006", name: "SQL Audience", type: "funnel", size: 142_318, growth7d: 5.1, description: "Sales qualified — source of truth", updated: hours(0.6) },
  { id: "aud_007", name: "High Purchase Propensity", type: "propensity", size: 612_044, growth7d: 8.4, description: "Model score ≥ 75", updated: hours(1.2) },
  { id: "aud_008", name: "Do Not Contact", type: "consent", size: 9_233_881, growth7d: 0.3, description: "Unsubscribed across all channels", updated: hours(2) },
  { id: "aud_009", name: "Litigation Risk", type: "consent", size: 12_440, growth7d: -0.8, description: "Flagged via TCPA monitoring", updated: hours(3) },
  { id: "aud_010", name: "Homeowners — High Value", type: "custom", size: 2_104_812, growth7d: 1.9, description: "Custom audience: address verified + propensity ≥ 60", updated: hours(0.7) },
];

export const EVENT_MAPPINGS: EventMapping[] = [
  {
    id: "map_001",
    sourceEvent: "quiz_started",
    actions: [
      { type: "audience_add", target: "Quiz Started" },
      { type: "funnel_update", target: "Quiz Start" },
    ],
    enabled: true,
    triggered24h: 18_412,
  },
  {
    id: "map_002",
    sourceEvent: "partial_lead",
    actions: [
      { type: "audience_add", target: "Partial Leads" },
      { type: "funnel_update", target: "Partial Lead" },
      { type: "identity_update", target: "Increase confidence +12" },
    ],
    enabled: true,
    triggered24h: 7_281,
  },
  {
    id: "map_003",
    sourceEvent: "lead_submitted",
    actions: [
      { type: "audience_add", target: "Leads" },
      { type: "audience_remove", target: "Partial Leads" },
      { type: "funnel_update", target: "Lead" },
      { type: "identity_update", target: "Increase confidence +25" },
      { type: "trigger", target: "Welcome email sequence" },
    ],
    enabled: true,
    triggered24h: 4_104,
  },
  {
    id: "map_004",
    sourceEvent: "appointment_set",
    actions: [
      { type: "funnel_update", target: "Appointment" },
      { type: "trigger", target: "SMS reminder workflow" },
    ],
    enabled: true,
    triggered24h: 612,
  },
  {
    id: "map_005",
    sourceEvent: "sale",
    actions: [
      { type: "funnel_update", target: "Sale" },
      { type: "audience_remove", target: "High Purchase Propensity" },
      { type: "trigger", target: "Post-purchase nurture" },
    ],
    enabled: true,
    triggered24h: 184,
  },
];

export const DATA_SOURCES: DataSource[] = [
  { id: "src_001", name: "Website Tracker (web SDK)", category: "web", status: "healthy", events24h: 14_812_004, lastEvent: hours(0.001) },
  { id: "src_002", name: "Meta Ads", category: "ad", status: "healthy", events24h: 4_120_881, lastEvent: hours(0.01) },
  { id: "src_003", name: "Google Ads", category: "ad", status: "healthy", events24h: 6_220_412, lastEvent: hours(0.01) },
  { id: "src_004", name: "TikTok Ads", category: "ad", status: "degraded", events24h: 1_044_018, lastEvent: hours(0.4) },
  { id: "src_005", name: "Klaviyo (Email)", category: "email", status: "healthy", events24h: 2_412_881, lastEvent: hours(0.05) },
  { id: "src_006", name: "Twilio (SMS)", category: "sms", status: "healthy", events24h: 884_412, lastEvent: hours(0.02) },
  { id: "src_007", name: "Quiz Engine", category: "form", status: "healthy", events24h: 412_881, lastEvent: hours(0.01) },
  { id: "src_008", name: "Experian Partner Feed", category: "partner", status: "healthy", events24h: 12_004_881, lastEvent: hours(2.3) },
  { id: "src_009", name: "LiveRamp ATS", category: "identity", status: "healthy", events24h: 8_204_881, lastEvent: hours(0.5) },
  { id: "src_010", name: "Device Graph", category: "device", status: "down", events24h: 0, lastEvent: hours(36) },
];

export const FUNNEL_STAGES: { stage: FunnelStage; count: number }[] = [
  { stage: "Impression", count: 412_881_004 },
  { stage: "Visit", count: 88_412_004 },
  { stage: "Quiz Start", count: 4_812_226 },
  { stage: "Partial Lead", count: 1_204_991 },
  { stage: "Lead", count: 884_512 },
  { stage: "MQL", count: 412_881 },
  { stage: "SQL", count: 142_318 },
  { stage: "Appointment", count: 84_220 },
  { stage: "Meeting", count: 62_004 },
  { stage: "Opportunity", count: 38_412 },
  { stage: "Sale", count: 18_812 },
];

export const IDENTITY_METHODS = [
  { name: "Email (verified)", coverage: 78, usage: 92, finalDeterminant: 41, accuracy: 96, conflictRate: 1.2, confidence: 94, grade: "A+" as AccuracyGrade },
  { name: "Phone (verified)", coverage: 62, usage: 71, finalDeterminant: 22, accuracy: 93, conflictRate: 2.1, confidence: 90, grade: "A" as AccuracyGrade },
  { name: "Postal address", coverage: 84, usage: 88, finalDeterminant: 18, accuracy: 88, conflictRate: 4.6, confidence: 84, grade: "A" as AccuracyGrade },
  { name: "Cookie (1st party)", coverage: 91, usage: 96, finalDeterminant: 9, accuracy: 71, conflictRate: 12.4, confidence: 68, grade: "C" as AccuracyGrade },
  { name: "IP + User Agent", coverage: 99, usage: 99, finalDeterminant: 4, accuracy: 58, conflictRate: 22.1, confidence: 52, grade: "D" as AccuracyGrade },
  { name: "Geolocation", coverage: 41, usage: 32, finalDeterminant: 2, accuracy: 64, conflictRate: 18.0, confidence: 60, grade: "C" as AccuracyGrade },
  { name: "LiveRamp ATS", coverage: 38, usage: 44, finalDeterminant: 14, accuracy: 91, conflictRate: 3.2, confidence: 88, grade: "A" as AccuracyGrade },
  { name: "Form-derived", coverage: 22, usage: 28, finalDeterminant: 11, accuracy: 95, conflictRate: 1.6, confidence: 93, grade: "A+" as AccuracyGrade },
];

export function formatNum(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function timeAgo(iso: string): string {
  const diff = NOW_MS - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// =====================================================================
// Identity Console + Identity Graph — extended mock fixtures
// (Non-breaking additions. Everything above is untouched.)
// =====================================================================

export type UnifiedProfileType =
  | "personal"
  | "work"
  | "household"
  | "historical"
  | "partner"
  | "user_submitted"
  | "verified_lead"
  | "litigation"
  | "customer"
  | "custom";

export interface UnifiedPersonProfile {
  id: string;
  personId: string;
  type: UnifiedProfileType;
  label: string;
  fields: Record<string, string>;
  coherenceScore: number;
  isGolden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SourceProfile {
  id: string;
  source: string;
  partner?: string;
  receivedAt: string;
  fields: Record<string, string>;
  hash: string;
  personId?: string;
}

export type TimelineStepName =
  | "request_received"
  | "schema_validated"
  | "consent_checked"
  | "hygiene_check"
  | "signals_extracted"
  | "signals_normalized"
  | "signals_hashed"
  | "partner_enrichment"
  | "candidates_fetched"
  | "candidates_scored"
  | "deterministic_match"
  | "probabilistic_match"
  | "graph_traversal"
  | "policy_evaluated"
  | "conflict_check"
  | "fraud_check"
  | "decision_made"
  | "merge_evaluated"
  | "split_evaluated"
  | "profile_selected"
  | "profile_updated"
  | "audience_recalc"
  | "funnel_recalc"
  | "propensity_recalc"
  | "downstream_dispatch"
  | "webhook_fired"
  | "cache_invalidated"
  | "audit_written"
  | "response_returned"
  | "post_processing";

export type StepStatus =
  | "success"
  | "warning"
  | "failed"
  | "skipped"
  | "retried"
  | "pending"
  | "superseded"
  | "reversed";

export interface TimelineStep {
  name: TimelineStepName;
  worker: string;
  workerVersion: string;
  status: StepStatus;
  durationMs: number;
  candidateCount: number;
  warningCount: number;
  errorCount: number;
  retryCount: number;
  reasonCodes: string[];
  inputs: Record<string, string | number>;
  outputs: Record<string, string | number>;
}

export interface CandidateMatch {
  id: string;
  entityId: string;
  entityLabel: string;
  method: string;
  score: number;
  features: Record<string, number>;
  outcome: "won" | "lost";
  reason: string;
}

export interface IdentityScoreBundle {
  overall: number;
  entityMatch: number;
  unifiedAccuracy: number;
  coherence: number;
  fieldAccuracy: number;
  sourceReliability: number;
  identifierConsistency: number;
  relationshipConsistency: number;
  mergeConfidence: number;
  falseMergeRisk: number;
  falseSplitRisk: number;
  conflictRisk: number;
  fraudRisk: number;
  prepopSuitability: number;
  consentEligibility: number;
  dataFreshness: number;
  completeness: number;
  businessValue: number;
  revenueLift: number;
  verifiedLeadProb: number;
}

export type IdentityEventKind =
  | "resolve"
  | "enrich"
  | "merge"
  | "split"
  | "prepop"
  | "audit"
  | "reversal"
  | "rollback";

export interface IdentityEventRecord {
  id: string;
  kind: IdentityEventKind;
  personId: string;
  profileId?: string;
  requestId: string;
  traceId: string;
  timestamp: string;
  source: string;
  partner?: string;
  channel: "web" | "sms" | "email" | "call" | "partner" | "batch";
  campaign?: string;
  environment: "prod" | "staging";
  winningMethod: string;
  supportingMethods: string[];
  conflictingMethods: string[];
  decisionResult: "matched" | "created" | "merged" | "split" | "rejected" | "pending_review";
  decisionVersion: string;
  policyVersion: string;
  modelVersion: string;
  latencyMs: number;
  hygieneStatus: "clean" | "warning" | "quarantined";
  errorCount: number;
  warningCount: number;
  scores: IdentityScoreBundle;
  steps: TimelineStep[];
  candidates: CandidateMatch[];
  sourceProfileId?: string;
}

export interface IdentityDecision {
  id: string;
  eventId: string;
  personId: string;
  outcome: IdentityEventRecord["decisionResult"];
  winningMethod: string;
  reversed: boolean;
  reversedAt?: string;
  reversedBy?: string;
  downstreamRecalc: "pending" | "in_progress" | "complete" | "n/a";
  ts: string;
}

export interface IdentityIncident {
  id: string;
  ts: string;
  severity: "info" | "warning" | "error" | "critical";
  category: "schema" | "hygiene" | "consent" | "partner" | "model" | "timeout" | "conflict" | "fraud";
  message: string;
  affectedEventId?: string;
  affectedPersonId?: string;
  resolved: boolean;
}

export interface MergeSplitRecord {
  id: string;
  kind: "merge" | "split";
  ts: string;
  actor: "model" | "policy" | "manual";
  sourceIds: string[];
  resultIds: string[];
  evidence: string[];
  confidence: number;
  reversible: boolean;
  reversedAt?: string;
}

export interface GraphConflict {
  id: string;
  kind:
    | "shared_email_across_persons"
    | "phone_ping_pong"
    | "ip_cluster_anomaly"
    | "address_household_mismatch"
    | "device_fanout"
    | "rapid_signal_swap";
  severity: "low" | "medium" | "high" | "critical";
  involvedPersonIds: string[];
  signalValue: string;
  evidence: string[];
  suspectedFraud: boolean;
  detectedAt: string;
  reviewed: boolean;
}

export interface IdentityMethod {
  id: string;
  name: string;
  category: "deterministic" | "probabilistic" | "partner" | "graph";
  enabled: boolean;
  version: string;
  threshold: number;
  precision: number;
  recall: number;
  usage24h: number;
  docs: string;
}

export interface IdentityPolicy {
  id: string;
  name: string;
  domain: "merge" | "split" | "fraud" | "consent" | "hygiene" | "prepop";
  version: string;
  updated: string;
  rules: string[];
  enabled: boolean;
}

export interface OpsMetricBucket {
  hour: number;
  rps: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  freshnessLagS: number;
  costPer1k: number;
}

export interface WorkerHealth {
  worker: string;
  version: string;
  status: "healthy" | "degraded" | "down";
  p50: number;
  p95: number;
  errorRate: number;
}

// ---------- deterministic pseudo-random helper ----------
function hash32(seed: number): number {
  let s = (seed | 0) + 0x9e3779b9;
  s = Math.imul(s ^ (s >>> 16), 0x85ebca6b);
  s = Math.imul(s ^ (s >>> 13), 0xc2b2ae35);
  s ^= s >>> 16;
  return (s >>> 0);
}
function pct(seed: number, lo: number, hi: number): number {
  return lo + (hash32(seed) % (hi - lo + 1));
}
function pick<T>(arr: T[], seed: number): T {
  return arr[hash32(seed) % arr.length];
}

// ---------- UNIFIED PROFILES ----------
const PROFILE_TYPES: UnifiedProfileType[] = ["personal", "work", "household", "historical", "partner", "verified_lead", "customer"];

export const UNIFIED_PROFILES: UnifiedPersonProfile[] = PEOPLE.flatMap((p, idx) => {
  const count = 2 + (idx % 3);
  return Array.from({ length: count }).map((_, i) => {
    const type = PROFILE_TYPES[(idx + i) % PROFILE_TYPES.length];
    return {
      id: `upp_${p.id.slice(-6)}_${i}`,
      personId: p.id,
      type,
      label:
        type === "work"
          ? `${p.name} — Work`
          : type === "household"
          ? `${p.name} — Household`
          : type === "historical"
          ? `${p.name} — Historical`
          : type === "partner"
          ? `${p.name} — Partner-derived`
          : type === "verified_lead"
          ? `${p.name} — Verified Lead`
          : type === "customer"
          ? `${p.name} — Customer`
          : `${p.name} — Personal`,
      fields: {
        name: p.name,
        email: type === "work" ? `${p.name.split(" ")[0].toLowerCase()}@acme-corp.com` : p.primaryEmail,
        phone: p.primaryPhone,
        city: p.city,
        state: p.state,
      },
      coherenceScore: pct(idx * 7 + i, 62, 99),
      isGolden: i === 0,
      createdAt: hours(24 * 30 + idx),
      updatedAt: hours((idx + i) % 240),
    };
  });
});

// ---------- SOURCE PROFILES ----------
const SP_SOURCES = ["salesforce_crm", "hubspot_crm", "lead_form_v2", "meta_capi", "google_offline_conv", "experian_enrich", "public_record", "call_center_notes"];
export const SOURCE_PROFILES: SourceProfile[] = Array.from({ length: 72 }).map((_, i) => {
  const person = PEOPLE[i % PEOPLE.length];
  return {
    id: `sp_${i.toString(36).padStart(4, "0")}`,
    source: SP_SOURCES[i % SP_SOURCES.length],
    partner: i % 5 === 0 ? "experian" : i % 7 === 0 ? "liveramp" : undefined,
    receivedAt: hours((i * 3) % 336),
    fields: {
      email: person.primaryEmail,
      phone: person.primaryPhone,
      first_name: person.name.split(" ")[0],
      last_name: person.name.split(" ")[1] ?? "",
      city: person.city,
      state: person.state,
    },
    hash: `sha256:${hash32(i * 991).toString(16).padStart(8, "0")}`,
    personId: person.id,
  };
});

// ---------- METHODS + POLICIES ----------
export const IDENTITY_METHOD_CATALOG: IdentityMethod[] = [
  { id: "m_email_exact", name: "Email exact match", category: "deterministic", enabled: true, version: "v3.1", threshold: 100, precision: 99.4, recall: 61, usage24h: 4_120_881, docs: "Exact normalized (lowercased, dots stripped for gmail) email match." },
  { id: "m_phone_exact", name: "Phone E.164 exact", category: "deterministic", enabled: true, version: "v2.7", threshold: 100, precision: 98.9, recall: 44, usage24h: 2_004_881, docs: "Normalized E.164 phone number exact match." },
  { id: "m_addr_norm", name: "Address (USPS-normalized)", category: "deterministic", enabled: true, version: "v4.0", threshold: 95, precision: 95.1, recall: 51, usage24h: 1_812_004, docs: "USPS-normalized street + ZIP+4 match, tolerant of unit/apt variants." },
  { id: "m_name_dob", name: "Name + DOB fuzzy", category: "probabilistic", enabled: true, version: "v1.9", threshold: 82, precision: 91.3, recall: 34, usage24h: 604_881, docs: "Levenshtein + phonetic on name, exact DOB." },
  { id: "m_cookie_persist", name: "1P cookie chain", category: "probabilistic", enabled: true, version: "v2.2", threshold: 70, precision: 74.2, recall: 88, usage24h: 12_412_881, docs: "Persistent 1st-party cookie graph across sessions and subdomains." },
  { id: "m_device_fp", name: "Device fingerprint", category: "probabilistic", enabled: true, version: "v3.4", threshold: 78, precision: 82.1, recall: 71, usage24h: 8_204_881, docs: "Client-hint + canvas + font fingerprint clustering." },
  { id: "m_ip_ua", name: "IP + User Agent", category: "probabilistic", enabled: false, version: "v1.2", threshold: 60, precision: 58.4, recall: 92, usage24h: 0, docs: "Disabled by policy on 2026-05-14 due to elevated false-merge rate." },
  { id: "m_liveramp", name: "LiveRamp ATS", category: "partner", enabled: true, version: "v5.0", threshold: 90, precision: 96.8, recall: 42, usage24h: 3_004_881, docs: "LiveRamp Authenticated Traffic Solution identity envelope." },
  { id: "m_experian", name: "Experian enrichment", category: "partner", enabled: true, version: "v2.1", threshold: 88, precision: 93.4, recall: 38, usage24h: 1_812_881, docs: "Experian consumer identity match + demographic append." },
  { id: "m_graph_2hop", name: "Graph 2-hop signal path", category: "graph", enabled: true, version: "v1.4", threshold: 80, precision: 88.9, recall: 47, usage24h: 2_412_004, docs: "Match via shared signal within 2 graph hops (email → device → person)." },
  { id: "m_household_addr", name: "Household by address", category: "graph", enabled: true, version: "v1.0", threshold: 75, precision: 79.1, recall: 66, usage24h: 812_004, docs: "Cluster persons sharing a normalized address; used only for household profiles." },
  { id: "m_partner_prob", name: "Partner probabilistic blend", category: "partner", enabled: true, version: "v0.9-beta", threshold: 72, precision: 71.2, recall: 74, usage24h: 412_881, docs: "Blend of 3 partner probabilistic identities. Behind feature flag." },
];

export const IDENTITY_POLICIES: IdentityPolicy[] = [
  { id: "pol_merge_v3", name: "Conservative merge policy", domain: "merge", version: "v3.2", updated: hours(48), enabled: true, rules: ["Require ≥2 deterministic signals OR 1 deterministic + partner", "Reject merge if any conflicting phone in last 30d", "Manual review for accounts >$50k LTV"] },
  { id: "pol_split_v2", name: "Liberal split policy", domain: "split", version: "v2.0", updated: hours(120), enabled: true, rules: ["Split on address change + email change within 14d", "Split on new SSN last-4 for lending vertical"] },
  { id: "pol_fraud_v1", name: "Fraud detection", domain: "fraud", version: "v1.6", updated: hours(72), enabled: true, rules: ["Flag device fanout >20 persons in 7d", "Flag IP cluster >50 unauthenticated sessions in 1h", "Escalate rapid signal swap patterns"] },
  { id: "pol_consent_v4", name: "Consent enforcement", domain: "consent", version: "v4.0", updated: hours(240), enabled: true, rules: ["No CRM sync without platform consent", "SMS destinations require sms consent grant timestamp", "Honor unsubscribe within 4h"] },
  { id: "pol_hygiene_v2", name: "Data hygiene", domain: "hygiene", version: "v2.4", updated: hours(300), enabled: true, rules: ["Quarantine role emails (info@, sales@) from person merge", "Drop obvious test data (john doe, 555-0100)", "Warn on freshness lag >72h"] },
  { id: "pol_prepop_v1", name: "Form pre-population", domain: "prepop", version: "v1.3", updated: hours(400), enabled: true, rules: ["Only pre-pop fields with score ≥85", "Never pre-pop SSN/DOB from probabilistic match", "Log every pre-pop for audit"] },
];

// ---------- IDENTITY EVENTS ----------
const STEP_CATALOG: TimelineStepName[] = [
  "request_received", "schema_validated", "consent_checked", "hygiene_check",
  "signals_extracted", "signals_normalized", "signals_hashed", "partner_enrichment",
  "candidates_fetched", "candidates_scored", "deterministic_match", "probabilistic_match",
  "graph_traversal", "policy_evaluated", "conflict_check", "fraud_check",
  "decision_made", "merge_evaluated", "split_evaluated", "profile_selected",
  "profile_updated", "audience_recalc", "funnel_recalc", "propensity_recalc",
  "downstream_dispatch", "webhook_fired", "cache_invalidated", "audit_written",
  "response_returned", "post_processing",
];
const CHANNELS: IdentityEventRecord["channel"][] = ["web", "sms", "email", "call", "partner", "batch"];
const KINDS: IdentityEventKind[] = ["resolve", "enrich", "merge", "split", "prepop", "audit"];
const OUTCOMES: IdentityEventRecord["decisionResult"][] = ["matched", "matched", "matched", "created", "merged", "split", "rejected", "pending_review"];
const CAMPAIGNS = ["spring_promo_2026", "brand_awareness_q2", "reactivation_v3", "lead_gen_hvac", undefined];
const PARTNERS = [undefined, "meta", "liveramp", "experian", "google", "tiktok"];

function buildScores(seed: number): IdentityScoreBundle {
  const base = pct(seed, 60, 98);
  return {
    overall: base,
    entityMatch: pct(seed + 1, 55, 99),
    unifiedAccuracy: pct(seed + 2, 60, 98),
    coherence: pct(seed + 3, 50, 99),
    fieldAccuracy: pct(seed + 4, 60, 98),
    sourceReliability: pct(seed + 5, 55, 96),
    identifierConsistency: pct(seed + 6, 60, 99),
    relationshipConsistency: pct(seed + 7, 55, 95),
    mergeConfidence: pct(seed + 8, 40, 98),
    falseMergeRisk: pct(seed + 9, 1, 30),
    falseSplitRisk: pct(seed + 10, 1, 25),
    conflictRisk: pct(seed + 11, 0, 40),
    fraudRisk: pct(seed + 12, 0, 22),
    prepopSuitability: pct(seed + 13, 40, 99),
    consentEligibility: pct(seed + 14, 50, 100),
    dataFreshness: pct(seed + 15, 55, 99),
    completeness: pct(seed + 16, 50, 98),
    businessValue: pct(seed + 17, 30, 96),
    revenueLift: pct(seed + 18, 20, 90),
    verifiedLeadProb: pct(seed + 19, 30, 96),
  };
}

function buildSteps(seed: number, kind: IdentityEventKind): TimelineStep[] {
  const relevant = STEP_CATALOG.filter((s) => {
    if (kind === "prepop") return !["merge_evaluated", "split_evaluated", "audience_recalc"].includes(s);
    if (kind === "audit") return ["request_received", "audit_written", "response_returned"].includes(s);
    return true;
  });
  return relevant.map((name, i) => {
    const roll = hash32(seed * 31 + i);
    const status: StepStatus =
      roll % 47 === 0 ? "failed" :
      roll % 23 === 0 ? "warning" :
      roll % 17 === 0 ? "retried" :
      roll % 53 === 0 ? "skipped" : "success";
    return {
      name,
      worker: `w-${name.split("_")[0]}`,
      workerVersion: `v${1 + (roll % 5)}.${roll % 12}`,
      status,
      durationMs: 1 + (roll % 180),
      candidateCount: name === "candidates_fetched" ? 1 + (roll % 12) : 0,
      warningCount: status === "warning" ? 1 : 0,
      errorCount: status === "failed" ? 1 : 0,
      retryCount: status === "retried" ? 1 + (roll % 3) : 0,
      reasonCodes:
        status === "failed" ? ["E_TIMEOUT", "E_UPSTREAM"] :
        status === "warning" ? ["W_LOW_CONF"] :
        status === "retried" ? ["R_TRANSIENT"] : [],
      inputs: { requestBytes: 200 + (roll % 800) },
      outputs: { producedBytes: 100 + (roll % 500) },
    };
  });
}

function buildCandidates(seed: number, person: Person): CandidateMatch[] {
  const count = 3 + (hash32(seed) % 4);
  const methods = ["m_email_exact", "m_phone_exact", "m_cookie_persist", "m_device_fp", "m_liveramp", "m_graph_2hop"];
  return Array.from({ length: count }).map((_, i) => {
    const won = i === 0;
    const score = won ? pct(seed + i, 88, 99) : pct(seed + i, 40, 87);
    return {
      id: `cand_${seed}_${i}`,
      entityId: won ? person.id : `prs_alt_${hash32(seed * 7 + i).toString(36).slice(0, 6)}`,
      entityLabel: won ? person.name : `Candidate ${i + 1}`,
      method: methods[i % methods.length],
      score,
      features: {
        email: pct(seed + i * 3, 40, 100),
        phone: pct(seed + i * 5, 30, 100),
        address: pct(seed + i * 7, 20, 100),
        cookie: pct(seed + i * 11, 20, 100),
      },
      outcome: won ? "won" : "lost",
      reason: won
        ? "Highest composite score; passed policy thresholds"
        : i === 1
        ? "Below merge threshold (82 < 90)"
        : i === 2
        ? "Conflicting phone signal (Δ<30d)"
        : "Insufficient supporting signals",
    };
  });
}

export const IDENTITY_EVENTS: IdentityEventRecord[] = Array.from({ length: 210 }).map((_, i) => {
  const person = PEOPLE[i % PEOPLE.length];
  const kind = KINDS[hash32(i) % KINDS.length];
  const scores = buildScores(i + 1);
  const steps = buildSteps(i + 1, kind);
  const candidates = buildCandidates(i + 1, person);
  const errorCount = steps.reduce((a, s) => a + s.errorCount, 0);
  const warningCount = steps.reduce((a, s) => a + s.warningCount, 0);
  const outcome = OUTCOMES[hash32(i * 3) % OUTCOMES.length];
  return {
    id: `ide_${(1_000_000 + i).toString(36)}`,
    kind,
    personId: person.id,
    profileId: `upp_${person.id.slice(-6)}_0`,
    requestId: `req_${hash32(i * 11).toString(36).padStart(8, "0")}`,
    traceId: `trc_${hash32(i * 17).toString(36).padStart(10, "0")}`,
    timestamp: hours((i * 0.4) % 240),
    source: pick(SOURCES, i),
    partner: PARTNERS[i % PARTNERS.length],
    channel: CHANNELS[i % CHANNELS.length],
    campaign: CAMPAIGNS[i % CAMPAIGNS.length],
    environment: i % 20 === 0 ? "staging" : "prod",
    winningMethod: candidates[0].method,
    supportingMethods: candidates.slice(1, 3).map((c) => c.method),
    conflictingMethods: candidates.filter((c) => c.outcome === "lost" && c.score > 70).map((c) => c.method),
    decisionResult: outcome,
    decisionVersion: "v3.2",
    policyVersion: "v4.0",
    modelVersion: `mdl-${1 + (i % 4)}.${i % 12}`,
    latencyMs: steps.reduce((a, s) => a + s.durationMs, 0),
    hygieneStatus: i % 31 === 0 ? "quarantined" : i % 11 === 0 ? "warning" : "clean",
    errorCount,
    warningCount,
    scores,
    steps,
    candidates,
    sourceProfileId: SOURCE_PROFILES[i % SOURCE_PROFILES.length].id,
  };
});

// ---------- DECISIONS ----------
export const IDENTITY_DECISIONS: IdentityDecision[] = IDENTITY_EVENTS.slice(0, 140).map((e, i) => {
  const reversed = i % 7 === 3;
  return {
    id: `dec_${(1000 + i).toString(36)}`,
    eventId: e.id,
    personId: e.personId,
    outcome: e.decisionResult,
    winningMethod: e.winningMethod,
    reversed,
    reversedAt: reversed ? hours((i % 20) + 1) : undefined,
    reversedBy: reversed ? (i % 2 === 0 ? "sarah.kim@resolve.io" : "auto-rollback:pol_merge_v3") : undefined,
    downstreamRecalc: reversed ? (i % 3 === 0 ? "complete" : "in_progress") : "n/a",
    ts: e.timestamp,
  };
});

// ---------- INCIDENTS / ERRORS ----------
const INC_MESSAGES: Record<IdentityIncident["category"], string[]> = {
  schema: ["Missing required field: email", "Unrecognized enum value in channel"],
  hygiene: ["Role email detected (sales@)", "Test-data pattern matched"],
  consent: ["SMS sync blocked — no sms consent grant", "Unsubscribe not honored within SLA"],
  partner: ["LiveRamp latency > 2000ms", "Experian returned 502"],
  model: ["Model confidence calibration drift > 3σ", "Feature `device_fp` missing at inference"],
  timeout: ["candidates_scored exceeded 500ms budget", "webhook_fired dropped after 3 retries"],
  conflict: ["Two persons share verified phone", "Address household mismatch"],
  fraud: ["Device fanout >25 in 24h", "IP cluster of 87 unauth sessions"],
};
const INC_CATEGORIES = Object.keys(INC_MESSAGES) as IdentityIncident["category"][];
const SEVS: IdentityIncident["severity"][] = ["info", "warning", "warning", "error", "error", "critical"];
export const IDENTITY_INCIDENTS: IdentityIncident[] = Array.from({ length: 48 }).map((_, i) => {
  const cat = INC_CATEGORIES[i % INC_CATEGORIES.length];
  const msgs = INC_MESSAGES[cat];
  return {
    id: `inc_${(500 + i).toString(36)}`,
    ts: hours((i * 1.3) % 168),
    severity: SEVS[i % SEVS.length],
    category: cat,
    message: msgs[i % msgs.length],
    affectedEventId: IDENTITY_EVENTS[i % IDENTITY_EVENTS.length].id,
    affectedPersonId: PEOPLE[i % PEOPLE.length].id,
    resolved: i % 4 !== 0,
  };
});

// ---------- MERGE / SPLIT HISTORY ----------
export const MERGE_SPLIT_HISTORY: MergeSplitRecord[] = Array.from({ length: 34 }).map((_, i) => {
  const kind: "merge" | "split" = i % 3 === 0 ? "split" : "merge";
  const a = PEOPLE[i % PEOPLE.length];
  const b = PEOPLE[(i + 3) % PEOPLE.length];
  return {
    id: `mh_${(200 + i).toString(36)}`,
    kind,
    ts: hours((i * 6) % 720),
    actor: i % 5 === 0 ? "manual" : i % 3 === 0 ? "policy" : "model",
    sourceIds: kind === "merge" ? [a.id, b.id] : [a.id],
    resultIds: kind === "merge" ? [a.id] : [a.id, `prs_split_${i}`],
    evidence:
      kind === "merge"
        ? ["email_exact:" + a.primaryEmail, "phone_exact:" + a.primaryPhone, "device_fp:0.92"]
        : ["address_change:14d", "new_phone_verified", "consent_reset"],
    confidence: pct(i * 5, 70, 99),
    reversible: i % 8 !== 0,
    reversedAt: i % 11 === 0 ? hours((i % 6) + 1) : undefined,
  };
});

// ---------- GRAPH CONFLICTS ----------
const CONFLICT_KINDS: GraphConflict["kind"][] = [
  "shared_email_across_persons", "phone_ping_pong", "ip_cluster_anomaly",
  "address_household_mismatch", "device_fanout", "rapid_signal_swap",
];
export const GRAPH_CONFLICTS: GraphConflict[] = Array.from({ length: 28 }).map((_, i) => {
  const kind = CONFLICT_KINDS[i % CONFLICT_KINDS.length];
  const involved = [PEOPLE[i % PEOPLE.length].id, PEOPLE[(i + 2) % PEOPLE.length].id];
  if (i % 4 === 0) involved.push(PEOPLE[(i + 5) % PEOPLE.length].id);
  const sev: GraphConflict["severity"] = i % 9 === 0 ? "critical" : i % 5 === 0 ? "high" : i % 3 === 0 ? "medium" : "low";
  return {
    id: `gcf_${(300 + i).toString(36)}`,
    kind,
    severity: sev,
    involvedPersonIds: involved,
    signalValue:
      kind === "shared_email_across_persons" ? `shared${i}@example.com` :
      kind === "phone_ping_pong" ? `+1 (512) 555-${1000 + i}` :
      kind === "ip_cluster_anomaly" ? `73.${i % 255}.14.${(i * 3) % 255}` :
      kind === "address_household_mismatch" ? `${100 + i} Elm St` :
      kind === "device_fanout" ? `dev_fp_${hash32(i).toString(16).slice(0, 8)}` :
      `swap_pattern_${i}`,
    evidence: [
      `${involved.length} persons linked`,
      `Detected via ${kind === "device_fanout" ? "device fingerprint" : "signal graph"}`,
      `Confidence ${pct(i * 3, 60, 98)}%`,
    ],
    suspectedFraud: sev === "critical" || sev === "high",
    detectedAt: hours((i * 4) % 168),
    reviewed: i % 6 === 0,
  };
});

// ---------- OPS METRICS ----------
export const OPS_METRICS_24H: OpsMetricBucket[] = Array.from({ length: 24 }).map((_, h) => {
  const base = 400 + (Math.sin(h / 24 * Math.PI * 2) + 1) * 800;
  return {
    hour: h,
    rps: Math.round(base + (hash32(h * 7) % 200)),
    p50: 22 + (hash32(h * 3) % 12),
    p95: 88 + (hash32(h * 5) % 45),
    p99: 180 + (hash32(h * 11) % 120),
    errorRate: 0.02 + ((hash32(h * 13) % 30) / 1000),
    freshnessLagS: 4 + (hash32(h * 17) % 22),
    costPer1k: 0.14 + ((hash32(h * 19) % 40) / 1000),
  };
});

export const WORKER_HEALTH: WorkerHealth[] = [
  "w-request", "w-schema", "w-signals", "w-partner", "w-candidates", "w-decision",
  "w-merge", "w-audience", "w-webhook", "w-audit",
].map((w, i) => ({
  worker: w,
  version: `v${1 + (i % 4)}.${i % 12}`,
  status: i === 6 ? "degraded" : i === 9 ? "down" : "healthy",
  p50: 12 + (i * 3),
  p95: 40 + (i * 8),
  errorRate: 0.001 * (1 + (i % 4)),
}));

// ---------- IDENTITY ACCURACY (decision-level) ----------
export const IDENTITY_ACCURACY_METHODS = IDENTITY_METHOD_CATALOG.slice(0, 8).map((m, i) => ({
  method: m.name,
  precision: m.precision,
  recall: m.recall,
  falseMerge: 0.5 + (i * 0.4),
  falseSplit: 0.3 + (i * 0.2),
  labeled: 1200 + i * 320,
}));

export const IDENTITY_CALIBRATION_BINS = Array.from({ length: 10 }).map((_, i) => ({
  predicted: (i + 1) * 10,
  actual: Math.min(100, (i + 1) * 10 + (hash32(i * 91) % 12) - 6),
  count: 240 + (hash32(i * 51) % 400),
}));


// =====================================================================
// IDENTITY GRAPH v2 — Consolidated Profiles · Golden Records · Signal Linkage
// =====================================================================

export type HygieneStatus = "clean" | "minor_issues" | "dirty" | "very_dirty" | "under_review" | "suppressed";

export type IndividualProfileType = UnifiedProfileType;

export type GoldenRecordPurpose =
  | "prepopulation"
  | "reactivation"
  | "personal"
  | "work"
  | "customer_support"
  | "full_investigation";

export type SignalKind =
  | "email" | "phone" | "address" | "cookie" | "device"
  | "maid" | "ip" | "session" | "caller_id" | "click_id" | "domain" | "external_id";

export type EntityKind = "person" | "household" | "company" | "place" | "legal_case";

export type SharingClass =
  | "household" | "company" | "registered_address" | "historical_reuse"
  | "shared_business_phone" | "shared_office_device"
  | "unexplained" | "suspicious" | "confirmed_conflict";

export interface ComponentScores {
  overall: number;
  profileAccuracy: number;
  profileCoherence: number;
  fieldAccuracy: number;
  sourceReliability: number;
  identifierConsistency: number;
  relationshipConsistency: number;
  matchProbability: number;
  mergeProbability: number;
  falseMergeRisk: number;
  falseSplitRisk: number;
  conflictRisk: number;
  fraudRisk: number;
  profileMixingRisk: number;
  dataFreshness: number;
  goldenRecordSuitability: number;
  prepopSuitability: number;
  revenueLiftPrediction: number;
}

export interface ConsolidatedProfile {
  id: string;
  personId: string;
  label: string;
  hygiene: HygieneStatus;
  scores: ComponentScores;
  individualProfileIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface IndividualProfile {
  id: string;
  consolidatedId: string;
  personId: string;
  type: IndividualProfileType;
  label: string;
  fields: Record<string, string>;
  sourceProfileIds: string[];
  status: "current" | "historical";
  hygiene: HygieneStatus;
  scores: ComponentScores;
  conflictCount: number;
  completeness: number;
  updatedAt: string;
}

export interface GoldenRecordField {
  key: string;
  value: string;
  selectedFromIndividualProfileId: string;
  selectedFromSourceProfileId: string;
  fieldAccuracy: number;
  rule: string;
  alternatives: { value: string; fromIndividualProfileId: string; fromSourceProfileId: string; fieldAccuracy: number; rejectionReason: string }[];
  warning?: string;
}

export interface GoldenRecord {
  id: string;
  personId: string;
  consolidatedId: string;
  purpose: GoldenRecordPurpose;
  fields: GoldenRecordField[];
  suitability: number;
  builtAt: string;
  warnings: string[];
}

export interface EntityRelationship {
  id: string;
  from: string; // entity id (person/household/company/place/case)
  fromKind: EntityKind;
  to: string;
  toKind: EntityKind;
  type:
    | "resides_at" | "works_at" | "works_from" | "member_of"
    | "operates_at" | "registered_at" | "related_to"
    | "possible_duplicate" | "likely_same_person"
    | "party_to_case";
  confidence: number;
  status: "current" | "historical";
  firstObserved: string;
  lastObserved: string;
  conflict?: boolean;
  decisionId?: string;
}

export interface EntityNode {
  id: string;
  kind: EntityKind;
  label: string;
  sub?: string;
  personId?: string; // for person kind
}

export interface SignalLinkageEntry {
  id: string;
  kind: SignalKind;
  value: string;
  connectedPersonIds: string[];
  connectedProfileIds: string[];
  connectedHouseholdIds: string[];
  connectedCompanyIds: string[];
  sourceProfileIds: string[];
  identityEventIds: string[];
  conflictCount: number;
  sharingClass: SharingClass;
  confidence: number;
  firstObserved: string;
  lastObserved: string;
}

export interface GraphTimelineChange {
  id: string;
  ts: string;
  kind: "added" | "removed" | "updated" | "merge" | "split" | "gr_change" | "conflict_open" | "conflict_resolved";
  target: string;
  targetKind: string;
  summary: string;
  decisionId?: string;
}

// -------- deterministic seeded builders --------

function scoreBundle(seed: number, hygiene: HygieneStatus): ComponentScores {
  const base = hygiene === "clean" ? 88 : hygiene === "minor_issues" ? 78 : hygiene === "dirty" ? 62 : hygiene === "very_dirty" ? 44 : 70;
  const drift = (n: number) => Math.max(10, Math.min(99, base + ((hash32(seed * 13 + n) % 14) - 7)));
  const risk = (n: number) => Math.max(0, Math.min(60, (100 - base) / 3 + (hash32(seed * 17 + n) % 12)));
  return {
    overall: drift(1),
    profileAccuracy: drift(2),
    profileCoherence: drift(3),
    fieldAccuracy: drift(4),
    sourceReliability: drift(5),
    identifierConsistency: drift(6),
    relationshipConsistency: drift(7),
    matchProbability: drift(8),
    mergeProbability: drift(9),
    falseMergeRisk: risk(10),
    falseSplitRisk: risk(11),
    conflictRisk: risk(12),
    fraudRisk: risk(13),
    profileMixingRisk: risk(14),
    dataFreshness: drift(15),
    goldenRecordSuitability: drift(16),
    prepopSuitability: drift(17),
    revenueLiftPrediction: drift(18),
  };
}

const HYG_CYCLE: HygieneStatus[] = ["clean", "clean", "minor_issues", "dirty", "clean", "minor_issues", "very_dirty", "clean"];

// Households: one per every third person becomes a "head", others may share
export const HOUSEHOLDS: EntityNode[] = PEOPLE.filter((_, i) => i % 4 === 0).map((p, i) => ({
  id: `hh_${i.toString(36).padStart(3, "0")}`,
  kind: "household",
  label: `${p.name.split(" ").slice(-1)[0]} Household`,
  sub: `${p.city}, ${p.state}`,
}));

export const COMPANIES: EntityNode[] = ["Acme Corp", "Northwind Trading", "Contoso Analytics", "Fabrikam Health", "Globex Financial", "Initech Systems"].map((name, i) => ({
  id: `co_${i.toString(36).padStart(3, "0")}`,
  kind: "company",
  label: name,
  sub: pick(["Austin, TX", "Denver, CO", "Seattle, WA", "Miami, FL", "Boston, MA", "Chicago, IL"], i * 17),
}));

export const PLACES: EntityNode[] = PEOPLE.map((p) => ({
  id: p.placeId,
  kind: "place",
  label: `${p.city}, ${p.state}`,
  sub: p.placeId,
}));

export const LEGAL_CASES: EntityNode[] = [
  { id: "case_001", kind: "legal_case", label: "TCPA Class Action #22-8811", sub: "N.D. Cal." },
  { id: "case_002", kind: "legal_case", label: "Data Retention Complaint #23-0142", sub: "S.D.N.Y." },
];

export const CONSOLIDATED_PROFILES: ConsolidatedProfile[] = PEOPLE.map((p, idx) => {
  const hygiene = HYG_CYCLE[idx % HYG_CYCLE.length];
  return {
    id: `cp_${p.id.slice(-6)}`,
    personId: p.id,
    label: `${p.name} — Consolidated`,
    hygiene,
    scores: scoreBundle(idx * 31, hygiene),
    individualProfileIds: [], // filled after INDIVIDUAL_PROFILES built
    createdAt: hours(24 * 90 + idx),
    updatedAt: hours(idx % 240),
  };
});

const IP_TYPES_BY_INDEX: IndividualProfileType[][] = [
  ["personal", "work"],
  ["personal", "work", "household"],
  ["personal", "verified_lead"],
  ["personal", "work", "historical"],
  ["personal", "household", "user_submitted"],
  ["personal", "work", "partner"],
];

export const INDIVIDUAL_PROFILES: IndividualProfile[] = CONSOLIDATED_PROFILES.flatMap((cp, cIdx) => {
  const p = PEOPLE.find((pp) => pp.id === cp.personId)!;
  const types = IP_TYPES_BY_INDEX[cIdx % IP_TYPES_BY_INDEX.length];
  return types.map((t, i): IndividualProfile => {
    const seed = cIdx * 100 + i;
    const status: "current" | "historical" = t === "historical" ? "historical" : "current";
    const hygiene: HygieneStatus = t === "historical" ? "dirty" : cp.hygiene;
    const email =
      t === "work"
        ? `${p.name.split(" ")[0].toLowerCase()}.${p.name.split(" ")[1]?.toLowerCase() ?? "x"}@acme-corp.com`
        : t === "verified_lead"
        ? `${p.name.split(" ")[0].toLowerCase()}${p.id.slice(-3)}@gmail.com`
        : p.primaryEmail;
    const phone =
      t === "work"
        ? `+1${pct(seed, 200, 999)}5550${pct(seed + 1, 100, 999)}`
        : t === "household"
        ? p.primaryPhone // shared household
        : p.primaryPhone;
    return {
      id: `ip_${cp.id.slice(3)}_${t.slice(0, 4)}${i}`,
      consolidatedId: cp.id,
      personId: cp.personId,
      type: t,
      label: t === "personal" ? `${p.name} — Personal`
        : t === "work" ? `${p.name} — Work (Acme Corp)`
        : t === "household" ? `${p.name.split(" ").slice(-1)[0]} Household — ${p.name}`
        : t === "historical" ? `${p.name} — Historical (${p.city})`
        : t === "verified_lead" ? `${p.name} — Verified Lead`
        : t === "user_submitted" ? `${p.name} — Self-submitted`
        : t === "partner" ? `${p.name} — Partner-derived`
        : `${p.name} — ${t}`,
      fields: {
        name: p.name,
        email,
        phone,
        address: `${pct(seed, 100, 9999)} ${pick(["Oak", "Maple", "Cedar", "Pine", "Elm"], seed)} St`,
        city: t === "historical" ? pick(["Austin", "Denver", "Portland"], seed) : p.city,
        state: p.state,
        company: t === "work" ? "Acme Corp" : "—",
        title: t === "work" ? pick(["Sr. Analyst", "VP Marketing", "Product Lead", "Engineer"], seed) : "—",
      },
      sourceProfileIds: SOURCE_PROFILES.filter((sp) => sp.personId === cp.personId).slice(i, i + 2).map((sp) => sp.id),
      status,
      hygiene,
      scores: scoreBundle(seed * 7, hygiene),
      conflictCount: pct(seed, 0, 3),
      completeness: pct(seed, 55, 99),
      updatedAt: hours((seed % 200)),
    };
  });
});

// Backfill CONSOLIDATED_PROFILES individualProfileIds
CONSOLIDATED_PROFILES.forEach((cp) => {
  cp.individualProfileIds = INDIVIDUAL_PROFILES.filter((ip) => ip.consolidatedId === cp.id).map((ip) => ip.id);
});

const GR_PURPOSES: GoldenRecordPurpose[] = ["prepopulation", "reactivation", "personal", "work", "customer_support", "full_investigation"];
const GR_FIELDS_BY_PURPOSE: Record<GoldenRecordPurpose, string[]> = {
  prepopulation: ["name", "email", "phone", "address", "city", "state"],
  reactivation: ["name", "email", "phone", "consent_channel"],
  personal: ["name", "email", "phone", "address", "city", "state"],
  work: ["name", "email", "phone", "company", "title"],
  customer_support: ["name", "email", "phone", "address"],
  full_investigation: ["name", "email", "phone", "address", "company", "title", "city", "state"],
};

export const GOLDEN_RECORDS: GoldenRecord[] = CONSOLIDATED_PROFILES.flatMap((cp, cIdx) => {
  const ips = INDIVIDUAL_PROFILES.filter((ip) => ip.consolidatedId === cp.id);
  const purposes: GoldenRecordPurpose[] = [GR_PURPOSES[cIdx % 6], GR_PURPOSES[(cIdx + 2) % 6]];
  return purposes.map((purpose, pi): GoldenRecord => {
    const keys = GR_FIELDS_BY_PURPOSE[purpose];
    const fields: GoldenRecordField[] = keys.map((k, fi) => {
      const preferredIP = purpose === "work" ? (ips.find((ip) => ip.type === "work") ?? ips[0])
        : purpose === "personal" ? (ips.find((ip) => ip.type === "personal") ?? ips[0])
        : ips[fi % ips.length];
      const alt = ips.filter((ip) => ip.id !== preferredIP.id).slice(0, 2);
      const seed = cIdx * 40 + pi * 10 + fi;
      const val = preferredIP.fields[k] ?? preferredIP.fields.name;
      const warning =
        (purpose === "prepopulation" && k === "email" && preferredIP.type === "work") ? "Work email selected for personal-flow prepopulation"
        : (purpose === "personal" && k === "phone" && preferredIP.type === "household") ? "Shared household phone selected"
        : (k === "address" && preferredIP.type === "historical") ? "Historical address may be stale"
        : undefined;
      return {
        key: k,
        value: val,
        selectedFromIndividualProfileId: preferredIP.id,
        selectedFromSourceProfileId: preferredIP.sourceProfileIds[0] ?? "sp_0000",
        fieldAccuracy: pct(seed, 70, 99),
        rule: purpose === "prepopulation" ? "highest_field_accuracy · consent_ok" : purpose === "work" ? "prefer_work_profile · recency<30d" : "prefer_personal_profile · verified_source",
        alternatives: alt.map((a, ai) => ({
          value: a.fields[k] ?? "—",
          fromIndividualProfileId: a.id,
          fromSourceProfileId: a.sourceProfileIds[0] ?? "sp_0000",
          fieldAccuracy: pct(seed * 3 + ai, 40, 90),
          rejectionReason: ai === 0 ? "lower recency" : "lower source reliability",
        })),
        warning,
      };
    });
    const warnings = fields.filter((f) => f.warning).map((f) => `${f.key}: ${f.warning}`);
    return {
      id: `gr_${cp.id.slice(3)}_${purpose.slice(0, 4)}${pi}`,
      personId: cp.personId,
      consolidatedId: cp.id,
      purpose,
      fields,
      suitability: pct(cIdx * 9 + pi * 3, 60, 99),
      builtAt: hours(pi * 6 + cIdx),
      warnings,
    };
  });
});

// Entity relationships (real-world entities only — no signals)
export const ENTITY_RELATIONSHIPS: EntityRelationship[] = (() => {
  const rels: EntityRelationship[] = [];
  PEOPLE.forEach((p, i) => {
    // resides_at
    rels.push({
      id: `rel_${p.id.slice(-4)}_r`,
      from: p.id, fromKind: "person",
      to: p.placeId, toKind: "place",
      type: "resides_at", confidence: pct(i, 85, 99), status: "current",
      firstObserved: hours(24 * 200), lastObserved: hours(i % 96),
    });
    // works_at
    const co = COMPANIES[i % COMPANIES.length];
    rels.push({
      id: `rel_${p.id.slice(-4)}_w`,
      from: p.id, fromKind: "person",
      to: co.id, toKind: "company",
      type: "works_at", confidence: pct(i * 3, 70, 96), status: "current",
      firstObserved: hours(24 * 120), lastObserved: hours((i * 3) % 96),
    });
    // household membership every 4th
    if (i % 4 === 0) {
      const hh = HOUSEHOLDS[Math.floor(i / 4) % HOUSEHOLDS.length];
      rels.push({
        id: `rel_${p.id.slice(-4)}_hh`,
        from: p.id, fromKind: "person",
        to: hh.id, toKind: "household",
        type: "member_of", confidence: 94, status: "current",
        firstObserved: hours(24 * 300), lastObserved: hours(i % 96),
      });
      rels.push({
        id: `rel_${hh.id}_place`,
        from: hh.id, fromKind: "household",
        to: p.placeId, toKind: "place",
        type: "resides_at", confidence: 96, status: "current",
        firstObserved: hours(24 * 300), lastObserved: hours(24),
      });
    }
    // possible duplicate every 7th
    if (i % 7 === 3 && PEOPLE[i + 1]) {
      rels.push({
        id: `rel_${p.id.slice(-4)}_dup`,
        from: p.id, fromKind: "person",
        to: PEOPLE[i + 1].id, toKind: "person",
        type: "possible_duplicate", confidence: pct(i * 11, 55, 78), status: "current",
        firstObserved: hours(i * 4), lastObserved: hours(i),
        conflict: true,
      });
    }
    // related_to
    if (i > 0 && i % 3 === 0) {
      rels.push({
        id: `rel_${p.id.slice(-4)}_rel`,
        from: p.id, fromKind: "person",
        to: PEOPLE[i - 1].id, toKind: "person",
        type: "related_to", confidence: pct(i * 5, 60, 90), status: "current",
        firstObserved: hours(24 * 60), lastObserved: hours(i),
      });
    }
  });
  // companies registered/operate at places
  COMPANIES.forEach((c, i) => {
    rels.push({
      id: `rel_${c.id}_op`,
      from: c.id, fromKind: "company",
      to: PLACES[i % PLACES.length].id, toKind: "place",
      type: "operates_at", confidence: 95, status: "current",
      firstObserved: hours(24 * 400), lastObserved: hours(2),
    });
    rels.push({
      id: `rel_${c.id}_reg`,
      from: c.id, fromKind: "company",
      to: PLACES[(i + 3) % PLACES.length].id, toKind: "place",
      type: "registered_at", confidence: 99, status: "current",
      firstObserved: hours(24 * 800), lastObserved: hours(24 * 40),
    });
  });
  return rels;
})();

// Signal linkage — canonical signals across the population
export const SIGNAL_LINKAGE: SignalLinkageEntry[] = (() => {
  const seen = new Map<string, SignalLinkageEntry>();
  PEOPLE.forEach((p, i) => {
    p.signals.forEach((s, si) => {
      const key = `${s.type}::${s.value}`;
      const existing = seen.get(key);
      if (existing) {
        if (!existing.connectedPersonIds.includes(p.id)) existing.connectedPersonIds.push(p.id);
        existing.conflictCount += 1;
        existing.sharingClass =
          s.type === "phone" && existing.connectedPersonIds.length > 3 ? "suspicious"
          : s.type === "address" ? "household"
          : s.type === "cookie" ? "confirmed_conflict"
          : s.type === "device" ? "shared_office_device"
          : "unexplained";
      } else {
        seen.set(key, {
          id: s.id,
          kind: s.type as SignalKind,
          value: s.value,
          connectedPersonIds: [p.id],
          connectedProfileIds: INDIVIDUAL_PROFILES.filter((ip) => ip.personId === p.id).map((ip) => ip.id),
          connectedHouseholdIds: i % 4 === 0 ? [HOUSEHOLDS[Math.floor(i / 4) % HOUSEHOLDS.length].id] : [],
          connectedCompanyIds: s.type === "phone" && si % 3 === 0 ? [COMPANIES[i % COMPANIES.length].id] : [],
          sourceProfileIds: SOURCE_PROFILES.filter((sp) => sp.personId === p.id).slice(0, 2).map((sp) => sp.id),
          identityEventIds: IDENTITY_EVENTS.filter((e) => e.personId === p.id).slice(0, 2).map((e) => e.id),
          conflictCount: 0,
          sharingClass: "household",
          confidence: s.confidence,
          firstObserved: s.firstSeen,
          lastObserved: s.lastSeen,
        });
      }
    });
  });
  return Array.from(seen.values());
})();

// Curated demo canon (section 22)
export const DEMO_CANON = {
  personalAndWorkPersonId: PEOPLE[0].id,
  mixedWarningGoldenRecordId: GOLDEN_RECORDS.find((g) => g.warnings.length > 0)?.id ?? GOLDEN_RECORDS[0].id,
  suspiciousSignalId: SIGNAL_LINKAGE.find((s) => s.sharingClass === "suspicious")?.id ?? SIGNAL_LINKAGE[0].id,
  cookieConflictSignalId: SIGNAL_LINKAGE.find((s) => s.kind === "cookie" && s.connectedPersonIds.length > 1)?.id ?? SIGNAL_LINKAGE[0].id,
  duplicatePersonId: PEOPLE[3].id,
  reversibleMergeId: MERGE_SPLIT_HISTORY.find((m) => m.kind === "merge" && m.reversible)?.id,
  reversibleSplitId: MERGE_SPLIT_HISTORY.find((m) => m.kind === "split" && m.reversible)?.id,
};

// 12-week graph timeline (per-person compact)
export const GRAPH_TIMELINE: GraphTimelineChange[] = Array.from({ length: 120 }).map((_, i) => {
  const kinds: GraphTimelineChange["kind"][] = ["added", "updated", "merge", "split", "gr_change", "conflict_open", "conflict_resolved", "removed"];
  const k = kinds[i % kinds.length];
  const p = PEOPLE[i % PEOPLE.length];
  return {
    id: `chg_${i.toString(36).padStart(4, "0")}`,
    ts: hours(i * 14),
    kind: k,
    target: p.id,
    targetKind: "person",
    summary:
      k === "merge" ? `Merged duplicate profile into ${p.name}`
      : k === "split" ? `Split misjoined profile off ${p.name}`
      : k === "gr_change" ? `Golden Record field updated for ${p.name}`
      : k === "conflict_open" ? `New signal conflict opened for ${p.name}`
      : k === "conflict_resolved" ? `Signal conflict resolved for ${p.name}`
      : k === "added" ? `New source profile ingested for ${p.name}`
      : k === "removed" ? `Suppressed signal for ${p.name}`
      : `Profile field updated for ${p.name}`,
    decisionId: k === "merge" || k === "split" ? `dec_${i.toString(36).padStart(4, "0")}` : undefined,
  };
});
