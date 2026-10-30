import { describe, expect, it } from "vitest";
import { pickRecent, presentEvent, sourceLabel } from "./leadEvents";

const ev = (o: Partial<Parameters<typeof presentEvent>[0]>) => ({ event_type: "", event_subtype: null, event_source: null, old_value: null, new_value: null, ...o });

describe("presentEvent", () => {
  it("stage change with old and new", () => {
    const v = presentEvent(ev({ event_type: "STAGE_CHANGED", old_value: "contacted", new_value: "connected" }));
    expect(v.title).toBe("Buyer stage changed");
    expect(v.summary).toBe("Contacted → Connected");
  });
  it("stage update with only new value never invents a previous stage", () => {
    const v = presentEvent(ev({ event_type: "x", event_subtype: "investor_lead_stage_update", new_value: "connected" }));
    expect(v.title).toBe("Buyer stage updated");
    expect(v.summary).toBe("Buyer stage updated to Connected");
  });
  it("known event keys", () => {
    expect(presentEvent(ev({ event_type: "auto_dial" })).title).toBe("Automatic call initiated");
    expect(presentEvent(ev({ event_type: "called_no_msg" })).title).toBe("Call attempted — no message");
    expect(presentEvent(ev({ event_type: "ai_intro_triggered" })).title).toBe("AI introduction triggered");
    expect(presentEvent(ev({ event_type: "LEAD_CREATED" })).title).toBe("Lead created");
  });
  it("friendly source label", () => {
    expect(sourceLabel("homelight_sales_events")).toBe("Homelight");
  });
});

describe("pickRecent", () => {
  it("prefers stage/call events over routine noise", () => {
    const list = [
      { ...ev({ event_type: "eligibility_check" }), event_timestamp: "2026-08-05" },
      { ...ev({ event_type: "eligibility_check" }), event_timestamp: "2026-08-04" },
      { ...ev({ event_type: "STAGE_CHANGED", new_value: "connected" }), event_timestamp: "2026-08-01" },
      { ...ev({ event_type: "auto_dial" }), event_timestamp: "2026-08-02" },
    ];
    expect(pickRecent(list).map((e) => e.event_type)).toEqual(["eligibility_check", "auto_dial", "STAGE_CHANGED"]);
  });
});
