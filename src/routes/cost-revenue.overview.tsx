// Previous Overview page is kept at src/archive/cost-revenue/cost-revenue.overview.tsx.bak so it can be restored.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { SOURCE_LABELS, errMsg, isActive, listRules } from "@/lib/rulesApi";
import { dailyReportStatus, getDailyReport } from "@/lib/reconciliationDaily";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cost-revenue/overview")({
  head: () => ({
    meta: [
      { title: "Cost & Revenue Overview · Alyson CDP" },
      { name: "description", content: "A simple summary of active cost and revenue rules and the latest daily reconciliation." },
      { property: "og:title", content: "Cost & Revenue Overview · Alyson CDP" },
      { property: "og:description", content: "A simple summary of active cost and revenue rules and the latest daily reconciliation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CostRevenueOverview,
});

const usd = (n?: number | null) => (n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" }));
const Stat = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) => (
  <div className="min-w-0 px-4 py-4 sm:px-5">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={cn("mt-2 text-2xl font-semibold tabular-nums", tone)}>{value}</div>
  </div>
);

function CostRevenueOverview() {
  const rules = useQuery({ queryKey: ["cr-rules"], queryFn: listRules, retry: false });
  const daily = useQuery({ queryKey: ["cr-daily-report", ""], queryFn: () => getDailyReport(""), retry: false });

  const all = rules.data ?? [];
  const active = all.filter((r) => isActive(r.status));
  const bySource = Object.entries(active.reduce<Record<string, { REVENUE: number; COST: number }>>((acc, r) => {
    const s = (acc[r.source_id] ??= { REVENUE: 0, COST: 0 }); s[r.type] = (s[r.type] ?? 0) + 1; return acc;
  }, {}));

  const report = daily.data;
  const status = report ? dailyReportStatus(report) : null;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 p-4 sm:p-6">
      <PageHeader className="px-0 pt-0 pb-0" title="Cost & Revenue Overview" subtitle="Rules in use and the latest reconciliation result." />

      <section className="space-y-4" aria-labelledby="overview-rules">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 id="overview-rules" className="min-w-0 text-base font-semibold">Rules</h2>
          <Button asChild size="sm" variant="outline" className="shrink-0"><Link to="/cost-revenue/rules">Open rules</Link></Button>
        </div>
        {rules.isLoading ? <p className="text-sm text-muted-foreground">Loading rules…</p>
          : rules.error ? <p className="text-sm text-destructive">{errMsg(rules.error)}</p>
          : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 divide-x divide-border rounded-lg border border-border bg-card sm:grid-cols-4">
                <Stat label="Active rules" value={active.length} />
                <Stat label="Revenue rules" value={active.filter((r) => r.type === "REVENUE").length} />
                <Stat label="Cost rules" value={active.filter((r) => r.type === "COST").length} />
                <Stat label="Inactive versions" value={all.length - active.length} />
              </div>
              {bySource.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full min-w-[360px] text-left text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium sm:px-5">Source</th><th className="px-4 py-3 text-right font-medium sm:px-5">Revenue rules</th><th className="px-4 py-3 text-right font-medium sm:px-5">Cost rules</th></tr></thead>
                  <tbody>{bySource.map(([src, c]) => <tr key={src} className="border-t border-border"><td className="px-4 py-3 sm:px-5">{SOURCE_LABELS[src] ?? src}</td><td className="px-4 py-3 text-right tabular-nums sm:px-5">{c.REVENUE}</td><td className="px-4 py-3 text-right tabular-nums sm:px-5">{c.COST}</td></tr>)}</tbody>
                </table>
                </div>
              )}
            </div>
          )}
      </section>

      <section className="space-y-4 border-t border-border pt-6" aria-labelledby="overview-reconciliation">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 id="overview-reconciliation" className="min-w-0 text-base font-semibold">Reconciliation</h2>
          <Button asChild size="sm" variant="outline" className="shrink-0"><Link to="/cost-revenue/reconciliation">Open reconciliation</Link></Button>
        </div>
        {daily.isLoading ? <p className="text-sm text-muted-foreground">Loading latest daily check…</p>
          : daily.error ? <p className="text-sm text-destructive">{errMsg(daily.error)}</p>
          : !report ? <p className="text-sm text-muted-foreground">No daily report is available yet.</p>
          : (
            <div className="space-y-4">
              <div className="grid gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0 space-y-1">
                  <p className={cn("font-semibold", status === "All sources match" ? "text-success" : "text-destructive")}>{status}</p>
                  <p className="text-muted-foreground">{report.start} to {report.end}</p>
                </div>
                <p className="text-xs text-muted-foreground sm:text-right">Last run {new Date(report.run_at).toLocaleString()}</p>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full min-w-[660px] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium sm:px-5">Source</th><th className="px-4 py-3 font-medium sm:px-5">Status</th><th className="px-4 py-3 text-right font-medium sm:px-5">Source revenue</th><th className="px-4 py-3 text-right font-medium sm:px-5">Loaded revenue</th><th className="px-4 py-3 text-right font-medium sm:px-5">Difference</th></tr></thead>
                <tbody>{report.sources.map((s) => (
                  <tr key={s.label} className="border-t border-border">
                    <td className="px-4 py-3 sm:px-5">{s.label}</td>
                    <td className={cn("px-4 py-3 font-medium capitalize sm:px-5", s.status === "matched" ? "text-success" : "text-destructive")}>{s.status}</td>
                    <td className="px-4 py-3 text-right tabular-nums sm:px-5">{usd(s.source_revenue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums sm:px-5">{usd(s.loaded_revenue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums sm:px-5">{usd(s.difference)}</td>
                  </tr>
                ))}</tbody>
              </table>
              </div>
            </div>
          )}
      </section>
    </div>
  );
}
