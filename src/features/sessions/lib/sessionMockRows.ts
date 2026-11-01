// Deterministic mock rows shaped like Athena unified_session_summary cache rows.

import { PEOPLE, type Person, type MockSession } from "./mockPeople";
import { PLUGINS } from "./sessionData";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
const pick = <T,>(arr: readonly T[], seed: number) => arr[seed % arr.length];
const bool = (seed: number, pct: number) => seed % 100 < pct;

const CHANNELS = [
  "paid_social",
  "paid_search",
  "organic",
  "email",
  "partner",
  "direct",
];
const UTM_SOURCES = [
  "facebook",
  "google",
  "tiktok",
  "newsletter",
  "partner-coreg",
  "bing",
];
const CAMPAIGNS = [
  "q3-solar-prospecting",
  "brand-defense",
  "retarget-quiz-abandon",
  "partner-coreg",
  "lifecycle-winback",
];
const CONTENTS = [
  "vid-testimonial-a",
  "static-savings-b",
  "carousel-steps-c",
  "ugc-installer-d",
];
const LANDING = [
  "/quote/start",
  "/solar/savings",
  "/lp/roof-check",
  "/partners/offer",
];
const CLICKID_KEYS = [
  "gclid",
  "fbclid",
  "pixel_id",
  "txn_id",
  "cid",
  "affid",
  "clickid",
  "router_event_id",
  "task_event_id",
  "tune_click_id",
];
const SOURCES = ["native", "native", "native", "inherited", "synthetic"] as const;
const STAGE_LABELS = [
  "Visit",
  "Quiz Start",
  "Partial Lead",
  "Lead",
  "OTP Verified",
  "Qualified / Connected",
  "Meeting",
  "Listing",
  "Revenue",
];

function buildEvents(
  s: MockSession,
  p: Person,
  h: number,
  flags: boolean[],
): string {
  const start = +new Date(s.startTime);
  const span = Math.max(60_000, +new Date(s.endTime) - start);
  const names: string[] = ["page"];
  if (bool(h >> 2, 70)) names.push("button_click");
  if (flags[1]) names.push("quiz_start");
  if (flags[2]) names.push("partial_quiz_submit");
  if (flags[3]) names.push("lead_created");
  if (p.consent.platform) names.push("consent_given");
  if (flags[4]) names.push("otp_verified");
  if (flags[8]) names.push("revenue_recorded");
  const total = Math.max(names.length, s.events || names.length);
  const list = Array.from({ length: total }, (_, i) => {
    const name = names[i] ?? "page";
    const isPage = name === "page";
    return {
      type: isPage ? "page" : "track",
      event: name,
      timestamp: new Date(start + Math.round((span * i) / total)).toISOString(),
      id: `evt_${hash(s.id + name + i).toString(36)}`,
      properties: {
        url: `https://resolve.io${pick(LANDING, h + i)}`,
        device: s.device,
        source: s.source,
      },
    };
  });
  return JSON.stringify(list);
}

