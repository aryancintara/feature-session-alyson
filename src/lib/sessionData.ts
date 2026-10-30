export const PLUGINS = ["geo", "twilio", "postlead", "identity", "prepop", "rentcast"] as const;
export type PluginName = (typeof PLUGINS)[number];

export interface SessionEvent {
  type: string; // "page" | "track" | ...
  event_name: string; // event for track, "page" otherwise
  timestamp: string;
  event_id: string;
  raw: Record<string, unknown>;
}

export interface PluginInfo {
  name: PluginName;
  id: string;
  status: "on" | "off";
  fill: number;
}

export interface IpInfo {
  ip: string;
  country_code: string;
  country_name: string;
  region_name: string;
  district: string;
  city_name: string;
  latitude: string;
  longitude: string;
  area_code: string;
  time_zone: string;
  zip_code: string;
  is_proxy: boolean | null;
  is_vpn: boolean | null;
  is_bot?: boolean | null;
}

export interface Session {
  session_id: string;
  raw_session_id: string;
  session_id_source: "inherited" | "synthetic" | "native";
  anonymous_id: string;
  user_id: string;
  session_start: string;
  session_end: string;
  duration_seconds: number;
  session_date: string;
  event_count: number;
  entry_channel: string;
  entry_utm_source: string;
  entry_utm_medium: string;
  entry_utm_term: string;
  entry_utm_campaign: string;
  entry_utm_content: string;
  entry_page_url: string;
  website_metadata_id: string;
  has_visit: boolean;
  has_quiz_start: boolean;
  has_partial_quiz_submit: boolean; // alias of has_partial_lead
  has_lead: boolean;
  has_otp_verified: boolean;
  has_qualified_connected: boolean;
  has_meeting: boolean;
  has_listing: boolean;
  has_revenue: boolean;
  has_consent_given: boolean; // from has_consent column
  has_button_click: boolean; // derived from events
  furthest_stage: string;
  journey_stage: string;
  journey_stage_number: number;
  revcloud_person_id: string;
  expected_revenue: number;
  plugins: PluginInfo[];
  clickids: Record<string, string>;
  events: SessionEvent[];
  ip: IpInfo;
  raw: Record<string, string>;
}

function safeJson<T>(text: string, fallback: T): T {
  if (!text) return fallback;
  try { return JSON.parse(text) as T; } catch { return fallback; }
}

function parseEvents(text: string): SessionEvent[] {
  const arr = safeJson<unknown[]>(text, []);
  return arr.map((raw) => {
    const d = (typeof raw === "string" ? safeJson<Record<string, unknown>>(raw, {}) : (raw as Record<string, unknown>)) ?? {};
    const type = String(d.type ?? "");
    const name = type === "track" ? String(d.event ?? "track") : type || "event";
    return {
      type,
      event_name: name,
      timestamp: String(d.timestamp ?? ""),
      event_id: String(d.id ?? d.messageId ?? ""),
      raw: d,
    };
  });
}

function parsePlugins(text: string): PluginInfo[] {
  const obj = safeJson<Record<string, { plugin_id?: string; plugin_status?: string; plugin_fill?: string }>>(text, {});
  return PLUGINS.map((p) => {
    const src = obj[p] ?? {};
    const rawFill = (src.plugin_fill ?? "").toString().trim();
    const status = (src.plugin_status ?? "").toString().trim();
    const numeric = Number(rawFill.replace("%", ""));
    const hasFill = rawFill && rawFill !== "off" && !Number.isNaN(numeric);
    const on = status === "on" || hasFill;
    const fill = hasFill ? Math.max(0, Math.min(100, numeric)) : on ? 100 : 0;
    return { name: p, id: src.plugin_id ?? p, status: (on ? "on" : "off") as "on" | "off", fill };
  });
}

