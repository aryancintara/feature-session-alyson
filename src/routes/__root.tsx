import { Outlet, Link, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useEffect } from "react";

import { registerPipelineFingerprintInvalidator } from "@/lib/identityReportingCache";
import { configureCognito, registerLeadsQueryCacheClearer } from "@/lib/unifiedLeadsAuth";
import appCss from "../styles.css?url";
import { AppShell } from "@/components/AppShell";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Resolve.io · Identity & Audience Intelligence" },
      { name: "description", content: "Enterprise identity resolution and audience intelligence platform — 200M+ profiles unified across ads, web, forms, SMS, email, and partner data." },
      { name: "author", content: "Resolve.io" },
      { property: "og:title", content: "Resolve.io · Identity & Audience Intelligence" },
      { property: "og:description", content: "Enterprise identity resolution and audience intelligence platform — 200M+ profiles unified across ads, web, forms, SMS, email, and partner data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Resolve.io · Identity & Audience Intelligence" },
      { name: "twitter:description", content: "Enterprise identity resolution and audience intelligence platform — 200M+ profiles unified across ads, web, forms, SMS, email, and partner data." },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    configureCognito();
    registerLeadsQueryCacheClearer(() => queryClient.clear());
  }, [queryClient]);

  useEffect(() => {
    registerPipelineFingerprintInvalidator((scope) => {
      if (scope === "all") {
        void queryClient.invalidateQueries({ queryKey: ["identity-api"] });
        return;
      }
      void queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey;
          if (!Array.isArray(k) || k[0] !== "identity-api") return false;
          return k[1] !== "api-health" && k[1] !== "pipeline";
        },
      });
    });
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}
