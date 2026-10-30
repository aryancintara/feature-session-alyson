import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/ui-bits";
import { Panel, DataTable, Td, Pill, Bar, MetricCard, accuracyTone } from "@/components/identity/bits";
import { HELP } from "@/lib/identityHelpText";
import { MetricLineChart, KeyValues } from "@/components/identity/metrics";
import { MetricCardSkeleton, TableSkeleton, ChartSkeleton, ErrorState } from "@/components/identity/skeletons";
import { EmptyState } from "@/components/identity/ProcessDateSelect";
import { DateRangeSelect, makeLatestRange, type DateRange } from "@/components/identity/DateRangeSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  methodsQuery,
  methodTrendsQuery,
  accuracyQuery,
  apiHealthQuery,
  openCsv,
  rangeParams,
  num,
  pctPoints,
  pctRatio,
  type Grain,
} from "@/lib/identityLiveApi";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/identity/methods")({
  head: () => ({
    meta: [
      { title: "Method Analysis · Identity Monitoring" },
      {
        name: "description",
        content:
          "Live analysis of each identity resolution method: volume, match rate, accuracy against the source of truth, cascade position and trends.",
      },
      { property: "og:title", content: "Method Analysis · Identity Monitoring" },
      {
        property: "og:description",
        content: "Per-method identity resolution performance, cascade position and accuracy vs SOT.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MethodAnalysisPage,
});

function MethodAnalysisPage() {
  const [range, setRange] = useState<DateRange>(makeLatestRange());
  const [grain, setGrain] = useState<Grain>("daily");
  const [selected, setSelected] = useState<string | null>(null);

  const methods = useQuery(methodsQuery(range));
  const accuracy = useQuery(accuracyQuery(range));
  const trends = useQuery(methodTrendsQuery(grain, range));
  const health = useQuery(apiHealthQuery(range.from && range.to ? range : 24));


  const rows = methods.data?.methods ?? [];
  const accByMethod = new Map((accuracy.data?.byMethod ?? []).map((m) => [m.method, m]));
  const activeMethod = selected;
  const method = rows.find((m) => m.method === activeMethod) ?? null;
  const methodAcc = activeMethod ? accByMethod.get(activeMethod) : undefined;

  const cascade = methods.data?.cascade ?? [];
  const cascadeStep = method ? cascade.findIndex((c) => c.family === method.methodFamily) + 1 : 0;

  const trendData = useMemo(() => {
    if (!activeMethod) return [];
    return (trends.data?.series ?? []).map((p) => {
      const m = p.methods.find((x) => x.method === activeMethod);
      return { period: p.period, share: m?.share ?? 0, records: m?.records ?? 0 };
    });
  }, [trends.data, activeMethod]);

  const daily = accuracy.data?.daily ?? null;

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        title="Method Analysis"
        subtitle={
          range.from && range.to
            ? `Live per-method performance · ${range.from} → ${range.to}`
            : `Live per-method performance · process date ${methods.data?.processDate ?? "…"}`
        }
        actions={<DateRangeSelect value={range} onChange={setRange} resolved={methods.data?.processDate ?? null} />}
      />

      <div className="grid grid-cols-2 gap-3 px-6 lg:grid-cols-4">
        {methods.isPending || accuracy.isPending ? (
          Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : (
          <>
            <Metric
              label="Identity events"
              value={num(methods.data?.total)}
              sub="records processed"
              help={HELP.methodRecords}
            />
            <Metric
              label="Resolved"
              value={num(methods.data?.resolvedTotal)}
              sub={`${pctRatio(methods.data?.matchRate)} resolution share`}
              help={HELP.methodResolved}
            />
            <Metric
              label="Accuracy vs SOT (Leads Plus)"
              value={pctPoints(daily?.accuracyPct)}
              sub={`${num(daily?.compared)} compared vs SOT (Leads Plus)`}
              help={HELP.accuracy}
            />
            <Metric
              label="Field match rate"
              value={pctRatio(daily?.matchRate)}
              sub="email / name / address overlap"
              help={HELP.fieldMatchRate}
            />
          </>
        )}
      </div>

      <div className="px-6">
        <Panel
          title="All methods"
          description="Click a method to open its detail. Accuracy comes from the SOT comparison, not match share."
          help={HELP.methodsTable}
          actions={
            <button
              onClick={() => openCsv("/v1/methods", rangeParams(range))}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-accent"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          }
        >
          <DataTable
            head={["Method", "Family", "Cascade step", "Share", "Records", "Avg conf.", "Compared vs SOT (Leads Plus)", "Accuracy"]}
            align={["left", "left", "left", "left", "right", "right", "right", "left"]}
            tips={{
              Method: HELP.winningMethod,
              "Cascade step": HELP.cascadeStep,
              Share: HELP.methodRanking,
              Records: HELP.methodRecords,
              "Avg conf.": HELP.avgConfidence,
              "Compared vs SOT (Leads Plus)": HELP.comparedVsSot,
              Accuracy: HELP.accuracyByMethod,
            }}
          >
            {methods.isPending ? (
              <TableSkeleton cols={8} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState label="No method data for this process date" />
                </td>
              </tr>
            ) : (
              rows.map((m) => {
                const acc = accByMethod.get(m.method);
                const step = cascade.findIndex((c) => c.family === m.methodFamily) + 1;
                return (
                  <tr
                    key={m.method}
                    onClick={() => setSelected(m.method)}
                    className={cn("cursor-pointer hover:bg-muted/40", m.method === activeMethod && "bg-muted/50")}
                  >
                    <Td className="font-medium">{m.method}</Td>
                    <Td className="text-muted-foreground">{m.methodFamily}</Td>
                    <Td className="text-muted-foreground">{step > 0 ? `Step ${step}` : "—"}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="w-20">
                          <Bar value={m.percentage} tone="primary" />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">{pctPoints(m.percentage)}</span>
                      </div>
                    </Td>
                    <Td right>{num(m.records)}</Td>
                    <Td right>{m.avgConfidence === null ? "—" : m.avgConfidence}</Td>
                    <Td right>{acc ? num(acc.compared) : "—"}</Td>
                    <Td>{acc ? <Pill tone={accuracyTone(acc.accuracy)}>{pctPoints(acc.accuracy)}</Pill> : <span className="text-xs text-muted-foreground">—</span>}</Td>
                  </tr>
                );
              })
            )}
          </DataTable>
        </Panel>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{activeMethod}</DialogTitle>
            <DialogDescription>
              {method ? `${method.methodFamily} family · cascade step ${cascadeStep || "—"}` : "Method detail"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Panel title="Method summary" description="Volume, share and confidence for this method." help={HELP.methodsTable}>
              {methods.isPending ? (
                <ChartSkeleton bars={4} />
              ) : !method ? (
                <EmptyState label="No data for this method" />
              ) : (
                <div className="p-4">
                  <KeyValues
                    data={{
                      Records: num(method.records),
                      "Share of events": pctPoints(method.percentage),
                      "Avg confidence": method.avgConfidence === null ? "—" : String(method.avgConfidence),
                      Family: method.methodFamily,
                      "Cascade step": cascadeStep ? String(cascadeStep) : "—",
                    }}
                    tips={{ "Avg confidence": HELP.avgConfidence }}
                  />
                </div>
              )}
            </Panel>

            <Panel
              title="Accuracy scoring"
              description="Scored only on records we can join to a trusted Lead Plus record."
              help={HELP.accuracyScoring}
            >
              {accuracy.isPending ? (
                <ChartSkeleton bars={4} />
              ) : !methodAcc ? (
                <EmptyState label="No SOT overlap for this method on this date" />
              ) : (
                <div className="p-4">
                  <KeyValues
                    data={{
                      Compared: num(methodAcc.compared),
                      Matches: num(methodAcc.matches),
                      Accuracy: pctPoints(methodAcc.accuracy),
                      "SOT qualified leads": num(daily?.sotQualifiedLeads),
                      "SOT joined": num(daily?.sotJoined),
                    }}
                  />
                </div>
              )}
            </Panel>

            <Panel
              title={`${activeMethod ?? "Method"} · volume & share trend`}
              description="How this method's volume and share change day by day."
              help={HELP.methodTrends}
              actions={
                <div className="flex rounded-md border border-border p-0.5">
                  {(["daily", "weekly", "monthly"] as Grain[]).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGrain(g)}
                      className={`rounded px-2 py-1 text-[11px] font-medium capitalize ${
                        grain === g ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              }
            >
              {trends.isPending ? (
                <ChartSkeleton />
              ) : trends.isError ? (
                <ErrorState message={(trends.error as Error).message} onRetry={() => trends.refetch()} />
              ) : trendData.length === 0 ? (
                <EmptyState label="No trend data available" />
              ) : (
                <MetricLineChart data={trendData} series={[{ key: "share", label: "Share of events" }]} />
              )}
            </Panel>
          </div>
        </DialogContent>
      </Dialog>


      <div className="px-6">
        <Panel
          title="Cascade waterfall"
          description="Methods are tried in priority order — the first hit wins."
          help={HELP.waterfall}
        >
          <DataTable
            head={["Step", "Family", "Entering", "Resolved", "Passed on", "Match rate", "Avg conf."]}
            align={["left", "left", "right", "right", "right", "right", "right"]}
            tips={{
              Step: HELP.cascadeStep,
              Entering: HELP.waterfallEntering,
              Resolved: HELP.waterfallResolved,
              "Passed on": HELP.waterfallPassed,
              "Match rate": HELP.matchRate,
              "Avg conf.": HELP.avgConfidence,
            }}
          >
            {methods.isPending ? (
              <TableSkeleton cols={7} rows={6} />
            ) : cascade.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState label="No cascade data" />
                </td>
              </tr>
            ) : (
              cascade.map((c, i) => (
                <tr key={c.family}>
                  <Td className="text-muted-foreground">Step {i + 1}</Td>
                  <Td className="font-medium">{c.family}</Td>
                  <Td right>{num(c.entering)}</Td>
                  <Td right>{num(c.resolved)}</Td>
                  <Td right>{num(c.passed)}</Td>
                  <Td right>{pctRatio(c.matchRate, 2)}</Td>
                  <Td right>{c.avgConfidence === null ? "—" : c.avgConfidence}</Td>
                </tr>
              ))
            )}
          </DataTable>
        </Panel>
      </div>

      {health.data?.byMethodFamily?.length ? (
        <div className="px-6">
          <Panel
            title="Identity Search API latency by family"
            description="How long Identity Search takes per method family."
            help={HELP.latencyByFamily}
          >
            <DataTable head={["Family", "Calls", "Avg latency", "p95 latency"]} align={["left", "right", "right", "right"]}>
              {health.data.byMethodFamily.map((f) => (
                <tr key={f.family}>
                  <Td className="font-medium">{f.family}</Td>
                  <Td right>{num(f.calls)}</Td>
                  <Td right>{Math.round(f.avgLatencyMs)} ms</Td>
                  <Td right>{Math.round(f.p95LatencyMs)} ms</Td>
                </tr>
              ))}
            </DataTable>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value, sub, help }: { label: string; value: string; sub?: string; help?: string }) {
  return <MetricCard label={label} value={value} sub={sub} help={help} />;
}
