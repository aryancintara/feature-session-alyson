import { ruleIdForRecord, REVENUE_RULES } from "@/lib/revenueRulesData";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Filter, Search, X } from "lucide-react";
import { PageHeader } from "@/components/ui-bits";
import { Pill } from "@/components/identity/bits";
import { AnalyticsTable } from "@/components/AnalyticsTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RevenueEventDrawer, TenantSelect } from "@/components/revenue/RevenueBits";
import { fmtMoney } from "@/lib/unifiedTablesData";
import { REVENUE_RECORDS, SOURCE_META, procTone, sourceName, type RevenueRecord } from "@/lib/unifiedRevenueData";

export const Route = createFileRoute("/unified-revenue/events")({
  head: () => ({
    meta: [
      { title: "Revenue Events · Resolve.io" },
      { name: "description", content: "Search and filter unified revenue events by source, type, lifecycle and identifiers." },
      { property: "og:title", content: "Revenue Events · Resolve.io" },
      { property: "og:description", content: "Explore unified revenue events." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { source?: string; status?: string; rule?: string } => ({ source: typeof s.source === "string" ? s.source : undefined, status: typeof s.status === "string" ? s.status : undefined, rule: typeof s.rule === "string" ? s.rule : undefined }),
  component: EventsPage,
});

const EMPTY = { rule: "", from: "", to: "", source: "", type: "", object: "", session: "", lead: "", order: "", customer: "", status: "", min: "", max: "", lifecycle: "" };
const uniq = (k: keyof RevenueRecord) => Array.from(new Set(REVENUE_RECORDS.map((r) => String(r[k]))));
const LIFECYCLE: Record<string, (r: RevenueRecord) => boolean> = {
  "Not invoiced": (r) => r.earned_revenue > 0 && r.invoiced_revenue === 0,
  "Partially received": (r) => r.received_revenue > 0 && r.received_revenue < r.net_revenue,
  "Fully received": (r) => r.received_revenue >= r.net_revenue,
  "Has refund": (r) => r.refund_amount > 0,
};

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 rounded-md border border-border bg-card px-2 text-sm text-foreground">
        <option value="">All</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
function Txt({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm text-foreground" />
    </label>
  );
}

function EventsPage() {
  const init = Route.useSearch();
  const [f, setF] = useState({ ...EMPTY, source: init.source ?? "", status: init.status ?? "", rule: init.rule ?? "" });
  const [q, setQ] = useState("");
  const [show, setShow] = useState(true);
  const [sel, setSel] = useState<RevenueRecord | null>(null);
  const set = (k: keyof typeof EMPTY) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const active = Object.values(f).filter(Boolean).length;

  const rows = useMemo(() => REVENUE_RECORDS.filter((r) => {
    const d = r.event_timestamp.slice(0, 10);
    const ql = q.trim().toLowerCase();
    if (ql && ![r.revenue_summary_id, r.session_id, r.lead_id, r.order_id, r.customer_id, r.conversation_id, r.source_event_id, r.transaction_id].some((x) => x.toLowerCase().includes(ql))) return false;
    if (f.rule && ruleIdForRecord(r) !== f.rule) return false;
    if (f.from && d < f.from) return false;
    if (f.to && d > f.to) return false;
    if (f.source && r.source_id !== f.source) return false;
    if (f.type && r.revenue_type !== f.type) return false;
    if (f.object && r.revenue_object_type !== f.object) return false;
    if (f.status && r.processing_status !== f.status) return false;
    if (f.session && !r.session_id.includes(f.session)) return false;
    if (f.lead && !r.lead_id.includes(f.lead)) return false;
    if (f.order && !r.order_id.includes(f.order)) return false;
    if (f.customer && !r.customer_id.includes(f.customer)) return false;
    if (f.min && r.net_revenue < Number(f.min)) return false;
    if (f.max && r.net_revenue > Number(f.max)) return false;
    if (f.lifecycle && !LIFECYCLE[f.lifecycle](r)) return false;
    return true;
  }), [f, q]);

  const money = (k: keyof RevenueRecord, header: string, hidden = false) => ({ key: k, header, align: "right" as const, defaultHidden: hidden, value: (r: RevenueRecord) => Number(r[k]), cell: (r: RevenueRecord) => fmtMoney(Number(r[k])) });

  return (
    <div className="pb-10">
      <PageHeader
        title="Revenue Events"
        subtitle="Every unified revenue event with lifecycle amounts and attribution."
        actions={<>
          <TenantSelect />
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search session, lead, order, customer, transaction ID…" className="w-72 bg-transparent outline-none placeholder:text-muted-foreground" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShow((s) => !s)}><Filter className="h-4 w-4" /> Filters{active ? ` (${active})` : ""}</Button>
        </>}
      />
      {show && (
        <div className="mx-6 mb-4 rounded-xl border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Txt label="From" type="date" value={f.from} onChange={set("from")} />
            <Txt label="To" type="date" value={f.to} onChange={set("to")} />
            <Sel label="Rule" value={f.rule} onChange={set("rule")} options={REVENUE_RULES.map((r) => [r.id, r.name])} />
            <Sel label="Source" value={f.source} onChange={set("source")} options={Object.entries(SOURCE_META).map(([k, v]) => [k, v.name])} />
            <Sel label="Revenue type" value={f.type} onChange={set("type")} options={uniq("revenue_type").map((x) => [x, x])} />
            <Sel label="Object type" value={f.object} onChange={set("object")} options={uniq("revenue_object_type").map((x) => [x, x])} />
            <Sel label="Processing status" value={f.status} onChange={set("status")} options={uniq("processing_status").map((x) => [x, x])} />
            <Txt label="Session ID" value={f.session} onChange={set("session")} />
            <Txt label="Lead ID" value={f.lead} onChange={set("lead")} />
            <Txt label="Order ID" value={f.order} onChange={set("order")} />
            <Txt label="Customer ID" value={f.customer} onChange={set("customer")} />
            <Txt label="Min net amount" type="number" value={f.min} onChange={set("min")} />
            <Txt label="Max net amount" type="number" value={f.max} onChange={set("max")} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Lifecycle:</span>
            {Object.keys(LIFECYCLE).map((l) => (
              <button key={l} onClick={() => set("lifecycle")(f.lifecycle === l ? "" : l)} className={`rounded-full border px-2.5 py-0.5 text-xs ${f.lifecycle === l ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{l}</button>
            ))}
            {active > 0 && <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setF(EMPTY)}><X className="h-4 w-4" /> Clear filters</Button>}
          </div>
        </div>
      )}
      <div className="px-6">
        <AnalyticsTable
          rows={rows}
          rowKey={(r) => r.revenue_summary_id}
          onRowClick={setSel}
          pageSize={20}
          csvName="revenue-events.csv"
          storageKey="unified-revenue-events"
          columns={[
            { key: "id", header: "Event ID", value: (r) => r.revenue_summary_id, cell: (r) => <span className="font-mono text-xs">{r.revenue_summary_id}</span> },
            { key: "ts", header: "Event time", value: (r) => r.event_timestamp, cell: (r) => r.event_timestamp.replace("T", " ").slice(0, 16) },
            { key: "source", header: "Source", value: (r) => sourceName(r.source_id), cell: (r) => sourceName(r.source_id) },
            { key: "type", header: "Revenue type", value: (r) => r.revenue_type, cell: (r) => r.revenue_type },
            { key: "object", header: "Object type", value: (r) => r.revenue_object_type, cell: (r) => r.revenue_object_type },
            money("gross_revenue", "Gross", true),
            money("net_revenue", "Net"),
            money("earned_revenue", "Earned", true),
            money("invoiced_revenue", "Invoiced", true),
            money("received_revenue", "Received"),
            { key: "session", header: "Session ID", value: (r) => r.session_id, cell: (r) => <span className="font-mono text-xs">{r.session_id || "—"}</span> },
            { key: "lead", header: "Lead ID", value: (r) => r.lead_id, cell: (r) => <span className="font-mono text-xs">{r.lead_id}</span>, defaultHidden: true },
            { key: "order", header: "Order ID", value: (r) => r.order_id, cell: (r) => <span className="font-mono text-xs">{r.order_id}</span>, defaultHidden: true },
            { key: "customer", header: "Customer ID", value: (r) => r.customer_id, cell: (r) => <span className="font-mono text-xs">{r.customer_id}</span>, defaultHidden: true },
            { key: "txn", header: "Transaction ID", value: (r) => r.transaction_id, cell: (r) => <span className="font-mono text-xs">{r.transaction_id}</span>, defaultHidden: true },
            { key: "status", header: "Status", value: (r) => r.processing_status, cell: (r) => <Pill tone={procTone(r.processing_status)}>{r.processing_status}</Pill> },
          ]}
        />
      </div>
      <RevenueEventDrawer record={sel} onClose={() => setSel(null)} />
    </div>
  );
}
