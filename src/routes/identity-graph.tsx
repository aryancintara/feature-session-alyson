import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/identity-graph")({
  component: IdentityGraphLayout,
});

const TABS: { label: string; to: string; exact?: boolean }[] = [
  { label: "Graph Explorer", to: "/identity-graph", exact: true },
  { label: "Conflicts & Fraud", to: "/identity-graph/conflicts" },
  { label: "Merge & Split History", to: "/identity-graph/history" },
];

function IdentityGraphLayout() {
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
                  "border-b-2 px-3 py-2 text-xs font-medium transition-colors",
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
      </div>
    </div>
  );
}
