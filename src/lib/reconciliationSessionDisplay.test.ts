import { describe, expect, it } from "vitest";
import { previewSessionDetails } from "../routes/cost-revenue.reconciliation";

const row = { source_record_id: "lead-test", rule_id: "test-rule", rule_version: 1, stored_amount: 10, calculated_amount: 12, delta: 2 };

describe("Reconciliation session attribution", () => {
  it("uses utm_content only as click lookup, never as the chosen session", () => {
    expect(previewSessionDetails({ ...row, utm_content: "click-test", session_id: "session-chosen" })).toMatchObject({ clickId: "click-test", sessionId: "session-chosen" });
    expect(previewSessionDetails({ ...row, utm_content: "click-test" }).sessionId).toBe("");
  });
  it("excludes our_session = no without treating an absent field as no", () => {
    expect(previewSessionDetails({ ...row, our_session: " no " }).excluded).toBe(true);
    expect(previewSessionDetails({ ...row, our_session: "yes" }).excluded).toBe(false);
    expect(previewSessionDetails(row).excluded).toBe(false);
  });
  it("shows only other observed sessions, deduplicated, without changing revenue", () => {
    const attributed = { ...row, session_id: "session-chosen", click_session_observations: [{ session_id: "session-chosen" }, { session_id: "session-other" }, "session-other", "session-third"] };
    expect(previewSessionDetails(attributed).otherSessions).toEqual(["session-other", "session-third"]);
    expect(attributed.calculated_amount).toBe(12);
    expect(attributed.session_id).toBe("session-chosen");
  });
  it("does not invent a session source or observations when fields are absent", () => {
    expect(previewSessionDetails(row)).toMatchObject({ clickId: "", sessionId: "", sessionSource: "", otherSessions: [] });
  });
});