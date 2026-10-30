import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { logoutUnifiedLeads } from "@/lib/unifiedLeadsAuth";
import {
  LayoutDashboard,
  Users,
  Fingerprint,
  // Network, // used by hidden Identity Graph nav item

  Compass,
  Layers,
  Wand2,
  Workflow,
  GitBranch,
  ClipboardList,
  ShieldCheck,
  FlaskConical,
  Code2,
  Plug,
  Send,
  Database,
  Search,
  Bell,
  CircleUser,
  Sparkles,
  Zap,
  ChevronRight,
  Tag,
  Building2,
} from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NavChild = { label: string; to: string };
type NavItem = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  children?: NavChild[];
  /** Working sections — always highlighted in the nav, even when not selected. */
  live?: boolean;
};

const NAV: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, group: "Overview" },

  { label: "People Explorer", to: "/people", icon: Users, group: "Identity" },
  // HIDDEN (historical implementation — kept for future reference):
  // Identity Console and Identity Graph are being replaced by a newer UI.
  // Their route files remain intact; only the navigation entries are disabled.
  // {
  //   label: "Identity Console",
  //   to: "/identity-console",
  //   icon: Fingerprint,
  //   group: "Identity",
  //   children: [
  //     { label: "Identity Events", to: "/identity-console" },
  //     { label: "Decisions", to: "/identity-console/decisions" },
  //     { label: "Accuracy", to: "/identity-console/accuracy" },
  //     { label: "Errors", to: "/identity-console/errors" },
  //     { label: "Operations", to: "/identity-console/operations" },
  //     { label: "Methods & Policies", to: "/identity-console/methods" },
  //   ],
  // },
  // {
  //   label: "Identity Graph",
  //   to: "/identity-graph",
  //   icon: Network,
  //   group: "Identity",
  //   children: [
  //     { label: "Graph Explorer", to: "/identity-graph" },
  //     { label: "Conflicts & Fraud", to: "/identity-graph/conflicts" },
  //     { label: "Merge & Split History", to: "/identity-graph/history" },
  //   ],
  // },
  {
    label: "Session Explorer",
    to: "/sessions",
    icon: ClipboardList,
    group: "Explorer",
    live: true,
  },
  {
    label: "Identity Explorer",
    to: "/identity/explorer",
    icon: Search,
    group: "Explorer",
    live: true,
    children: [
      { label: "Overview", to: "/identity" },
      { label: "Method Analysis", to: "/identity/methods" },
      { label: "Audit Explorer", to: "/identity/explorer" },
      { label: "Identity Errors", to: "/identity/errors" },
      { label: "API Health", to: "/identity/api" },
    ],
  },



  { label: "Audiences", to: "/audiences", icon: Layers, group: "Audiences" },
  { label: "Audience Builder", to: "/audience-builder", icon: Wand2, group: "Audiences" },
  { label: "Reactivation", to: "/reactivation", icon: Zap, group: "Audiences" },
  { label: "Event Mapper", to: "/event-mapper", icon: Workflow, group: "Audiences" },

  { label: "Funnels", to: "/funnels", icon: GitBranch, group: "Analytics" },
  { label: "Form Analytics", to: "/forms", icon: ClipboardList, group: "Analytics" },

  {
    label: "Unified Leads",
    to: "/unified-leads",
    icon: Users,
    group: "Unified Data",
    children: [
      { label: "Explorer", to: "/unified-leads" },
      { label: "Pipeline & API Health", to: "/unified-leads/pipeline-api-health" },
    ],
  },
  {
    label: "Unified Properties",
    to: "/unified-properties",
    icon: Database,
    group: "Unified Data",
    children: [
      { label: "Explorer", to: "/unified-properties" },
      { label: "Pipeline & API Health", to: "/unified-properties/pipeline-api-health" },
    ],
  },
  {
    label: "Cost & Revenue",
    to: "/cost-revenue/overview",
    icon: Database,
    group: "Unified Data",
    children: [
      { label: "Overview", to: "/cost-revenue/overview" },
      // Hidden at the user's request — the Events tab is not needed in the nav.
      // The route file (src/routes/cost-revenue.events.tsx) is untouched, so this line can be restored.
      // { label: "Events", to: "/cost-revenue/events" },
      { label: "Rules", to: "/cost-revenue/rules" },
      { label: "Reconciliation", to: "/cost-revenue/reconciliation" },
    ],
  },

  { label: "Consent & Compliance", to: "/consent", icon: ShieldCheck, group: "Trust" },
  { label: "Identity Accuracy Lab", to: "/accuracy", icon: FlaskConical, group: "Trust" },

  { label: "Event Explorer", to: "/events", icon: Code2, group: "Engineering" },
  { label: "Data Explorer", to: "/data-explorer", icon: Database, group: "Engineering" },
  { label: "Sources", to: "/sources", icon: Plug, group: "Engineering" },
  { label: "Destinations", to: "/destinations", icon: Send, group: "Engineering" },

  { label: "UCT Events", to: "/unified/events", icon: Users, group: "Unified Data Sources" },
  { label: "UCT Properties", to: "/unified/properties", icon: Tag, group: "Unified Data Sources" },
  { label: "UCT Companies", to: "/unified/companies", icon: Building2, group: "Unified Data Sources" },
];


