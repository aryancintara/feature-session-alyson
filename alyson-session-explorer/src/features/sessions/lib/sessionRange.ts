export const SESSION_PAGE_SIZE = 200;

/** A calendar day is UTC, regardless of the browser's local timezone. */
export function sessionDate(value: string, exclusiveEnd = false): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 2000 || year > 2100 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (exclusiveEnd) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

/** Journey filters sent to the Session API as `<flag>=true`; the API filters and its `total` counts matches. */
export const JOURNEY_API_FLAGS = {
  visit: "has_visit",
  quiz_start: "has_quiz_start",
  partial_lead: "has_partial_lead",
  lead: "has_lead",
  otp_verified: "has_otp_verified",
  qualified_connected: "has_qualified_connected",
  meeting: "has_meeting",
  listing: "has_listing",
  revenue: "has_revenue",
  consent_given: "has_consent",
} as const;
export type JourneyFilter = keyof typeof JOURNEY_API_FLAGS;

export function isJourneyFilter(value: unknown): value is JourneyFilter {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(JOURNEY_API_FLAGS, value);
}

function flagOn(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
}

/** True when the API applied the flag, or every returned row carries it. */
export function journeyFilterHonored(
  journey: JourneyFilter | null | undefined,
  rows: Record<string, string>[],
  applied?: Record<string, unknown> | null,
) {
  if (!journey) return true;
  const flag = JOURNEY_API_FLAGS[journey];
  if (applied && flagOn(applied[flag])) return true;
  if (!rows.length) return true;
  return rows.every((row) => flagOn(row[flag]));
}

export function sessionRequest(from: string, to: string, pageSize = SESSION_PAGE_SIZE, journey?: JourneyFilter | null) {
  const start = new Date(from);
  const end = new Date(to);
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || start >= end) throw new Error("Invalid date range");
  const utc = (date: Date) => date.toISOString().replace(".000Z", "Z");
  const params = new URLSearchParams({
    from: utc(start),
    to: utc(end),
    page_size: String(Math.max(1, Math.min(SESSION_PAGE_SIZE, Math.floor(pageSize) || SESSION_PAGE_SIZE))),
  });
  if (journey) params.set(JOURNEY_API_FLAGS[journey], "true");
  return params;
}

export function parseSessionPage(payload: unknown) {
  if (!payload || typeof payload !== "object") throw new Error("Invalid session response");
  const response = payload as Record<string, unknown>;
  const total = response.total;
  if (typeof total !== "number" || !Number.isInteger(total) || total < 0) throw new Error("Session response is missing total");
  if (!Array.isArray(response.rows)) throw new Error("Session response is missing rows");
  const rows = response.rows.map((row: unknown) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Invalid session row");
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value)]));
  });
  const applied = response.applied_filters && typeof response.applied_filters === "object" && !Array.isArray(response.applied_filters)
    ? response.applied_filters as Record<string, unknown>
    : null;
  return { rows, total, applied };
}