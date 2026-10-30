import { createServerFn } from "@tanstack/react-start";
import { readAthenaCreds, querySessionsInRange } from "./athenaSessions.server";

export const fetchAthenaSessions = createServerFn({ method: "POST" })
  .inputValidator((input: { from: string; to: string; limit?: number }) => {
    if (!input || typeof input.from !== "string" || typeof input.to !== "string") {
      throw new Error("from and to ISO timestamps are required");
    }
    const from = new Date(input.from);
    const to = new Date(input.to);
    if (Number.isNaN(+from) || Number.isNaN(+to)) throw new Error("Invalid date range");
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      limit: Math.max(1, Math.min(1000, Math.floor(input.limit ?? 500))),
    };
  })
  .handler(async ({ data }) => {
    const creds = readAthenaCreds();
    if (!creds) {
      return {
        connected: false as const,
        rows: [] as Record<string, string>[],
        latestSessionAt: null as string | null,
        error: "AWS Athena is not connected to this project.",
      };
    }
    try {
      const rows = await querySessionsInRange(creds, data.from, data.to, data.limit);
      return {
        connected: true as const,
        rows,
        latestSessionAt: rows[0]?.["session_start"] ?? null,
        error: null as string | null,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("fetchAthenaSessions failed:", message);
      return {
        connected: true as const,
        rows: [] as Record<string, string>[],
        latestSessionAt: null as string | null,
        error: message,
      };
    }
  });
