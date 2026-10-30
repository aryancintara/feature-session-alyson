// Reactivation feature data layer
// Reactivation = automatic lead creation when an identified user with valid
// consent leaves a session via heartbeat exit without submitting a lead.

import { PEOPLE, type Person, type FunnelStage, type RepeatBucket } from "./mockData";

export type ReactivationStatus =
  | "eligible"
  | "lead_created"
  | "sent_to_destination"
  | "contact_attempted"
  | "converted"
  | "suppressed";

export type ReactivationEventType =
  | "heartbeat_exit_detected"
  | "reactivation_eligible"
  | "reactivation_lead_created"
  | "reactivation_sent_to_destination"
  | "reactivation_contact_attempt"
  | "reactivation_conversion";

export const REACTIVATION_EVENT_LABEL: Record<ReactivationEventType, string> = {
  heartbeat_exit_detected: "Heartbeat exit detected",
  reactivation_eligible: "Reactivation eligible",
  reactivation_lead_created: "Reactivation lead created",
  reactivation_sent_to_destination: "Sent to destination",
  reactivation_contact_attempt: "Contact attempt",
  reactivation_conversion: "Reactivation conversion",
};

export interface ReactivationLead {
  reactivation_lead_id: string;
  person_id: string;
  person_name: string;
  place_id: string;
  session_id: string;
  created_at: string;
  trigger_event_id: string;
  consent_channel: "sms" | "call" | "email";
  destination: string;
  status: ReactivationStatus;
  last_funnel_stage: FunnelStage;
  repeat_bucket: RepeatBucket;
  identity_confidence: number;
  city: string;
  state: string;
}

export interface ReactivationRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: Array<{ kind: "session" | "identity" | "consent" | "funnel" | "propensity" | "duration" | "visits"; label: string; value: string }>;
  destinations: string[];
  triggered24h: number;
}

export interface TimeseriesPoint {
  t: string;
  opportunities: number;
  leads: number;
  sent: number;
  attempts: number;
  conversions: number;
}

const hours = (n: number) => new Date(Date.now() - n * 3600 * 1000).toISOString();

const DESTINATIONS_FOR_REACTIVATION = [
  "Salesforce Sales Cloud",
  "HubSpot CRM",
  "Twilio Dialer Queue",
  "Five9 Call Center",
  "Lead Marketplace · Verify",
  "Klaviyo Lists",
];

const STATUS_PROGRESSION: ReactivationStatus[] = [
  "eligible",
  "lead_created",
  "sent_to_destination",
  "contact_attempted",
  "converted",
];

function pickStatus(seed: number): ReactivationStatus {
  // Funnel-style progression — most are eligible/created, fewer convert.
  const r = (seed * 37) % 100;
  if (r < 4) return "suppressed";
  if (r < 38) return "eligible";
  if (r < 64) return "lead_created";
  if (r < 82) return "sent_to_destination";
  if (r < 95) return "contact_attempted";
  return "converted";
}

function pickConsent(p: Person, seed: number): "sms" | "call" | "email" {
  const opts: ("sms" | "call" | "email")[] = [];
  if (p.consent.sms) opts.push("sms");
  if (p.consent.call) opts.push("call");
  if (p.consent.email) opts.push("email");
  if (opts.length === 0) return "email";
  return opts[seed % opts.length];
}

function buildLead(person: Person, idx: number): ReactivationLead {
  const session = person.sessions[idx % person.sessions.length];
  const trigger = person.events[idx % person.events.length];
  const seed = idx + person.id.length;
  return {
    reactivation_lead_id: `rxl_${person.id.slice(4, 10)}_${idx}`,
    person_id: person.id,
    person_name: person.name,
    place_id: person.placeId,
    session_id: session.id,
    created_at: hours((idx * 1.7 + seed * 0.3) % 168),
    trigger_event_id: trigger.id,
    consent_channel: pickConsent(person, seed),
    destination: DESTINATIONS_FOR_REACTIVATION[seed % DESTINATIONS_FOR_REACTIVATION.length],
    status: pickStatus(seed),
    last_funnel_stage: person.currentStage,
    repeat_bucket: person.repeatBucket,
    identity_confidence: person.identityScore,
    city: person.city,
    state: person.state,
  };
}

// Generate ~60 reactivation leads from people who have consent + heartbeat exits.
export const REACTIVATION_LEADS: ReactivationLead[] = PEOPLE
  .filter(
    (p) =>
      !p.consent.unsubscribed &&
      !p.consent.litigationRisk &&
      (p.consent.sms || p.consent.call || p.consent.email) &&
      p.sessions.some((s) => s.exitReason === "heartbeat_exit") &&
      // Did NOT yet submit a lead in this window
      ["Visit", "Quiz Start", "Partial Lead"].includes(p.currentStage),
  )
  .flatMap((p, i) => Array.from({ length: 1 + (i % 3) }).map((_, idx) => buildLead(p, idx + i)))
  .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

