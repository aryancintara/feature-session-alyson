import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Plug, Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { DATA_SOURCES, formatNum, timeAgo } from "@/lib/mockData";
import { PageHeader, StatusDot, Mono } from "@/components/ui-bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sources")({
  head: () => ({
    meta: [
      { title: "Data Sources · Resolve.io" },
      { name: "description", content: "Health, throughput, and delivery for every connected source." },
    ],
  }),
  component: Sources,
});

function ThroughputBars({ seed }: { seed: number }) {
  const bars = Array.from({ length: 24 }).map((_, i) => 30 + ((seed * (i + 1)) % 60) + Math.sin((i + seed) / 2) * 10);
  const max = Math.max(...bars);
  return (
    <div className="flex h-10 items-end gap-0.5">
      {bars.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm bg-primary/70" style={{ height: `${(v / max) * 100}%` }} />
      ))}
    </div>
  );
}

function Sources() {
  const total24h = useMemo(() => DATA_SOURCES.reduce((s, d) => s + d.events24h, 0), []);
  const healthy = DATA_SOURCES.filter((d) => d.status === "healthy").length;
  const degraded = DATA_SOURCES.filter((d) => d.status === "degraded").length;
  const down = DATA_SOURCES.filter((d) => d.status === "down").length;

  const byCategory = DATA_SOURCES.reduce((acc, s) => {
    acc[s.category] = (acc[s.category] ?? 0) + s.events24h;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="pb-10">
      <PageHeader title="Data Sources" subtitle="Every connected source — health, volume, and last event received." />

      <div className="grid grid-cols-2 gap-3 px-6 lg:grid-cols-4">
        {[
          { label: "Total events 24h", value: formatNum(total24h), icon: Activity, tone: "text-primary" },
          { label: "Healthy sources", value: `${healthy}/${DATA_SOURCES.length}`, icon: CheckCircle2, tone: "text-success" },
          { label: "Degraded", value: degraded.toString(), icon: AlertTriangle, tone: "text-warning-foreground" },
          { label: "Down", value: down.toString(), icon: Plug, tone: "text-destructive" },
        ].map((k) => {
          const I = k.icon;
          return (
            <div key={k.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="uppercase tracking-wider">{k.label}</span>
                <I className={cn("h-4 w-4", k.tone)} />
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">{k.value}</div>
            </div>
          );
        })}
      </div>

      <div className="px-6 pt-4">
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">Volume by category (24h)</div>
          <div className="space-y-2 p-4">
            {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, vol]) => {
              const pct = (vol / total24h) * 100;
              return (
                <div key={cat} className="flex items-center gap-3">
                  <div className="w-20 text-xs uppercase tracking-wider text-muted-foreground">{cat}</div>
                  <div className="relative h-5 flex-1 overflow-hidden rounded bg-muted">
                    <div className="h-full bg-primary/80" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-20 text-right font-mono text-xs">{formatNum(vol)}</div>
                  <div className="w-12 text-right font-mono text-[10px] text-muted-foreground">{pct.toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 px-6 pt-4 sm:grid-cols-2 lg:grid-cols-3">
        {DATA_SOURCES.map((s, i) => (
          <div key={s.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusDot status={s.status} />
                <span className="text-sm font-medium">{s.name}</span>
              </div>
              <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {s.category}
              </span>
            </div>
            <div className="mt-3"><ThroughputBars seed={i + 3} /></div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Events 24h</div>
                <div className="text-base font-semibold tabular-nums">{formatNum(s.events24h)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Last event</div>
                <div className="text-sm">{timeAgo(s.lastEvent)}</div>
              </div>
            </div>
            <Mono className="mt-3 block">{s.id}</Mono>
          </div>
        ))}
      </div>
    </div>
  );
}
