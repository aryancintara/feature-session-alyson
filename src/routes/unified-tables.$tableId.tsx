import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, Search } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, Mono } from "@/components/ui-bits";
import { MetricCard, Panel, Pill, DataTable, Td } from "@/components/identity/bits";
import { AnalyticsTable, type Column } from "@/components/AnalyticsTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  REVENUE_RECORDS, UNIFIED_TABLES, fmtCompact, fmtMoney, lineageFor, qualityFor, recordsBySource, recordsOverTime, schemaFor, statusTone,
  type RevenueRecord, type Severity,
} from "@/lib/unifiedTablesData";

export const Route = createFileRoute("/unified-tables/$tableId")({
  head: ({ params }) => {
    const t = UNIFIED_TABLES.find((x) => x.id === params.tableId);
    const title = `${t?.name ?? "Unified Table"} · Unified Tables · Resolve.io`;
    const desc = t?.description ?? "Unified table explorer.";
    return { meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ] };
  },
  component: TableExplorer,
});

const sevTone = (s: Severity) => (s === "Healthy" ? "success" : s === "Warning" ? "warning" : "danger");

function TableExplorer() {
  const { tableId } = Route.useParams();
  const t = UNIFIED_TABLES.find((x) => x.id === tableId);
  const [selected, setSelected] = useState<RevenueRecord | null>(null);
  const [schemaQ, setSchemaQ] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");

  const records = useMemo(
    () => (tableId === "revenue" ? REVENUE_RECORDS : []).filter((r) => (status === "all" || r.processing_status === status) && (source === "all" || r.source_id === source)),
    [tableId, status, source],
  );

  if (!t) {
    return <div className="p-6 text-sm">Table not found. <Link to="/unified-tables" className="text-primary">Back</Link></div>;
  }

  const quality = qualityFor(t);
  const schema = schemaFor(t.id).filter((c) => `${c.name} ${c.description} ${c.type}`.toLowerCase().includes(schemaQ.toLowerCase()));
  const money = (k: keyof RevenueRecord, h: string, hidden = false): Column<RevenueRecord> => ({
    key: k, header: h, align: "right", defaultHidden: hidden, value: (r) => r[k] as number, cell: (r) => fmtMoney(r[k] as number),
  });
  const columns: Column<RevenueRecord>[] = [
    { key: "id", header: "Revenue ID", value: (r) => r.revenue_summary_id, cell: (r) => <Mono>{r.revenue_summary_id}</Mono> },
    { key: "type", header: "Revenue Type", value: (r) => r.revenue_type, cell: (r) => r.revenue_type },
    { key: "source", header: "Source", value: (r) => r.source_id, cell: (r) => r.source_id },
    { key: "session", header: "Session ID", value: (r) => r.session_id, cell: (r) => <Mono>{r.session_id || "—"}</Mono> },
    { key: "lead", header: "Lead ID", value: (r) => r.lead_id, cell: (r) => <Mono>{r.lead_id}</Mono> },
    { key: "order", header: "Order ID", value: (r) => r.order_id, cell: (r) => <Mono>{r.order_id}</Mono> },
    money("gross_revenue", "Gross Revenue"),
    money("net_revenue", "Net Revenue"),
    money("estimated_revenue", "Estimated Revenue", true),
    money("earned_revenue", "Earned Revenue", true),
    money("invoiced_revenue", "Invoiced Revenue", true),
    money("received_revenue", "Received Revenue", true),
    { key: "currency", header: "Currency", value: (r) => r.currency, cell: (r) => r.currency },
    { key: "ts", header: "Timestamp", value: (r) => r.event_timestamp, cell: (r) => <Mono>{r.event_timestamp.replace("T", " ").slice(0, 16)}</Mono> },
    { key: "status", header: "Status", value: (r) => r.processing_status, cell: (r) => (
      <Pill tone={r.processing_status === "processed" ? "success" : r.processing_status === "pending" ? "warning" : "danger"}>{r.processing_status}</Pill>
    ) },
  ];
  const sel = "rounded-md border border-border bg-card px-2 py-1.5 text-xs";

  return (
    <div className="pb-10">
      <div className="px-6 pt-4">
        <Link to="/unified-tables" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Unified Tables
        </Link>
      </div>
      <PageHeader className="pt-2" title={t.name} subtitle={t.description} actions={<Pill tone={statusTone(t.status)}>{t.status}</Pill>} />

      <div className="mx-6 grid gap-4 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
        <Info k="Domain" v={t.domain} />
        <Info k="Records" v={t.records.toLocaleString()} />
        <Info k="Last Updated" v={t.lastUpdated} />
        <Info k="Sources" v={t.sources.join(", ")} />
        <Info k="Status" v={t.status} />
      </div>

      <Tabs defaultValue="overview" className="mt-4 px-6">
        <TabsList>
          {["overview", "records", "schema", "lineage", "quality"].map((v) => (
            <TabsTrigger key={v} value={v} className="capitalize">{v}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard label="Total records" value={fmtCompact(t.records)} />
            <MetricCard label="Added today" value={fmtCompact(t.addedToday)} />
            <MetricCard label="Updated today" value={fmtCompact(t.updatedToday)} />
            <MetricCard label="Missing identifiers" value={fmtCompact(t.missingIds)} tone="warning" />
            <MetricCard label="Data quality score" value={`${t.qualityScore}%`} tone={t.qualityScore >= 95 ? "success" : "warning"} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Records Over Time">
              <div className="h-64 p-3">
                <ResponsiveContainer>
                  <LineChart data={recordsOverTime(t)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" fontSize={11} stroke="var(--muted-foreground)" />
                    <YAxis fontSize={11} stroke="var(--muted-foreground)" tickFormatter={fmtCompact} />
                    <Tooltip formatter={(v: number) => v.toLocaleString()} />
                    <Line type="monotone" dataKey="records" stroke="var(--primary)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Records By Source">
              <div className="h-64 p-3">
                <ResponsiveContainer>
                  <BarChart data={recordsBySource(t)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="source" fontSize={11} stroke="var(--muted-foreground)" />
                    <YAxis fontSize={11} stroke="var(--muted-foreground)" tickFormatter={fmtCompact} />
                    <Tooltip formatter={(v: number) => v.toLocaleString()} />
                    <Bar dataKey="records" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>
          <Panel title="Data Quality">
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              <MetricCard label="Passed checks" value={String(quality.filter((q) => q.severity === "Healthy").length)} tone="success" />
              <MetricCard label="Failed checks" value={String(quality.filter((q) => q.severity === "Critical").length)} tone="destructive" />
              <MetricCard label="Warnings" value={String(quality.filter((q) => q.severity === "Warning").length)} tone="warning" />
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="records">
          {t.id === "revenue" ? (
            <AnalyticsTable
              rows={records}
              columns={columns}
              rowKey={(r) => r.revenue_summary_id}
              onRowClick={setSelected}
              pageSize={20}
              csvName={`unified-${t.id}.csv`}
              searchPlaceholder="Search revenue ID, session, lead, order…"
              toolbar={
                <div className="flex gap-2">
                  <select className={sel} value={source} onChange={(e) => setSource(e.target.value)}>
                    <option value="all">All sources</option>
                    {["homelight", "phonexa", "crm"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="all">All statuses</option>
                    {["processed", "pending", "failed"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              }
            />
          ) : (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Sample records are not available for this table yet.</div>
          )}
        </TabsContent>

        <TabsContent value="schema">
          <Panel title="Schema" actions={
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input value={schemaQ} onChange={(e) => setSchemaQ(e.target.value)} placeholder="Search columns…" className="bg-transparent outline-none" />
            </div>
          }>
            <DataTable head={["Column Name", "Data Type", "Group", "Description", "Nullable", "Example Value"]}>
              {schema.map((c) => (
                <tr key={c.name}>
                  <Td mono>{c.name}</Td><Td mono>{c.type}</Td><Td>{c.group}</Td><Td>{c.description}</Td>
                  <Td>{c.nullable ? "Yes" : "No"}</Td><Td mono className="max-w-[260px] truncate">{c.example}</Td>
                </tr>
              ))}
            </DataTable>
          </Panel>
        </TabsContent>

        <TabsContent value="lineage">
          <Panel title="Lineage" description="Source tables → transformation steps → destination tables">
            <LineageGraph nodes={lineageFor(t)} />
          </Panel>
        </TabsContent>

        <TabsContent value="quality">
          <Panel title="Data Quality Checks">
            <DataTable head={["Check", "Severity", "Detail", "Affected"]} align={["left", "left", "left", "right"]}>
              {quality.map((q) => (
                <tr key={q.name}>
                  <Td className="font-medium">{q.name}</Td>
                  <Td><Pill tone={sevTone(q.severity)}>{q.severity}</Pill></Td>
                  <Td>{q.detail}</Td>
                  <Td right>{q.affected.toLocaleString()}</Td>
                </tr>
              ))}
            </DataTable>
          </Panel>
        </TabsContent>
      </Tabs>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader><SheetTitle className="font-mono text-base">{selected.revenue_summary_id}</SheetTitle></SheetHeader>
              <div className="space-y-5 px-4 pb-6 text-sm">
                <Section title="Record Summary">
                  <KV rows={[
                    ["Revenue type", selected.revenue_type], ["Object", `${selected.revenue_object_type} · ${selected.revenue_object_id}`],
                    ["Gross revenue", fmtMoney(selected.gross_revenue)], ["Refund", fmtMoney(selected.refund_amount)],
                    ["Credit", fmtMoney(selected.credit_amount)], ["Net revenue", fmtMoney(selected.net_revenue)],
                    ["Estimated", fmtMoney(selected.estimated_revenue)], ["Earned", fmtMoney(selected.earned_revenue)],
                    ["Invoiced", fmtMoney(selected.invoiced_revenue)], ["Received", fmtMoney(selected.received_revenue)],
                    ["Order prediction", fmtMoney(selected.best_current_order_prediction)], ["Lifetime prediction", fmtMoney(selected.best_lifetime_prediction)],
                    ["Currency", selected.currency], ["Event time", selected.event_timestamp],
                  ]} />
                </Section>
                <Section title="Source Lineage">
                  <LineageGraph nodes={[
                    { label: `Raw Source · ${selected.source_id}`, kind: "source", detail: selected.source_row_uri },
                    { label: "Optimized Table", kind: "transform", detail: "optimized.revenue_events" },
                    { label: "Unified Table", kind: "unified", detail: "unified.revenue" },
                  ]} compact />
                  <KV rows={[
                    ["Source name", selected.source_id], ["Source ID", selected.source_event_id],
                    ["Original row ID", selected.source_row_id], ["Row hash", selected.source_row_hash], ["Source timestamp", selected.event_timestamp],
                  ]} />
                </Section>
                <Section title="Relationships">
                  <KV rows={[
                    ["Session", selected.session_id || "—"], ["Lead", selected.lead_id], ["Order", selected.order_id],
                    ["Customer", selected.customer_id], ["Conversation", selected.conversation_id],
                  ]} />
                </Section>
                <Section title="Processing Metadata">
                  <KV rows={[
                    ["Pipeline run", selected.pipeline_run], ["Created", selected.created_at], ["Updated", selected.updated_at],
                    ["Processing status", selected.processing_status],
                  ]} />
                </Section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</div><div className="mt-0.5 font-medium">{v}</div></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>{children}</div>;
}

function KV({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-border rounded-lg border border-border">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 px-3 py-1.5">
          <dt className="text-muted-foreground">{k}</dt><dd className="truncate font-mono text-xs">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const KIND: Record<string, string> = {
  source: "border-info/40 bg-info/10",
  transform: "border-warning/40 bg-warning/10",
  unified: "border-primary/50 bg-primary/10",
  destination: "border-success/40 bg-success/10",
};

function LineageGraph({ nodes, compact }: { nodes: { label: string; kind: string; detail: string }[]; compact?: boolean }) {
  const sources = nodes.filter((n) => n.kind === "source");
  const rest = nodes.filter((n) => n.kind !== "source");
  const Node = ({ n }: { n: (typeof nodes)[number] }) => (
    <div className={cn("rounded-lg border px-3 py-2 text-center", KIND[n.kind])}>
      <div className="text-sm font-medium">{n.label}</div>
      <div className="truncate font-mono text-[10px] text-muted-foreground">{n.detail}</div>
    </div>
  );
  return (
    <div className={cn("flex flex-col items-center gap-1", compact ? "mb-3" : "p-6")}>
      <div className="flex flex-wrap justify-center gap-2">{sources.map((n) => <Node key={n.label} n={n} />)}</div>
      {rest.map((n) => (
        <div key={n.label} className="flex flex-col items-center gap-1">
          <ArrowDown className="h-4 w-4 text-muted-foreground" />
          <Node n={n} />
        </div>
      ))}
    </div>
  );
}
