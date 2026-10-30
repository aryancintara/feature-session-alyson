import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AUTH_CLEARED_EVENT, isUnifiedLeadsAuthenticated, safeLeadsPath } from "@/lib/unifiedLeadsAuth";

const isLogin = (p: string) => p.startsWith("/unified-leads/login");

export const Route = createFileRoute("/unified-leads")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined" || !location.pathname.startsWith("/unified-leads") || isLogin(location.pathname)) return;
    if (!(await isUnifiedLeadsAuthenticated())) {
      throw redirect({ to: "/unified-leads/login", search: { redirect: safeLeadsPath(location.href) } });
    }
  },
  component: UnifiedLeadsLayout,
});

/** Client-side gate as well, since SSR cannot see the browser's Cognito session or tenant. */
function UnifiedLeadsLayout() {
  const { pathname, href } = useLocation();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const hide = () => setOk(false);
    window.addEventListener(AUTH_CLEARED_EVENT, hide);
    return () => window.removeEventListener(AUTH_CLEARED_EVENT, hide);
  }, []);
  useEffect(() => {
    if (!pathname.startsWith("/unified-leads") || isLogin(pathname)) { setOk(true); return; }
    let live = true;
    isUnifiedLeadsAuthenticated().then((authed) => {
      if (!live || !window.location.pathname.startsWith("/unified-leads")) return;
      if (authed) setOk(true);
      else window.location.assign("/unified-leads/login?redirect=" + encodeURIComponent(safeLeadsPath(href)));
    });
    return () => { live = false; };
  }, [pathname, href]);
  if (!ok) return <div className="p-6 text-sm text-muted-foreground">Checking sign-in…</div>;
  return <Outlet />;
}
