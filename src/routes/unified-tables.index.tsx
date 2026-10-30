import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, RefreshCw, Search } from "lucide-react";
import { PageHeader } from "@/components/ui-bits";
import { MetricCard, Pill } from "@/components/identity/bits";
import { AnalyticsTable } from "@/components/AnalyticsTable";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LAST_SYNC, UNIFIED_TABLES, fmtCompact, unifiedApi, type UnifiedTable, statusTone } from "@/lib/unifiedTablesData";

export const Route = createFileRoute("/unified-tables/")({
  head: () => ({
    meta: [
      { title: "Unified Tables · Resolve.io" },
      { name: "description", content: "Explore canonical unified datasets across revenue, leads, sessions, customers, and costs." },
      { property: "og:title", content: "Unified Tables · Resolve.io" },
      { property: "og:description", content: "Explore canonical unified datasets across your platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnifiedTablesPage,
});


function UnifiedTablesPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { data = UNIFIED_TABLES, refetch, isFetching } = useQuery({ queryKey: ["unified-tables"], queryFn: unifiedApi.listTables });
  const rows = data.filter((t) => `${t.name} ${t.domain} ${t.description}`.toLowerCase().includes(q.toLowerCase()));
  const total = data.reduce((s, t) => s + t.records, 0);
  const open = (t: UnifiedTable) => t.status !== "Coming Soon" && navigate({ to: "/unified-tables/$tableId", params: { tableId: t.id } });

  return (
    <div className="pb-10">
      <PageHeader
        title="Unified Tables"
        subtitle="Explore canonical unified datasets across your platform."
        actions={
          <>
            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tables…" className="w-48 bg-transparent outline-none placeholder:text-muted-foreground" />
            </div>
            <span className="text-xs text-muted-foreground">Last synced {LAST_SYNC}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast("Export is not available yet")}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </>
        }
      />
      <div className="grid gap-3 px-6 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Unified Tables" value={String(data.length)} sub="Number of available canonical datasets" />
        <MetricCard label="Total Records" value={fmtCompact(total)} sub="Total records across unified tables" />
        <MetricCard label="Last Pipeline Sync" value={LAST_SYNC} sub="Latest successful data update" tone="success" />
        <MetricCard label="Data Quality Issues" value="24" sub="Records requiring attention" tone="warning" />
      </div>
      <div className="mt-4 px-6">
        <AnalyticsTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={open}
          pageSize={20}
          csvName="unified-tables.csv"
          columns={[
            { key: "name", header: "Table Name", value: (r) => r.name, cell: (r) => (
              <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.description}</div></div>
            ) },
            { key: "domain", header: "Domain", value: (r) => r.domain, cell: (r) => r.domain },
            { key: "records", header: "Records", align: "right", value: (r) => r.records, cell: (r) => fmtCompact(r.records) },
            { key: "sources", header: "Sources", align: "right", value: (r) => r.sources.length, cell: (r) => r.sources.length },
            { key: "updated", header: "Last Updated", value: (r) => r.lastUpdated, cell: (r) => r.lastUpdated },
            { key: "status", header: "Status", value: (r) => r.status, cell: (r) => <Pill tone={statusTone(r.status)}>{r.status}</Pill> },
            { key: "actions", header: "Actions", cell: (r) => r.status === "Coming Soon"
              ? <span className="text-xs text-muted-foreground">—</span>
              : <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); open(r); }}>Open explorer</Button> },
          ]}
        />
      </div>
    </div>
  );
}