export function parseSessionRow(r: Record<string, string>): Session {
  const events = parseEvents(r.events_json ?? "");
  // Older exports use last_* attribution and context URL columns.
  // Keep explicit entry attribution when supplied; never infer it from later events.
  const entryUrl = r.entry_page_url?.trim() || r.context_url_with_params?.trim() || r.properties_url?.trim() || r.context_url_no_params?.trim() || "";
  const urlParams = parseEntryUrlParams(entryUrl);
  const attributionValue = (entryKey: string, lastKey: string, urlKey?: string) =>
    r[entryKey]?.trim() || r[lastKey]?.trim() || (urlKey ? urlParams[urlKey]?.trim() : "") || "";
  const hasConsent = r.has_consent === "true" || r.has_consent === "on";
  const hasClick = events.some((e) => e.event_name === "button_click");
  return {
    session_id: r.session_id,
      raw_session_id: r.raw_session_id ?? "",
      session_id_source: (r.session_id_source as Session["session_id_source"]) || "native",
      anonymous_id: r.anonymous_id,
      user_id: r.user_id,
      session_start: r.session_start,
      session_end: r.session_end,
      duration_seconds: Number(r.duration_seconds) || 0,
      session_date: r.session_date,
      event_count: Number(r.event_count) || 0,
      entry_channel: attributionValue("entry_channel", "last_channel"),
      entry_utm_source: attributionValue("entry_utm_source", "last_utm_source", "utm_source"),
      entry_utm_medium: attributionValue("entry_utm_medium", "last_utm_medium", "utm_medium"),
      entry_utm_term: attributionValue("entry_utm_term", "last_utm_term", "utm_term"),
      entry_utm_campaign: attributionValue("entry_utm_campaign", "last_utm_campaign", "utm_campaign"),
      entry_utm_content: attributionValue("entry_utm_content", "last_utm_content", "utm_content"),
      entry_page_url: entryUrl,
      website_metadata_id: r.website_metadata_id ?? "",
      has_visit: r.has_visit === "true" || r.has_visit === "on",
      has_quiz_start: r.has_quiz_start === "true" || r.has_quiz_start === "on",
      has_partial_quiz_submit: r.has_partial_lead === "true" || r.has_partial_lead === "on",
      has_lead: r.has_lead === "true" || r.has_lead === "on",
      has_otp_verified: r.has_otp_verified === "true" || r.has_otp_verified === "on",
      has_qualified_connected: r.has_qualified_connected === "true" || r.has_qualified_connected === "on",
      has_meeting: r.has_meeting === "true" || r.has_meeting === "on",
      has_listing: r.has_listing === "true" || r.has_listing === "on",
      has_revenue: r.has_revenue === "true" || r.has_revenue === "on",
      has_consent_given: hasConsent,
      has_button_click: hasClick,
      furthest_stage: r.furthest_stage ?? "",
      journey_stage: r.journey_stage ?? "",
      journey_stage_number: Number(r.journey_stage_number) || 0,
      revcloud_person_id: r.revcloud_person_id ?? "",
      expected_revenue: Number(r.expected_revenue) || 0,
      plugins: parsePlugins(r.plugins_json ?? ""),
      clickids: Object.fromEntries(
        Object.entries(safeJson<Record<string, string>>(r.clickids_json || r.clickids || "", {}))
          .filter(([, v]) => v != null && String(v).trim() !== ""),
      ),
      events,
      ip: {
        ip: r.ip_address?.trim() || r.session_ip?.trim() || "",
        country_code: r.ip_country_code ?? "",
        country_name: r.ip_country_name ?? "",
        region_name: r.ip_region_name ?? "",
        district: r.ip_district ?? "",
        city_name: r.ip_city_name ?? "",
        latitude: r.ip_latitude ?? "",
        longitude: r.ip_longitude ?? "",
        area_code: r.ip_area_code ?? "",
        time_zone: r.ip_time_zone ?? "",
        zip_code: r.ip_zip_code ?? "",
        is_proxy: r.ip_is_proxy === "true",
        is_vpn: r.ip_is_vpn === "true",
      },
      raw: r,
    };
}

export function parseSessions(rows: Record<string, string>[]): Session[] {
  return rows
    .map(parseSessionRow)
    .sort((a, b) => +new Date(b.session_start) - +new Date(a.session_start));
}

export function parseEntryUrlParams(url: string): Record<string, string> {
  try {
    const u = new URL(url);
    const out: Record<string, string> = {};
    u.searchParams.forEach((v, k) => { if (v) out[k] = v; });
    return out;
  } catch { return {}; }
}

export function formatDuration(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (isNaN(+d)) return "—";
  const diff = Date.now() - +d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toISOString().slice(0, 10);
}

export function computeKpis(sessions: Session[]) {
  const total = sessions.length;
  const quizStart = sessions.filter((s) => s.has_quiz_start).length;
  const partial = sessions.filter((s) => s.has_partial_quiz_submit).length;
  const consent = sessions.filter((s) => s.has_consent_given).length;
  const avgEvents = sessions.reduce((a, s) => a + s.event_count, 0) / (total || 1);
  const durations = sessions.map((s) => s.duration_seconds).sort((a, b) => a - b);
  const median = durations[Math.floor(durations.length / 2)] ?? 0;
  return { total, quizStart, partial, consent, avgEvents, medianDuration: median };
}

export function utmSources(sessions: Session[]): string[] {
  return Array.from(new Set(sessions.map((s) => s.entry_utm_source).filter(Boolean))).sort();
}
