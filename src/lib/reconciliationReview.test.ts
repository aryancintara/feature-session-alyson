import { describe, expect, it } from "vitest";
import { reconciliationDifferences, reconciliationReviewStatus, reconciliationIntegrityChecks, type ReconciliationIntegrity } from "./reconciliationReview";

const integrity: ReconciliationIntegrity = {
  missing_source_leads: { count: 0, leads: [] },
  session_id_coverage: { loaded_rows: 12, with_session_id: 12, in_click_bridge: 12 },
  duplicates: { count: 0, leads: [] },
  timestamp: { request_timezone: "UTC", source_date_column: "date_pst", source_date_basis: "America/Los_Angeles" },
  join_validation: { path: "source → lead bridge → click bridge", source_rows: 15, after_lead_bridge: 14, after_click_bridge: 12, matched_loaded: 12 },
};
const check = (value: ReconciliationIntegrity, index: number) => reconciliationIntegrityChecks(value)[index];

describe("Live reconciliation integrity", () => {
  it("passes zero missing count even with a returned evidence list", () => {
    expect(check(integrity, 0)?.result).toBe("Pass");
    const row = check({ ...integrity, missing_source_leads: { count: 1, leads: [{ lead_id: "lead-1", revenue: 25, session_id: "session-1" }] } }, 0);
    expect(row?.result).toBe("Fail");
    expect(row?.details).toEqual(["Lead ID: lead-1 · Revenue: 25 · Session ID: session-1"]);
  });
  it("requires both session coverage counts to equal loaded rows including zero", () => {
    expect(check(integrity, 1)?.result).toBe("Pass");
    expect(check({ ...integrity, session_id_coverage: { loaded_rows: 12, with_session_id: 11, in_click_bridge: 12 } }, 1)?.result).toBe("Fail");
    expect(check({ ...integrity, session_id_coverage: { loaded_rows: 12, with_session_id: 12, in_click_bridge: 11 } }, 1)?.result).toBe("Fail");
    expect(check({ ...integrity, session_id_coverage: { loaded_rows: 0, with_session_id: 0, in_click_bridge: 0 } }, 1)?.result).toBe("Pass");
  });
  it("passes zero duplicates with an empty list and fails nonzero count", () => {
    expect(check(integrity, 2)?.result).toBe("Pass");
    const row = check({ ...integrity, duplicates: { count: 1, leads: [{ lead_id: "lead-2", rows: 2 }] } }, 2);
    expect(row?.result).toBe("Fail");
    expect(row?.details).toEqual(["Lead ID: lead-2 · Rows: 2"]);
    expect(check({ ...integrity, duplicates: { count: 1, leads: [] } }, 2)?.result).toBe("Fail");
  });
  it("accepts UTC requests with Pacific source dates without comparing timezones for equality", () => {
    expect(check(integrity, 3)?.result).toBe("Pass");
    expect(check(integrity, 3)?.evidence).toContain("date_pst");
    expect(check(integrity, 3)?.evidence).toContain("America/Los_Angeles");
    expect(check({ ...integrity, timestamp: { ...integrity.timestamp, request_timezone: "America/Los_Angeles" } }, 3)?.result).toBe("Fail");
  });
  it("compares after-click-bridge with matched-loaded, not earlier counts", () => {
    expect(check(integrity, 4)?.result).toBe("Pass");
    expect(check({ ...integrity, join_validation: { ...integrity.join_validation, matched_loaded: 11 } }, 4)?.result).toBe("Fail");
    expect(check(integrity, 4)?.evidence).toContain("Source rows: 15 · After lead bridge: 14 · After click bridge: 12 · Matched loaded: 12");
  });
  it("uses Not checked only for absent integrity, never incomplete returned integrity", () => {
    expect(reconciliationIntegrityChecks().map((row) => row.result)).toEqual(Array(5).fill("Not checked"));
    expect(reconciliationIntegrityChecks(null).map((row) => row.result)).toEqual(Array(5).fill("Not checked"));
    expect(reconciliationIntegrityChecks({}).map((row) => row.result)).toEqual(Array(5).fill("Fail"));
  });
});

describe("Reconciliation evidence-aware review", () => {
  it("does not certify joins from matching aggregates", () => {
    expect(reconciliationReviewStatus({ matched: true, manual: false, approved: false })).toBe("Warning");
  });
  it("keeps unapproved pasted evidence awaiting evidence instead of failed", () => {
    expect(reconciliationReviewStatus({ matched: false, manual: true, approved: false })).toBe("Awaiting Evidence");
  });
  it("identifies an actual returned mismatch as failed", () => {
    expect(reconciliationReviewStatus({ matched: false, manual: false, approved: false })).toBe("Failed");
  });
  it("keeps absent results not checked", () => {
    expect(reconciliationReviewStatus({ manual: false, approved: false })).toBe("Not Checked");
  });
  it("requires separately verified integrity for reconciled status", () => {
    expect(reconciliationReviewStatus({ matched: true, manual: false, approved: false, integrityVerified: true })).toBe("Reconciled");
  });
  it("shows absolute, percentage and count differences without changing returned amounts", () => {
    expect(reconciliationDifferences({ source_revenue: 125, loaded_revenue: 100, source_leads: 2, loaded_leads: 1, difference: 25 })).toEqual({ absolute: 25, percentage: 20, leads: 1 });
  });
  it("does not invent a percentage for a nonzero difference against zero source revenue", () => {
    expect(reconciliationDifferences({ source_revenue: 0, loaded_revenue: 10, source_leads: 0, loaded_leads: 1, difference: -10 }).percentage).toBeNull();
  });
});