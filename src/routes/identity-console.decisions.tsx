import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { IDENTITY_DECISIONS, IDENTITY_EVENTS, PEOPLE, timeAgo, type IdentityDecision } from "@/lib/mockData";
import { PageHeader, Mono, StatusDot } from "@/components/ui-bits";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RotateCcw, ArrowRight, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/identity-console/decisions")({
  head: () => ({ meta: [
    { title: "Identity Console Decisions — Alyson CDP" },
    { name: "description", content: "Explore identity console decisions in Alyson CDP." },
    { property: "og:title", content: "Identity Console Decisions — Alyson CDP" },
    { property: "og:description", content: "Explore identity console decisions in Alyson CDP." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: DecisionsPage,
});

const OUTCOME_TONE: Record<string, string> = {
  matched: "text-success",
  created: "text-info",
  merged: "text-primary",
  split: "text-warning",
  rejected: "text-destructive",
  pending_review: "text-muted-foreground",
};

function DecisionsPage() {
  const [selected, setSelected] = useState<IdentityDecision | null>(null);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [filter, setFilter] = useState({ outcome: "all", method: "all", reversed: "all" });
  const [reversedIds, setReversedIds] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    return IDENTITY_DECISIONS.filter((d) => {
      if (filter.outcome !== "all" && d.outcome !== filter.outcome) return false;
      if (filter.method !== "all" && d.winningMethod !== filter.method) return false;
      const isReversed = d.reversed || reversedIds.has(d.id);
      if (filter.reversed === "yes" && !isReversed) return false;
      if (filter.reversed === "no" && isReversed) return false;
      return true;
    });
  }, [filter, reversedIds]);

  const event = selected ? IDENTITY_EVENTS.find((e) => e.id === selected.eventId) : null;
  const person = selected ? PEOPLE.find((p) => p.id === selected.personId) : null;

  const handleReverse = (d: IdentityDecision) => {
    setReversedIds((prev) => new Set(prev).add(d.id));
    toast.success(`Decision ${d.id} reversed`, { description: "Downstream systems will recalc in ~2m" });
  };

  return (
    <div className="pb-6">
      <PageHeader
        title="Decisions"
        subtitle="Every identity decision, reversible with full audit trail."
        actions={
          <button
            onClick={() => setRollbackOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <RotateCcw className="h-3 w-3" /> Rollback by cohort
          </button>
        }
      />

      <div className="px-6">
        <div className="mb-3 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3">
          <FilterSelect
            label="Outcome"
            value={filter.outcome}
            onChange={(v) => setFilter({ ...filter, outcome: v })}
            options={["all", "matched", "created", "merged", "split", "rejected", "pending_review"]}
          />
          <FilterSelect
            label="Method"
            value={filter.method}
            onChange={(v) => setFilter({ ...filter, method: v })}
            options={["all", ...Array.from(new Set(IDENTITY_DECISIONS.map((d) => d.winningMethod)))]}
          />
          <FilterSelect
            label="Reversed"
            value={filter.reversed}
            onChange={(v) => setFilter({ ...filter, reversed: v })}
            options={["all", "yes", "no"]}
          />
          <div className="ml-auto text-xs text-muted-foreground">
            {rows.length} decisions · {rows.filter((r) => r.reversed || reversedIds.has(r.id)).length} reversed
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Decision</th>
                <th className="px-3 py-2 text-left font-medium">Event</th>
                <th className="px-3 py-2 text-left font-medium">Person</th>
                <th className="px-3 py-2 text-left font-medium">Outcome</th>
                <th className="px-3 py-2 text-left font-medium">Method</th>
                <th className="px-3 py-2 text-left font-medium">Downstream</th>
                <th className="px-3 py-2 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map((d) => {
                const isReversed = d.reversed || reversedIds.has(d.id);
                return (
                  <tr
                    key={d.id}
                    onClick={() => setSelected(d)}
                    className={cn(
                      "cursor-pointer border-t border-border hover:bg-accent",
                      isReversed && "bg-destructive/5",
                    )}
                  >
                    <td className="px-3 py-2"><Mono>{d.id}</Mono>{isReversed && <span className="ml-2 rounded border border-destructive/20 bg-destructive/10 px-1 text-[10px] text-destructive">reversed</span>}</td>
                    <td className="px-3 py-2"><Mono>{d.eventId}</Mono></td>
                    <td className="px-3 py-2 text-xs">{PEOPLE.find(p => p.id === d.personId)?.name ?? d.personId}</td>
                    <td className={cn("px-3 py-2 font-medium", OUTCOME_TONE[d.outcome])}>{d.outcome.replace("_", " ")}</td>
                    <td className="px-3 py-2"><Mono>{d.winningMethod}</Mono></td>
                    <td className="px-3 py-2 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <StatusDot status={d.downstreamRecalc === "complete" ? "healthy" : d.downstreamRecalc === "in_progress" ? "warning" : "healthy"} />
                        {d.downstreamRecalc}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">{timeAgo(d.ts)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-[560px] sm:max-w-[560px]">
          {selected && event && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.id}</SheetTitle>
                <SheetDescription>
                  Outcome <span className={cn("font-medium", OUTCOME_TONE[selected.outcome])}>{selected.outcome}</span> · won by <Mono>{selected.winningMethod}</Mono>
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-border p-3 text-xs">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Candidate comparison</div>
                  <ul className="space-y-2">
                    {event.candidates.map((c, idx) => {
                      const won = c.outcome === "won";
                      const delta = idx === 0 ? 0 : event.candidates[0].score - c.score;
                      return (
                        <li key={c.id} className={cn("rounded border p-2", won ? "border-success/30 bg-success/5" : "border-border")}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{c.entityLabel}</span>
                            <span className="font-mono">{c.score}{delta > 0 && <span className="ml-1 text-[10px] text-muted-foreground">Δ-{delta}</span>}</span>
                          </div>
                          <Mono className="block">{c.method}</Mono>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">{c.reason}</div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="rounded-lg border border-border p-3 text-xs">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Person</div>
                  <div className="font-medium">{person?.name ?? selected.personId}</div>
                  <Mono>{selected.personId}</Mono>
                </div>

                {(selected.reversed || reversedIds.has(selected.id)) ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
                    <div className="font-semibold text-destructive">Reversed</div>
                    <div className="mt-1 text-muted-foreground">
                      By {selected.reversedBy ?? "sarah.kim@resolve.io"} · {selected.reversedAt ? timeAgo(selected.reversedAt) : "just now"}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleReverse(selected)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
                  >
                    <RotateCcw className="h-3 w-3" /> Reverse this decision
                  </button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Rollback cohort modal */}
      <Dialog open={rollbackOpen} onOpenChange={setRollbackOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Rollback decisions by cohort</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <CohortField label="Model version" value="mdl-2.7" />
              <CohortField label="Method" value="m_probabilistic_v1" />
              <CohortField label="Policy" value="pol_merge_v3" />
              <CohortField label="Source" value="all" />
              <CohortField label="Date from" value="2026-06-25" />
              <CohortField label="Date to" value="2026-07-02" />
            </div>
            <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
              <div className="font-medium">Preview</div>
              <div className="mt-1 text-muted-foreground">
                <span className="font-mono text-foreground">1,284</span> decisions match. Reversing will trigger recalc across{" "}
                <span className="font-mono text-foreground">4</span> downstream systems (audience, funnel, propensity, destinations).
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRollbackOpen(false)} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">Cancel</button>
              <button
                onClick={() => {
                  setRollbackOpen(false);
                  toast.success("Cohort rollback queued", { description: "1,284 decisions · downstream recalc in progress" });
                }}
                className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                Reverse 1,284 decisions
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function CohortField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <input defaultValue={value} className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none" />
    </div>
  );
}
