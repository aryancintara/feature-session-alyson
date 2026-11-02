export const RECONCILIATION_LOG_KEY = "cost-revenue-reconciliation-log:v1";
export const RECONCILIATION_DONE_KEY = "cost-revenue-reconciliation-done:v1";

export type ReconciliationLogResult = "matched" | "difference" | "failed";

export interface ReconciliationLogRow {
  id: string;
  source: string;
  period_kind: "day" | "week" | "month" | "range";
  date_reconciled: string;
  period_start: string;
  period_end: string;
  checked_at: string;
  result: ReconciliationLogResult;
  source_leads: number | null;
  loaded_leads: number | null;
  source_revenue: number | null;
  loaded_revenue: number | null;
  difference: number | null;
  how: string;
  locked: boolean;
  cost_usd: number | null;
  missing_leads: number | null;
  missing: { lead_id: string; revenue: number; session_id?: string | null; affiliate?: boolean }[];
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const RESULTS = new Set<ReconciliationLogResult>(["matched", "difference", "failed"]);

export function reconciliationLogId(source: string, start: string, end: string) {
  return `${source}:${start}:${end}`;
}

export function isReconciliationLogRow(value: unknown): value is ReconciliationLogRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string"
    && typeof row.source === "string"
    && (row.period_kind === "day" || row.period_kind === "week" || row.period_kind === "month" || row.period_kind === "range")
    && typeof row.date_reconciled === "string" && DAY_RE.test(row.date_reconciled)
    && typeof row.period_start === "string" && DAY_RE.test(row.period_start)
    && typeof row.period_end === "string" && DAY_RE.test(row.period_end)
    && typeof row.checked_at === "string"
    && RESULTS.has(row.result as ReconciliationLogResult)
    && typeof row.how === "string"
    && typeof row.locked === "boolean"
    && (row.cost_usd === null || (typeof row.cost_usd === "number" && Number.isFinite(row.cost_usd)))
    && (row.source_leads === null || typeof row.source_leads === "number")
    && (row.loaded_leads === null || typeof row.loaded_leads === "number")
    && (row.source_revenue === null || typeof row.source_revenue === "number")
    && (row.loaded_revenue === null || typeof row.loaded_revenue === "number")
    && (row.difference === null || typeof row.difference === "number")
    && (row.missing_leads === undefined || row.missing_leads === null || typeof row.missing_leads === "number")
    && (row.missing === undefined || (Array.isArray(row.missing) && row.missing.every((item) => item && typeof item === "object" && typeof (item as { lead_id?: unknown }).lead_id === "string")));
}

export function parseReconciliationLog(value: unknown): ReconciliationLogRow[] {
  if (!Array.isArray(value)) return [];
  const rows = value.filter(isReconciliationLogRow).map((row) => ({
    ...row,
    missing_leads: row.missing_leads ?? row.missing?.length ?? null,
    missing: row.missing ?? [],
  }));
  const latest = new Map<string, ReconciliationLogRow>();
  for (const row of rows) latest.set(row.id, row);
  return [...latest.values()].sort((a, b) => b.checked_at.localeCompare(a.checked_at) || b.date_reconciled.localeCompare(a.date_reconciled));
}

export function upsertReconciliationLog(rows: ReconciliationLogRow[], next: ReconciliationLogRow) {
  return parseReconciliationLog([next, ...rows.filter((row) => row.id !== next.id)]);
}

export function lockReconciliationLog(rows: ReconciliationLogRow[], id: string) {
  return parseReconciliationLog(rows.map((row) => row.id === id ? { ...row, locked: true } : row));
}

export function lockedReconciliationIds(rows: ReconciliationLogRow[]) {
  return Object.fromEntries(rows.filter((row) => row.locked && row.result === "matched").map((row) => [row.id, true]));
}

export function coveringReconciliationLog(rows: ReconciliationLogRow[], source: string, start: string, end: string) {
  return rows.find((row) =>
    row.source === source
    && row.locked
    && row.result === "matched"
    && row.period_start <= start
    && row.period_end >= end
  );
}

export function migrateDoneKeyToLog(saved: unknown, now = new Date().toISOString()): ReconciliationLogRow[] {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return [];
  const rows: ReconciliationLogRow[] = [];
  for (const [id, value] of Object.entries(saved)) {
    const parts = id.split(":");
    if (parts.length !== 3 || !DAY_RE.test(parts[1]) || !DAY_RE.test(parts[2])) continue;
    if (!value || typeof value !== "object") continue;
    const result = value as Record<string, unknown>;
    if (result.matched !== true) continue;
    rows.push({
      id,
      source: parts[0],
      period_kind: "day",
      date_reconciled: parts[1],
      period_start: parts[1],
      period_end: parts[2],
      checked_at: now,
      result: "matched",
      source_leads: typeof result.source_leads === "number" ? result.source_leads : null,
      loaded_leads: typeof result.loaded_leads === "number" ? result.loaded_leads : null,
      source_revenue: typeof result.source_revenue === "number" ? result.source_revenue : null,
      loaded_revenue: typeof result.loaded_revenue === "number" ? result.loaded_revenue : null,
      difference: typeof result.difference === "number" ? result.difference : 0,
      how: "Existing check · browser reminder",
      locked: true,
      cost_usd: null,
      missing_leads: 0,
      missing: [],
    });
  }
  return parseReconciliationLog(rows);
}
