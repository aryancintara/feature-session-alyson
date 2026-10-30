import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSessionUser, loginUnifiedLeads, mapCognitoLoginError, resolveTenant, safeLeadsPath, scrubAuthStorage, TENANT_KEY } from "@/lib/unifiedLeadsAuth";
import { signOut } from "aws-amplify/auth";

/** On the login page itself: clear a broken session without redirecting. */
async function logoutUnifiedLeadsSilently() {
  sessionStorage.removeItem(TENANT_KEY);
  await signOut().catch(() => {});
  scrubAuthStorage(localStorage); scrubAuthStorage(sessionStorage);
}

export const Route = createFileRoute("/unified-leads/login")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: typeof s.redirect === "string" ? s.redirect : undefined }),
  head: () => ({ meta: [
    { title: "Sign in — Unified Leads" },
    { name: "description", content: "Sign in with your Alyson account to use Unified Leads." },
    { property: "og:title", content: "Sign in — Unified Leads" },
    { property: "og:description", content: "Sign in with your Alyson account to use Unified Leads." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const target = safeLeadsPath(redirect);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let live = true;
    getSessionUser().then(async (u) => {
      if (!u || !live) return;
      setPending(true);
      try { await resolveTenant(); window.location.assign(target); }
      catch (err) {
        await logoutUnifiedLeadsSilently();
        if (live) { setError(mapCognitoLoginError(err) || "Sign in failed. Please try again."); setPending(false); }
      }
    });
    return () => { live = false; };
  }, [target]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Enter your email and password."); return; }
    setPending(true); setError("");
    try {
      await loginUnifiedLeads(email, password);
      window.location.assign(target);
    } catch (err) {
      setError(mapCognitoLoginError(err) || "Sign in failed. Please try again."); setPending(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6">
        <div>
          <h1 className="text-lg font-semibold">Sign in to Unified Leads</h1>
          <p className="mt-1 text-xs text-muted-foreground">Use your Alyson account email and password.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ul-email" className="text-xs text-muted-foreground">Email</Label>
          <Input id="ul-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ul-password" className="text-xs text-muted-foreground">Password</Label>
          <Input id="ul-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
        <p className="text-xs text-muted-foreground">New password or MFA required? Finish setup at <a className="text-primary hover:underline" href="https://app.alyson.ai" target="_blank" rel="noreferrer">app.alyson.ai</a>.</p>
      </form>
    </div>
  );
}
