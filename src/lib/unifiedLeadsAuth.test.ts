import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
let idToken: string | null = "id-1";
vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
vi.mock("aws-amplify/auth", () => ({
  signIn: vi.fn(async () => { calls.push("signIn"); return { nextStep: { signInStep: "DONE" } }; }),
  signOut: vi.fn(async () => { calls.push("signOut"); }),
  getCurrentUser: vi.fn(async () => ({})),
  fetchAuthSession: vi.fn(async () => ({ tokens: idToken ? { idToken: { toString: () => idToken, payload: { sub: "u1" } }, accessToken: { toString: () => "acc-1" } } : undefined })),
}));

class MemStorage implements Storage {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}
const local = new MemStorage(); const session = new MemStorage();
const assign = vi.fn();
vi.stubGlobal("window", { sessionStorage: session, localStorage: local, location: { pathname: "/unified-leads", search: "?x=1", assign }, dispatchEvent: vi.fn() });

const palisade = (id: unknown, ws: unknown) => ({ data: { response: { id, workspaces: ws ? [{ id: ws, name: "WS" }] : [], account: [{ name: "Acme" }], email: "a@b.co" } } });
let tenantN = 0;
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  const u = String(url);
  if (u.includes("cognito-idp")) { calls.push("GetUser"); return new Response(JSON.stringify({ UserAttributes: [] }), { status: 200 }); }
  if (u.includes("/userManagement/signin")) { calls.push("Palisade"); tenantN++; return new Response(JSON.stringify(palisade(`c${tenantN}`, `w${tenantN}`)), { status: 200 }); }
  calls.push(`api:${u}`);
  return new Response(u.includes("unauth") ? "" : "{}", { status: u.includes("unauth") ? 401 : 200, headers: { "X-Export-Row-Count": "2" } });
});
vi.stubGlobal("fetch", fetchMock);

const auth = await import("./unifiedLeadsAuth");
const api = await import("./unifiedLeadsApi");

beforeEach(() => { calls.length = 0; local.clear(); session.clear(); assign.mockClear(); fetchMock.mockClear(); idToken = "id-1"; auth.__resetLeadsAuthForTests(); });

describe("Unified Leads sign-in", () => {
  it("runs signIn, then Cognito GetUser, then Palisade, and stores that tenant", async () => {
    const t = await auth.loginUnifiedLeads("a@b.co", "pw");
    expect(calls).toEqual(["signIn", "GetUser", "Palisade"]);
    expect(JSON.parse(session.getItem(auth.TENANT_KEY)!).clientId).toBe(t.clientId);
    const p = fetchMock.mock.calls.find(([u]) => String(u).includes("signin"))!;
    expect((p[1]!.headers as Record<string, string>)["x-auth-token"]).toBe("id-1");
  });

  it("takes client from response.id and workspace from workspaces[0].id", () => {
    expect(auth.tenantFromPalisade(palisade(42, 7))).toMatchObject({ clientId: "42", workspaceId: "7", accountName: "Acme" });
    expect(() => auth.tenantFromPalisade(palisade(42, null))).toThrow("Palisade sign-in did not return a client and workspace.");
  });

  it("a new login drops the old tenant and fetches a fresh one", async () => {
    session.setItem(auth.TENANT_KEY, JSON.stringify({ clientId: "old", workspaceId: "old" }));
    const t = await auth.loginUnifiedLeads("a@b.co", "pw");
    expect(t.clientId).not.toBe("old");
  });
});

describe("Unified Leads API scoping", () => {
  it("sends tenant headers and overrides caller-supplied client_id/workspace_id", async () => {
    session.setItem(auth.TENANT_KEY, JSON.stringify({ clientId: "C1", workspaceId: "W1" }));
    await api.leadsGet("/v1/leads", { client_id: "evil", workspace_id: "evil", q: "x" });
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    const u = new URL(String(url));
    expect(u.searchParams.get("client_id")).toBe("C1");
    expect(u.searchParams.get("workspace_id")).toBe("W1");
    const h = init!.headers as Record<string, string>;
    expect(h["x-client-id"]).toBe("C1"); expect(h["x-workspace-id"]).toBe("W1"); expect(h.Authorization).toBe("Bearer id-1");
  });

  it("reads the tenant fresh on every request", async () => {
    session.setItem(auth.TENANT_KEY, JSON.stringify({ clientId: "C1", workspaceId: "W1" }));
    await api.leadsGet("/v1/leads");
    session.setItem(auth.TENANT_KEY, JSON.stringify({ clientId: "C2", workspaceId: "W2" }));
    await api.leadsGet("/v1/leads");
    expect(new URL(String(fetchMock.mock.calls.at(-1)![0])).searchParams.get("client_id")).toBe("C2");
  });

  it("scopes CSV exports to the tenant", async () => {
    session.setItem(auth.TENANT_KEY, JSON.stringify({ clientId: "C1", workspaceId: "W1" }));
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => {} }));
    vi.stubGlobal("document", { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } });
    await api.leadsDownloadCsv("/v1/leads", { format: "csv", client_id: "evil" });
    const u = new URL(String(fetchMock.mock.calls.at(-1)![0]));
    expect(u.searchParams.get("client_id")).toBe("C1"); expect(u.searchParams.get("workspace_id")).toBe("W1");
  });

  it("does not call the API without a session, and logs out", async () => {
    idToken = null;
    await expect(api.leadsGet("/v1/leads")).rejects.toThrow("Your session has ended");
    expect(calls.some((c) => c.startsWith("api:"))).toBe(false);
    expect(assign).toHaveBeenCalled();
  });

  it("on 401 runs a full logout before throwing", async () => {
    session.setItem(auth.TENANT_KEY, JSON.stringify({ clientId: "C1", workspaceId: "W1" }));
    local.setItem("CognitoIdentityServiceProvider.x.idToken", "t");
    await expect(api.leadsGet("/unauth")).rejects.toThrow("Your session has ended. Please sign in again.");
    expect(session.getItem(auth.TENANT_KEY)).toBeNull();
    expect(local.length).toBe(0);
    expect(calls).toContain("signOut");
    expect(assign).toHaveBeenCalledWith("/unified-leads/login?redirect=" + encodeURIComponent("/unified-leads?x=1"));
  });
});

describe("storage and redirects", () => {
  it("scrubs every auth key and leaves others", () => {
    const s = new MemStorage();
    ["unified_leads_tenant_v1", "amplify-signin", "AmplifyX", "CognitoIdentityServiceProvider.a.b", `foo.${auth.COGNITO_CLIENT_ID}`, "my-cognito", "aws-amplify-cache", "LastAuthUser", "idToken", "accessToken", "refreshToken", "theme"].forEach((k) => s.setItem(k, "1"));
    auth.scrubAuthStorage(s);
    expect([...s.m.keys()]).toEqual(["theme"]);
  });

  it("only allows same-origin /unified-leads paths that are not the login page", () => {
    expect(auth.safeLeadsPath("/unified-leads?x=1")).toBe("/unified-leads?x=1");
    expect(auth.safeLeadsPath("/unified-leads/login")).toBe("/unified-leads");
    expect(auth.safeLeadsPath("//evil.com/unified-leads")).toBe("/unified-leads");
    expect(auth.safeLeadsPath("https://evil.com")).toBe("/unified-leads");
    expect(auth.safeLeadsPath("/cost-revenue")).toBe("/unified-leads");
  });
});
