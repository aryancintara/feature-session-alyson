import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/ui-bits";
import { DataTable, MetricCard, Pill, Td } from "@/components/identity/bits";
import { AnalyticsTable } from "@/components/AnalyticsTable";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TenantSelect } from "@/components/revenue/RevenueBits";
import { fmtMoney } from "@/lib/unifiedTablesData";
import { PIPELINE_RUNS, REVENUE_ISSUES, REVENUE_RECORDS, fmtDuration, issueStatusTone, issueTone, procTone, revenueSources, runTone } from "@/lib/unifiedRevenueData";

export const Route = createFileRoute("/unified-revenue/sources")({
  head: () => ({
    meta: [
      { title: "Revenue Sources · Resolve.io" },
      { name: "description", content: "Connectors feeding Unified Revenue with events, revenue, status and issues." },
      { property: "og:title", content: "Revenue Sources · Resolve.io" },
      { property: "og:description", content: "Revenue source connectors and their health." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { source?: string } => ({ source: typeof s.source === "string" ? s.source : undefined }),
  component: SourcesPage,
});

type Src = ReturnType<typeof revenueSources>[number];
const ts = (s: string) => s.replace("T", " ").slice(0, 16);
const H = "mb-2 mt-5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground";

function SourcesPage() {
  const rows = revenueSources();
  const { source } = Route.useSearch();
  const [selId, setSelId] = useState<string | null>(source ?? null);
  const sel = rows.find((r) => r.id === selId) ?? null;
  return (
    <div className="pb-10">
      <PageHeader title="Revenue Sources" subtitle="Systems that send revenue into Unified Revenue." actions={<TenantSelect />} />
      <div className="px-6">
        <AnalyticsTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => setSelId(r.id)}
          pageSize={20}
          csvName="revenue-sources.csv"
          storageKey="unified-revenue-sources"
          columns={[
            { key: "source", header: "Source Name", value: (r) => r.source, cell: (r) => <span className="font-medium">{r.source}</span> },
            { key: "connector", header: "Connector Type", value: (r) => r.connector, cell: (r) => r.connector },
            { key: "types", header: "Revenue Types", value: (r) => r.revenueTypes.join(", "), cell: (r) => <span className="text-xs">{r.revenueTypes.join(", ")}</span> },
            { key: "events", header: "Revenue Event Count", align: "right", value: (r) => r.events, cell: (r) => r.events },
            { key: "revenue", header: "Net Revenue", align: "right", value: (r) => r.revenue, cell: (r) => fmtMoney(r.revenue) },
            { key: "est", header: "Estimated Revenue", align: "right", value: (r) => r.estimated, cell: (r) => fmtMoney(r.estimated) },
            { key: "last", header: "Last Revenue Event", value: (r) => r.lastEvent, cell: (r) => ts(r.lastEvent) },
            { key: "run", header: "Last Processing Run", value: (r) => r.lastRun, cell: (r) => <span className="font-mono text-xs">{r.lastRun}</span> },
            { key: "issues", header: "Issue Count", align: "right", value: (r) => r.issues, cell: (r) => r.issues },
            { key: "status", header: "Processing Status", value: (r) => r.status, cell: (r) => <Pill tone={r.status === "Healthy" ? "success" : "warning"}>{r.status}</Pill> },
          ]}
        />
      </div>
      <SourceDrawer src={sel} onClose={() => setSelId(null)} />
    </div>
  );
}

function SourceDrawer({ src, onClose }: { src: Src | null; onClose: () => void }) {
  const recs = src ? REVENUE_RECORDS.filter((r) => r.source_id === src.id) : [];
  const recent = [...recs].sort((a, b) => b.event_timestamp.localeCompare(a.event_timestamp)).slice(0, 6);
  const runs = src ? PIPELINE_RUNS.filter((r) => r.sources.includes(src.id)).slice(0, 6) : [];
  const issues = src ? REVENUE_ISSUES.filter((i) => i.source === src.source) : [];
  const sum = (k: "earned_revenue" | "invoiced_revenue" | "received_revenue") => recs.reduce((s, r) => s + r[k], 0);
  return (
    <Sheet open={!!src} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {src && (
          <>
            <SheetHeader>
              <SheetTitle>{src.source}</SheetTitle>
              <div className="flex gap-2"><Pill tone={src.status === "Healthy" ? "success" : "warning"}>{src.status}</Pill><span className="text-xs text-muted-foreground">{src.connector}</span></div>
            </SheetHeader>
            <div className={H}>Source overview</div>
            <dl className="divide-y divide-border rounded-lg border border-border text-sm">
              {[["Connector type", src.connector], ["Revenue types", src.revenueTypes.join(", ")], ["Last revenue event", ts(src.lastEvent)], ["Last processing run", src.lastRun]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
              ))}
            </dl>
            <div className={H}>Revenue metrics</div>
            <div className="grid grid-cols-3 gap-2">
              <MetricCard label="Events" value={String(src.events)} />
              <MetricCard label="Net" value={fmtMoney(src.revenue)} />
              <MetricCard label="Estimated" value={fmtMoney(src.estimated)} />
              <MetricCard label="Earned" value={fmtMoney(sum("earned_revenue"))} />
              <MetricCard label="Invoiced" value={fmtMoney(sum("invoiced_revenue"))} />
              <MetricCard label="Received" value={fmtMoney(sum("received_revenue"))} />
            </div>
            <div className={H}>Recent revenue events</div>
            <DataTable head={["Event", "Time", "Net", "Status"]} align={["left", "left", "right", "left"]}>
              {recent.map((r) => <tr key={r.revenue_summary_id}><Td mono>{r.revenue_summary_id}</Td><Td>{ts(r.event_timestamp)}</Td><Td right>{fmtMoney(r.net_revenue)}</Td><Td><Pill tone={procTone(r.processing_status)}>{r.processing_status}</Pill></Td></tr>)}
            </DataTable>
            <div className={H}>Processing history</div>
            <DataTable head={["Run", "Processed", "Failed", "Duration", "Status"]} align={["left", "right", "right", "right", "left"]}>
              {runs.map((r) => <tr key={r.id + r.timestamp}><Td mono>{r.id}</Td><Td right>{r.processed}</Td><Td right>{r.failed}</Td><Td right>{fmtDuration(r.durationSec)}</Td><Td><Pill tone={runTone(r.status)}>{r.status}</Pill></Td></tr>)}
            </DataTable>
            <div className={H}>Data quality issues</div>
            {issues.length ? (
              <DataTable head={["Severity", "Issue", "Status"]}>
                {issues.map((i) => <tr key={i.id}><Td><Pill tone={issueTone(i.severity)}>{i.severity}</Pill></Td><Td>{i.title}</Td><Td><Pill tone={issueStatusTone(i.status)}>{i.status}</Pill></Td></tr>)}
              </DataTable>
            ) : <p className="text-sm text-muted-foreground">No issues for this source.</p>}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
