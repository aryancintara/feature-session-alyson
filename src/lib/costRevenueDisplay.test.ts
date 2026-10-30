import { describe, expect, it } from "vitest";
import { returnedRuleDates, rulePeriodSummary, savedDateWarning } from "./costRevenueDisplay";

describe("Rule date display", () => {
  it("supports open-ended periods and counts inclusive calendar days", () => {
    expect(rulePeriodSummary("2026-09-01", "")).toBe("This rule applies from 2026-09-01 until edited");
    expect(rulePeriodSummary("", "2026-10-30")).toBe("Pick a start date");
    expect(rulePeriodSummary("2026-09-01", "2026-10-30")).toBe("This rule applies from 2026-09-01 to 2026-10-30 (60 days)");
    expect(rulePeriodSummary("2026-10-12", "2026-10-12")).toContain("(1 day)");
  });
  it("compares dates without treating omitted response fields as null", () => {
    expect(returnedRuleDates({ rule_id: "test", rule_version: 1 })).toBeNull();
    expect(returnedRuleDates({ effective_from: "2026-10-12", effective_to: null })).toEqual({ effective_from: "2026-10-12", effective_to: null });
    expect(returnedRuleDates({ rule: { effective_from: "2026-10-12", effective_to: null } })).not.toBeNull();
    expect(returnedRuleDates({ effective_from: undefined, effective_to: undefined })).toBeNull();
    expect(returnedRuleDates({ start_date: "2026-10-01" })).toEqual({ effective_from: "2026-10-01", effective_to: null });
    expect(returnedRuleDates({ start_date: "2026-10-01", end_date: "2026-10-31" })).toEqual({ effective_from: "2026-10-01", effective_to: "2026-10-31" });
  });
  it("normalizes timestamps and reports changed saved dates", () => {
    expect(savedDateWarning("2026-09-01", "2026-10-30", { effective_from: "2026-09-01T00:00:00Z", effective_to: "2026-10-30T00:00:00Z" })).toBeNull();
    expect(savedDateWarning("2026-09-01", "2026-10-30", { effective_from: "2026-10-12", effective_to: null })).toBe("Saved, but the dates changed: you entered 2026-09-01 → 2026-10-30, the rule was saved as 2026-10-12 → no end date.");
  });
});