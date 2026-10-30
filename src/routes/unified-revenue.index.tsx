import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { DataTable, MetricCard, Panel, Pill, Td } from "@/components/identity/bits";
import { RevenueEventDrawer, TenantSelect } from "@/components/revenue/RevenueBits";
import { fmtCompact, fmtMoney } from "@/lib/unifiedTablesData";
import {
  REVENUE_ISSUES, REVENUE_RECORDS, SOURCE_META, groupSum, issueStatusTone, issueTone, lifecycleTotals, procTone, revenueByHour, sourceName, type RevenueRecord,
} from "@/lib/unifiedRevenueData";

export const Route = createFileRoute("/unified-revenue/")({
  head: () => ({
    meta: [
      { title: "Unified Revenue Overview · Resolve.io" },
      { name: "description", content: "Net revenue, events, sources, lifecycle and data issues for Unified Revenue." },
      { property: "og:title", content: "Unified Revenue Overview · Resolve.io" },
      { property: "og:description", content: "Overview of the canonical Unified Revenue layer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OverviewPage,
});

const axis = { fontSize: 11, fill: "var(--color-muted-foreground)" };

function ChartBox({ children }: { children: React.ReactElement }) {
  return <div className="h-72 px-3 pb-3 pt-5 sm:h-80 sm:px-5"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>;
}

type RevenueView = "trend" | "source" | "type" | "lifecycle";

const REVENUE_VIEWS: { id: RevenueView; label: string; title: string; description: string }[] = [
  { id: "trend", label: "Trend", title: "Revenue over time", description: "Net revenue by hour (UTC)" },
  { id: "source", label: "Source", title: "Revenue by source", description: "Net revenue contribution across connected sources" },
  { id: "type", label: "Revenue type", title: "Revenue by revenue type", description: "Net revenue grouped by business model" },
  { id: "lifecycle", label: "Lifecycle", title: "Revenue lifecycle", description: "Estimated → Earned → Invoiced → Received" },
];

function OverviewPage() {
  const [sel, setSel] = useState<RevenueRecord | null>(null);
  const [revenueView, setRevenueView] = useState<RevenueView>("trend");
  const net = REVENUE_RECORDS.reduce((s, r) => s + r.net_revenue, 0);
  const missing = REVENUE_RECORDS.filter((r) => !r.session_id).length;
  const processed = REVENUE_RECORDS.filter((r) => r.processing_status === "processed").length;
  const health = (processed / REVENUE_RECORDS.length) * 100;
  const open = REVENUE_ISSUES.filter((i) => i.status === "Open" || i.status === "Investigating").length;
  const bySource = groupSum("source_id").map((d) => ({ ...d, name: sourceName(d.name) }));
  const recent = [...REVENUE_RECORDS].sort((a, b) => b.event_timestamp.localeCompare(a.event_timestamp)).slice(0, 8);
  const activeView = REVENUE_VIEWS.find((view) => view.id === revenueView) ?? REVENUE_VIEWS[0];

  const chart = revenueView === "trend"
    ? <LineChart data={revenueByHour()} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" /><XAxis dataKey="time" tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} tickFormatter={fmtCompact} axisLine={false} tickLine={false} width={48} /><Tooltip formatter={(v: number) => fmtMoney(v)} /><Line dataKey="revenue" name="Net revenue" stroke="var(--color-primary)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} /></LineChart>
    : revenueView === "source"
      ? <BarChart data={bySource} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" /><XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} tickFormatter={fmtCompact} axisLine={false} tickLine={false} width={48} /><Tooltip formatter={(v: number) => fmtMoney(v)} /><Bar dataKey="value" name="Net revenue" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={96} /></BarChart>
      : revenueView === "type"
        ? <BarChart data={groupSum("revenue_type")} layout="vertical" margin={{ top: 4, right: 20, left: 12, bottom: 0 }}><CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--color-border)" /><XAxis type="number" tick={axis} tickFormatter={fmtCompact} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" tick={axis} width={90} axisLine={false} tickLine={false} /><Tooltip formatter={(v: number) => fmtMoney(v)} /><Bar dataKey="value" name="Net revenue" fill="var(--color-info)" radius={[0, 4, 4, 0]} maxBarSize={34} /></BarChart>
        : <BarChart data={lifecycleTotals()} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" /><XAxis dataKey="stage" tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} tickFormatter={fmtCompact} axisLine={false} tickLine={false} width={48} /><Tooltip formatter={(v: number) => fmtMoney(v)} /><Bar dataKey="value" name="Revenue" fill="var(--color-success)" radius={[4, 4, 0, 0]} maxBarSize={96} /></BarChart>;

  return (
    <div className="pb-10">
      <PageHeader title="Unified Revenue" subtitle="Canonical revenue layer across all revenue sources." actions={<TenantSelect />} />
      <div className="grid gap-3 px-6 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Total net revenue" value={fmtMoney(net)} />
        <MetricCard label="Revenue events" value={fmtCompact(REVENUE_RECORDS.length)} />
        <MetricCard label="Revenue sources" value={String(Object.keys(SOURCE_META).length)} />
        <MetricCard label="Open issues" value={String(open)} tone="warning" />
        <MetricCard label="Missing session IDs" value={String(missing)} tone="warning" />
        <Link to="/unified-revenue/runs" className="rounded-xl transition hover:ring-2 hover:ring-primary/40" title="View pipeline runs">
          <MetricCard label="Processing health" value={`${health.toFixed(1)}%`} sub="View pipeline runs →" tone={health >= 90 ? "success" : "warning"} />
        </Link>
      </div>
      <div className="mt-4 grid gap-4 px-6 lg:grid-cols-2">
        <Panel
          className="lg:col-span-2"
          title={activeView.title}
          description={activeView.description}
          actions={
            <div className="flex flex-wrap justify-end gap-1 rounded-lg bg-muted/60 p-1" role="group" aria-label="Revenue chart view">
              {REVENUE_VIEWS.map((view) => (
                <Button
                  key={view.id}
                  type="button"
                  variant={revenueView === view.id ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  aria-pressed={revenueView === view.id}
                  onClick={() => setRevenueView(view.id)}
                >
                  {view.label}
                </Button>
              ))}
            </div>
          }
        >
          <ChartBox>{chart}</ChartBox>
        </Panel>
        <Panel title="Recent revenue events" actions={<Link to="/unified-revenue/events" className="text-xs text-primary">View all</Link>}>
          <DataTable head={["Event", "Source", "Type", "Net", "Status"]} align={["left", "left", "left", "right", "left"]}>
            {recent.map((r) => (
              <tr key={r.revenue_summary_id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSel(r)}>
                <Td mono>{r.revenue_summary_id}</Td><Td>{sourceName(r.source_id)}</Td><Td>{r.revenue_type}</Td><Td right>{fmtMoney(r.net_revenue)}</Td><Td><Pill tone={procTone(r.processing_status)}>{r.processing_status}</Pill></Td>
              </tr>
            ))}
          </DataTable>
        </Panel>
        <Panel title="Recent issues" actions={<Link to="/unified-revenue/issues" className="text-xs text-primary">View all</Link>}>
          <DataTable head={["Severity", "Issue", "Source", "Status"]}>
            {REVENUE_ISSUES.map((i) => (
              <tr key={i.id}><Td><Pill tone={issueTone(i.severity)}>{i.severity}</Pill></Td><Td>{i.title}</Td><Td>{i.source}</Td><Td><Pill tone={issueStatusTone(i.status)}>{i.status}</Pill></Td></tr>
            ))}
          </DataTable>
        </Panel>
      </div>
      <RevenueEventDrawer record={sel} onClose={() => setSel(null)} />
    </div>
  );
}
