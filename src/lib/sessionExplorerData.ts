// Session Explorer enrichment layer.
// Mirrors the shape produced by `unified.unified_session_summary` (Athena) →
// `session_summary_cache.data` jsonb → `parseSessionRow()`.
// Everything here is deterministic (hash-derived) so SSR and client match.

import { PEOPLE, type Person, type Session } from "@/lib/mockData";

export const PLUGINS = ["geo", "twilio", "postlead", "identity", "prepop", "rentcast"] as const;
export type PluginId = (typeof PLUGINS)[number];
export type PluginStatus = "ok" | "partial" | "miss" | "skipped";

export interface PluginResult {
  pluginId: PluginId;
  pluginStatus: PluginStatus;
  pluginFill: number; // 0..1
}

export const FUNNEL_STAGE_KEYS = [
  "has_visit",
  "has_engagement",
  "has_lead",
  "has_quiz",
  "has_partial",
  "has_submit",
  "has_revenue",
] as const;
export type FunnelStageKey = (typeof FUNNEL_STAGE_KEYS)[number];

export const FUNNEL_STAGE_LABEL: Record<FunnelStageKey, string> = {
  has_visit: "Visit",
  has_engagement: "Engagement",
  has_lead: "Lead",
  has_quiz: "Quiz",
  has_partial: "Partial",
  has_submit: "Submit",
  has_revenue: "Revenue",
};

export const CLICK_ID_KEYS = [
  "clickid_gclid",
  "fbclid",
  "pixel_id",
  "txn_id",
  "cid",
  "affid",
  "clickid",
  "router_event_id",
  "task_event_id",
  "tune_click_id",
] as const;

export const IP_FIELD_KEYS = [
  "session_ip",
  "ip_version",
  "ip_type",
  "ip_asn",
  "ip_org",
  "ip_isp",
  "ip_city",
  "ip_region",
  "ip_postal",
  "ip_country",
  "ip_timezone",
  "ip_proxy",
  "ip_hosting",
] as const;

