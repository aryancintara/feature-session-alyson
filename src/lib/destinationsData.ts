export interface Destination {
  id: string;
  name: string;
  vendor: string;
  category: "ads" | "crm" | "marketing" | "analytics" | "marketplace" | "warehouse";
  status: "live" | "paused" | "error";
  audiencesSynced: number;
  events24h: number;
  successRate: number; // 0-100
  latencyMs: number;
  failures24h: number;
  lastSync: string;
  trend: number[];
}

const hours = (n: number) => new Date(Date.now() - n * 3600 * 1000).toISOString();
const trend = (seed: number) =>
  Array.from({ length: 12 }).map((_, i) => 50 + ((seed * (i + 3)) % 50) + (i * 2));

export const DESTINATIONS: Destination[] = [
  { id: "dst_001", name: "Meta Conversions API", vendor: "Meta", category: "ads", status: "live", audiencesSynced: 14, events24h: 4_120_881, successRate: 99.7, latencyMs: 184, failures24h: 1240, lastSync: hours(0.01), trend: trend(1) },
  { id: "dst_002", name: "Google Ads Customer Match", vendor: "Google", category: "ads", status: "live", audiencesSynced: 9, events24h: 6_220_412, successRate: 99.9, latencyMs: 92, failures24h: 612, lastSync: hours(0.02), trend: trend(2) },
  { id: "dst_003", name: "TikTok Events API", vendor: "TikTok", category: "ads", status: "error", audiencesSynced: 4, events24h: 0, successRate: 12.4, latencyMs: 5400, failures24h: 88_412, lastSync: hours(2.3), trend: trend(3).map((v) => v / 4) },
  { id: "dst_004", name: "Salesforce Sales Cloud", vendor: "Salesforce", category: "crm", status: "live", audiencesSynced: 6, events24h: 142_318, successRate: 99.2, latencyMs: 612, failures24h: 184, lastSync: hours(0.1), trend: trend(4) },
  { id: "dst_005", name: "HubSpot CRM", vendor: "HubSpot", category: "crm", status: "live", audiencesSynced: 4, events24h: 84_220, successRate: 98.8, latencyMs: 410, failures24h: 412, lastSync: hours(0.2), trend: trend(5) },
  { id: "dst_006", name: "Klaviyo Lists", vendor: "Klaviyo", category: "marketing", status: "live", audiencesSynced: 22, events24h: 1_412_881, successRate: 99.4, latencyMs: 220, failures24h: 1820, lastSync: hours(0.05), trend: trend(6) },
  { id: "dst_007", name: "Iterable Audiences", vendor: "Iterable", category: "marketing", status: "paused", audiencesSynced: 11, events24h: 0, successRate: 0, latencyMs: 0, failures24h: 0, lastSync: hours(48), trend: trend(7).map(() => 0) },
  { id: "dst_008", name: "Twilio Segment", vendor: "Twilio", category: "marketing", status: "live", audiencesSynced: 18, events24h: 884_412, successRate: 99.8, latencyMs: 142, failures24h: 240, lastSync: hours(0.04), trend: trend(8) },
  { id: "dst_009", name: "Snowflake Warehouse", vendor: "Snowflake", category: "warehouse", status: "live", audiencesSynced: 41, events24h: 22_412_881, successRate: 100, latencyMs: 880, failures24h: 0, lastSync: hours(1), trend: trend(9) },
  { id: "dst_010", name: "BigQuery Mirror", vendor: "Google Cloud", category: "warehouse", status: "live", audiencesSynced: 38, events24h: 19_881_412, successRate: 99.99, latencyMs: 940, failures24h: 12, lastSync: hours(1), trend: trend(10) },
  { id: "dst_011", name: "Mixpanel Events", vendor: "Mixpanel", category: "analytics", status: "live", audiencesSynced: 0, events24h: 14_812_004, successRate: 99.6, latencyMs: 102, failures24h: 1612, lastSync: hours(0.01), trend: trend(11) },
  { id: "dst_012", name: "Lead Marketplace · Verify", vendor: "Verify", category: "marketplace", status: "live", audiencesSynced: 3, events24h: 14_220, successRate: 97.4, latencyMs: 1240, failures24h: 380, lastSync: hours(0.3), trend: trend(12) },
];

// Data Explorer dataset definitions
export interface DatasetField {
  name: string;
  type: "string" | "number" | "timestamp" | "boolean" | "json";
  pii?: boolean;
  description: string;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  rowCount: number;
  fields: DatasetField[];
  freshness: string;
  partitioned: boolean;
}

