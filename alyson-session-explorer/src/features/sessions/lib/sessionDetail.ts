import { parsePluginJson, parseSessionRow, type IpInfo, type Session, type SessionEvent } from "./sessionData";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function flag(value: unknown): boolean | null {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

/** Accepts the direct detail object, a Lambda-style `{ body: "<json>" }`, or `{ data | session: {...} }`. */
function unwrap(value: unknown): Record<string, unknown> {
  let detail: unknown = value;
  if (typeof detail === "string") {
    try { detail = JSON.parse(detail); } catch { return {}; }
  }
  const obj = object(detail);
  if (typeof obj.body === "string" && !("events" in obj)) return unwrap(obj.body);
  if (!("events" in obj) && !("session_id" in obj)) {
    for (const key of ["data", "session", "item"]) {
      const inner = object(obj[key]);
      if ("events" in inner || "session_id" in inner) return inner;
    }
  }
  return obj;
}

export type SessionDetail = { ip: IpInfo; events: SessionEvent[]; session: Session | null };

/**
 * Detail-only fields. The event list is the detail response's `events` array —
 * never the summary `event_count`, which can differ from the events returned.
 */
export function parseSessionDetail(value: unknown): SessionDetail {
  const detail = unwrap(value);
  const ip = object(detail.ip);
  const ipText = (field: string) => text(ip[field]);
  const list = Array.isArray(detail.events) ? detail.events : Array.isArray(detail.event_payloads) ? detail.event_payloads : [];
  const events: SessionEvent[] = list.map((value) => {
    const event = object(value);
    return {
      type: text(event.type), event_name: text(event.event_name), timestamp: text(event.timestamp),
      event_id: text(event.event_id ?? event.id),
      raw: object(event.payload ?? event.raw ?? event.raw_payload),
    };
  });
  const parsedIp: IpInfo = {
    ip: text(detail.ip_address).trim() || ipText("ip"),
    country_code: ipText("country_code"), country_name: ipText("country_name"),
    region_name: ipText("region_name"), district: ipText("district"), city_name: ipText("city_name"),
    latitude: ipText("latitude"), longitude: ipText("longitude"), area_code: ipText("area_code"),
    time_zone: ipText("time_zone"), zip_code: ipText("zip_code"),
    is_proxy: flag(ip.is_proxy), is_vpn: flag(ip.is_vpn), is_bot: flag(detail.is_bot ?? detail.is_bot_click ?? ip.is_bot ?? ip.is_bot_click),
  };

  // Summary fields so a session looked up by ID (not in the loaded page) can still be shown.
  let session: Session | null = null;
  if (text(detail.session_id)) {
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(detail)) {
      if (v == null || typeof v === "object") continue;
      row[k] = String(v);
    }
    row.clickids_json = JSON.stringify(object(detail.clickids));
    if (detail.plugin_json != null) row.plugin_json = typeof detail.plugin_json === "string" ? detail.plugin_json : JSON.stringify(detail.plugin_json);
    session = { ...parseSessionRow(row), ip: parsedIp, events, plugin_json: parsePluginJson(detail.plugin_json ?? row.plugin_json) };
  }
  return { ip: parsedIp, events, session };
}

export function applySessionDetail(session: Session, detail: SessionDetail): Session {
  return { ...session, ip: detail.ip, events: detail.events, plugin_json: detail.session?.plugin_json ?? session.plugin_json };
}
