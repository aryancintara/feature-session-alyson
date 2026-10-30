/**
 * Unified Leads sign-in (browser only): Amplify Cognito sign-in → Cognito GetUser → Palisade sign-in → tenant.
 * Tenant lives in sessionStorage; the API gets the ID token plus client/workspace ids. Never calls Athena.
 */
import { Amplify } from "aws-amplify";
import { signIn, signOut, fetchAuthSession, getCurrentUser } from "aws-amplify/auth";

const env = import.meta.env as Record<string, string | undefined>;
const pick = (v: string | undefined, d: string) => (v || "").trim() || d;
export const COGNITO_USER_POOL_ID = pick(env.VITE_COGNITO_USER_POOL_ID, "us-west-2_ZL4ElZy4r");
export const COGNITO_CLIENT_ID = pick(env.VITE_COGNITO_CLIENT_ID, "hrp03a37bqti7capfoptd8737");
export const COGNITO_IDP_URL = pick(env.VITE_COGNITO_IDP_URL, "https://cognito-idp.us-west-2.amazonaws.com/");
export const PALISADE_API_BASE_URL = pick(env.VITE_PALISADE_API_BASE_URL, "https://api-stage.palisade.ai").replace(/\/$/, "");
export const TENANT_KEY = "unified_leads_tenant_v1";
export const AUTH_CLEARED_EVENT = "unified-leads-auth-cleared";
export const cognitoConfigured = true;

let configured = false;
export function configureCognito() {
  if (configured) return;
  Amplify.configure({ Auth: { Cognito: { userPoolId: COGNITO_USER_POOL_ID, userPoolClientId: COGNITO_CLIENT_ID } } });
  configured = true;
}
export const isUnifiedLeadsAuthEnabled = () => true;

export interface LeadsTenant {
  clientId: string; workspaceId: string;
  accountName: string | null; workspaceName: string | null;
  firstName: string | null; lastName: string | null; email: string | null;
}

const ss = () => (typeof window === "undefined" ? null : window.sessionStorage);
export function readTenant(): LeadsTenant | null {
  try {
    const raw = ss()?.getItem(TENANT_KEY); if (!raw) return null;
    const t = JSON.parse(raw) as LeadsTenant;
    return t?.clientId && t?.workspaceId ? t : null;
  } catch { return null; }
}
function writeTenant(t: LeadsTenant) { ss()?.setItem(TENANT_KEY, JSON.stringify(t)); }
function clearTenant() {
  ss()?.removeItem(TENANT_KEY);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_CLEARED_EVENT));
}

async function tokens() {
  configureCognito();
  try { const { tokens } = await fetchAuthSession(); return tokens ?? null; } catch { return null; }
}
export async function getIdToken(): Promise<string | null> { return (await tokens())?.idToken?.toString() || null; }

class ApiError extends Error {}
const apiMessage = (body: unknown, fallback: string) => {
  const b = body as Record<string, unknown> | null;
  const m = b?.message ?? b?.Message ?? (b?.response as Record<string, unknown> | undefined)?.message ?? b?.error;
  return typeof m === "string" && m ? m : fallback;
};
async function json(res: Response) { try { return await res.json(); } catch { return null; } }

/** Pure: tenant from the Palisade signin body. Throws when client or workspace is missing. */
export function tenantFromPalisade(body: unknown, email: string | null = null): LeadsTenant {
  const r = ((body as Record<string, unknown>)?.data as Record<string, unknown>)?.response as Record<string, any> | undefined;
  const clientId = r?.id != null ? String(r.id) : "";
  const ws = Array.isArray(r?.workspaces) ? r!.workspaces[0] : undefined;
  const workspaceId = ws?.id != null ? String(ws.id) : "";
  if (!clientId || !workspaceId) throw new ApiError("Palisade sign-in did not return a client and workspace.");
  const acct = Array.isArray(r?.account) ? r!.account[0] : undefined;
  const s = (v: unknown) => (v == null || v === "" ? null : String(v));
  return { clientId, workspaceId, accountName: s(acct?.name), workspaceName: s(ws?.name), firstName: s(r?.firstName ?? r?.first_name), lastName: s(r?.lastName ?? r?.last_name), email: s(r?.email) ?? email };
}

async function bootstrapTenant(): Promise<LeadsTenant> {
  const t = await tokens();
  const accessToken = t?.accessToken?.toString(); const idToken = t?.idToken?.toString();
  if (!accessToken || !idToken) throw new ApiError("Your session has ended. Please sign in again.");
  const gu = await fetch(COGNITO_IDP_URL, { method: "POST", headers: { "Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": "AWSCognitoIdentityProviderService.GetUser" }, body: JSON.stringify({ AccessToken: accessToken }) });
  const guBody = await json(gu);
  if (!gu.ok) throw new ApiError(apiMessage(guBody, `Cognito GetUser failed (${gu.status})`));
  const email = (guBody?.UserAttributes as { Name: string; Value: string }[] | undefined)?.find((a) => a.Name === "email")?.Value ?? null;
  const ps = await fetch(`${PALISADE_API_BASE_URL}/userManagement/signin`, { method: "POST", headers: { accept: "application/json, text/plain, */*", "content-type": "application/json", "x-auth-token": idToken }, body: "{}" });
  const psBody = await json(ps);
  if (!ps.ok) throw new ApiError(apiMessage(psBody, `Palisade sign-in failed (${ps.status})`));
  return tenantFromPalisade(psBody, email);
}

