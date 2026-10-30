import { describe, expect, it } from "vitest";
import { customIdentifiersForDisplay } from "./leadIdentifiers";

describe("customIdentifiersForDisplay", () => {
  it("hides heartbeat_recovered_session but keeps the other identifiers", () => {
    expect(customIdentifiersForDisplay({ heartbeat_recovered_session: true, crm_lead_id: "HL-9" })).toEqual({ crm_lead_id: "HL-9" });
  });

  it("returns null when heartbeat_recovered_session is the only identifier", () => {
    expect(customIdentifiersForDisplay({ heartbeat_recovered_session: true })).toBeNull();
    expect(customIdentifiersForDisplay('{"heartbeat_recovered_session":true}')).toBeNull();
  });

  it("ignores letter case and hyphens in the hidden key", () => {
    expect(customIdentifiersForDisplay({ "Heartbeat-Recovered-Session": "yes", buyer_ref: "7" })).toEqual({ buyer_ref: "7" });
  });

  it("leaves unrelated identifiers untouched", () => {
    expect(customIdentifiersForDisplay({ campaign_ref: "a", heartbeat_recovered_session: false })).toEqual({ campaign_ref: "a" });
    expect(customIdentifiersForDisplay({ campaign_ref: "a" })).toEqual({ campaign_ref: "a" });
  });

  it("drops the hidden entry from arrays and plain strings", () => {
    expect(customIdentifiersForDisplay(["heartbeat_recovered_session", "lead-42"])).toEqual(["lead-42"]);
    expect(customIdentifiersForDisplay("heartbeat_recovered_session: true")).toBeNull();
    expect(customIdentifiersForDisplay("heartbeat_recovered_session: true, buyer_ref: 7")).toBe("heartbeat_recovered_session: true, buyer_ref: 7");
  });

  it("passes empty values through as null", () => {
    expect(customIdentifiersForDisplay(null)).toBeNull();
    expect(customIdentifiersForDisplay(undefined)).toBeNull();
  });
});
