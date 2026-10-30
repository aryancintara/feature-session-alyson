import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search, Layers } from "lucide-react";
import { AUDIENCES, formatNum, timeAgo, type Audience } from "@/lib/mockData";
import { PageHeader, Mono } from "@/components/ui-bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/audiences")({
  head: () => ({
    meta: [
      { title: "Audiences · Resolve.io" },
      { name: "description", content: "System, event, funnel, propensity, consent, and custom audiences." },
    ],
  }),
  component: Audiences,
});

const TYPES: ("all" | Audience["type"])[] = ["all", "system", "event", "funnel", "propensity", "consent", "custom"];

function MiniSpark({ trend }: { trend: number }) {
  const data = Array.from({ length: 12 }).map((_, i) => 50 + Math.sin(i / 1.4) * 8 + i * (trend / 6));
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const w = 80, h = 24;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-6 w-20">
      <path d={`M ${pts.join(" L ")}`} fill="none" stroke={trend >= 0 ? "var(--color-success)" : "var(--color-destructive)"} strokeWidth="1.5" />
    </svg>
  );
}

function Audiences() {
  const [filter, setFilter] = useState<(typeof TYPES)[number]>("all");
  const [q, setQ] = useState("");

  const rows = AUDIENCES.filter((a) => (filter === "all" || a.type === filter) && (!q || a.name.toLowerCase().includes(q.toLowerCase())));
  const total = AUDIENCES.reduce((s, a) => s + a.size, 0);
  const fastest = [...AUDIENCES].sort((a, b) => b.growth7d - a.growth7d)[0];

  return (
    <div className="pb-10">
      <PageHeader
        title="Audiences"
        subtitle="System, event, funnel, propensity, consent, and custom audiences — with live size."
        actions={
          <Link to="/audience-builder" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-3 w-3" /> New audience
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 px-6 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Layers className="h-3.5 w-3.5" /><span className="uppercase tracking-wider">Total audiences</span></div>
          <div className="mt-2 text-2xl font-semibold">{AUDIENCES.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Combined reach</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{formatNum(total)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Fastest growing</div>
          <div className="mt-2 truncate text-sm font-semibold">{fastest.name}</div>
          <div className="text-xs text-success">+{fastest.growth7d.toFixed(1)}% / 7d</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Custom audiences</div>
          <div className="mt-2 text-2xl font-semibold">{AUDIENCES.filter((a) => a.type === "custom").length}</div>
        </div>
      </div>

      <div className="px-6 pt-4">
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
            <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search audiences…" className="w-full bg-transparent text-sm outline-none" />
            </div>
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs capitalize",
                  filter === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left font-medium">Audience</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-right font-medium">Size</th>
                <th className="px-4 py-2 text-right font-medium">7d trend</th>
                <th className="px-4 py-2 text-right font-medium">7d Δ</th>
                <th className="px-4 py-2 text-right font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{a.description}</div>
                    <Mono>{a.id}</Mono>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{a.type}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatNum(a.size)}</td>
                  <td className="px-4 py-2.5 text-right"><div className="ml-auto inline-block"><MiniSpark trend={a.growth7d} /></div></td>
                  <td className={cn("px-4 py-2.5 text-right text-xs font-medium", a.growth7d >= 0 ? "text-success" : "text-destructive")}>
                    {a.growth7d >= 0 ? "+" : ""}{a.growth7d.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{timeAgo(a.updated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
