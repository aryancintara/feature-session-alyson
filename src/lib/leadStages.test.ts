import { describe, expect, it } from "vitest";
import { stageLabel, stageTone } from "./leadStages";

describe("stageTone", () => {
  it("missing stages stay neutral", () => {
    expect(stageTone(null)).toBe("neutral");
    expect(stageTone("")).toBe("neutral");
  });
  it("success stages are green", () => {
    for (const s of ["connected", "met_in_person", "closed", "closed_paid", "listing", "in_escrow", "Escrow_Open"]) expect(stageTone(s), s).toBe("success");
  });
  it("intro / qualification stages are blue", () => {
    for (const s of ["introduced", "intro_request", "auto_intro_match", "quiz_match", "investor_qualified", "meeting_scheduled"]) expect(stageTone(s), s).toBe("info");
  });
  it("outreach attempts are amber", () => {
    for (const s of ["contacted", "called_no_msg", "called_left_msg", "agent_left_vm", "called_busy", "client_left_vm"]) expect(stageTone(s), s).toBe("warning");
  });
  it("bad outcomes are red", () => {
    for (const s of ["failed", "removed", "bad_number", "duplicate", "Buyer_Failed"]) expect(stageTone(s), s).toBe("danger");
  });
  it("new / unknown stay neutral", () => {
    for (const s of ["new", "coming_soon", "claimed", "curious_valuation", "some_custom_stage"]) expect(stageTone(s), s).toBe("neutral");
  });
});

describe("stageLabel", () => {
  it("humanizes underscored stages", () => {
    expect(stageLabel("called_no_msg")).toBe("Called No Msg");
    expect(stageLabel("MEETING_SCHEDULED")).toBe("Meeting Scheduled");
  });
  it("blank stays Not reported", () => {
    expect(stageLabel(null)).toBe("Not reported");
  });
});
