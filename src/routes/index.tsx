import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, TrendingUp, Users2, MapPin, Activity, Zap, ShieldCheck, Target, Database } from "lucide-react";
import { AUDIENCES, DATA_SOURCES, FUNNEL_STAGES, IDENTITY_METHODS, formatNum, timeAgo } from "@/lib/mockData";
import { PageHeader, StatusDot, GradeBadge, Mono } from "@/components/ui-bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Identity Intelligence — Alyson CDP" },
    { name: "description", content: "Monitor identity intelligence across people, audiences, and connected data sources." },
    { property: "og:title", content: "Identity Intelligence — Alyson CDP" },
    { property: "og:description", content: "Monitor identity intelligence across people, audiences, and connected data sources." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Dashboard,
});

const SPARK = [38, 41, 44, 42, 47, 51, 49, 53, 58, 56, 62, 64, 68, 71, 74, 78, 82, 80, 86, 91, 89, 95, 98, 104];

function Sparkline({ data, accent = "var(--color-primary)" }: { data: number[]; accent?: string }) {
  const w = 240, h = 56;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const path = `M ${pts.join(" L ")}`;
  const area = `${path} L ${w},${h} L 0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full">
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path d={path} fill="none" stroke={accent} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Metric({ icon: Icon, label, value, delta, deltaTone = "up", spark }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; delta: string; deltaTone?: "up" | "down" | "neutral"; spark?: number[] }) {
  const tone =
    deltaTone === "up" ? "text-success" : deltaTone === "down" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5" />
          <span className="uppercase tracking-wider">{label}</span>
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 opacity-40" />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
        <div className={cn("text-xs font-medium tabular-nums", tone)}>{delta}</div>
      </div>
      {spark && <div className="mt-2"><Sparkline data={spark} /></div>}
    </div>
  );
}

function Dashboard() {
  const totalEvents24h = DATA_SOURCES.reduce((s, d) => s + d.events24h, 0);
  const sqlAud = AUDIENCES.find((a) => a.name === "SQL Audience")!;
  const allVisitors = AUDIENCES.find((a) => a.name === "All Visitors")!;
  const maxFunnel = FUNNEL_STAGES[0].count;

  return (
    <div className="pb-10">
      <PageHeader
        title="Identity Intelligence"
        subtitle="Real-time signal across 204M profiles, 38M places, and every connected data source."
        actions={
          <>
            <button className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent">Last 7 days</button>
            <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">+ New audience</button>
          </>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-3 px-6 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Users2} label="Total People" value="204.3M" delta="+1.4%" spark={SPARK} />
        <Metric icon={MapPin} label="Total Places" value="38.4M" delta="+0.6%" spark={SPARK.map((n) => n * 0.7)} />
        <Metric icon={Activity} label="Sessions (24h)" value="62.1M" delta="+4.2%" spark={SPARK.map((n, i) => n * 1.1 + ((i % 5) - 2) * 0.8)} />
        <Metric icon={Zap} label="Events (24h)" value={formatNum(totalEvents24h)} delta="+8.1%" spark={SPARK.map((n) => n * 1.4)} />
      </div>

      <div className="grid grid-cols-1 gap-3 px-6 pt-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Target} label="Identity Resolution" value="89.4%" delta="+0.8pp" spark={[78, 80, 81, 83, 84, 85, 86, 87, 88, 88, 89, 89]} />
        <Metric icon={ShieldCheck} label="Source-of-Truth Accuracy" value="94.2%" delta="+0.3pp" spark={[91, 92, 92, 92, 93, 93, 93, 94, 94, 94, 94, 94]} />
        <Metric icon={TrendingUp} label="Audience Growth (7d)" value="+2.4M" delta="+5.6%" spark={SPARK.map((n) => n * 0.8 + 10)} />
        <Metric icon={Database} label="Consent Coverage" value="97.1%" delta="+0.1pp" deltaTone="neutral" spark={[96, 96, 96, 97, 97, 97, 97, 97, 97, 97, 97, 97]} />
      </div>

      {/* Lower grid */}
      <div className="grid grid-cols-1 gap-3 px-6 pt-4 lg:grid-cols-3">
        {/* Funnel */}
        <div className="rounded-xl border border-border bg-card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">Funnel — All Traffic</h3>
              <p className="text-xs text-muted-foreground">From impression through sale, last 30 days</p>
            </div>
            <Link to="/funnels" className="text-xs text-primary hover:underline">View funnel →</Link>
          </div>
          <div className="space-y-2 p-4">
            {FUNNEL_STAGES.map((s, i) => {
              const pct = (s.count / maxFunnel) * 100;
              const conv = i > 0 ? ((s.count / FUNNEL_STAGES[i - 1].count) * 100).toFixed(1) : "100.0";
              return (
                <div key={s.stage} className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-xs text-muted-foreground">{s.stage}</div>
                  <div className="relative h-6 flex-1 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full rounded bg-gradient-to-r from-primary/90 to-primary/60"
                      style={{ width: `${Math.max(pct, 0.4)}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-end pr-2 text-[11px] font-medium text-foreground">
                      {formatNum(s.count)}
                    </div>
                  </div>
                  <div className="w-14 shrink-0 text-right font-mono text-[11px] text-muted-foreground">{conv}%</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Identity methods */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">Top Identity Determinants</h3>
              <p className="text-xs text-muted-foreground">By final-resolution share</p>
            </div>
            <Link to="/accuracy" className="text-xs text-primary hover:underline">Lab →</Link>
          </div>
          <div className="divide-y divide-border">
            {IDENTITY_METHODS.slice(0, 6).map((m) => (
              <div key={m.name} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">{m.name}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1 w-24 overflow-hidden rounded bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${m.finalDeterminant * 2}%` }} />
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">{m.finalDeterminant}%</span>
                  </div>
                </div>
                <GradeBadge grade={m.grade} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 px-6 pt-3 lg:grid-cols-3">
        {/* Audience growth */}
        <div className="rounded-xl border border-border bg-card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Top Audiences</h3>
            <Link to="/audiences" className="text-xs text-primary hover:underline">All audiences →</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left font-medium">Audience</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-right font-medium">Size</th>
                <th className="px-4 py-2 text-right font-medium">7d Δ</th>
                <th className="px-4 py-2 text-right font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {AUDIENCES.slice(0, 7).map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{a.name}</div>
                    <Mono>{a.id}</Mono>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {a.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatNum(a.size)}</td>
                  <td className={cn("px-4 py-2.5 text-right tabular-nums text-xs", a.growth7d >= 0 ? "text-success" : "text-destructive")}>
                    {a.growth7d >= 0 ? "+" : ""}{a.growth7d.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{timeAgo(a.updated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Source health */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Source Health</h3>
            <Link to="/sources" className="text-xs text-primary hover:underline">All →</Link>
          </div>
          <div className="divide-y divide-border">
            {DATA_SOURCES.slice(0, 7).map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <StatusDot status={s.status} />
                  <div>
                    <div className="text-xs font-medium">{s.name}</div>
                    <Mono>{formatNum(s.events24h)} events · {timeAgo(s.lastEvent)}</Mono>
                  </div>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.category}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
