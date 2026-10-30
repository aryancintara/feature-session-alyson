import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/ui-bits";
import { Panel, DataTable, Td, Pill, MetricCard } from "@/components/identity/bits";
import { HELP } from "@/lib/identityHelpText";
import { MetricLineChart } from "@/components/identity/metrics";
import { MetricCardSkeleton, TableSkeleton, ChartSkeleton, ErrorState } from "@/components/identity/skeletons";
import { EmptyState } from "@/components/identity/ProcessDateSelect";
import { DateRangeSelect, makeLatestRange, type DateRange } from "@/components/identity/DateRangeSelect";
import { apiHealthQuery, openCsv, rangeParams, num, pctRatio } from "@/lib/identityLiveApi";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/identity/api")({
  head: () => ({
    meta: [
      { title: "API Health · Identity Search" },
      {
        name: "description",
        content: "Live Identity Search API health — call volume, success rate, latency percentiles and recent server errors.",
      },
      { property: "og:title", content: "API Health · Identity Search" },
      { property: "og:description", content: "Volume, latency and error monitoring for the Identity Search API." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApiHealthPage,
});

const WINDOWS = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
];

function ApiHealthPage() {
  const [hours, setHours] = useState(24);
  const [range, setRange] = useState<DateRange>(makeLatestRange());
  const useRange = Boolean(range.from && range.to);
  const q = useQuery(apiHealthQuery(useRange ? range : hours));
  const d = q.data;

  const chart = (d?.series ?? []).map((s) => ({
    period: s.bucket.slice(5, 16),
    calls: s.estimatedTotal,
    errorRate: Number(((s.logged5xx / Math.max(1, s.estimatedTotal)) * 100).toFixed(2)),
  }));

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        title="API Health"
        subtitle={
          useRange
            ? `Identity Search API · ${range.from} → ${range.to}`
            : d
              ? `${d.api} · ${d.endpoint} · last ${d.windowHours}h`
              : "Identity Search API monitoring"
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-border p-0.5">
              {WINDOWS.map((w) => (
                <button
                  key={w.hours}
                  onClick={() => {
                    setRange(makeLatestRange());
                    setHours(w.hours);
                  }}
                  className={cn(
                    "rounded px-2 py-1 text-[11px] font-medium",
                    !useRange && hours === w.hours ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                  )}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <DateRangeSelect value={range} onChange={setRange} />
            <button
              onClick={() => openCsv("/v1/api-health", useRange ? rangeParams(range) : { hours })}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-accent"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 px-6 lg:grid-cols-5">
        {q.isPending ? (
          Array.from({ length: 5 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : (
          <>
            <Metric help={HELP.callVolume} label="Estimated calls" value={num(d?.counts.estimatedTotalVolume)} sub={`${num(d?.counts.logged2xx)} logged 2xx`} />
            <Metric help={HELP.successRate} label="Success rate" value={pctRatio(d?.successRate, 2)} sub={`${num(d?.counts.logged5xx)} server errors`} />
            <Metric help={HELP.latency} label="Avg latency" value={`${Math.round(d?.latencyMs.avg ?? 0)} ms`} sub={`${num(d?.latencyMs.samples)} samples`} />
            <Metric help={HELP.latency} label="p95 latency" value={`${Math.round(d?.latencyMs.p95 ?? 0)} ms`} sub={`p99 ${Math.round(d?.latencyMs.p99 ?? 0)} ms`} />
            <Metric help={HELP.latency} label="Max latency" value={`${Math.round(d?.latencyMs.max ?? 0)} ms`} sub="slowest sampled call" />
          </>
        )}
      </div>

      {d?.sampling ? (
        <p className="px-6 text-[11px] text-muted-foreground">
          Sampling: 2xx logs at {Math.round(d.sampling.twoXxSampleRate * 100)}% — {d.sampling.note}
        </p>
      ) : null}

      <div className="px-6">
        <Panel title="Traffic & server error rate" description="Identity Search call volume and 5xx server error rate over time." help={HELP.apiSeries}>
          {q.isPending ? (
            <ChartSkeleton />
          ) : q.isError ? (
            <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
          ) : chart.length === 0 ? (
            <EmptyState label="No traffic in this window" />
          ) : (
            <MetricLineChart
              data={chart}
              yUnit=""
              series={[
                { key: "calls", label: "Estimated calls" },
                { key: "errorRate", label: "Server error rate (%)" },
              ]}
            />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 px-6 lg:grid-cols-2">
        <Panel title="Latency by method family" description="How long Identity Search takes per method family." help={HELP.latencyByFamily}>
          <DataTable head={["Family", "Calls", "Avg", "p95"]} align={["left", "right", "right", "right"]}>
            {q.isPending ? (
              <TableSkeleton cols={4} rows={4} />
            ) : !d?.byMethodFamily?.length ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState label="Method family logging not present in this window" />
                </td>
              </tr>
            ) : (
              d.byMethodFamily.map((f) => (
                <tr key={f.family}>
                  <Td className="font-medium">{f.family}</Td>
                  <Td right>{num(f.calls)}</Td>
                  <Td right>{Math.round(f.avgLatencyMs)} ms</Td>
                  <Td right>{Math.round(f.p95LatencyMs)} ms</Td>
                </tr>
              ))
            )}
          </DataTable>
        </Panel>

        <Panel title="Server error breakdown" description="Logged Identity Search 5xx server errors by status code." help={HELP.apiStatusBreakdown}>
          <DataTable head={["Status", "Count"]} align={["left", "right"]}>
            {q.isPending ? (
              <TableSkeleton cols={2} rows={3} />
            ) : !d ? (
              <tr>
                <td colSpan={2}>
                  <EmptyState />
                </td>
              </tr>
            ) : (
              Object.entries(d.counts.byStatus)
                .filter(([s]) => Number(s) >= 500)
                .map(([s, c]) => (
                  <tr key={s}>
                    <Td>
                      <Pill tone="danger">{s}</Pill>
                    </Td>
                    <Td right>{num(c)}</Td>
                  </tr>
                ))
            )}
          </DataTable>
        </Panel>
      </div>

      <div className="px-6">
        <Panel title="Recent server errors" description="The most recent Identity Search failures, with reason and timing." help={HELP.apiErrors}>
          <DataTable
            head={["Timestamp", "Status", "Duration", "Endpoint", "Message"]}
            align={["left", "left", "right", "left", "left"]}
          >
            {q.isPending ? (
              <TableSkeleton cols={5} rows={5} />
            ) : !d?.recentServerErrors?.length ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState label="No server errors in this window" />
                </td>
              </tr>
            ) : (
              d.recentServerErrors.map((e, i) => (
                <tr key={`${e.requestId}-${i}`}>
                  <Td mono>{e.timestamp}</Td>
                  <Td>
                    <Pill tone="danger">{e.status}</Pill>
                  </Td>
                  <Td right>{Math.round(e.durationMs)} ms</Td>
                  <Td mono>{e.endpoint}</Td>
                  <Td className="max-w-[420px] truncate text-muted-foreground">
                    <span title={e.errorMessage}>{e.errorMessage}</span>
                  </Td>
                </tr>
              ))
            )}
          </DataTable>
        </Panel>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, help }: { label: string; value: string; sub?: string; help?: string }) {
  return <MetricCard label={label} value={value} sub={sub} help={help} />;
}

