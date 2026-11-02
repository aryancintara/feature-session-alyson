import { describe, expect, it } from "vitest";
import { reconciliationPeriod, reconciliationCheckRequest, isReconciliationCheckResult, parseReconciliationCheckResponse } from "../routes/cost-revenue.reconciliation";

describe("Reconciliation past periods", () => {
  const today = "2026-10-21";
  const matched = { source_leads: 0, source_revenue: 0, loaded_leads: 0, loaded_revenue: 0, difference: 0, matched: true, missing: [] };
  it("reads direct Lambda totals without changing zero values", () => {
    expect(parseReconciliationCheckResponse(matched)).toEqual(matched);
  });
  it("parses a string body in a Lambda statusCode wrapper", () => {
    const unmatched = { source_leads: 2, source_revenue: 125, loaded_leads: 1, loaded_revenue: 100, difference: 25, matched: false, missing: [{ lead_id: "lead-2", revenue: 25 }] };
    expect(parseReconciliationCheckResponse({ statusCode: 200, body: JSON.stringify(unmatched) })).toEqual(unmatched);
  });
  it("preserves integrity from the same parsed Lambda body as aggregate totals", () => {
    const integrity = { missing_source_leads: { count: 0, leads: [] }, duplicates: { count: 0, leads: [] } };
    expect(parseReconciliationCheckResponse({ statusCode: 200, body: JSON.stringify({ ...matched, integrity }) }).integrity).toEqual(integrity);
    expect(parseReconciliationCheckResponse({ ...matched, integrity }).integrity).toEqual(integrity);
  });
  it("rejects wrapped failures rather than displaying totals", () => {
    expect(() => parseReconciliationCheckResponse({ statusCode: 500, body: JSON.stringify({ message: "Source unavailable" }) })).toThrow("Source unavailable");
  });
  it("rejects invalid JSON and incomplete wrapped results", () => {
    expect(() => parseReconciliationCheckResponse({ statusCode: 200, body: "invalid" })).toThrow();
    expect(() => parseReconciliationCheckResponse({ statusCode: 200, body: "{}" })).toThrow("incomplete result");
  });
  it("allows a day only after a 5-day wait", () => {
    expect(reconciliationPeriod("day", "2026-10-16", today)).toEqual({ start: "2026-10-16", end: "2026-10-16" });
    expect(reconciliationPeriod("day", "2026-10-17", today)).toBeNull();
    expect(reconciliationPeriod("day", today, today)).toBeNull();
    expect(reconciliationPeriod("day", "2026-10-22", today)).toBeNull();
  });
  it("accepts a week only after its Sunday is 5 days old", () => {
    expect(reconciliationPeriod("week", "2026-10-07", today)).toEqual({ start: "2026-10-05", end: "2026-10-11" });
    expect(reconciliationPeriod("week", "2026-10-14", today)).toBeNull();
    expect(reconciliationPeriod("week", "2026-10-20", today)).toBeNull();
    expect(reconciliationPeriod("week", "2026-10-26", today)).toBeNull();
  });
  it("accepts completed months and rejects the current month", () => {
    expect(reconciliationPeriod("month", "2026-09", today)).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    expect(reconciliationPeriod("month", "2026-10", today)).toBeNull();
  });
  it("rejects blank and invalid calendar dates", () => {
    expect(reconciliationPeriod("day", "", today)).toBeNull();
    expect(reconciliationPeriod("day", "2026-02-30", today)).toBeNull();
    expect(reconciliationPeriod("month", "2026-13", today)).toBeNull();
  });
  it("sends September HomeLight with the day-after end from the contract", () => {
    expect(reconciliationCheckRequest("month", "2026-09", today, "homelight")).toEqual({ source_id: "homelight", start: "2026-09-01", end: "2026-10-01" });
  });
  it("sends non-HomeLight as uct with an exclusive day end", () => {
    expect(reconciliationCheckRequest("day", "2026-10-16", today, "uct")).toEqual({ source_id: "uct", start: "2026-10-16", end: "2026-10-17" });
  });
  it("sends the Monday after a completed week as end", () => {
    expect(reconciliationCheckRequest("week", "2026-10-07", today, "homelight")).toEqual({ source_id: "homelight", start: "2026-10-05", end: "2026-10-12" });
  });
  it("does not construct a request for today", () => {
    expect(reconciliationCheckRequest("day", today, today, "homelight")).toBeNull();
  });
  it("accepts real zero totals and rejects incomplete responses instead of inventing a match", () => {
    const result = { source_leads: 0, source_revenue: 0, loaded_leads: 0, loaded_revenue: 0, difference: 0, matched: true, missing: [] };
    expect(isReconciliationCheckResult(result)).toBe(true);
    expect(isReconciliationCheckResult({ ...result, source_revenue: undefined })).toBe(false);
    expect(isReconciliationCheckResult({ ...result, matched: undefined })).toBe(false);
    expect(isReconciliationCheckResult({ ...result, missing: [{ lead_id: "lead", revenue: null }] })).toBe(false);
  });
});
import { reconciliationCheckPassed, reconciliationCheckRequest as uctRequest } from "../routes/cost-revenue.reconciliation";
describe("Third-party (uct) reconciliation", () => {
  const base = { source_leads: 1, source_revenue: 10, loaded_leads: 1, loaded_revenue: 10, difference: 0, matched: true, missing: [], different: [] };
  it("sends source_id uct with exclusive UTC end", () => {
    expect(uctRequest("week", "2026-10-14", "2026-10-23", "uct")).toEqual({ source_id: "uct", start: "2026-10-12", end: "2026-10-19" });
  });
  it("passes when no source leads are missing from revenue_events", () => {
    expect(reconciliationCheckPassed(base)).toBe(true);
    expect(reconciliationCheckPassed({ ...base, different: [{ lead_id: "c1", source_revenue: 10, loaded_revenue: 9 }] })).toBe(true);
    expect(reconciliationCheckPassed({ ...base, missing: [{ lead_id: "c2", revenue: 5 }] })).toBe(false);
  });
});