// Index of person_id → leads for quick lookup in Identity Console & Sessions.
export const REACTIVATION_BY_PERSON: Record<string, ReactivationLead[]> = REACTIVATION_LEADS.reduce(
  (acc, l) => {
    (acc[l.person_id] ||= []).push(l);
    return acc;
  },
  {} as Record<string, ReactivationLead[]>,
);

export const REACTIVATION_BY_SESSION: Record<string, ReactivationLead> = REACTIVATION_LEADS.reduce(
  (acc, l) => {
    acc[l.session_id] = l;
    return acc;
  },
  {} as Record<string, ReactivationLead>,
);

export const REACTIVATION_RULES: ReactivationRule[] = [
  {
    id: "rxr_001",
    name: "Standard reactivation",
    enabled: true,
    conditions: [
      { kind: "session", label: "Session ended", value: "heartbeat_exit" },
      { kind: "identity", label: "Identity resolved", value: "confidence ≥ 70" },
      { kind: "consent", label: "Contact consent", value: "sms OR call OR email" },
      { kind: "funnel", label: "Lead not submitted", value: "current_stage < Lead" },
    ],
    destinations: ["Salesforce Sales Cloud", "Twilio Dialer Queue"],
    triggered24h: 4_120,
  },
  {
    id: "rxr_002",
    name: "High intent quick dial",
    enabled: true,
    conditions: [
      { kind: "session", label: "Session ended", value: "heartbeat_exit" },
      { kind: "identity", label: "Identity resolved", value: "confidence ≥ 85" },
      { kind: "consent", label: "Call consent", value: "granted" },
      { kind: "propensity", label: "Purchase propensity", value: "≥ 70" },
      { kind: "duration", label: "Session length", value: "≥ 90s" },
      { kind: "funnel", label: "Reached", value: "Quiz Start or Partial Lead" },
    ],
    destinations: ["Five9 Call Center"],
    triggered24h: 612,
  },
  {
    id: "rxr_003",
    name: "Repeat visitor warm CRM",
    enabled: true,
    conditions: [
      { kind: "session", label: "Session ended", value: "heartbeat_exit" },
      { kind: "visits", label: "Repeat visit bucket", value: "≥ 4 visits" },
      { kind: "consent", label: "Email consent", value: "granted" },
      { kind: "funnel", label: "Lead not submitted", value: "current_stage < Lead" },
    ],
    destinations: ["HubSpot CRM", "Klaviyo Lists"],
    triggered24h: 2_044,
  },
  {
    id: "rxr_004",
    name: "Marketplace overflow",
    enabled: false,
    conditions: [
      { kind: "session", label: "Session ended", value: "heartbeat_exit" },
      { kind: "identity", label: "Identity resolved", value: "confidence ≥ 60" },
      { kind: "consent", label: "Partner data sharing", value: "granted" },
      { kind: "funnel", label: "Reached", value: "Visit only" },
    ],
    destinations: ["Lead Marketplace · Verify"],
    triggered24h: 0,
  },
];

// Time series for the dashboard — last 14 days.
export const REACTIVATION_TIMESERIES: TimeseriesPoint[] = Array.from({ length: 14 }).map((_, i) => {
  const day = 13 - i;
  const seed = (i * 31 + 7) % 100;
  const opportunities = 3800 + seed * 12 + (i * 80);
  const leads = Math.round(opportunities * 0.62);
  const sent = Math.round(leads * 0.88);
  const attempts = Math.round(sent * 0.74);
  const conversions = Math.round(attempts * 0.18);
  return {
    t: new Date(Date.now() - day * 24 * 3600 * 1000).toISOString().slice(0, 10),
    opportunities,
    leads,
    sent,
    attempts,
    conversions,
  };
});

export function reactivationKpis() {
  const total = (k: keyof Omit<TimeseriesPoint, "t">) =>
    REACTIVATION_TIMESERIES.reduce((s, p) => s + p[k], 0);
  const last7 = REACTIVATION_TIMESERIES.slice(-7);
  const prev7 = REACTIVATION_TIMESERIES.slice(0, 7);
  const sum = (arr: TimeseriesPoint[], k: keyof Omit<TimeseriesPoint, "t">) =>
    arr.reduce((s, p) => s + p[k], 0);
  const variance = (k: keyof Omit<TimeseriesPoint, "t">) => {
    const a = sum(prev7, k);
    const b = sum(last7, k);
    if (a === 0) return 0;
    return ((b - a) / a) * 100;
  };
  return {
    opportunities: { total: total("opportunities"), variance: variance("opportunities") },
    leads: { total: total("leads"), variance: variance("leads") },
    sent: { total: total("sent"), variance: variance("sent") },
    attempts: { total: total("attempts"), variance: variance("attempts") },
    conversions: { total: total("conversions"), variance: variance("conversions") },
  };
}

export const REACTIVATION_STATUS_LABEL: Record<ReactivationStatus, string> = {
  eligible: "Eligible",
  lead_created: "Lead created",
  sent_to_destination: "Sent",
  contact_attempted: "Attempted",
  converted: "Converted",
  suppressed: "Suppressed",
};
