import { describe, expect, it } from "vitest";
import { parseSessionRow } from "./sessionData";

describe("session attribution mapping", () => {
  it("reads attribution and URL from the existing export columns", () => {
    const session = parseSessionRow({ last_channel: "client", last_utm_source: "aff-cc", last_utm_medium: "affiliate", last_utm_campaign: "1021592", last_utm_term: "house", last_utm_content: "postback", context_url_with_params: "https://example.com/?utm_source=other" });
    expect([session.entry_channel, session.entry_utm_source, session.entry_utm_medium, session.entry_utm_campaign, session.entry_utm_term, session.entry_utm_content]).toEqual(["client", "aff-cc", "affiliate", "1021592", "house", "postback"]);
    expect(session.entry_page_url).toBe("https://example.com/?utm_source=other");
  });

  it("preserves explicit entry fields over last attribution", () => {
    const session = parseSessionRow({ entry_utm_source: "original", last_utm_source: "later", entry_page_url: "https://example.com/original", context_url_with_params: "https://example.com/later" });
    expect(session.entry_utm_source).toBe("original");
    expect(session.entry_page_url).toBe("https://example.com/original");
  });

  it("reads ip_address and clickids from the Session API list row", () => {
    const session = parseSessionRow({
      ip_address: "172.226.190.54",
      clickids: JSON.stringify({ tune_click_id: "abc", affid: "276" }),
    });
    expect(session.ip.ip).toBe("172.226.190.54");
    expect(session.clickids).toEqual({ tune_click_id: "abc", affid: "276" });
  });


  it("reads missing UTM values from the provided URL without inventing a channel", () => {
    const session = parseSessionRow({ properties_url: "https://example.com/?utm_source=partner&utm_medium=sms&utm_campaign=fall&utm_term=home&utm_content=abc" });
    expect([session.entry_utm_source, session.entry_utm_medium, session.entry_utm_campaign, session.entry_utm_term, session.entry_utm_content]).toEqual(["partner", "sms", "fall", "home", "abc"]);
    expect(session.entry_channel).toBe("");
    expect(parseSessionRow({}).entry_utm_source).toBe("");
  });
});