export const DATASETS: Dataset[] = [
  {
    id: "ds_people",
    name: "people",
    description: "Canonical person records — one row per resolved identity.",
    rowCount: 204_318_991,
    fields: [
      { name: "person_id", type: "string", description: "Canonical identifier" },
      { name: "place_id", type: "string", description: "Linked household identifier" },
      { name: "primary_email", type: "string", pii: true, description: "Verified primary email" },
      { name: "primary_phone", type: "string", pii: true, description: "Verified primary phone" },
      { name: "current_stage", type: "string", description: "Current funnel stage" },
      { name: "furthest_stage", type: "string", description: "Furthest funnel stage reached" },
      { name: "identity_score", type: "number", description: "0–100 identity confidence" },
      { name: "source_of_truth", type: "boolean", description: "True if reached SQL+" },
      { name: "last_seen", type: "timestamp", description: "Most recent observed activity" },
    ],
    freshness: "streaming",
    partitioned: true,
  },
  {
    id: "ds_places",
    name: "places",
    description: "Household / location identities derived from address clustering.",
    rowCount: 88_412_004,
    fields: [
      { name: "place_id", type: "string", description: "Household identifier" },
      { name: "address_line", type: "string", pii: true, description: "Normalized street" },
      { name: "city", type: "string", description: "City" },
      { name: "state", type: "string", description: "State / region" },
      { name: "person_count", type: "number", description: "People linked to this place" },
      { name: "first_observed", type: "timestamp", description: "First observation" },
    ],
    freshness: "5 min",
    partitioned: true,
  },
  {
    id: "ds_sessions",
    name: "sessions",
    description: "Web visit journeys terminated by inactivity or heartbeat exit.",
    rowCount: 412_881_004,
    fields: [
      { name: "session_id", type: "string", description: "Session identifier" },
      { name: "person_id", type: "string", description: "Linked person" },
      { name: "start_time", type: "timestamp", description: "Session start" },
      { name: "end_time", type: "timestamp", description: "Session end" },
      { name: "exit_reason", type: "string", description: "inactivity_timeout | heartbeat_exit" },
      { name: "page_views", type: "number", description: "Page views in session" },
      { name: "device", type: "string", description: "Device + UA" },
      { name: "source", type: "string", description: "Acquisition source" },
    ],
    freshness: "streaming",
    partitioned: true,
  },
  {
    id: "ds_events",
    name: "events",
    description: "Raw event stream — one row per discrete event.",
    rowCount: 14_220_881_004,
    fields: [
      { name: "event_id", type: "string", description: "Event identifier" },
      { name: "person_id", type: "string", description: "Linked person" },
      { name: "session_id", type: "string", description: "Linked session" },
      { name: "event_type", type: "string", description: "Event taxonomy" },
      { name: "source", type: "string", description: "Origin system" },
      { name: "timestamp", type: "timestamp", description: "Event time" },
      { name: "payload", type: "json", description: "Raw payload" },
    ],
    freshness: "streaming",
    partitioned: true,
  },
  {
    id: "ds_identity_signals",
    name: "identity_signals",
    description: "Every observed identity signal with confidence + source.",
    rowCount: 1_204_881_004,
    fields: [
      { name: "signal_id", type: "string", description: "Signal identifier" },
      { name: "person_id", type: "string", description: "Linked person" },
      { name: "signal_type", type: "string", description: "email | phone | address | ..." },
      { name: "value", type: "string", pii: true, description: "Signal value (PII)" },
      { name: "source", type: "string", description: "Originating system" },
      { name: "confidence", type: "number", description: "0–100" },
      { name: "grade", type: "string", description: "A+ … F" },
      { name: "first_seen", type: "timestamp", description: "First observation" },
      { name: "last_seen", type: "timestamp", description: "Last observation" },
    ],
    freshness: "streaming",
    partitioned: true,
  },
  {
    id: "ds_audience_memberships",
    name: "audience_memberships",
    description: "Person ↔ Audience join with timestamps.",
    rowCount: 4_412_881_004,
    fields: [
      { name: "person_id", type: "string", description: "Linked person" },
      { name: "audience_id", type: "string", description: "Audience identifier" },
      { name: "added_at", type: "timestamp", description: "When added" },
      { name: "removed_at", type: "timestamp", description: "When removed (if any)" },
      { name: "source", type: "string", description: "Rule that triggered membership" },
    ],
    freshness: "streaming",
    partitioned: true,
  },
  {
    id: "ds_consent",
    name: "consent_records",
    description: "Consent state per person × channel.",
    rowCount: 612_881_004,
    fields: [
      { name: "person_id", type: "string", description: "Linked person" },
      { name: "channel", type: "string", description: "sms | email | call | partner | platform" },
      { name: "granted", type: "boolean", description: "Current consent state" },
      { name: "captured_at", type: "timestamp", description: "Capture time" },
      { name: "source", type: "string", description: "Capture source" },
      { name: "litigation_risk", type: "boolean", description: "TCPA risk flag" },
    ],
    freshness: "streaming",
    partitioned: true,
  },
  {
    id: "ds_propensity",
    name: "propensity_scores",
    description: "Latest model scores per person.",
    rowCount: 204_318_991,
    fields: [
      { name: "person_id", type: "string", description: "Linked person" },
      { name: "model", type: "string", description: "purchase | churn | engagement" },
      { name: "score", type: "number", description: "0–100" },
      { name: "scored_at", type: "timestamp", description: "Scored time" },
      { name: "model_version", type: "string", description: "Model build" },
    ],
    freshness: "hourly",
    partitioned: true,
  },
];
