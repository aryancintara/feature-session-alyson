import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Users2, MapPin, ShieldCheck, Activity, Filter } from "lucide-react";
import { PEOPLE, formatNum, timeAgo, type RepeatBucket, type FunnelStage } from "@/lib/mockData";
import { PageHeader, Mono } from "@/components/ui-bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/people")({
  head: () => ({
    meta: [
      { title: "People Explorer · Resolve.io" },
      { name: "description", content: "Search and segment 204M+ resolved profiles." },
    ],
  }),
  component: People,
});

const STAGE_FILTERS: ("All" | FunnelStage)[] = ["All", "Visit", "Lead", "MQL", "SQL", "Sale"];
const BUCKETS: ("All" | RepeatBucket)[] = ["All", "1 visit", "2-3 visits", "4-10 visits", "10+ visits"];

function KPI({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> <span className="uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function People() {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<(typeof STAGE_FILTERS)[number]>("All");
  const [bucket, setBucket] = useState<(typeof BUCKETS)[number]>("All");

  const rows = useMemo(
    () =>
      PEOPLE.filter((p) => {
        if (q && !`${p.name} ${p.primaryEmail} ${p.id} ${p.city}`.toLowerCase().includes(q.toLowerCase())) return false;
        if (stage !== "All" && p.furthestStage !== stage) return false;
        if (bucket !== "All" && p.repeatBucket !== bucket) return false;
        return true;
      }),
    [q, stage, bucket],
  );

  const sotCount = PEOPLE.filter((p) => p.sourceOfTruth).length;
  const repeatCount = PEOPLE.filter((p) => p.visits > 1).length;
  const places = new Set(PEOPLE.map((p) => p.placeId)).size;

  return (
    <div className="pb-10">
      <PageHeader
        title="People Explorer"
        subtitle="204.3M resolved profiles. Search, filter, and drill into any identity."
        actions={
          <Link to="/audience-builder" className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent">
            Save view as audience
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 px-6 lg:grid-cols-4">
        <KPI icon={Users2} label="People" value="204.3M" sub="+1.4% week" />
        <KPI icon={MapPin} label="Places" value="38.4M" sub={`${places} on screen`} />
        <KPI icon={ShieldCheck} label="Source of Truth" value={`${((sotCount / PEOPLE.length) * 100).toFixed(0)}%`} sub={`${sotCount} of ${PEOPLE.length} on screen`} />
        <KPI icon={Activity} label="Repeat visitors" value={`${repeatCount}`} sub="≥ 2 visits in this view" />
      </div>

      <div className="px-6 pt-4">
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
            <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, email, person ID, city…"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>

            <div className="flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Stage</span>
              {STAGE_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStage(s)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs",
                    stage === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Visits</span>
              {BUCKETS.map((b) => (
                <button
                  key={b}
                  onClick={() => setBucket(b)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs",
                    bucket === b ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left font-medium">Person</th>
                <th className="px-4 py-2 text-left font-medium">Place</th>
                <th className="px-4 py-2 text-left font-medium">Stage</th>
                <th className="px-4 py-2 text-right font-medium">Visits</th>
                <th className="px-4 py-2 text-right font-medium">Identity</th>
                <th className="px-4 py-2 text-right font-medium">Propensity</th>
                <th className="px-4 py-2 text-right font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                        {p.name.split(" ").map((x) => x[0]).join("")}
                      </div>
                      <div>
                        {/* Identity Console is hidden pending the new UI; keep name as plain text for now.
                            Previously: <Link to="/identity-console" className="font-medium hover:underline">{p.name}</Link> */}
                        <span className="font-medium">{p.name}</span>

                        <div><Mono>{p.id} · {p.primaryEmail}</Mono></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Mono>{p.placeId}</Mono>
                    <div className="text-xs text-muted-foreground">{p.city}, {p.state}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <div>{p.currentStage}</div>
                    <div className="text-muted-foreground">furthest: {p.furthestStage}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{p.visits}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-2">
                      <div className="h-1 w-12 overflow-hidden rounded bg-muted">
                        <div className={cn("h-full", p.identityScore >= 85 ? "bg-success" : p.identityScore >= 70 ? "bg-info" : "bg-warning")} style={{ width: `${p.identityScore}%` }} />
                      </div>
                      <span className="font-mono text-xs">{p.identityScore}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">{p.propensity.purchase}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{timeAgo(p.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            Showing {rows.length} filtered of {PEOPLE.length} loaded · {formatNum(204_300_000)} total
          </div>
        </div>
      </div>
    </div>
  );
}
