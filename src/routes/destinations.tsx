import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, StatusDot, Mono } from "@/components/ui-bits";
import { AnalyticsTable, Sparkline, VarianceCell, type Column } from "@/components/AnalyticsTable";
import { FilterBar, makeDefaultFilters } from "@/components/FilterBar";
import { DESTINATIONS, type Destination } from "@/lib/destinationsData";
import { formatNum, timeAgo } from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { Plug, AlertTriangle, CheckCircle2, PauseCircle, Plus } from "lucide-react";

export const Route = createFileRoute("/destinations")({
  head: () => ({
    meta: [
      { title: "Destinations · Resolve.io" },
      { name: "description", content: "Outbound integrations and audience activation." },
    ],
  }),
  component: Destinations,
});

const CATEGORY_LABEL: Record<Destination["category"], string> = {
  ads: "Ad Platforms",
  crm: "CRM",
  marketing: "Marketing Automation",
  analytics: "Analytics",
  marketplace: "Lead Marketplaces",
  warehouse: "Data Warehouses",
};

function StatusPill({ status }: { status: Destination["status"] }) {
  const cfg: Record<Destination["status"], { icon: React.ReactNode; cls: string; label: string }> = {
    live: { icon: <CheckCircle2 className="h-3 w-3" />, cls: "bg-success/10 text-success border-success/20", label: "Live" },
    paused: { icon: <PauseCircle className="h-3 w-3" />, cls: "bg-muted text-muted-foreground border-border", label: "Paused" },
    error: { icon: <AlertTriangle className="h-3 w-3" />, cls: "bg-destructive/10 text-destructive border-destructive/20", label: "Error" },
  };
  const c = cfg[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold", c.cls)}>
      {c.icon} {c.label}
    </span>
  );
}

function Destinations() {
  const [filters, setFilters] = useState(makeDefaultFilters());
  const [category, setCategory] = useState<Destination["category"] | "all">("all");

  const rows = useMemo(
    () => (category === "all" ? DESTINATIONS : DESTINATIONS.filter((d) => d.category === category)),
    [category],
  );

  const totals = useMemo(() => {
    const live = DESTINATIONS.filter((d) => d.status === "live").length;
    const errors = DESTINATIONS.filter((d) => d.status === "error").length;
    const events = DESTINATIONS.reduce((s, d) => s + d.events24h, 0);
    const failures = DESTINATIONS.reduce((s, d) => s + d.failures24h, 0);
    return { live, errors, events, failures };
  }, []);

  const columns: Column<Destination>[] = [
    {
      key: "name",
      header: "Destination",
      value: (r) => r.name,
      cell: (r) => (
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">
            {r.vendor.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-medium">{r.name}</div>
            <Mono>{r.vendor} · {CATEGORY_LABEL[r.category]}</Mono>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      value: (r) => r.status,
      cell: (r) => <StatusPill status={r.status} />,
      width: "100px",
    },
    {
      key: "audiences",
      header: "Audiences",
      value: (r) => r.audiencesSynced,
      align: "right",
      cell: (r) => <span className="font-mono text-xs tabular-nums">{r.audiencesSynced}</span>,
      width: "100px",
    },
    {
      key: "events",
      header: "Events 24h",
      value: (r) => r.events24h,
      align: "right",
      cell: (r) => <span className="font-mono text-xs tabular-nums">{formatNum(r.events24h)}</span>,
    },
    {
      key: "trend",
      header: "Trend",
      cell: (r) => <Sparkline data={r.trend} />,
      width: "80px",
    },
    {
      key: "success",
      header: "Success",
      value: (r) => r.successRate,
      align: "right",
      cell: (r) => (
        <span className={cn("font-mono text-xs tabular-nums", r.successRate < 90 && "text-destructive", r.successRate >= 99.5 && "text-success")}>
          {r.successRate.toFixed(2)}%
        </span>
      ),
      width: "100px",
    },
    {
      key: "variance",
      header: "Δ vs prev",
      value: (r) => r.successRate - 99,
      align: "right",
      cell: (r) => <VarianceCell value={r.successRate - 99} suffix="pp" />,
      width: "100px",
      defaultHidden: false,
    },
    {
      key: "latency",
      header: "Latency",
      value: (r) => r.latencyMs,
      align: "right",
      cell: (r) => <span className="font-mono text-xs tabular-nums">{r.latencyMs}ms</span>,
      width: "90px",
    },
    {
      key: "failures",
      header: "Failures 24h",
      value: (r) => r.failures24h,
      align: "right",
      cell: (r) => (
        <span className={cn("font-mono text-xs tabular-nums", r.failures24h > 1000 && "text-warning", r.failures24h > 10000 && "text-destructive")}>
          {formatNum(r.failures24h)}
        </span>
      ),
      defaultHidden: true,
    },
    {
      key: "lastSync",
      header: "Last sync",
      value: (r) => -new Date(r.lastSync).getTime(),
      cell: (r) => <Mono>{timeAgo(r.lastSync)}</Mono>,
      width: "110px",
    },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="Destinations"
        subtitle="Outbound integrations that activate audiences and stream events to downstream systems."
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-3 w-3" /> Add destination
          </button>
        }
      />

      <div className="space-y-3 px-6">
        <FilterBar value={filters} onChange={setFilters} />

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Live integrations", value: `${totals.live} / ${DESTINATIONS.length}`, sub: <span className="text-success">All ad platforms healthy</span> },
            { label: "Errored destinations", value: totals.errors, sub: <span className="text-destructive">TikTok Events API</span> },
            { label: "Events sent · 24h", value: formatNum(totals.events) },
            { label: "Delivery failures · 24h", value: formatNum(totals.failures), sub: <span className="text-warning">Mostly TikTok</span> },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{k.label}</div>
              <div className="mt-1 font-mono text-2xl tabular-nums">{k.value}</div>
              {k.sub && <div className="mt-1 text-xs">{k.sub}</div>}
            </div>
          ))}
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(["all", ...Object.keys(CATEGORY_LABEL)] as Array<Destination["category"] | "all">).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                category === c
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-accent",
              )}
            >
              {c === "all" ? "All categories" : CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>

        <AnalyticsTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          searchPlaceholder="Search destinations…"
          csvName="destinations.csv"
          pageSize={10}
        />

        {/* Activation summary */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Recent activations</h3>
            </div>
            <Mono>Live</Mono>
          </div>
          <ul className="divide-y divide-border">
            {[
              { aud: "SQL Audience", dst: "Salesforce Sales Cloud", count: 142_318, ago: "2m ago" },
              { aud: "High Purchase Propensity", dst: "Meta Conversions API", count: 612_044, ago: "4m ago" },
              { aud: "Repeat Visitors", dst: "Klaviyo Lists", count: 38_412_004, ago: "11m ago" },
              { aud: "Do Not Contact", dst: "All marketing destinations", count: 9_233_881, ago: "32m ago" },
            ].map((r) => (
              <li key={r.aud} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <StatusDot status="active" />
                  <span className="font-medium">{r.aud}</span>
                  <Mono>→</Mono>
                  <span className="text-muted-foreground">{r.dst}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs tabular-nums">{formatNum(r.count)} people</span>
                  <Mono>{r.ago}</Mono>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
