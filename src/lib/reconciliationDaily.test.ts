import { describe, expect, it } from "vitest";
import { dailyReportUrl, parseDailyReport, dailyReportStatus, dailyDetailRows, dailyDetailColumns, dailyDetailCsv, type DailyReport } from "./reconciliationDaily";

const report: DailyReport = { run_at: "2026-10-24T03:30:00Z", start: "2026-09-24", end: "2026-10-24", difference_found: false, available_dates: ["2026-10-24", "2026-10-23"], sources: [{ label: "Homelight", status: "matched", source_leads: 12, loaded_leads: 12, source_revenue: 10, loaded_revenue: 10, difference: 0 }] };
describe("daily automatic reconciliation", () => {
  it("uses the daily endpoint and date query for past reports", () => {
    expect(dailyReportUrl()).toMatch(/\/reconcile\/daily$/);
    expect(dailyReportUrl("2026-10-23")).toMatch(/\/reconcile\/daily\?date=2026-10-23$/);
  });
  it("treats HTTP and Lambda 404 as no report", () => {
    expect(parseDailyReport(null, 404)).toBeNull();
    expect(parseDailyReport({ statusCode: 404, body: "not found" })).toBeNull();
  });
  it("preserves totals, dates and period from direct and Lambda bodies", () => {
    expect(parseDailyReport(report)).toEqual(report);
    expect(parseDailyReport({ statusCode: 200, body: JSON.stringify(report) })).toEqual(report);
  });
  it("shows matches green only when no differences or failed sources exist", () => {
    expect(dailyReportStatus(report)).toBe("All sources match");
    expect(dailyReportStatus({ ...report, difference_found: true })).toBe("Differences found");
    expect(dailyReportStatus({ ...report, sources: [{ label: "Phonexa", status: "failed", error: "Timed out" }] })).toBe("Check incomplete");
  });
  it("limits detail display to 200 returned rows", () => {
    const rows = Array.from({ length: 201 }, (_, lead_id) => ({ lead_id }));
    expect(dailyDetailRows(rows)).toHaveLength(200);
    expect(dailyDetailRows(rows)[199].lead_id).toBe(199);
  });
  it("keeps all returned detail fields in CSV", () => {
    const rows = [{ lead_id: 'a,"b', revenue: 10, session_id: "s1", postback: "p1" }];
    const columns = dailyDetailColumns(rows, "missing");
    expect(columns).toContain("postback");
    expect(dailyDetailCsv(rows, columns)).toContain('"a,""b"');
    expect(dailyDetailCsv(rows, columns)).toContain('"p1"');
  });
});