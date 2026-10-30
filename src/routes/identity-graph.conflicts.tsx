import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GRAPH_CONFLICTS, PEOPLE, timeAgo, type GraphConflict } from "@/lib/mockData";
import { PageHeader, Mono } from "@/components/ui-bits";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { AlertTriangle, ShieldAlert, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/identity-graph/conflicts")({
  head: () => ({ meta: [
    { title: "Identity Graph Conflicts — Alyson CDP" },
    { name: "description", content: "Explore identity graph conflicts in Alyson CDP." },
    { property: "og:title", content: "Identity Graph Conflicts — Alyson CDP" },
    { property: "og:description", content: "Explore identity graph conflicts in Alyson CDP." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ConflictsPage,
});

const SEV_TONE: Record<string, string> = {
  low: "border-border bg-muted text-muted-foreground",
  medium: "border-info/20 bg-info/10 text-info",
  high: "border-warning/30 bg-warning/15 text-warning-foreground",
  critical: "border-destructive/20 bg-destructive/10 text-destructive",
};

function ConflictsPage() {
  const [selected, setSelected] = useState<GraphConflict | null>(null);
  const [severity, setSeverity] = useState("all");
  const [kind, setKind] = useState("all");
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

  const rows = useMemo(() => GRAPH_CONFLICTS.filter(c => {
    if (severity !== "all" && c.severity !== severity) return false;
    if (kind !== "all" && c.kind !== kind) return false;
    return true;
  }), [severity, kind]);

  const critical = GRAPH_CONFLICTS.filter(c => c.severity === "critical").length;
  const fraud = GRAPH_CONFLICTS.filter(c => c.suspectedFraud).length;

  return (
    <div className="pb-6">
      <PageHeader
        title="Conflicts & Fraud"
        subtitle="Signals shared across identities, ping-pong patterns, device fanout, and suspected fraud."
      />
      <div className="space-y-4 px-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Open conflicts" value={GRAPH_CONFLICTS.length.toString()} icon={AlertTriangle} tone="warning" />
          <Kpi label="Critical" value={critical.toString()} icon={ShieldAlert} tone="destructive" />
          <Kpi label="Suspected fraud" value={fraud.toString()} icon={ShieldAlert} tone="destructive" />
          <Kpi label="Reviewed" value={(GRAPH_CONFLICTS.filter(c => c.reviewed).length + reviewedIds.size).toString()} icon={ShieldAlert} tone="success" />
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2 text-xs">
            <Select label="Severity" value={severity} onChange={setSeverity} options={["all", "low", "medium", "high", "critical"]} />
            <Select label="Kind" value={kind} onChange={setKind} options={["all", ...Array.from(new Set(GRAPH_CONFLICTS.map(c => c.kind)))]} />
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Sev</th>
                <th className="px-3 py-2 text-left font-medium">Kind</th>
                <th className="px-3 py-2 text-left font-medium">Signal</th>
                <th className="px-3 py-2 text-right font-medium">Persons</th>
                <th className="px-3 py-2 text-left font-medium">Fraud</th>
                <th className="px-3 py-2 text-right font-medium">Detected</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(c => (
                <tr key={c.id} onClick={() => setSelected(c)} className="cursor-pointer border-t border-border hover:bg-accent">
                  <td className="px-3 py-2">
                    <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium", SEV_TONE[c.severity])}>{c.severity}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">{c.kind.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2"><Mono className="truncate">{c.signalValue}</Mono></td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{c.involvedPersonIds.length}</td>
                  <td className="px-3 py-2 text-xs">
                    {c.suspectedFraud ? <span className="text-destructive">yes</span> : <span className="text-muted-foreground">no</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground">{timeAgo(c.detectedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <SheetContent side="right" className="w-[520px] sm:max-w-[520px]">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="capitalize">{selected.kind.replace(/_/g, " ")}</SheetTitle>
                <SheetDescription>
                  <span className={cn("rounded border px-1.5 py-0.5 text-[10px]", SEV_TONE[selected.severity])}>{selected.severity}</span>
                  {selected.suspectedFraud && <span className="ml-2 text-destructive">Suspected fraud</span>}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Shared signal</div>
                  <Mono className="mt-1 block break-all text-sm">{selected.signalValue}</Mono>
                </div>

                {/* Mini graph */}
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Subgraph</div>
                  <svg viewBox="0 0 300 180" className="h-40 w-full">
                    <circle cx="150" cy="90" r="22" fill="var(--color-warning)" fillOpacity="0.2" stroke="var(--color-warning)" />
                    <text x="150" y="94" textAnchor="middle" fontSize="9" fill="var(--color-foreground)">signal</text>
                    {selected.involvedPersonIds.map((pid, i) => {
                      const n = selected.involvedPersonIds.length;
                      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
                      const x = 150 + Math.cos(angle) * 90;
                      const y = 90 + Math.sin(angle) * 60;
                      const p = PEOPLE.find(pp => pp.id === pid);
                      return (
                        <g key={pid}>
                          <line x1="150" y1="90" x2={x} y2={y} stroke="var(--color-destructive)" strokeWidth="1.5" />
                          <circle cx={x} cy={y} r="16" fill="var(--color-card)" stroke="var(--color-primary)" strokeWidth="2" />
                          <text x={x} y={y + 3} textAnchor="middle" fontSize="8" fill="var(--color-foreground)">
                            {(p?.name.split(" ").map(w => w[0]).join("")) ?? "?"}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Involved persons</div>
                  <ul className="mt-1 space-y-1 text-xs">
                    {selected.involvedPersonIds.map(pid => {
                      const p = PEOPLE.find(pp => pp.id === pid);
                      return (
                        <li key={pid} className="flex items-center justify-between rounded border border-border px-2 py-1">
                          <span>{p?.name ?? pid}</span>
                          <Mono>{pid}</Mono>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Evidence</div>
                  <ul className="mt-1 ml-4 list-disc space-y-0.5 text-xs">
                    {selected.evidence.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>

                <div className="flex gap-2">
                  <Link to="/identity-graph" className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium hover:bg-accent">
                    Open in Graph Explorer <ArrowRight className="h-3 w-3" />
                  </Link>
                  <button
                    onClick={() => {
                      setReviewedIds(prev => new Set(prev).add(selected.id));
                      toast.success("Marked reviewed");
                      setSelected(null);
                    }}
                    className="flex-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Mark reviewed
                  </button>
                </div>
                {selected.suspectedFraud && (
                  <button
                    onClick={() => { toast.error("Escalated to fraud team"); setSelected(null); }}
                    className="w-full rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                  >
                    Escalate to fraud team
                  </button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; tone: "success" | "info" | "warning" | "destructive" }) {
  const c = tone === "success" ? "text-success" : tone === "info" ? "text-info" : tone === "warning" ? "text-warning-foreground" : "text-destructive";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Icon className={cn("h-4 w-4", c)} />
      </div>
      <div className={cn("mt-1 font-mono text-2xl font-semibold tabular-nums", c)}>{value}</div>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
