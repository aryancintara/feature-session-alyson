import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusDot } from "@/components/ui-bits";
import { Pill, MetricCard, Panel, DataTable, Td } from "@/components/identity/bits";
import { ChartSkeleton, MetricRowSkeleton, Shimmer, TableSkeleton } from "@/components/identity/skeletons";
import { leadsPipelineQuery as pipelineQuery, LEADS_OVERALL as PIPELINE_OVERALL } from "@/components/leads/LeadsPipelinePill";
import { leadsGet, LEADS_HIDDEN_PATHS as HIDDEN_PATHS } from "@/lib/unifiedLeadsApi";
import { fmtPst, humanize, pipelineTone, relTime, type ApiHealthResponse } from "@/lib/unifiedPropertiesApi";

const TITLE = "Leads Pipeline & API Health — Alyson CDP";
const DESC = "See whether lead data is current, review recent processing, and monitor service reliability.";
export const Route = createFileRoute("/unified-leads/pipeline-api-health")({
  head: () => ({ meta: [
    { title: TITLE }, { name: "description", content: DESC },
    { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: PipelineApiHealth,
});

const CARDS = [
  { id: "unified_leads_ingest", title: "Unified Leads Ingest", desc: "Runs after each successful sampledb.leads refresh (hl-leads-sync watermark → unified-leads-ingest SFN)" },
] as const;
const ATTEMPT: Record<string, string> = { SUCCEEDED: "Succeeded", FAILED: "Failed", RUNNING: "Running", ABORTED: "Stopped", TIMED_OUT: "Timed out" };
const dot = (t: string) => (t === "success" ? "healthy" : t === "warning" ? "warning" : t === "danger" ? "error" : "degraded") as "healthy";

const WINDOWS = [[1, "1h"], [6, "6h"], [24, "24h"], [168, "7d"]] as const;
const n = (v: number | undefined) => (v ?? 0).toLocaleString();
const pct = (v: number | undefined) => (v == null ? "—" : `${(v * 100).toFixed(v >= 0.999 || v === 0 ? 1 : 2)}%`);
const attemptTone = (status: string) => status === "SUCCEEDED" ? "success" : status === "RUNNING" ? "neutral" : "danger";
const statusTone = (status: string) => status.startsWith("2") ? "success" : status.startsWith("5") ? "danger" : "neutral";

function PipelineApiHealth() {
  const qc = useQueryClient();
  const q = useQuery(pipelineQuery);
  const d = q.data;
  const name = (id: string) => CARDS.find((c) => c.id === id)?.title ?? humanize(id);
  const [hours, setHours] = useState(24);
  const aq = useQuery({ queryKey: ["unified-leads", "api-health", hours], queryFn: () => leadsGet<ApiHealthResponse>("/v1/api-health", { hours }), retry: 1 });
  const ad = aq.data;
  const c = ad?.counts ?? {};
  const total = c.estimatedTotalVolume ?? c.total ?? 0;
  const e5 = c.logged5xx ?? 0;
  const clean = total > 0 ? (total - e5) / total : undefined;
  const paths = (ad?.byMethodFamily ?? []).filter((p) => !HIDDEN_PATHS.has(p.family)).sort((a, b) => b.calls - a.calls);
  const statusRows = (Array.isArray(c.byStatus) ? c.byStatus.map((s) => [String(s.status), s.count] as const) : Object.entries(c.byStatus ?? {}))
    .filter(([status]) => !status.startsWith("4"));
  const series = (ad?.series ?? []).map((s) => {
    const calls = s.calls ?? s.estimatedTotal ?? 0;
    const rate = s.errorRate ?? (calls ? (s.logged5xx ?? 0) / calls : 0);
    const b = s.ts ?? s.bucket ?? "";
    return { calls, label: fmtPst(/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(b) ? `${b}:00:00Z` : b).replace(" PST", ""), errPct: +(rate * 100).toFixed(2) };
  });
  const errors = ad?.recentServerErrors ?? ad?.recentErrors ?? [];

  return (
    <div className="pb-10">
      <PageHeader title="Pipeline & API Health" subtitle="See whether lead data is current, review recent processing, and monitor service reliability."
        actions={<>
          {d && <Pill tone={pipelineTone(d.overallStatus)}>{PIPELINE_OVERALL[d.overallStatus] ?? humanize(d.overallStatus)}</Pill>}
          <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="API time window">
            {WINDOWS.map(([h, l]) => <button key={h} aria-pressed={hours === h} onClick={() => setHours(h)} className={`rounded px-2.5 py-1 text-xs font-medium ${hours === h ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{l}</button>)}
          </div>
          <Button variant="outline" size="sm" onClick={() => { qc.invalidateQueries({ queryKey: pipelineQuery.queryKey }); qc.invalidateQueries({ queryKey: ["unified-leads", "api-health"] }); }}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Refresh</Button>
        </>} />
      <section className="space-y-4 px-6" aria-label="Pipeline">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pipeline</h2>
        {q.isError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{(q.error as Error).message}</p>}
        <div className="grid gap-4">
          {CARDS.map((c) => {
            const p = d?.pipelines.find((x) => x.id === c.id);
            const tone = pipelineTone(p?.status);
            return (
              <div key={c.id} className={`rounded-xl border bg-card p-4 ${tone === "success" ? "border-success/40" : tone === "danger" ? "border-destructive/40" : "border-border"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><StatusDot status={dot(tone)} /><h3 className="text-sm font-semibold">{c.title}</h3></div>
                  {p && <Pill tone={tone}>{humanize(p.status)}</Pill>}
                </div>
                <p className="text-xs text-muted-foreground">{c.desc}</p>
                {q.isLoading ? <div className="mt-4 space-y-2"><Shimmer className="h-6 w-32" /><Shimmer className="h-3 w-48" /></div> : p ? (
                  <div className="mt-4 space-y-3 text-sm">
                    <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Last successful run</div><div className="text-xl font-semibold text-success">{relTime(p.lastSuccessfulAt)}</div><div className="text-xs text-muted-foreground">{fmtPst(p.lastSuccessfulAt)}</div></div>
                    <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Last attempt</div><div>{p.lastAttemptStatus ? <Pill tone={attemptTone(p.lastAttemptStatus)}>{ATTEMPT[p.lastAttemptStatus] ?? humanize(p.lastAttemptStatus)}</Pill> : "—"} <span className="text-muted-foreground">· {fmtPst(p.lastAttemptAt)}</span></div></div>
                    {p.message && <p className="text-xs text-muted-foreground">{p.message}</p>}
                    {(p.status === "lagging" || p.status === "stale") && p.lagMinutes != null && <p className="text-xs text-warning-foreground">About {Math.round(p.lagMinutes)} minutes behind the expected ~{d?.expectedCadenceMinutes ?? 15}-minute refresh</p>}
                  </div>
                ) : !q.isError && <p className="mt-4 text-sm text-muted-foreground">No status reported.</p>}
                <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-xs"><span className="text-muted-foreground">Data completeness:</span><Pill tone="neutral">Not verified</Pill><span className="text-muted-foreground">A healthy run doesn't confirm every source row arrived.</span></div>
              </div>
            );
          })}
        </div>
        <Panel title="Source coverage">
          <DataTable head={["Source", "Loaded", "Expected", "Freshness"]} align={["left", "right", "right", "left"]}>
            {(() => {
              const ingest = d?.pipelines.find((x) => x.id === "unified_leads_ingest");
              const nr = <span className="text-muted-foreground">Not reported</span>;
              const rows: [string, React.ReactNode][] = [
                ["Unified Leads ingest", q.isLoading ? <Shimmer className="h-3 w-20" /> : ingest?.lastSuccessfulAt ? <span title={fmtPst(ingest.lastSuccessfulAt)}>{relTime(ingest.lastSuccessfulAt)}</span> : nr],
                ["Leads Plus feed", nr],
                ["Buyer CRM", nr],
              ];
              return rows.map(([label, fresh]) => <tr key={label}><Td>{label}</Td><Td right>{nr}</Td><Td right>{nr}</Td><Td>{fresh}</Td></tr>);
            })()}
          </DataTable>
        </Panel>
        {d?.recentRuns && d.recentRuns.length > 0 && (
          <Panel title="Recent runs">
            <DataTable head={["When (PST)", "Pipeline", "Status", "Duration"]} align={["left", "left", "left", "right"]}>
              {d.recentRuns.map((r, i) => (
                 <tr key={i}><Td>{fmtPst(r.startedAt)}</Td><Td>{name(r.pipelineId)}</Td><Td><Pill tone={attemptTone(r.status)}>{ATTEMPT[r.status] ?? humanize(r.status)}</Pill></Td><Td right>{r.durationMs != null ? `${Math.round(r.durationMs / 1000)}s` : "—"}</Td></tr>
              ))}
            </DataTable>
          </Panel>
        )}
      </section>
      <section className="mt-8" aria-label="API">
        <h2 className="mb-3 px-6 text-sm font-semibold uppercase tracking-wider text-muted-foreground">API</h2>
      {aq.isError && <p role="alert" className="mx-6 mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{(aq.error as Error).message}</p>}
      {aq.isLoading ? <MetricRowSkeleton count={4} /> : (
        <div className="grid grid-cols-2 gap-3 px-6 lg:grid-cols-4">
           <MetricCard label="Calls" value={n(total)} sub={`${n(c.logged2xx)} successful responses${ad?.latencyMs?.p95 != null ? ` · p95 ${Math.round(ad.latencyMs.p95)} ms` : ""}`} tone="success" />
          <MetricCard label="Success rate" value={pct(ad?.successRate)} sub={`${n(e5)} server errors`} tone="success" />
           <MetricCard label="Server errors" value={n(e5)} sub="5xx in this window" tone={e5 > 0 ? "destructive" : "success"} />
           <MetricCard label="Error-free traffic" value={pct(clean)} sub={`${n(total - e5)} clean requests`} tone="success" />
        </div>
      )}
      <div className="mt-4 space-y-4 px-6">
        <Panel title="Traffic & server error rate">
          {aq.isLoading ? <ChartSkeleton /> : series.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">No traffic in this window.</p> : (
            <div className="h-64 p-4">
              <ResponsiveContainer>
                <ComposedChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <YAxis yAxisId="l" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <YAxis yAxisId="r" orientation="right" unit="%" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", fontSize: 12 }} />
                   <Bar yAxisId="l" dataKey="calls" name="Calls" fill="var(--success)" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="r" dataKey="errPct" name="Server error rate %" stroke="var(--destructive)" dot={false} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Traffic by path" className="lg:col-span-2">
            <DataTable head={["Path", "Calls", "Server errors", "Error rate", "p95"]} align={["left", "right", "right", "right", "right"]}>
              {aq.isLoading ? <TableSkeleton cols={5} rows={4} /> : paths.length === 0 ? <tr><Td className="text-center text-muted-foreground">No traffic.</Td></tr> : paths.map((p) => (
                 <tr key={p.family}><Td mono>{p.family}</Td><Td right className="text-success">{n(p.calls)}</Td><Td right className={p.serverErrors > 0 ? "text-destructive" : "text-success"}>{n(p.serverErrors)}</Td><Td right className={p.errorRate > 0 ? "text-destructive" : "text-success"}>{pct(p.errorRate)}</Td><Td right className="text-xs text-muted-foreground">{Math.round(p.p95LatencyMs)} ms</Td></tr>
              ))}
            </DataTable>
          </Panel>
          <Panel title="Status breakdown">
            <DataTable head={["Status", "Responses"]} align={["left", "right"]}>
               {aq.isLoading ? <TableSkeleton cols={2} rows={4} /> : statusRows.map(([s, v]) => <tr key={s}><Td><Pill tone={statusTone(s)}>{s}</Pill></Td><Td right className={s.startsWith("5") ? "text-destructive" : "text-success"}>{n(v)}</Td></tr>)}
            </DataTable>
          </Panel>
        </div>
        <Panel title="Recent server errors">
          <DataTable head={["Timestamp (PST)", "Status", "Duration", "Endpoint", "Message"]} align={["left", "left", "right", "left", "left"]}>
            {aq.isLoading ? <TableSkeleton cols={5} rows={3} /> : errors.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No server errors in this window.</td></tr> : errors.map((e, i) => (
               <tr key={i}><Td>{fmtPst(e.timestamp ?? e.ts)}</Td><Td><Pill tone="danger">{e.status}</Pill></Td><Td right>{e.durationMs != null ? `${Math.round(e.durationMs)} ms` : "—"}</Td><Td mono>{e.endpoint ?? e.path ?? "—"}</Td><Td className="text-xs text-destructive">{e.errorMessage || e.message || "—"}</Td></tr>
            ))}
          </DataTable>
        </Panel>
      </div>
      </section>
    </div>
  );
}