export interface SessionRow extends Session {
  personName: string;
  person: Person;
  durationMs: number;
  identified: boolean;
  hasConsent: boolean;
  hasLitigant: boolean;
  expectedRevenueSource: "direct" | "uct_revenue";
  stages: Record<FunnelStageKey, boolean>;
  plugins: PluginResult[];
  clickIds: Record<(typeof CLICK_ID_KEYS)[number], string | null>;
  ip: Record<(typeof IP_FIELD_KEYS)[number], string>;
  attribution: { channel: string; campaign: string; adset: string; creative: string; landingPage: string };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
const pick = <T,>(arr: readonly T[], seed: number) => arr[seed % arr.length];

const CHANNELS = ["Paid social", "Paid search", "Organic", "Email", "Partner", "Direct"];
const CAMPAIGNS = ["q3-solar-prospecting", "brand-defense", "retarget-quiz-abandon", "partner-coreg", "lifecycle-winback"];
const ADSETS = ["lookalike-1pct", "interest-homeowner", "broad-25-54", "retarget-7d"];
const CREATIVES = ["vid-testimonial-a", "static-savings-b", "carousel-steps-c", "ugc-installer-d"];
const LANDING = ["/quote/start", "/solar/savings", "/lp/roof-check", "/partners/offer"];
const ISPS = ["Comcast Cable", "AT&T Internet", "Verizon Fios", "T-Mobile USA", "Spectrum"];
const ORGS = ["AS7922 Comcast", "AS7018 ATT-Internet", "AS701 UUNET", "AS21928 T-Mobile", "AS20115 Charter"];

function buildRow(s: Session, p: Person): SessionRow {
  const h = hash(s.id);
  const durationMs = Math.max(0, +new Date(s.endTime) - +new Date(s.startTime));

  const stageOn = (i: number) => (h >> i) % 100 < [100, 88, 61, 44, 33, 24, 11][i];
  const stages = FUNNEL_STAGE_KEYS.reduce(
    (acc, k, i) => ({ ...acc, [k]: stageOn(i) }),
    {} as Record<FunnelStageKey, boolean>,
  );

  const plugins: PluginResult[] = PLUGINS.map((id, i) => {
    const ph = hash(s.id + id);
    const status: PluginStatus = ph % 10 < 6 ? "ok" : ph % 10 < 8 ? "partial" : ph % 10 < 9 ? "miss" : "skipped";
    const fill = status === "ok" ? 0.8 + (ph % 20) / 100 : status === "partial" ? 0.3 + (ph % 40) / 100 : 0;
    return { pluginId: id, pluginStatus: status, pluginFill: Math.min(1, Number(fill.toFixed(2))) + i * 0 };
  });

  const clickIds = CLICK_ID_KEYS.reduce(
    (acc, k, i) => {
      const kh = hash(s.id + k);
      acc[k] = kh % 10 < 5 + (i % 3) ? `${k.split("_")[0]}_${kh.toString(36).slice(0, 12)}` : null;
      return acc;
    },
    {} as SessionRow["clickIds"],
  );

  const octet = (n: number) => (hash(s.id + n) % 253) + 1;
  const ip: SessionRow["ip"] = {
    session_ip: `${octet(1)}.${octet(2)}.${octet(3)}.${octet(4)}`,
    ip_version: "IPv4",
    ip_type: h % 7 === 0 ? "mobile" : "residential",
    ip_asn: `AS${7000 + (h % 900)}`,
    ip_org: pick(ORGS, h),
    ip_isp: pick(ISPS, h >> 3),
    ip_city: p.city,
    ip_region: p.state,
    ip_postal: String(10000 + (h % 89999)),
    ip_country: "US",
    ip_timezone: pick(["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"], h >> 5),
    ip_proxy: h % 23 === 0 ? "true" : "false",
    ip_hosting: h % 31 === 0 ? "true" : "false",
  };

  return {
    ...s,
    personName: p.name,
    person: p,
    durationMs,
    identified: h % 10 < 7,
    hasConsent: p.consent.platform && h % 9 !== 0,
    hasLitigant: p.consent.litigationRisk || h % 17 === 0,
    expectedRevenueSource: h % 4 === 0 ? "uct_revenue" : "direct",
    stages,
    plugins,
    clickIds,
    ip,
    attribution: {
      channel: pick(CHANNELS, h),
      campaign: pick(CAMPAIGNS, h >> 2),
      adset: pick(ADSETS, h >> 4),
      creative: pick(CREATIVES, h >> 6),
      landingPage: pick(LANDING, h >> 8),
    },
  };
}

export const SESSION_ROWS: SessionRow[] = PEOPLE.flatMap((p) => p.sessions.map((s) => buildRow(s, p))).sort(
  (a, b) => +new Date(b.startTime) - +new Date(a.startTime),
);

/** Anchor for date presets — the source refreshes daily, so presets key off the
 *  latest cached session rather than the wall clock. */
export const LATEST_SESSION_AT = SESSION_ROWS.length ? +new Date(SESSION_ROWS[0].startTime) : 0;

export type DatePreset = "24h" | "7d" | "30d" | "custom";
export const PRESET_HOURS: Record<Exclude<DatePreset, "custom">, number> = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };

export function rowsInRange(fromMs: number, toMs: number): SessionRow[] {
  return SESSION_ROWS.filter((r) => {
    const t = +new Date(r.startTime);
    return t >= fromMs && t <= toMs;
  });
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function kpisFor(rows: SessionRow[]) {
  const n = rows.length || 1;
  return {
    sessions: rows.length,
    identifiedPct: (rows.filter((r) => r.identified).length / n) * 100,
    consentPct: (rows.filter((r) => r.hasConsent).length / n) * 100,
    leadPct: (rows.filter((r) => r.stages.has_lead).length / n) * 100,
    revenuePct: (rows.filter((r) => r.stages.has_revenue).length / n) * 100,
    avgDurationMs: rows.reduce((a, r) => a + r.durationMs, 0) / n,
  };
}
