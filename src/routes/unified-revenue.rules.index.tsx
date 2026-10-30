import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui-bits";
import { MetricCard, Pill } from "@/components/identity/bits";
import { AnalyticsTable } from "@/components/AnalyticsTable";
import { TenantSelect } from "@/components/revenue/RevenueBits";
import { RuleWizard } from "@/components/revenue/RuleWizard";
import { Button } from "@/components/ui/button";
import { RULE_STATUSES, ruleStats, ruleStatusTone } from "@/lib/revenueRulesData";
import { useAllRules } from "@/lib/revenueRulesStore";
import { fmtCompact, fmtMoney } from "@/lib/unifiedTablesData";

export const Route = createFileRoute("/unified-revenue/rules/")({
  head: () => ({
    meta: [
      { title: "Revenue Rules · RevCloud" },
      { name: "description", content: "Create and manage the logic used to calculate revenue." },
      { property: "og:title", content: "Revenue Rules · RevCloud" },
      { property: "og:description", content: "Create and manage the logic used to calculate revenue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RulesPage,
});

const RECENT_CUTOFF = "2026-08-26";

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 rounded-md border border-border bg-card px-2 text-sm text-foreground">
        <option value="">All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function RulesPage() {
  const nav = useNavigate();
  const rules = useAllRules();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const uniq = (xs: string[]) => Array.from(new Set(xs)).sort();
  const withStats = rules.map((r) => ({ ...r, ...ruleStats(r) }));
  const rows = withStats.filter((r) => (!type || r.revenueType === type) && (!status || r.status === status));
  const active = withStats.filter((r) => r.status === "Active");
  return (
    <div className="pb-10">
      <PageHeader
        title="Revenue Rules"
        subtitle="Create and manage the logic used to calculate revenue."
        actions={<div className="flex items-center gap-2"><TenantSelect /><Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" /> Create Rule</Button></div>}
      />
      <div className="grid grid-cols-2 gap-3 px-6 lg:grid-cols-4">
        <MetricCard label="Active rules" value={String(active.length)} sub={`${rules.length} total`} />
        <MetricCard label="Records impacted" value={fmtCompact(active.reduce((s, r) => s + r.records, 0))} />
        <MetricCard label="Drafts & testing" value={String(rules.filter((r) => r.status === "Draft" || r.status === "Testing").length)} sub="Not yet applied" />
        <MetricCard label="Recently updated" value={String(rules.filter((r) => r.updated >= RECENT_CUTOFF).length)} sub="Last 30 days" />
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3 px-6">
        <Sel label="Revenue type" value={type} onChange={setType} options={uniq(rules.map((r) => r.revenueType))} />
        <Sel label="Status" value={status} onChange={setStatus} options={RULE_STATUSES} />
      </div>
      <div className="mt-3 px-6">
        <AnalyticsTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => nav({ to: "/unified-revenue/rules/$ruleId", params: { ruleId: r.id } })}
          pageSize={20}
          csvName="revenue-rules.csv"
          columns={[
            { key: "name", header: "Rule name", value: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span> },
            { key: "id", header: "Rule ID", value: (r) => r.id, cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
            { key: "type", header: "Revenue type", value: (r) => r.revenueType, cell: (r) => r.revenueType },
            { key: "ver", header: "Version", value: (r) => r.version, cell: (r) => r.version },
            { key: "status", header: "Status", value: (r) => r.status, cell: (r) => <Pill tone={ruleStatusTone(r.status)}>{r.status}</Pill> },
            { key: "rec", header: "Records impacted", value: (r) => r.records, cell: (r) => fmtCompact(r.records) },
            { key: "rev", header: "Revenue generated", value: (r) => r.revenue, cell: (r) => fmtMoney(r.revenue) },
            { key: "by", header: "Created by", value: (r) => r.createdBy, cell: (r) => r.createdBy },
            { key: "upd", header: "Last updated", value: (r) => r.updated, cell: (r) => r.updated },
          ]}
        />
      </div>
      <RuleWizard open={open} onOpenChange={setOpen} />
    </div>
  );
}