let generation = 0;
let inflight: Promise<LeadsTenant> | null = null;
/** Shares one in-flight bootstrap; a sign-out during bootstrap (generation bump) discards its result. */
export function resolveTenant(): Promise<LeadsTenant> {
  const existing = readTenant(); if (existing) return Promise.resolve(existing);
  if (inflight) return inflight;
  const gen = generation;
  const p = bootstrapTenant().then((t) => {
    if (gen !== generation) throw new ApiError("Sign-in was cancelled.");
    writeTenant(t); return t;
  }).finally(() => { if (inflight === p) inflight = null; });
  inflight = p;
  return p;
}

/** Fresh per request: ID token + tenant, or null when there is no valid session. */
export async function getLeadsCredentials(): Promise<{ idToken: string; tenant: LeadsTenant } | null> {
  const idToken = await getIdToken(); if (!idToken) return null;
  try { return { idToken, tenant: await resolveTenant() }; } catch { return null; }
}

export async function getSessionUser(): Promise<{ sub: string; email: string } | null> {
  configureCognito();
  try {
    await getCurrentUser();
    const payload = ((await tokens())?.idToken?.payload || {}) as Record<string, unknown>;
    if (!payload.sub) return null;
    return { sub: String(payload.sub), email: String(payload.email || payload["cognito:username"] || "") };
  } catch { return null; }
}
export async function isUnifiedLeadsAuthenticated() {
  if (!(await getSessionUser())) return false;
  try { await resolveTenant(); return true; } catch { return false; }
}

const SETUP = "Account setup incomplete";
export async function loginUnifiedLeads(email: string, password: string): Promise<LeadsTenant> {
  configureCognito();
  generation++; inflight = null; ss()?.removeItem(TENANT_KEY);
  try {
    const result = await signIn({ username: email.trim(), password });
    if (result?.nextStep?.signInStep && result.nextStep.signInStep !== "DONE") {
      await signOut().catch(() => {});
      throw new Error(SETUP);
    }
  } catch (err) {
    if ((err as { name?: string })?.name !== "UserAlreadyAuthenticatedException") throw err;
  }
  return resolveTenant();
}

/** Remove every auth-related key from a Storage. */
export function scrubAuthStorage(store: Storage | null | undefined) {
  if (!store) return;
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k) keys.push(k); }
  keys.forEach((k) => {
    if (k === TENANT_KEY || k.startsWith("amplify-") || k.startsWith("Amplify") || k.startsWith("CognitoIdentityServiceProvider.") || k.includes(COGNITO_CLIENT_ID) || /cognito|aws-amplify|LastAuthUser/i.test(k) || /idToken|accessToken|refreshToken/.test(k)) store.removeItem(k);
  });
}

let clearQueryCache: (() => void) | null = null;
export function registerLeadsQueryCacheClearer(fn: () => void) { clearQueryCache = fn; }

/** Only same-origin paths under /unified-leads (never the login page). */
export function safeLeadsPath(path: unknown): string {
  if (typeof path !== "string" || !path.startsWith("/unified-leads") || path.startsWith("//")) return "/unified-leads";
  if (path.startsWith("/unified-leads/login")) return "/unified-leads";
  return path;
}

let redirecting = false;
/** Full logout: cancel bootstrap, clear tenant, global sign-out, scrub storage, clear cache, hard-navigate to login. */
export async function logoutUnifiedLeads() {
  generation++; inflight = null;
  clearTenant();
  configureCognito();
  try { await signOut({ global: true }); } catch { await signOut().catch(() => {}); }
  if (typeof window !== "undefined") { scrubAuthStorage(window.localStorage); scrubAuthStorage(window.sessionStorage); }
  try { clearQueryCache?.(); } catch { /* ignore */ }
  if (typeof window === "undefined" || redirecting) return;
  redirecting = true;
  const safe = safeLeadsPath(window.location.pathname + window.location.search);
  window.location.assign("/unified-leads/login?redirect=" + encodeURIComponent(safe));
}
export const handleUnifiedLeadsUnauthorized = logoutUnifiedLeads;
/** Test-only reset of module state. */
export function __resetLeadsAuthForTests() { generation = 0; inflight = null; redirecting = false; }

export function mapCognitoLoginError(err: unknown): string {
  const name = (err as { name?: string })?.name;
  const message = (err as { message?: string })?.message;
  if (message === SETUP) return "Account setup incomplete. Finish setup at https://app.alyson.ai then try again.";
  if (err instanceof ApiError && message) return message;
  switch (name) {
    case "NotAuthorizedException": return "Incorrect email or password.";
    case "UserNotFoundException": return "No account for that email.";
    case "LimitExceededException":
    case "TooManyRequestsException":
    case "TooManyFailedAttemptsException": return "Too many attempts. Try again later.";
    case "UserAlreadyAuthenticatedException": return "";
    default: return "Sign in failed. Please try again.";
  }
}
