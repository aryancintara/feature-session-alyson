import { createFileRoute } from "@tanstack/react-router";
import { OPS_METRICS_24H, WORKER_HEALTH } from "@/lib/mockData";
import { PageHeader, StatusDot } from "@/components/ui-bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/identity-console/operations")({
  head: () => ({ meta: [
    { title: "Identity Console Operations — Alyson CDP" },
    { name: "description", content: "Explore identity console operations in Alyson CDP." },
    { property: "og:title", content: "Identity Console Operations — Alyson CDP" },
    { property: "og:description", content: "Explore identity console operations in Alyson CDP." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: OpsPage,
});

function OpsPage() {
  const totalRps = OPS_METRICS_24H.reduce((a, b) => a + b.rps, 0) / 24;
  const p95Avg = OPS_METRICS_24H.reduce((a, b) => a + b.p95, 0) / 24;
  const errAvg = OPS_METRICS_24H.reduce((a, b) => a + b.errorRate, 0) / 24;
  const costAvg = OPS_METRICS_24H.reduce((a, b) => a + b.costPer1k, 0) / 24;

  return (
    <div className="pb-6">
      <PageHeader
        title="Operations"
        subtitle="Throughput, latency, freshness, cost, and worker health over the last 24h."
      />
      <div className="space-y-4 px-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Avg RPS" value={Math.round(totalRps).toLocaleString()} tone="info" />
          <Kpi label="p95 latency" value={`${Math.round(p95Avg)}ms`} tone="success" />
          <Kpi label="Error rate" value={`${(errAvg * 100).toFixed(2)}%`} tone="success" />
          <Kpi label="Cost / 1k" value={`$${costAvg.toFixed(3)}`} tone="info" />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Chart title="Requests per second (24h)" data={OPS_METRICS_24H.map(m => m.rps)} color="var(--color-primary)" fmt={(v) => Math.round(v).toString()} />
          <Chart title="p50 / p95 / p99 latency (ms)" data={OPS_METRICS_24H.map(m => m.p95)} data2={OPS_METRICS_24H.map(m => m.p99)} data3={OPS_METRICS_24H.map(m => m.p50)} color="var(--color-info)" fmt={(v) => `${Math.round(v)}ms`} />
          <Chart title="Error rate %" data={OPS_METRICS_24H.map(m => m.errorRate * 100)} color="var(--color-destructive)" fmt={(v) => `${v.toFixed(2)}%`} />
          <Chart title="Freshness lag (s)" data={OPS_METRICS_24H.map(m => m.freshnessLagS)} color="var(--color-warning)" fmt={(v) => `${Math.round(v)}s`} />
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Worker health</h3>
            <p className="text-xs text-muted-foreground">Per-pipeline-stage vitals</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Worker</th>
                <th className="px-3 py-2 text-left font-medium">Version</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">p50</th>
                <th className="px-3 py-2 text-right font-medium">p95</th>
                <th className="px-3 py-2 text-right font-medium">Error %</th>
              </tr>
            </thead>
            <tbody>
              {WORKER_HEALTH.map(w => (
                <tr key={w.worker} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{w.worker}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{w.version}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className="inline-flex items-center gap-1"><StatusDot status={w.status} />{w.status}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{w.p50}ms</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{w.p95}ms</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{(w.errorRate * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "success" | "info" | "warning" }) {
  const c = tone === "success" ? "text-success" : tone === "info" ? "text-info" : "text-warning-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-mono text-2xl font-semibold tabular-nums", c)}>{value}</div>
    </div>
  );
}

function Chart({ title, data, data2, data3, color, fmt }: { title: string; data: number[]; data2?: number[]; data3?: number[]; color: string; fmt: (v: number) => string }) {
  const max = Math.max(...data, ...(data2 ?? []), ...(data3 ?? []));
  const w = 320, h = 100;
  const points = (arr: number[]) => arr.map((v, i) => `${(i / (arr.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        <span className="font-mono text-xs text-muted-foreground">now {fmt(data[data.length - 1])}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h + 10}`} className="mt-2 h-24 w-full">
        {data3 && <polyline fill="none" stroke="var(--color-muted-foreground)" strokeWidth="1" opacity="0.5" points={points(data3)} />}
        {data2 && <polyline fill="none" stroke="var(--color-warning)" strokeWidth="1.2" points={points(data2)} />}
        <polyline fill="none" stroke={color} strokeWidth="1.5" points={points(data)} />
      </svg>
    </div>
  );
}
