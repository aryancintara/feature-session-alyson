// Real production rows exported from `unified.unified_session_summary`
// (1,000 sessions). Served locally until the live AWS Athena connection is
// linked. Shape matches the Athena row exactly (all strings).

import raw from "./sampleSessionRows.json";

export const SAMPLE_SESSION_ROWS = raw as Record<string, string>[];

/** Timestamps in the export are fixed in the past. Rebase them once per page
 *  load so the 24h / 7d / 30d presets all return data. Relative spacing and
 *  ordering are preserved. */
const REBASED: Record<string, string>[] = (() => {
  const stamps = SAMPLE_SESSION_ROWS.map((r) => +new Date(r["session_start"]!)).filter(Number.isFinite);
  if (!stamps.length) return SAMPLE_SESSION_ROWS;
  const oldest = Math.min(...stamps);
  const newest = Math.max(...stamps);
  const srcSpan = Math.max(1, newest - oldest);
  const to = Date.now();
  const from = to - 30 * 86400_000;
  const dstSpan = to - from;

  return SAMPLE_SESSION_ROWS.map((r) => {
    const start = +new Date(r["session_start"]!);
    const end = +new Date(r["session_end"]!);
    const dur = Number.isFinite(end) ? Math.max(0, end - start) : 0;
    const shifted = from + ((start - oldest) / srcSpan) * dstSpan;
    const startIso = new Date(shifted).toISOString();
    return {
      ...r,
      session_start: startIso,
      session_end: new Date(Math.min(to, shifted + dur)).toISOString(),
      session_date: startIso.slice(0, 10),
    };
  }).sort((a, b) => +new Date(b["session_start"]!) - +new Date(a["session_start"]!));
})();

export const SAMPLE_LATEST_SESSION_AT = REBASED[0]?.["session_start"] ?? new Date().toISOString();

export function sampleRowsInRange(fromIso: string, toIso: string, limit = 500): Record<string, string>[] {
  const from = +new Date(fromIso);
  const to = +new Date(toIso);
  return REBASED.filter((r) => {
    const t = +new Date(r["session_start"]!);
    return t >= from && t <= to;
  }).slice(0, limit);
}
