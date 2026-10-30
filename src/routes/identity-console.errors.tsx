import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { IDENTITY_INCIDENTS, PEOPLE, timeAgo, type IdentityIncident } from "@/lib/mockData";
import { PageHeader, Mono } from "@/components/ui-bits";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/identity-console/errors")({
  head: () => ({ meta: [
    { title: "Identity Console Errors — Alyson CDP" },
    { name: "description", content: "Explore identity console errors in Alyson CDP." },
    { property: "og:title", content: "Identity Console Errors — Alyson CDP" },
    { property: "og:description", content: "Explore identity console errors in Alyson CDP." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ErrorsPage,
});

const SEV_TONE: Record<string, string> = {
  info: "border-border bg-muted text-muted-foreground",
  warning: "border-warning/30 bg-warning/15 text-warning-foreground",
  error: "border-destructive/20 bg-destructive/10 text-destructive",
  critical: "border-destructive/40 bg-destructive/20 text-destructive",
};

function ErrorsPage() {
  const [severity, setSeverity] = useState<string>("all");
  const [resolved, setResolved] = useState<string>("open");
  const [selected, setSelected] = useState<IdentityIncident | null>(null);

  const rows = useMemo(() => IDENTITY_INCIDENTS.filter((i) => {
    if (severity !== "all" && i.severity !== severity) return false;
    if (resolved === "open" && i.resolved) return false;
    if (resolved === "resolved" && !i.resolved) return false;
    return true;
  }), [severity, resolved]);

  const open = IDENTITY_INCIDENTS.filter((i) => !i.resolved).length;
  const critical = IDENTITY_INCIDENTS.filter((i) => i.severity === "critical").length;
  const mttrMin = 42;

  return (
    <div className="pb-6">
      <PageHeader
        title="Errors & Incidents"
        subtitle="Triage identity pipeline failures, degradations, and policy violations."
      />
      <div className="space-y-4 px-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Open incidents" value={open.toString()} tone="warning" />
          <Kpi label="Critical" value={critical.toString()} tone="destructive" />
          <Kpi label="MTTR" value={`${mttrMin}m`} tone="info" />
          <Kpi label="Error rate 24h" value="0.14%" tone="success" />
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs">
            <Select label="Severity" value={severity} onChange={setSeverity} options={["all", "info", "warning", "error", "critical"]} />
            <Select label="State" value={resolved} onChange={setResolved} options={["open", "resolved", "all"]} />
            <div className="ml-auto text-muted-foreground">{rows.length} incidents</div>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Sev</th>
                <th className="px-3 py-2 text-left font-medium">Category</th>
                <th className="px-3 py-2 text-left font-medium">Message</th>
                <th className="px-3 py-2 text-left font-medium">Event</th>
                <th className="px-3 py-2 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr
                  key={i.id}
                  onClick={() => setSelected(i)}
                  className="cursor-pointer border-t border-border hover:bg-accent"
                >
                  <td className="px-3 py-2">
                    <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium", SEV_TONE[i.severity])}>
                      {i.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">{i.category}</td>
                  <td className="px-3 py-2 text-xs">{i.message}</td>
                  <td className="px-3 py-2"><Mono>{i.affectedEventId}</Mono></td>
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground">{timeAgo(i.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-[500px] sm:max-w-[500px]">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.message}</SheetTitle>
                <SheetDescription>
                  {selected.category} · <span className={cn("rounded border px-1.5 py-0.5 text-[10px]", SEV_TONE[selected.severity])}>{selected.severity}</span>
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Affected event</div>
                  <Mono className="mt-1 block">{selected.affectedEventId}</Mono>
                  <Link to="/identity-console" className="mt-1 inline-block text-xs text-primary hover:underline">Open in Identity Events →</Link>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Affected person</div>
                  <div className="mt-1 text-xs">{PEOPLE.find(p => p.id === selected.affectedPersonId)?.name ?? "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reason codes</div>
                  <div className="mt-1 flex flex-wrap gap-1 font-mono text-[10px]">
                    <span className="rounded bg-muted px-1.5 py-0.5">E_{selected.category.toUpperCase()}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5">retry_exhausted</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stack</div>
                  <pre className="mt-1 overflow-auto rounded bg-muted p-2 font-mono text-[10px]">
{`at w-decision (v3.2):handleCandidateScore
at w-candidates (v2.4):fetchTop50
at pipeline.run(${selected.affectedEventId})
  cause: ${selected.message}`}
                  </pre>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "success" | "info" | "warning" | "destructive" }) {
  const c = tone === "success" ? "text-success" : tone === "info" ? "text-info" : tone === "warning" ? "text-warning-foreground" : "text-destructive";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-mono text-2xl font-semibold tabular-nums", c)}>{value}</div>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
