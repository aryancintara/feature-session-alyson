import { describe, expect, it } from "vitest";
import { parseSessionDetail } from "./sessionDetail";

describe("session detail fields", () => {
  it("keeps ip_address without optional enrichment", () => {
    const detail = parseSessionDetail({ ip_address: "203.0.113.10", ip: { country_code: null, is_vpn: null, is_bot: null } });
    expect(detail.ip.ip).toBe("203.0.113.10");
    expect(detail.ip.is_vpn).toBeNull();
    expect(detail.ip.is_bot).toBeNull();
  });
  it("uses nested ip.ip when ip_address is absent", () => {
    expect(parseSessionDetail({ ip: { ip: "203.0.113.20" } }).ip.ip).toBe("203.0.113.20");
  });
  it("preserves event metadata and the entire payload rather than its wrapper", () => {
    const payload = { nested: { values: [1, 2, 3] }, extra: "full event" };
    const event = parseSessionDetail({ events: [{ type: "track", event_name: "quiz_start", timestamp: "2026-10-30T01:05:00Z", payload, raw: { wrong: true } }] }).events[0];
    expect(event).toEqual({ type: "track", event_name: "quiz_start", timestamp: "2026-10-30T01:05:00Z", event_id: "", raw: payload });
  });
  it("accepts the raw and raw_payload aliases", () => {
    expect(parseSessionDetail({ events: [{ raw: { a: 1 } }, { raw_payload: { b: 2 } }] }).events.map(e => e.raw)).toEqual([{ a: 1 }, { b: 2 }]);
  });
});
describe("detail events list", () => {
  it("renders the detail response events, not the summary event_count", async () => {
    const { parseSessionDetail } = await import("./sessionDetail");
    const ev = (n: number) => ({ type: "page", event_name: `E${n}`, timestamp: `2026-10-29T0${n}:00:00Z`, payload: { n }, raw: { n } });
    const d = parseSessionDetail({ session_id: "f8b1d707-9ddf-4c2b-8025-fb37af4ec6b2", event_count: 6, ip_address: "1.2.3.4", events: [ev(1), ev(2)] });
    expect(d.events).toHaveLength(2);
    expect(d.events[1].raw).toEqual({ n: 2 });
    expect(d.session?.event_count).toBe(6);
    expect(d.session?.events).toHaveLength(2);
    expect(d.ip.ip).toBe("1.2.3.4");
  });
  it("unwraps a Lambda-style string body", async () => {
    const { parseSessionDetail } = await import("./sessionDetail");
    const d = parseSessionDetail({ statusCode: 200, body: JSON.stringify({ session_id: "x", events: [{ type: "track", event_name: "a", timestamp: "t", payload: {} }] }) });
    expect(d.events).toHaveLength(1);
  });
});
