import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/identity")({
  head: () => ({
    meta: [
      { title: "Identity Monitoring · Session Summary" },
      { name: "description", content: "Monitor people identity creation, delivery, accuracy, errors, validation, API health and remediation." },
      { property: "og:title", content: "Identity Monitoring · Session Summary" },
      { property: "og:description", content: "Observability console for the people identity graph." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IdentityLayout,
});

const TABS: { label: string; to: string; exact?: boolean }[] = [
  { label: "Overview", to: "/identity", exact: true },
  { label: "Method Analysis", to: "/identity/methods" },
  { label: "Audit Explorer", to: "/identity/explorer" },
  { label: "Identity Errors", to: "/identity/errors" },
  { label: "API Health", to: "/identity/api" },
];

function IdentityLayout() {
  const location = useLocation();
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-background/60 px-6">
        <div className="flex items-center gap-1 overflow-x-auto pt-3">
          {TABS.map((t) => {
            const active = t.exact ? location.pathname === t.to : location.pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Outlet />
        <Toaster />
      </div>
    </div>
  );
}
