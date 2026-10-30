import { createServerFn } from "@tanstack/react-start";
import { isJourneyFilter, journeyFilterHonored, parseSessionPage, sessionRequest, type JourneyFilter } from "./sessionRange";

const SESSION_API_BASE = "https://6s2ai70d6l.execute-api.us-west-2.amazonaws.com/prod";

export const fetchSessionDetailServer = createServerFn({ method: "POST" })
  .inputValidator((input: { sessionId: string }) => {
    const sessionId = input?.sessionId?.trim();
    if (!sessionId || sessionId.length > 512) throw new Error("A valid session ID is required.");
    return { sessionId };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.SESSION_API_KEY;
    if (!apiKey) return { ok: false as const, error: "Session API key is not connected yet.", detail: null };
    try {
      const response = await fetch(`${SESSION_API_BASE}/sessions/${encodeURIComponent(data.sessionId)}`, {
        headers: { "x-api-key": apiKey, accept: "application/json" },
      });
      if (!response.ok) {
        return { ok: false as const, error: response.status === 404 ? "Session details were not found." : `Session details could not be loaded (${response.status}).`, detail: null };
      }
      const detail = JSON.stringify(await response.json());
      return { ok: true as const, error: null, detail };
    } catch {
      return { ok: false as const, error: "Session details could not be loaded. Please try opening the row again.", detail: null };
    }
  });

type Count = { total: number | null; honored: boolean };

/** Server-side proxy so the private Session API key never reaches the browser. */
export const fetchSessionPageServer = createServerFn({ method: "POST" })
  .inputValidator((input: { from: string; to: string; journey?: string | null }) => {
    if (!input || typeof input.from !== "string" || typeof input.to !== "string") {
      throw new Error("from and to are required");
    }
    if (input.journey != null && !isJourneyFilter(input.journey)) throw new Error("Unknown journey filter");
    // Validates range and caps page_size at 200.
    sessionRequest(input.from, input.to);
    return { from: input.from, to: input.to, journey: (input.journey ?? null) as JourneyFilter | null };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.SESSION_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "Session API key is not connected yet.", rows: [], total: null, journeyHonored: true, counts: null };
    }
    const get = (pageSize: number, journey: JourneyFilter | null) =>
      fetch(`${SESSION_API_BASE}/sessions?${sessionRequest(data.from, data.to, pageSize, journey)}`, {
        headers: { "x-api-key": apiKey, accept: "application/json" },
      });

    // Counts come from each response's total (page_size=1), never from downloaded row counts.
    const count = async (journey: JourneyFilter | null): Promise<Count> => {
      try {
        const res = await get(1, journey);
        if (!res.ok) return { total: null, honored: false };
        const page = parseSessionPage(await res.json());
        return { total: page.total, honored: journeyFilterHonored(journey, page.rows, page.applied) };
      } catch {
        return { total: null, honored: false };
      }
    };

    const [response, quizStart, partial, consent, range] = await Promise.all([
      get(200, data.journey),
      count("quiz_start"),
      count("partial_lead"),
      count("consent_given"),
      data.journey ? count(null) : Promise.resolve(null),
    ]);
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`Session API failed [${response.status}]: ${body.slice(0, 500)}`);
      const error =
        response.status === 401 || response.status === 403
          ? "Session API rejected the key (access denied)."
          : `Session API request failed (${response.status}).`;
      return { ok: false as const, error, rows: [], total: null, journeyHonored: true, counts: null };
    }
    const page = parseSessionPage(await response.json());
    const counts = {
      quizStart,
      partial,
      consent,
      rangeTotal: range ? range.total : page.total,
    };
    return {
      ok: true as const,
      error: null,
      rows: page.rows,
      total: page.total as number | null,
      journeyHonored: journeyFilterHonored(data.journey, page.rows, page.applied),
      counts,
    };
  });
