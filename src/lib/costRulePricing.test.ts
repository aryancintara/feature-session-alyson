import { describe, expect, it } from "vitest";
import { RULE_SOURCES, SMS_CONNECTORS, apiSourceId, ruleSourceLabel, hasCostModifier, isDirectCost, ruleWizardSteps, smsPerSend, ruleDatesValid, ruleSaveDates, ruleSaveCalculation } from "./costRulePricing";

describe("Cost source pricing", () => {
  it("offers Tune, Phonexa and SMS for Cost", () => {
    expect(RULE_SOURCES.COST).toEqual(["tune", "phonexa", "sms_57", "sms_67", "sms_77"]);
    expect(RULE_SOURCES.REVENUE).toEqual(["homelight", "uct", "phonexa"]);
  });
  it("does not offer modifiers for Tune or Phonexa", () => {
    for (const source of ["tune", "phonexa"]) {
      expect(isDirectCost("COST", source)).toBe(true);
      expect(hasCostModifier("COST", source)).toBe(false);
      expect(ruleWizardSteps("COST", source)).not.toContain(1);
      expect(ruleWizardSteps("COST", source)).toEqual([0]);
    }
  });
  it("offers the per-send modifier for SMS only", () => {
    expect(hasCostModifier("COST", "sms_57")).toBe(true);
    expect(hasCostModifier("REVENUE", "sms_57")).toBe(false);
    expect(ruleWizardSteps("COST", "sms_77")).toEqual([0, 1, 2, 4]);
    expect(ruleWizardSteps("COST", "sms_77")).not.toContain(3);
    expect(apiSourceId("sms_67")).toBe("sms");
    expect(ruleWizardSteps("COST", "sms_67")).toEqual([0, 1, 2, 4]);
    expect(ruleWizardSteps("COST", "sms_57")).toEqual([0, 1, 2, 4]);
    expect(ruleWizardSteps("REVENUE", "homelight")).toEqual([0, 1, 2, 3, 4]);
    expect(SMS_CONNECTORS.sms_57.connector).toBe("57");
    expect(SMS_CONNECTORS.sms_67.connector).toBe("67");
    expect(SMS_CONNECTORS.sms_77.connector).toBe("77");
    expect(ruleSourceLabel({ source_id: "sms", conditions: [{ field: "connector_id", value: "57" }] }, {})).toBe("PitchPrfct SMS");
  });
  it("converts $10 per 1,000 SMS into $0.01 per send", () => {
    expect(smsPerSend("10", 1000)).toBe(0.01);
    expect(smsPerSend("0.01", 1)).toBe(0.01);
    expect(smsPerSend("0.01", "1")).toBe(0.01);
    expect(smsPerSend("50", 10000)).toBe(0.005);
  });
  it("uses Klaviyo SMS for connector 77", () => {
    expect(ruleSourceLabel({ source_id: "sms", conditions: [{ field: "connector_id", value: "77" }] }, {})).toBe("Klaviyo SMS");
  });
  it("requires start but allows omitted end dates", () => {
    expect(ruleDatesValid("", "")).toBe(false);
    expect(ruleDatesValid("2026-10-01", "")).toBe(true);
    expect(ruleDatesValid("2026-10-01", "2026-09-30")).toBe(false);
    expect(ruleSaveDates("2026-10-01", "")).toEqual({ start_date: "2026-10-01" });
    expect(ruleSaveDates("2026-10-01", "2026-10-31")).toEqual({ start_date: "2026-10-01", end_date: "2026-10-31" });
  });
  it("sends Phonexa payout as money without Tune session fields", () => {
    expect(ruleSaveCalculation("COST", "phonexa", "", "event", 0, 0, 1)).toEqual({ kind: "money", field: "publisher_payout" });
  });
  it("sends the entered SMS quantity and amount", () => {
    expect(ruleSaveCalculation("COST", "sms_57", "", "event", 0, 10, 1000)).toEqual({ kind: "sms_per_count", per_count: 1000, amount: 10 });
    expect(ruleSaveCalculation("COST", "sms_77", "", "event", 0, 50, 10000)).toEqual({ kind: "sms_per_count", per_count: 10000, amount: 50 });
  });
  it("keeps revenue calculation shapes", () => {
    expect(ruleSaveCalculation("REVENUE", "homelight", "expected_revenue", "revenue_share", 100, 0, 1)).toEqual({ kind: "revenue_share", field: "expected_revenue", percent: 100 });
    expect(ruleSaveCalculation("REVENUE", "uct", "expected_revenue_vendor", "roas", 50, 0, 1)).toEqual({ kind: "roas", field: "expected_revenue_vendor", percent: 50 });
    expect(ruleSaveCalculation("REVENUE", "phonexa", "", "event", 0, 25, 1)).toEqual({ kind: "event_based", amount: 25 });
  });
  it("preserves small rates and rejects missing or invalid amounts or quantities", () => {
    expect(smsPerSend("0.01", 1000)).toBe(0.00001);
    for (const amount of ["", " ", "-1", "Infinity", "abc"]) expect(smsPerSend(amount, 1)).toBeNull();
    for (const qty of ["0", "-1", "", "abc", "Infinity"]) expect(smsPerSend("10", qty)).toBeNull();
    expect(smsPerSend("0", 1)).toBe(0);
  });
});