import { describe, expect, it } from "vitest";
import { journeyFilterHonored, parseSessionPage, sessionDate, sessionRequest } from "./sessionRange";

describe("session API range and count contract", () => {
  it("sends October 5–27 as UTC with October 28 exclusive", () => {
    const start = sessionDate("2026-10-05");
    const end = sessionDate("2026-10-27", true);
    const request = sessionRequest(start?.toISOString() ?? "", end?.toISOString() ?? "");
    expect(request.get("from")).toBe("2026-10-05T00:00:00Z");
    expect(request.get("to")).toBe("2026-10-28T00:00:00Z");
  });
  it("caps each page at 200", () => {
    expect(sessionRequest("2026-10-05", "2026-10-28", 1000).get("page_size")).toBe("200");
  });
  it("keeps the response total of 105116 separate from its 200 page rows", () => {
    const page = parseSessionPage({ total: 105116, rows: Array.from({ length: 200 }, (_, i) => ({ session_id: `s-${i}` })) });
    expect(page.total).toBe(105116);
    expect(page.rows).toHaveLength(200);
  });
  it("never substitutes the page length for a missing total", () => {
    expect(() => parseSessionPage({ rows: [{ session_id: "s-1" }] })).toThrow("missing total");
  });
  it("rejects invalid dates and includes a same-day range", () => {
    expect(sessionDate("2026-02-30")).toBeNull();
    expect(sessionDate("2026-10-27", true)?.toISOString()).toBe("2026-10-28T00:00:00.000Z");
  });
  it("sends Quiz Start to the API as has_quiz_start=true", () => {
    expect(sessionRequest("2026-10-28", "2026-10-29", 200, "quiz_start").get("has_quiz_start")).toBe("true");
    expect(sessionRequest("2026-10-28", "2026-10-29", 200, "partial_lead").get("has_partial_lead")).toBe("true");
    expect(sessionRequest("2026-10-28", "2026-10-29", 200, "consent_given").get("has_consent")).toBe("true");
    expect(sessionRequest("2026-10-28", "2026-10-29", 200, "revenue").get("has_revenue")).toBe("true");
    expect(sessionRequest("2026-10-28", "2026-10-29").has("has_quiz_start")).toBe(false);
  });
  it("uses the response total of 1053 for Quiz Start, not the 200 rows", () => {
    const page = parseSessionPage({ total: 1053, rows: Array.from({ length: 200 }, (_, i) => ({ session_id: `s-${i}`, has_quiz_start: true })) });
    expect(page.total).toBe(1053);
    expect(journeyFilterHonored("quiz_start", page.rows)).toBe(true);
  });
  it("detects an API that ignored the journey filter", () => {
    const page = parseSessionPage({ total: 7710, rows: [{ session_id: "router", has_quiz_start: false }] });
    expect(journeyFilterHonored("quiz_start", page.rows)).toBe(false);
  });
  it("trusts applied_filters when the API says the flag was used", () => {
    const page = parseSessionPage({ total: 1052, rows: [], applied_filters: { has_partial_lead: true } });
    expect(journeyFilterHonored("partial_lead", page.rows, page.applied)).toBe(true);
  });
});
