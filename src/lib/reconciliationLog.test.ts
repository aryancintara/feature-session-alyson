import { describe, expect, it } from "vitest";
import {
  lockReconciliationLog,
  lockedReconciliationIds,
  migrateDoneKeyToLog,
  parseReconciliationLog,
  reconciliationLogId,
  upsertReconciliationLog,
  type ReconciliationLogRow,
} from "./reconciliationLog";

const row = (partial: Partial<ReconciliationLogRow> = {}): ReconciliationLogRow => ({
  id: "homelight:2026-10-24:2026-10-25",
  source: "homelight",
  period_kind: "day",
  date_reconciled: "2026-10-24",
  period_start: "2026-10-24",
  period_end: "2026-10-25",
  checked_at: "2026-10-29T09:00:00.000Z",
  result: "matched",
  source_leads: 10,
  loaded_leads: 10,
  source_revenue: 100,
  loaded_revenue: 100,
  difference: 0,
  how: "reconcile/check",
  locked: false,
  cost_usd: null,
  ...partial,
});

describe("reconciliation log", () => {
  it("keeps one row per source and date and sorts newest check first", () => {
    const older = row({ checked_at: "2026-10-28T09:00:00.000Z", result: "difference" });
    const newer = row({ checked_at: "2026-10-29T09:00:00.000Z", result: "matched" });
    expect(parseReconciliationLog([older, newer]).map((item) => item.result)).toEqual(["matched"]);
  });

  it("locks a matched date so it is not checked again", () => {
    const locked = lockReconciliationLog([row()], row().id);
    expect(locked[0]?.locked).toBe(true);
    expect(lockedReconciliationIds(locked)).toEqual({ [row().id]: true });
  });

  it("does not lock a difference as done", () => {
    expect(lockedReconciliationIds([row({ result: "difference", locked: true })])).toEqual({});
  });

  it("migrates the old browser reminder into a locked log row", () => {
    const migrated = migrateDoneKeyToLog({
      [reconciliationLogId("homelight", "2026-10-24", "2026-10-25")]: {
        source_leads: 4, source_revenue: 40, loaded_leads: 4, loaded_revenue: 40, difference: 0, matched: true, missing: [],
      },
    }, "2026-10-29T12:00:00.000Z");
    expect(migrated).toHaveLength(1);
    expect(migrated[0]?.locked).toBe(true);
    expect(migrated[0]?.date_reconciled).toBe("2026-10-24");
    expect(migrated[0]?.result).toBe("matched");
  });

  it("replaces the same date when a later check is saved", () => {
    const next = upsertReconciliationLog([row({ result: "difference" })], row({ result: "matched", checked_at: "2026-10-30T09:00:00.000Z" }));
    expect(next).toHaveLength(1);
    expect(next[0]?.result).toBe("matched");
  });
});
