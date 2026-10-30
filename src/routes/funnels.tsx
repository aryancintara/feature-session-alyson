import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GitBranch, TrendingDown, TrendingUp, Filter } from "lucide-react";
import { FUNNEL_STAGES, AUDIENCES, formatNum } from "@/lib/mockData";
import { PageHeader } from "@/components/ui-bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/funnels")({
  head: () => ({
    meta: [
      { title: "Funnels · Resolve.io" },
      { name: "description", content: "Impression to sale conversion analysis." },
    ],
  }),
  component: Funnels,
});

const SOURCES = ["All traffic", "Meta Ads", "Google Ads", "Organic", "Email", "Partner"];

function Funnels() {
  const [source, setSource] = useState(SOURCES[0]);
  const max = FUNNEL_STAGES[0].count;
  const overallConv = ((FUNNEL_STAGES[FUNNEL_STAGES.length - 1].count / FUNNEL_STAGES[0].count) * 100).toFixed(4);
  const visitToLead = ((FUNNEL_STAGES[4].count / FUNNEL_STAGES[1].count) * 100).toFixed(2);
  const leadToSale = ((FUNNEL_STAGES[10].count / FUNNEL_STAGES[4].count) * 100).toFixed(2);

  return (
    <div className="pb-10">
      <PageHeader
        title="Funnels"
        subtitle="Impression → Sale conversion, with current and furthest stage tracking."
        actions={
          <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5 text-xs">
            <Filter className="ml-1.5 h-3 w-3 text-muted-foreground" />
            {SOURCES.map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={cn(
                  "rounded px-2 py-1",
                  source === s ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 px-6 lg:grid-cols-4">
        {[
          { icon: GitBranch, label: "Overall conversion", value: `${overallConv}%`, sub: "impression → sale" },
          { icon: TrendingUp, label: "Visit → Lead", value: `${visitToLead}%`, sub: "trailing 30d" },
          { icon: TrendingUp, label: "Lead → Sale", value: `${leadToSale}%`, sub: "trailing 30d" },
          { icon: TrendingDown, label: "Biggest drop", value: "Quiz → Partial", sub: "−74.9%" },
        ].map((k) => {
          const I = k.icon;
          return (
            <div key={k.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><I className="h-3.5 w-3.5" /><span className="uppercase tracking-wider">{k.label}</span></div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">{k.value}</div>
              <div className="text-xs text-muted-foreground">{k.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 px-6 pt-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
          <div className="mb-4 text-sm font-semibold">{source}</div>
          <div className="space-y-3">
            {FUNNEL_STAGES.map((s, i) => {
              const pct = (s.count / max) * 100;
              const conv = i > 0 ? ((s.count / FUNNEL_STAGES[i - 1].count) * 100).toFixed(1) : "100.0";
              const drop = i > 0 ? (100 - parseFloat(conv)).toFixed(1) : "0.0";
              return (
                <div key={s.stage} className="flex items-center gap-4">
                  <div className="w-32 shrink-0 text-sm font-medium">{s.stage}</div>
                  <div className="relative h-9 flex-1 overflow-hidden rounded-md bg-muted">
                    <div className="h-full rounded-md bg-gradient-to-r from-primary to-primary/60" style={{ width: `${Math.max(pct, 0.4)}%` }} />
                    <div className="absolute inset-0 flex items-center justify-end pr-3 text-sm font-medium">{formatNum(s.count)}</div>
                  </div>
                  <div className="w-20 text-right font-mono text-xs text-success">{conv}%</div>
                  <div className="w-20 text-right font-mono text-xs text-destructive">−{drop}%</div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex justify-between border-t border-border pt-3 text-xs text-muted-foreground">
            <span>Stage</span>
            <span className="flex gap-12">
              <span className="text-success">conversion</span>
              <span className="text-destructive">drop-off</span>
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">Conversion by audience</div>
          <ul className="divide-y divide-border">
            {AUDIENCES.slice(0, 6).map((a, i) => {
              const conv = (12 - i * 1.4 + ((i * 37) % 15) / 10).toFixed(2);
              return (
                <li key={a.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{a.name}</div>
                    <div className="text-[10px] text-muted-foreground">{formatNum(a.size)} people</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-success">{conv}%</div>
                    <div className="text-[10px] text-muted-foreground">visit → sale</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