function buildRow(s: MockSession, p: Person): Record<string, string> {
  const h = hash(s.id);
  const durationSec = Math.max(
    5,
    Math.round((+new Date(s.endTime) - +new Date(s.startTime)) / 1000),
  );

  const flags = [
    true,
    bool(h >> 1, 62),
    bool(h >> 2, 44),
    bool(h >> 3, 36),
    bool(h >> 4, 27),
    bool(h >> 5, 19),
    bool(h >> 6, 12),
    bool(h >> 7, 8),
    bool(h >> 8, 5),
  ];
  const reached = flags.reduce((acc, on, i) => (on ? i : acc), 0);

  const plugins = Object.fromEntries(
    PLUGINS.map((name) => {
      const ph = hash(s.id + name);
      const on = ph % 10 < 7;
      return [
        name,
        {
          plugin_id: `pl_${ph.toString(36).slice(0, 8)}`,
          plugin_status: on ? "on" : "off",
          plugin_fill: on ? `${60 + (ph % 41)}` : "off",
        },
      ];
    }),
  );

  const clickids = Object.fromEntries(
    CLICKID_KEYS.map((k, i) => {
      const kh = hash(s.id + k);
      return [
        k,
        kh % 10 < 4 + (i % 3) ? `${k}_${kh.toString(36).slice(0, 12)}` : "",
      ];
    }),
  );

  const utm = pick(UTM_SOURCES, h);
  const landing = pick(LANDING, h >> 8);
  const campaign = pick(CAMPAIGNS, h >> 2);
  const content = pick(CONTENTS, h >> 6);
  const entryUrl = `https://resolve.io${landing}?utm_source=${utm}&utm_campaign=${campaign}&utm_content=${content}&gclid=${hash(s.id + "g").toString(36)}`;
  const octet = (n: number) => (hash(s.id + String(n)) % 253) + 1;
  const uct = h % 5 === 0 && flags[8];

  return {
    session_id: s.id,
    raw_session_id: `raw_${hash(s.id + "raw").toString(36)}`,
    session_id_source: pick(SOURCES, h >> 9),
    anonymous_id: `anon_${hash(p.id + s.id).toString(36)}`,
    user_id: p.id,
    session_start: new Date(s.startTime).toISOString(),
    session_end: new Date(s.endTime).toISOString(),
    duration_seconds: String(durationSec),
    session_date: new Date(s.startTime).toISOString().slice(0, 10),
    event_count: String(Math.max(1, s.events)),
    entry_channel: pick(CHANNELS, h >> 3),
    entry_utm_source: utm,
    entry_utm_campaign: campaign,
    entry_utm_content: content,
    entry_page_url: entryUrl,
    website_metadata_id: `wm_${hash(landing).toString(36).slice(0, 8)}`,
    has_visit: "true",
    has_quiz_start: String(flags[1]),
    has_partial_lead: String(flags[2]),
    has_lead: String(flags[3]),
    has_otp_verified: String(flags[4]),
    has_qualified_connected: String(flags[5]),
    has_meeting: String(flags[6]),
    has_listing: String(flags[7]),
    has_revenue: String(flags[8]),
    has_consent: String(p.consent.platform && h % 9 !== 0),
    has_litigant: String(p.consent.litigationRisk || h % 17 === 0),
    furthest_stage: STAGE_LABELS[reached],
    journey_stage: STAGE_LABELS[reached],
    journey_stage_number: String(reached + 1),
    expected_revenue: flags[8] ? (200 + (h % 1800)).toFixed(2) : "0.00",
    expected_revenue_source: uct ? "uct_revenue" : "direct",
    plugins_json: JSON.stringify(plugins),
    clickids_json: JSON.stringify(clickids),
    events_json: buildEvents(s, p, h, flags),
    session_ip: `${octet(1)}.${octet(2)}.${octet(3)}.${octet(4)}`,
    ip_country_code: "US",
    ip_country_name: "United States",
    ip_region_name: p.state,
    ip_district: `${p.city} County`,
    ip_city_name: p.city,
    ip_latitude: (25 + (h % 2000) / 100).toFixed(4),
    ip_longitude: (-(70 + (h % 5000) / 100)).toFixed(4),
    ip_area_code: String(200 + (h % 700)),
    ip_time_zone: pick(
      [
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
      ],
      h >> 5,
    ),
    ip_zip_code: String(10000 + (h % 89999)),
    ip_is_proxy: String(h % 23 === 0),
    ip_is_vpn: String(h % 31 === 0),
    device: s.device,
    source: s.source,
    exit_reason: s.exitReason,
  };
}

export const MOCK_SESSION_ROWS: Record<string, string>[] = PEOPLE.flatMap((p) =>
  p.sessions.map((s) => buildRow(s, p)),
).sort((a, b) => +new Date(b.session_start) - +new Date(a.session_start));

export function mockRowsInRange(
  fromIso: string,
  toIso: string,
): Record<string, string>[] {
  const from = +new Date(fromIso);
  const to = +new Date(toIso);
  return MOCK_SESSION_ROWS.filter((r) => {
    const t = +new Date(r.session_start);
    return t >= from && t <= to;
  });
}

/** Demo fallback: project mock rows into the requested window when empty. */
export function mockRowsForRange(
  fromIso: string,
  toIso: string,
): Record<string, string>[] {
  const inRange = mockRowsInRange(fromIso, toIso);
  if (inRange.length > 0) return inRange;

  const from = +new Date(fromIso);
  const to = +new Date(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return [];

  const stamps = MOCK_SESSION_ROWS.map((r) => +new Date(r.session_start));
  const oldest = Math.min(...stamps);
  const newest = Math.max(...stamps);
  const srcSpan = Math.max(1, newest - oldest);
  const dstSpan = to - from;

  return MOCK_SESSION_ROWS.map((r) => {
    const start = +new Date(r.session_start);
    const end = +new Date(r.session_end);
    const dur = Number.isFinite(end) ? Math.max(0, end - start) : 0;
    const shifted = from + ((start - oldest) / srcSpan) * dstSpan;
    const clamped = Math.min(to, Math.max(from, shifted));
    const startIso = new Date(clamped).toISOString();
    return {
      ...r,
      session_start: startIso,
      session_end: new Date(Math.min(to, clamped + dur)).toISOString(),
      session_date: startIso.slice(0, 10),
    };
  }).sort((a, b) => +new Date(b.session_start) - +new Date(a.session_start));
}
