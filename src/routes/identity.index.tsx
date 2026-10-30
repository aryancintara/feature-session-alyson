import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-bits";
import { Panel, Pill, Bar } from "@/components/identity/bits";
import { HelpTip } from "@/components/identity/HelpTip";
import { HELP } from "@/lib/identityHelpText";
import { TrendMetricCard, MetricLineChart } from "@/components/identity/metrics";
import { MetricCardSkeleton, ChartSkeleton, ListSkeleton, ErrorState } from "@/components/identity/skeletons";
import { EmptyState } from "@/components/identity/ProcessDateSelect";
import { DateRangeSelect, makeLatestRange, type DateRange } from "@/components/identity/DateRangeSelect";
import {
  overviewQuery,
  overviewSeriesQuery,
  methodsQuery,
  accuracyQuery,
  apiHealthQuery,
  pipelineStatusQuery,
  num,
  pctPoints,
  pctRatio,
  type Grain,
} from "@/lib/identityLiveApi";

export const Route = createFileRoute("/identity/")({
  head: () => ({
    meta: [
      { title: "Identity Overview · Identity Health Dashboard" },
      {
        name: "description",
        content:
          "Executive view of identity health — resolution rate, failure rate, accuracy vs source of truth, performance trend and identity waterfall.",
      },
      { property: "og:title", content: "Identity Overview · Identity Health Dashboard" },
      { property: "og:description", content: "Executive identity health summary with live trends and waterfall." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OverviewPage,
});

const TREND_METRICS = [
  { key: "resolutionRate", label: "Resolution Rate" },
  { key: "accuracyPct", label: "Accuracy" },
  { key: "matchRate", label: "Match Rate" },
] as const;

type TrendKey = (typeof TREND_METRICS)[number]["key"];
type UiGrain = Grain;

const GRAIN_LABEL: Record<UiGrain, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

function OverviewPage() {
  const [range, setRange] = useState<DateRange>(makeLatestRange());
  const [grain, setGrain] = useState<UiGrain>("daily");
  const [trendKey, setTrendKey] = useState<TrendKey>("resolutionRate");

  const overview = useQuery(overviewQuery(range));
  const accuracy = useQuery(accuracyQuery(range));
  const methods = useQuery(methodsQuery(range));
  const health = useQuery(apiHealthQuery(range.from && range.to ? range : 24));
  const pipeline = useQuery(pipelineStatusQuery());
  const series = useQuery(overviewSeriesQuery(grain, range));

  const o = overview.data;
  const base = o?.baseline30d ?? null;

  const chartData = useMemo(() => {
    const points = series.data?.points ?? [];
    return points.map((p) => ({
      period: p.period,
      resolutionRate: p.resolutionRate === null ? null : p.resolutionRate * 100,
      matchRate: p.matchRate === null ? null : p.matchRate * 100,
      accuracyPct: p.accuracyPct,
    }));
  }, [series.data]);

  const cascade = methods.data?.cascade ?? [];
  const maxResolved = Math.max(1, ...cascade.map((c) => c.resolved));
  const accuracyByFamily = new Map<string, number>();
  (accuracy.data?.byMethod ?? []).forEach((m) => {
    const prev = accuracyByFamily.get(m.methodFamily);
    accuracyByFamily.set(m.methodFamily, prev === undefined ? m.accuracy : Math.max(prev, m.accuracy));
  });

  const rankedFamilies = [...(methods.data?.families ?? [])].sort((a, b) => b.share - a.share);
  const topFamily = rankedFamilies[0];

  const activeTrend = TREND_METRICS.find((t) => t.key === trendKey)!;
  const pipelineTone =
    pipeline.data?.status === "healthy" ? "success" : pipeline.data?.status === "lagging" ? "warning" : "danger";

  return (
    <div className="space-y-2 pb-4">
      <PageHeader
        title="Identity Overview"
        subtitle={
          range.from && range.to
            ? `Identity health dashboard · ${range.from} → ${range.to}`
            : `Identity health dashboard · process date ${o?.processDate ?? "…"}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {pipeline.data ? (
              <span className="inline-flex items-center gap-1">
                <Pill tone={pipelineTone}>
                  Pipeline {pipeline.data.status}
                  {pipeline.data.expectedProcessDate ? ` · D-1 ${pipeline.data.expectedProcessDate}` : ""}
                </Pill>
                <HelpTip text={HELP.pipeline} />
              </span>
            ) : null}
            <DateRangeSelect value={range} onChange={setRange} resolved={o?.processDate ?? null} />
          </div>
        }
      />

      {/* Section 1 — headline identity health */}
      <div className="grid grid-cols-1 gap-2 px-6 sm:grid-cols-2 xl:grid-cols-4">
        {overview.isPending ? (
          Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : overview.isError ? (
          <div className="sm:col-span-2 xl:col-span-4 rounded-xl border border-border bg-card">
            <ErrorState message={(overview.error as Error).message} onRetry={() => overview.refetch()} />
          </div>
        ) : (
          <>
            <TrendMetricCard
              label="Identity Resolution Rate"
              description="Share of records that should have an identity and received one."
              help={HELP.resolutionRate}
              value={pctRatio(o?.resolutionRate)}
              previous={pctRatio(base?.resolutionRate)}
              previousLabel="30-day baseline"
              goodDirection="up"
            />
            <TrendMetricCard
              label="Failure Rate"
              description="Records that should have resolved but returned no identity."
              help={HELP.failureRate}
              value={pctRatio(o?.failureRate)}
              previous={pctRatio(base?.failureRate)}
              previousLabel="30-day baseline"
              goodDirection="down"
            />
            <TrendMetricCard
              label="Accuracy vs SOT (Leads Plus)"
              description="Right person vs SOT (Leads Plus) on email, name and address — not match rate."
              help={HELP.accuracy}
              value={pctPoints(accuracy.data?.daily?.accuracyPct ?? o?.accuracyPct)}
              previous={pctPoints(base?.accuracyPct)}
              previousLabel="30-day baseline"
              goodDirection="up"
            />
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Volume
                <HelpTip text={HELP.volume} />
              </div>
              <div className="mt-1.5 text-2xl font-semibold tabular-nums">
                {num(o?.kpis.find((k) => k.label === "Identities Delivered")?.value)}
              </div>
              <div className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                of {num(o?.kpis.find((k) => k.label === "Total Identity Events")?.value)} identity events
              </div>
              <p className="mt-2 inline-flex items-center gap-1 text-[11px] leading-snug text-muted-foreground">
                Cost per identity: not available yet (—)
                <HelpTip text={HELP.cost} />
              </p>
            </div>
          </>
        )}
      </div>

      {/* Section 2 — trend + method summary */}
      <div className="grid grid-cols-1 gap-2 px-6 lg:grid-cols-12">
        <Panel
          className="lg:col-span-8"
          title="Identity Performance Trend"
          description="Resolution, failure and accuracy over time, so you can spot good and bad days."
          help={HELP.trendChart}
          actions={
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex rounded-md border border-border p-0.5">
                {TREND_METRICS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTrendKey(t.key)}
                    className={`rounded px-2 py-1 text-[11px] font-medium ${
                      trendKey === t.key ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex rounded-md border border-border p-0.5">
                {(["daily", "weekly", "monthly"] as UiGrain[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGrain(g)}
                    className={`rounded px-2 py-1 text-[11px] font-medium ${
                      grain === g ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    }`}
                  >
                    {GRAIN_LABEL[g]}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          {series.isPending ? (
            <ChartSkeleton />
          ) : series.isError ? (
            <ErrorState message={(series.error as Error).message} onRetry={() => series.refetch()} />
          ) : chartData.length === 0 ? (
            <EmptyState label="No trend points for this range" />
          ) : (
            <MetricLineChart
              data={chartData}
              series={[{ key: activeTrend.key, label: `${activeTrend.label} (%)` }]}
              height={210}
            />
          )}
        </Panel>

        <Panel
          className="lg:col-span-4"
          title="Identity method summary"
          description="Which methods were used most. This is volume share — not accuracy."
          help={HELP.methodRanking}
        >
          {methods.isPending ? (
            <ListSkeleton rows={5} />
          ) : methods.isError ? (
            <ErrorState message={(methods.error as Error).message} onRetry={() => methods.refetch()} />
          ) : !topFamily ? (
            <EmptyState label="No method data for this process date" />
          ) : (
            <div className="space-y-2 p-3">
              <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Highest volume family</div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-base font-semibold">{topFamily.family}</span>
                  <Pill tone="info">{pctPoints(topFamily.share)} share</Pill>
                </div>
              </div>
              <div className="space-y-1">
                {rankedFamilies.slice(1).map((f) => (
                  <div key={f.family} className="flex items-center justify-between gap-3">
                    <span className="text-[11px]">{f.family}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16">
                        <Bar value={f.share} tone="primary" />
                      </div>
                      <span className="w-10 text-right text-[11px] tabular-nums">{pctPoints(f.share)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/identity/methods" className="inline-block text-[11px] font-medium text-primary hover:underline">
                View Method Analysis →
              </Link>
            </div>
          )}
        </Panel>
      </div>

      {/* Section 3 — cascade waterfall */}
      <div className="px-6">
        <Panel
          title="Method waterfall"
          description="Methods are tried in priority order — the first hit wins."
          help={HELP.waterfall}
          actions={
            <Link to="/identity/methods" className="text-[11px] font-medium text-primary hover:underline">
              View Method Analysis →
            </Link>
          }
        >
          {methods.isPending ? (
            <ChartSkeleton bars={6} />
          ) : cascade.length === 0 ? (
            <EmptyState label="No cascade data for this process date" />
          ) : (
            <ol className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-6">
              {cascade.map((c, i) => {
                const acc = accuracyByFamily.get(c.family);
                return (
                  <li key={c.family} className="rounded-lg border border-border bg-muted/30 p-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">
                        <span className="mr-1.5 text-[10px] tabular-nums text-muted-foreground">{i + 1}</span>
                        {c.family}
                      </span>
                      <Pill tone="neutral">{pctRatio(c.matchRate)} match</Pill>
                    </div>
                    <div className="mt-1.5">
                      <Bar value={(c.resolved / maxResolved) * 100} tone="primary" />
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] tabular-nums text-muted-foreground">
                      <span title={HELP.waterfallEntering}>Entering: {num(c.entering)}</span>
                      <span title={HELP.waterfallResolved}>Resolved: {num(c.resolved)}</span>
                      <span title={HELP.waterfallPassed}>Passed: {num(c.passed)}</span>
                      <span title={HELP.waterfallMatch}>Share: {pctPoints(c.share)}</span>
                      <span title={HELP.avgConfidence}>Conf: {c.avgConfidence === null ? "—" : c.avgConfidence}</span>
                      <span title={HELP.accuracy}>Acc: {acc === undefined ? "—" : pctPoints(acc)}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      </div>

      {/* Section 4 — system health */}
      <div className="px-6">
        <Panel
          title="System health summary"
          description="Quick pulse of the live Identity Search API — calls, success and latency."
          help={HELP.systemHealth}
          actions={
            <Link to="/identity/api" className="text-[11px] font-medium text-primary hover:underline">
              View API Health →
            </Link>
          }
        >
          {health.isPending ? (
            <ListSkeleton rows={2} bar={false} />
          ) : health.isError ? (
            <ErrorState message={(health.error as Error).message} onRetry={() => health.refetch()} />
          ) : (
            <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-5">
              {[
                { label: "Success rate", value: pctRatio(health.data?.successRate, 2) },
                { label: "Est. calls", value: num(health.data?.counts.estimatedTotalVolume) },
                { label: "Errors (5xx)", value: num(health.data?.counts.logged5xx) },
                { label: "Avg latency", value: `${Math.round(health.data?.latencyMs.avg ?? 0)} ms` },
                { label: "p95 latency", value: `${Math.round(health.data?.latencyMs.p95 ?? 0)} ms` },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-muted/30 p-2.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
                  <div className="mt-1 text-sm font-semibold tabular-nums">{s.value}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