export function AppShell() {
  const location = useLocation();
  const onCostRevenue = location.pathname === "/cost-revenue" || location.pathname.startsWith("/cost-revenue/");
  const groups = Array.from(new Set(NAV.map((n) => n.group)));
  const [openItems, setOpenItems] = useState<Record<string, boolean>>(() => ({
    "/identity/explorer": location.pathname.startsWith("/identity"),
  }));

  useEffect(() => {
    if (location.pathname.startsWith("/identity")) {
      setOpenItems((current) => ({ ...current, "/identity/explorer": true }));
    }
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Alyson CDP</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{"\n"}</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {groups.map((group) => (
            <div key={group} className="mb-4">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </div>
              {NAV.filter((n) => n.group === group).map((item) => {
                const routeActive = (to: string) =>
                  to === "/" ? location.pathname === "/" : location.pathname === to || location.pathname.startsWith(to + "/");
                const isChildActive = item.children?.some((c) => routeActive(c.to)) ?? false;
                const active = routeActive(item.to) || isChildActive;
                const Icon = item.icon;
                const hasChildren = !!item.children?.length;
                const groupOpen = hasChildren && (Boolean(openItems[item.to]) || (item.to === "/cost-revenue/overview" && onCostRevenue));
                return (
                  <div key={item.to}>
                    <Link
                      to={item.to}
                      onClick={() => {
                        if (hasChildren) {
                          setOpenItems((current) => ({ ...current, [item.to]: !current[item.to] }));
                        }
                      }}
                      className={cn(
                        "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : item.live
                            ? "bg-sidebar-accent/50 text-sidebar-accent-foreground font-medium hover:bg-sidebar-accent"
                            : "text-sidebar-foreground/40 hover:text-sidebar-foreground/60",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          active || item.live ? "text-primary" : "text-muted-foreground/50 group-hover:text-muted-foreground",
                        )}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.live && !active && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" aria-label="Working" title="Working section" />
                      )}
                      {hasChildren && (
                        <ChevronRight
                          className={cn(
                            "h-3 w-3 text-muted-foreground transition-transform",
                            groupOpen && "rotate-90",
                          )}
                        />
                      )}
                    </Link>
                    {hasChildren && groupOpen && (
                      <div className="mt-0.5 ml-2 space-y-0.5 border-l border-sidebar-border pl-2">
                        {item.children?.map((c) => {
                          const cActive = location.pathname.replace(/\/$/, "") === c.to || ((c.to === "/unified-revenue/rules" || c.to === "/cost-revenue/rules") && location.pathname.startsWith(c.to + "/"));
                          return (
                            <Link
                              key={c.to}
                              to={c.to}
                              aria-current={cActive ? "page" : undefined}
                              className={cn(
                                "flex items-center rounded-md px-2 py-1 text-[12px] transition-colors",
                                cActive
                                  ? "text-primary font-medium"
                                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-foreground",
                              )}
                            >
                              <span className="truncate">{c.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2 rounded-md p-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-semibold">
              A
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-medium">Admin</span>
              <span className="text-[10px] text-muted-foreground">Alyson CDP</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
          <div className="flex max-w-md flex-1 items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Search by Person ID, email, phone, address, session, event…"
              className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
              ⌘K
            </kbd>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div
              role="status"
              aria-label="Pipeline status: live"
              title="Ingestion pipeline is healthy — 12.4k events/min"
              className="inline-flex items-center rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground"
            >
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-success" />
              Pipeline live
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative rounded-md p-1.5 text-muted-foreground hover:bg-accent" aria-label="Notifications">
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-destructive" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Recent alerts</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <div>
                    <div className="text-xs font-medium">Match rate dipped 4%</div>
                    <div className="text-[10px] text-muted-foreground">Segment · Web · 12 min ago</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <div>
                    <div className="text-xs font-medium">2 conflicts pending review</div>
                    <div className="text-[10px] text-muted-foreground">Identity Graph · 34 min ago</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <div>
                    <div className="text-xs font-medium">Destination sync recovered</div>
                    <div className="text-[10px] text-muted-foreground">Meta CAPI · 1 hr ago</div>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" aria-label="Account menu">
                  <CircleUser className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-xs font-medium">Sarah Chen</div>
                  <div className="text-[10px] font-normal text-muted-foreground">sarah@atlas-analytics.com</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Workspace settings</DropdownMenuItem>
                <DropdownMenuItem>API keys</DropdownMenuItem>
                <DropdownMenuItem>Audit log</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => { void logoutUnifiedLeads().catch(() => {}); }}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>


        <main className="flex-1 overflow-y-auto bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
