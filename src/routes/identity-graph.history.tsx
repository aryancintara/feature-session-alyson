import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MERGE_SPLIT_HISTORY, PEOPLE, timeAgo, type MergeSplitRecord } from "@/lib/mockData";
import { PageHeader, Mono } from "@/components/ui-bits";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { GitMerge, GitBranch, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/identity-graph/history")({
  head: () => ({ meta: [
    { title: "Identity Graph History — Alyson CDP" },
    { name: "description", content: "Explore identity graph history in Alyson CDP." },
    { property: "og:title", content: "Identity Graph History — Alyson CDP" },
    { property: "og:description", content: "Explore identity graph history in Alyson CDP." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: HistoryPage,
});

function HistoryPage() {
  const [kind, setKind] = useState("all");
  const [actor, setActor] = useState("all");
  const [selected, setSelected] = useState<MergeSplitRecord | null>(null);
  const [reversedIds, setReversedIds] = useState<Set<string>>(new Set());

  const rows = useMemo(() => MERGE_SPLIT_HISTORY.filter(r => {
    if (kind !== "all" && r.kind !== kind) return false;
    if (actor !== "all" && r.actor !== actor) return false;
    return true;
  }), [kind, actor]);

  const merges = MERGE_SPLIT_HISTORY.filter(r => r.kind === "merge").length;
  const splits = MERGE_SPLIT_HISTORY.filter(r => r.kind === "split").length;

  return (
    <div className="pb-6">
      <PageHeader
        title="Merge & Split History"
        subtitle="Every identity merge and split, fully reversible."
      />
      <div className="space-y-4 px-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Merges" value={merges.toString()} icon={GitMerge} />
          <Kpi label="Splits" value={splits.toString()} icon={GitBranch} />
          <Kpi label="Reversed" value={(MERGE_SPLIT_HISTORY.filter(r => r.reversedAt).length + reversedIds.size).toString()} icon={RotateCcw} />
          <Kpi label="Last 24h" value={MERGE_SPLIT_HISTORY.filter(r => Date.now() - new Date(r.ts).getTime() < 86400000).length.toString()} icon={GitMerge} />
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2 text-xs">
            <Select label="Kind" value={kind} onChange={setKind} options={["all", "merge", "split"]} />
            <Select label="Actor" value={actor} onChange={setActor} options={["all", "model", "policy", "manual"]} />
          </div>

          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Actor</th>
                <th className="px-3 py-2 text-left font-medium">Sources → Result</th>
                <th className="px-3 py-2 text-right font-medium">Confidence</th>
                <th className="px-3 py-2 text-left font-medium">Reversible</th>
                <th className="px-3 py-2 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const isReversed = r.reversedAt || reversedIds.has(r.id);
                return (
                  <tr key={r.id} onClick={() => setSelected(r)} className={cn("cursor-pointer border-t border-border hover:bg-accent", isReversed && "bg-destructive/5")}>
                    <td className="px-3 py-2">
                      <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium",
                        r.kind === "merge" ? "border-primary/30 bg-primary/10 text-primary" : "border-warning/30 bg-warning/15 text-warning-foreground")}>
                        {r.kind === "merge" ? <GitMerge className="h-3 w-3" /> : <GitBranch className="h-3 w-3" />}
                        {r.kind}
                      </span>
                      {isReversed && <span className="ml-2 text-[10px] text-destructive">reversed</span>}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.actor}</td>
                    <td className="px-3 py-2 text-xs">
                      <Mono>{r.sourceIds.join(", ")}</Mono> → <Mono>{r.resultIds.join(", ")}</Mono>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{r.confidence}%</td>
                    <td className="px-3 py-2 text-xs">{r.reversible ? "yes" : <span className="text-muted-foreground">no</span>}</td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">{timeAgo(r.ts)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <SheetContent side="right" className="w-[540px] sm:max-w-[540px]">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="capitalize">{selected.kind} · {selected.id}</SheetTitle>
                <SheetDescription>
                  {selected.actor} · confidence {selected.confidence}%
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Before</div>
                    {selected.sourceIds.map(id => {
                      const p = PEOPLE.find(x => x.id === id);
                      return (
                        <div key={id} className="mt-2 text-xs">
                          <div className="font-medium">{p?.name ?? id}</div>
                          <Mono className="block">{id}</Mono>
                          {p && <div className="mt-0.5 text-[10px] text-muted-foreground">{p.city}, {p.state} · {p.signals.length} signals</div>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">After</div>
                    {selected.resultIds.map(id => {
                      const p = PEOPLE.find(x => x.id === id);
                      return (
                        <div key={id} className="mt-2 text-xs">
                          <div className="font-medium">{p?.name ?? id}</div>
                          <Mono className="block">{id}</Mono>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Evidence</div>
                  <ul className="mt-1 ml-4 list-disc space-y-0.5 text-xs">
                    {selected.evidence.map((e, i) => <li key={i}><Mono>{e}</Mono></li>)}
                  </ul>
                </div>

                {selected.reversible && !selected.reversedAt && !reversedIds.has(selected.id) ? (
                  <button
                    onClick={() => {
                      setReversedIds(prev => new Set(prev).add(selected.id));
                      toast.success(`${selected.kind} reversed`, { description: "Downstream recalc queued" });
                      setSelected(null);
                    }}
                    className="w-full rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
                  >
                    <RotateCcw className="mr-1 inline h-3 w-3" /> Reverse this {selected.kind}
                  </button>
                ) : selected.reversedAt || reversedIds.has(selected.id) ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">Already reversed</div>
                ) : (
                  <div className="rounded-lg border border-border bg-muted p-2 text-xs text-muted-foreground">Not reversible</div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</div>
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
