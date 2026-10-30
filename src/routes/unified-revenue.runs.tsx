import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/ui-bits";
import { MetricCard, Pill } from "@/components/identity/bits";
import { AnalyticsTable } from "@/components/AnalyticsTable";
import { TenantSelect } from "@/components/revenue/RevenueBits";
import { PIPELINE_RUNS, fmtDuration, runTone, type RunStatus } from "@/lib/unifiedRevenueData";

export const Route = createFileRoute("/unified-revenue/runs")({
  head: () => ({
    meta: [
      { title: "Pipeline Runs · Resolve.io" },
      { name: "description", content: "Unified Revenue processing runs with record counts, failures, duration and status." },
      { property: "og:title", content: "Pipeline Runs · Resolve.io" },
      { property: "og:description", content: "Processing health for Unified Revenue pipeline runs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { run?: string } => ({ run: typeof s.run === "string" ? s.run : undefined }),
  component: RunsPage,
});

const STATUSES: RunStatus[] = ["Successful", "Running", "Failed"];

function RunsPage() {
  const { run } = Route.useSearch();
  const [status, setStatus] = useState<RunStatus | "">("");
  const rows = PIPELINE_RUNS.filter((r) => (!status || r.status === status) && (!run || r.id === run));
  const processed = PIPELINE_RUNS.reduce((s, r) => s + r.processed, 0);
  const failed = PIPELINE_RUNS.reduce((s, r) => s + r.failed, 0);
  return (
    <div className="pb-10">
      <PageHeader title="Pipeline Runs" subtitle="Processing Health → Pipeline Runs for Unified Revenue." actions={<TenantSelect />} />
      <div className="grid gap-3 px-6 sm:grid-cols-4">
        <MetricCard label="Runs" value={String(PIPELINE_RUNS.length)} />
        <MetricCard label="Records processed" value={processed.toLocaleString()} />
        <MetricCard label="Failed records" value={failed.toLocaleString()} tone="warning" />
        <MetricCard label="Success rate" value={`${(((processed - failed) / processed) * 100).toFixed(2)}%`} tone="success" />
      </div>
      <div className="my-3 flex flex-wrap items-center gap-2 px-6">
        {(["", ...STATUSES] as const).map((s) => (
          <button key={s || "all"} onClick={() => setStatus(s)} className={`rounded-full border px-3 py-1 text-xs ${status === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{s || "All"}</button>
        ))}
        {run && <span className="text-xs text-muted-foreground">Filtered to run <span className="font-mono">{run}</span></span>}
      </div>
      <div className="px-6">
        <AnalyticsTable
          rows={rows}
          rowKey={(r) => r.id + r.timestamp}
          pageSize={20}
          csvName="pipeline-runs.csv"
          storageKey="unified-revenue-runs"
          columns={[
            { key: "id", header: "Run ID", value: (r) => r.id, cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
            { key: "ts", header: "Run timestamp", value: (r) => r.timestamp, cell: (r) => r.timestamp.replace("T", " ").slice(0, 16) },
            { key: "processed", header: "Records processed", align: "right", value: (r) => r.processed, cell: (r) => r.processed.toLocaleString() },
            { key: "ok", header: "Successful records", align: "right", value: (r) => r.successful, cell: (r) => r.successful.toLocaleString() },
            { key: "failed", header: "Failed records", align: "right", value: (r) => r.failed, cell: (r) => r.failed.toLocaleString() },
            { key: "dur", header: "Processing duration", align: "right", value: (r) => r.durationSec, cell: (r) => fmtDuration(r.durationSec) },
            { key: "status", header: "Status", value: (r) => r.status, cell: (r) => <Pill tone={runTone(r.status)}>{r.status}</Pill> },
          ]}
        />
      </div>
    </div>
  );
}
