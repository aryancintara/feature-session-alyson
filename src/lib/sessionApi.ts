import { fetchSessionPageServer, fetchSessionDetailServer } from "./sessionApi.functions";
import { parseSessionDetail } from "./sessionDetail";
import type { JourneyFilter } from "./sessionRange";

export async function fetchSessionDetail(sessionId: string, signal?: AbortSignal) {
  const result = await fetchSessionDetailServer({ data: { sessionId }, signal });
  if (!result.ok) throw new Error(result.error);
  return parseSessionDetail(result.detail);
}

/** One request returns one page; total is the API's count of sessions matching the range and journey filter. Calls go through the server so the API key stays private. */
export async function fetchSessionPage(from: string, to: string, journey: JourneyFilter | null, signal?: AbortSignal) {
  const res = await fetchSessionPageServer({ data: { from, to, journey }, signal });
  if (!res.ok || res.total == null) throw new Error(res.error ?? "Failed to load sessions.");
  return { rows: res.rows as Record<string, string>[], total: res.total, journeyHonored: res.journeyHonored, counts: res.counts };
}
