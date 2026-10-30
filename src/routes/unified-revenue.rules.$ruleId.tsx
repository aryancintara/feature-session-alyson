import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui-bits";
import { Panel, Pill } from "@/components/identity/bits";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TenantSelect } from "@/components/revenue/RevenueBits";
import { getDataset, opSymbol, OUTPUT_FIELDS, previewImpact, ruleExecutions, ruleRecords, ruleStats, ruleStatusTone } from "@/lib/revenueRulesData";
import { useAllRules, useRulesStore } from "@/lib/revenueRulesStore";
import { fmtCompact, fmtMoney } from "@/lib/unifiedTablesData";

export const Route = createFileRoute("/unified-revenue/rules/$ruleId")({
  head: ({ params }) => {
    const t = `${params.ruleId} · Revenue Rules · RevCloud`;
    const d = "Rule logic, versions, affected records and execution history.";
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: RuleDetail,
});

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</div><div className="mt-0.5 text-sm">{v}</div></div>;
}
const th = "px-3 py-2 font-medium";
const thead = "border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground";

function RuleDetail() {
  const { ruleId } = Route.useParams();
  const rule = useAllRules().find((r) => r.id === ruleId);
  const setStatus = useRulesStore((s) => s.setStatus);
  if (!rule) return <div className="p-6 text-sm text-muted-foreground">Rule not found. <Link to="/unified-revenue/rules" className="text-primary">Back to rules</Link></div>;

  const ds = getDataset(rule.datasetId);
  const stats = ruleStats(rule);
  const preview = previewImpact(rule);
  const records = ruleRecords(rule).slice(0, 8);
  const execs = ruleExecutions(rule);
  const lineage = [
    { t: "Source tables", d: `Unified Tables · ${ds?.name ?? rule.datasetId}` },
    { t: "Revenue rule", d: `${rule.id} (${rule.version})` },
    { t: "Unified Revenue", d: "unified.unified_revenue" },
    { t: "Analytics", d: "Overview, Events, Sources" },
  ];
  const actions = (
    <div className="flex items-center gap-2">
      <TenantSelect />
      {(rule.status === "Draft" || rule.status === "Testing") && <Button size="sm" onClick={() => setStatus(rule.id, "Active")}>Activate</Button>}
      {rule.status === "Draft" && <Button size="sm" variant="outline" onClick={() => setStatus(rule.id, "Testing")}>Move to testing</Button>}
      {rule.status === "Active" && <Button size="sm" variant="outline" onClick={() => setStatus(rule.id, "Archived")}>Archive</Button>}
    </div>
  );

  return (
    <div className="pb-10">
      <div className="px-6 pt-4">
        <Link to="/unified-revenue/rules" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ChevronLeft className="h-3 w-3" /> Revenue Rules</Link>
      </div>
      <PageHeader title={rule.name} subtitle={rule.description} actions={actions} />
      <div className="px-6">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="logic">Logic</TabsTrigger>
            <TabsTrigger value="versions">Versions</TabsTrigger>
            <TabsTrigger value="records">Affected Records</TabsTrigger>
            <TabsTrigger value="history">Execution History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Panel title="Rule summary">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <KV k="Rule name" v={rule.name} />
                <KV k="Rule ID" v={<span className="font-mono text-xs">{rule.id}</span>} />
                <KV k="Revenue type" v={rule.revenueType} />
                <KV k="Status" v={<Pill tone={ruleStatusTone(rule.status)}>{rule.status}</Pill>} />
                <KV k="Description" v={rule.description} />
                <KV k="Object type" v={rule.objectType} />
                <KV k="Currency" v={rule.currency} />
                <KV k="Effective date" v={rule.effectiveDate} />
                <KV k="Created by" v={rule.createdBy} />
                <KV k="Created date" v={rule.created} />
                <KV k="Last updated" v={rule.updated} />
                <KV k="Version" v={rule.version} />
              </div>
            </Panel>
            <Panel title="Rule lineage">
              <div className="grid gap-2 md:grid-cols-4">
                {lineage.map((s) => <div key={s.t} className="rounded-md border border-border p-2"><div className="text-sm font-medium">{s.t}</div><div className="text-xs text-muted-foreground">{s.d}</div></div>)}
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="logic" className="space-y-4">
            <Panel title="Readable rule">
              <div className="rounded-md border border-border bg-muted/30 p-4 font-mono text-sm leading-7">
                <div className="font-semibold">IF</div>
                {rule.conditions.map((c, i) => <div key={i} className="pl-4">{i > 0 && <span className="font-semibold text-primary">{rule.logic} </span>}{c.field} {opSymbol(c.op)} {c.op === "exists" ? "" : c.value}</div>)}
                <div className="font-semibold">THEN</div>
                <div className="pl-4">Create {rule.revenueType} Revenue</div>
                <div className="pl-4">Gross: {rule.grossField}</div>
                <div className="pl-4">Net: {rule.deductField ? `gross_revenue − ${rule.deductField}` : "gross_revenue"}</div>
              </div>
            </Panel>
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Input fields">
                <table className="w-full text-sm"><thead><tr className={thead}><th className={th}>Field</th><th className={th}>Description</th></tr></thead>
                  <tbody>{rule.fields.map((f) => <tr key={f} className="border-b border-border/50 last:border-0"><td className="px-3 py-2 font-mono text-xs">{f}</td><td className="px-3 py-2 text-muted-foreground">{ds?.fields.find((x) => x.name === f)?.description ?? "—"}</td></tr>)}</tbody></table>
              </Panel>
              <Panel title="Output fields">
                <table className="w-full text-sm"><thead><tr className={thead}><th className={th}>Output</th><th className={th}>Description</th></tr></thead>
                  <tbody>{OUTPUT_FIELDS.map((f) => <tr key={f.name} className="border-b border-border/50 last:border-0"><td className="px-3 py-2 font-mono text-xs">{f.name}</td><td className="px-3 py-2 text-muted-foreground">{f.description}</td></tr>)}</tbody></table>
              </Panel>
            </div>
          </TabsContent>

          <TabsContent value="versions">
            <Panel title="Version history" description="Rules never overwrite history — every change creates a new version.">
              <div className="max-w-xl space-y-1">
                {rule.versions.map((v, i) => (
                  <div key={v.version}>
                    <div className="flex items-center justify-between rounded-md border border-border p-3">
                      <div><div className="text-sm font-medium">Version {v.version.slice(1)}</div><div className="text-xs text-muted-foreground">Updated {v.date} · Changed: {v.note}</div></div>
                      <Pill tone={v.status === "Active" ? "success" : v.status === "Draft" ? "warning" : "neutral"}>{v.status}</Pill>
                    </div>
                    {i < rule.versions.length - 1 && <ArrowDown className="mx-auto my-1 h-3 w-3 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="records" className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Panel title="Records using this rule"><div className="text-2xl font-semibold tabular-nums">{fmtCompact(stats.records)}</div></Panel>
              <Panel title="Revenue generated"><div className="text-2xl font-semibold tabular-nums">{fmtMoney(stats.revenue)}</div></Panel>
              <Panel title="Events"><Button asChild size="sm" variant="outline"><Link to="/unified-revenue/events" search={{ rule: rule.id }}>View Revenue Events</Link></Button></Panel>
            </div>
            {(rule.status === "Draft" || rule.status === "Testing") && <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">This rule isn't applied yet. Samples below are a preview of records it would match.</div>}
            <Panel title="Sample records">
              <div className="overflow-x-auto">
                {records.length ? (
                  <table className="w-full text-sm"><thead><tr className={thead}><th className={th}>Revenue ID</th><th className={th}>Source</th><th className={th}>Lead / Order</th><th className={`${th} text-right`}>Net revenue</th><th className={th}>Status</th></tr></thead>
                    <tbody>{records.map((r) => <tr key={r.revenue_summary_id} className="border-b border-border/50 last:border-0"><td className="px-3 py-2 font-mono text-xs">{r.revenue_summary_id}</td><td className="px-3 py-2">{r.source_id}</td><td className="px-3 py-2 font-mono text-xs">{r.lead_id || r.order_id || "—"}</td><td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.net_revenue)}</td><td className="px-3 py-2"><Pill tone="success">{r.processing_status}</Pill></td></tr>)}</tbody></table>
                ) : (
                  <table className="w-full text-sm"><thead><tr className={thead}><th className={th}>{ds?.idField}</th><th className={th}>Input values</th><th className={`${th} text-right`}>Calculated revenue</th></tr></thead>
                    <tbody>{preview.sample.map((s) => <tr key={s.id} className="border-b border-border/50 last:border-0"><td className="px-3 py-2 font-mono text-xs">{s.id}</td><td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{Object.entries(s.inputs).map(([k, v]) => `${k}=${String(v)}`).join(", ")}</td><td className="px-3 py-2 text-right tabular-nums">{fmtMoney(s.net)}</td></tr>)}</tbody></table>
                )}
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="history">
            <Panel title="Execution history">
              {execs.length === 0 ? <div className="py-6 text-center text-sm text-muted-foreground">Draft rules haven't run yet.</div> : (
                <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className={thead}><th className={th}>Rule run</th><th className={th}>Timestamp</th><th className={`${th} text-right`}>Records evaluated</th><th className={`${th} text-right`}>Records matched</th><th className={`${th} text-right`}>Revenue created</th><th className={th}>Status</th></tr></thead>
                  <tbody>{execs.map((e) => <tr key={e.id} className="border-b border-border/50 last:border-0"><td className="px-3 py-2 font-mono text-xs">{e.id}</td><td className="px-3 py-2">{e.timestamp.replace("T", " ").slice(0, 16)} UTC</td><td className="px-3 py-2 text-right tabular-nums">{fmtCompact(e.evaluated)}</td><td className="px-3 py-2 text-right tabular-nums">{fmtCompact(e.matched)}</td><td className="px-3 py-2 text-right tabular-nums">{fmtMoney(e.revenue)}</td><td className="px-3 py-2"><Pill tone={e.status === "Successful" ? "success" : "danger"}>{e.status}</Pill></td></tr>)}</tbody></table></div>
              )}
            </Panel>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
