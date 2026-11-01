import { parseSessionDetail } from "./sessionDetail";
import type { JourneyFilter } from "./sessionRange";

type SessionCounts = {
  quizStart: { total: number | null; honored: boolean };
  partial: { total: number | null; honored: boolean };
  consent: { total: number | null; honored: boolean };
  rangeTotal: number | null;
};

async function postJson<T>(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Session proxy request failed (${response.status}).`);
  }
  return (await response.json()) as T;
}

/** One page from the Session API via the local Vite proxy (key stays server-side). */
export async function fetchSessionPage(
  from: string,
  to: string,
  journey: JourneyFilter | null,
  signal?: AbortSignal,
) {
  const res = await postJson<{
    ok: boolean;
    error: string | null;
    rows: Record<string, string>[];
    total: number | null;
    journeyHonored: boolean;
    counts: SessionCounts | null;
  }>("/__session_api/page", { from, to, journey }, signal);

  if (!res.ok || res.total == null) {
    throw new Error(res.error ?? "Failed to load sessions.");
  }
  return {
    rows: res.rows,
    total: res.total,
    journeyHonored: res.journeyHonored,
    counts: res.counts,
  };
}

export async function fetchSessionDetail(
  sessionId: string,
  signal?: AbortSignal,
) {
  const res = await postJson<{
    ok: boolean;
    error: string | null;
    detail: unknown;
  }>("/__session_api/detail", { sessionId }, signal);

  if (!res.ok) {
    throw new Error(res.error ?? "Session details could not be loaded.");
  }
  return parseSessionDetail(res.detail);
}
