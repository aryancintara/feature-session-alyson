import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-bits";
import { Pill } from "@/components/identity/bits";
import { ErrorState, TableSkeleton } from "@/components/identity/skeletons";
import { AnalyticsTable } from "@/components/AnalyticsTable";
import { TenantSelect } from "@/components/revenue/RevenueBits";
import { RuleBuilder } from "@/components/cost-revenue/RuleBuilder";
import { Button } from "@/components/ui/button";
import { ruleSourceLabel } from "@/lib/costRulePricing";
import { KIND_LABELS, SOURCE_LABELS, deactivateRule, errMsg, isActive, listRules, statusLabel, valueLine, type ApiRule } from "@/lib/rulesApi";
import { typeTone } from "@/lib/costRevenueData";
import { NotSet } from "@/components/cost-revenue/bits";

export const Route = createFileRoute("/cost-revenue/rules/")({
  head: () => ({
    meta: [
      { title: "Cost & Revenue Rules · Alyson CDP" },
      { name: "description", content: "Define how Cost and Revenue amounts are calculated." },
      { property: "og:title", content: "Cost & Revenue Rules · Alyson CDP" },
      { property: "og:description", content: "Define how Cost and Revenue amounts are calculated." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RulesTable,
});

export const rulesQuery = { queryKey: ["cr-rules"], queryFn: listRules, retry: false } as const;

function Sel({ label, value, onChange, options, labels }: { label: string; value: string; onChange: (v: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">{label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 rounded-md border border-border bg-card px-2 text-sm text-foreground"><option value="">All</option>{options.map((o) => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}</select>
    </label>
  );
}

function RulesTable() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery(rulesQuery);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<ApiRule | null>(null);
  const [paused, setPaused] = useState<Record<string, boolean>>({});
  const [toDelete, setToDelete] = useState<ApiRule | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // Delete = hide this version in the UI; the row stays in the source table as INACTIVE.
  useEffect(() => { try { setHidden(new Set(JSON.parse(localStorage.getItem("cr-rules:hidden:v1") ?? "[]") as string[])); } catch { /* ignore */ } }, []);
  const hide = (key: string) => setHidden((s) => { const n = new Set(s).add(key); try { localStorage.setItem("cr-rules:hidden:v1", JSON.stringify([...n])); } catch { /* ignore */ } return n; });
  const k = (r: ApiRule) => `${r.rule_id}:${r.rule_version}`;
  const rules = (q.data ?? []).filter((r) => !hidden.has(k(r))).map((r) => (paused[k(r)] ? { ...r, status: "PAUSED" } : r));
  const lbl = (r: ApiRule) => (r.status === "PAUSED" ? "Paused" : statusLabel(r.status));
  const tone = (r: ApiRule) => (isActive(r.status) ? "success" : r.status === "PAUSED" ? "warning" : "neutral") as "success" | "warning" | "neutral";
  const makeInactive = async (r: ApiRule) => {
    try { await deactivateRule(r.rule_id, r.rule_version); toast.success(`v${r.rule_version} made inactive`); await qc.invalidateQueries({ queryKey: rulesQuery.queryKey }); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const deleteRule = async (r: ApiRule) => {
    try {
      await deactivateRule(r.rule_id, r.rule_version);
      hide(k(r));
      toast.success(`Deleted ${r.name} v${r.rule_version} — hidden here and marked inactive in the source.`);
      await qc.invalidateQueries({ queryKey: rulesQuery.queryKey });
    } catch (e) { toast.error(errMsg(e)); }
  };
  const notYet = (what: string) => toast.error(`${what} is not available in the Rules API yet. Nothing was changed.`);
  const versions = new Map<string, ApiRule[]>();
  for (const r of rules) versions.set(r.rule_id, [...(versions.get(r.rule_id) ?? []), r]);
  for (const v of versions.values()) v.sort((a, b) => b.rule_version - a.rule_version);
  const multiActive = (id: string) => (versions.get(id) ?? []).filter((r) => isActive(r.status)).length > 1;
  const match = (r: ApiRule) => (!type || r.type === type) && (!source || r.source_id === source) && (!status || lbl(r) === status);
  const parents = [...versions.values()].map((v) => v.find(match)).filter((r): r is ApiRule => !!r)
    .sort((a, b) => a.name.localeCompare(b.name) || a.rule_id.localeCompare(b.rule_id));
  const isChild = (r: ApiRule) => !parents.includes(r);
  const rows: ApiRule[] = parents.flatMap((p) => [p, ...(versions.get(p.rule_id) ?? []).filter((r) => r !== p)]);
  const statusCounts = (["Active", "Inactive", "Paused"] as const).map((l) => [l, rules.filter((r) => lbl(r) === l).length] as const).filter(([, n]) => n > 0);
  return (
    <div className="pb-10">
      <PageHeader
        title="Cost & Revenue Rules"
        subtitle="Define how Cost and Revenue amounts are calculated."
        actions={<div className="flex items-center gap-2"><TenantSelect /><Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" /> Create Rule</Button></div>}
      />
      <div className="flex flex-wrap items-end gap-3 px-6">
        <Sel label="Type" value={type} onChange={setType} options={["COST", "REVENUE"]} />
        <Sel label="Source" value={source} onChange={setSource} options={Array.from(new Set(rules.map((r) => r.source_id))).sort()} labels={SOURCE_LABELS} />
        <Sel label="Status" value={status} onChange={setStatus} options={["Active", "Inactive", "Paused"]} />
      </div>
      {statusCounts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 px-6">
          {statusCounts.map(([l, n]) => (
            <button key={l} type="button" aria-pressed={status === l} onClick={() => setStatus(status === l ? "" : l)} className={cn("rounded-full border px-3 py-1 text-xs", status === l ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>{l} versions ({n})</button>
          ))}
        </div>
      )}
      <div className="mt-3 px-6">
        {q.isPending ? <div className="rounded-lg border border-border"><table className="w-full"><tbody><TableSkeleton cols={10} /></tbody></table></div>
          : q.isError ? <div className="rounded-lg border border-border"><ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /></div>
          : !rules.length ? <div className="rounded-lg border border-border p-10 text-center text-sm text-muted-foreground">No rules yet. Click Create Rule to add the first one.</div>
          : <AnalyticsTable
          rows={rows}
          rowKey={(r) => `${r.rule_id}:${r.rule_version}`}
          onRowClick={(r) => nav({ to: "/cost-revenue/rules/$ruleId", params: { ruleId: r.rule_id }, search: { v: r.rule_version } })}
          pageSize={20}
          csvName="cost-revenue-rules.csv"
          searchPlaceholder="Search rules…"
          columns={[
            { key: "name", header: "Name", value: (r) => r.name, cell: (r) => {
              const n = versions.get(r.rule_id)?.length ?? 1;
              if (isChild(r)) return <span className="pl-6 text-muted-foreground">↳ {r.name}</span>;
              return (
                <span className="inline-flex flex-wrap items-center gap-2 font-medium">
                  {r.name}

                  {n > 1 && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{n} versions</span>}
                  {multiActive(r.rule_id) && <span className="inline-flex items-center gap-1 rounded bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning"><AlertTriangle className="h-3 w-3" />More than one active version</span>}
                </span>
              );
            } },
            { key: "type", header: "Applies to", value: (r) => r.type, cell: (r) => <Pill tone={typeTone(r.type)}>{r.type === "COST" ? "Cost" : "Revenue"}</Pill> },
            { key: "src", header: "Source", value: (r) => ruleSourceLabel(r, SOURCE_LABELS), cell: (r) => ruleSourceLabel(r, SOURCE_LABELS) },
            { key: "kind", header: "Rule type", value: (r) => KIND_LABELS[r.calculation?.kind] ?? "—", cell: (r) => KIND_LABELS[r.calculation?.kind] ?? <NotSet /> },
            { key: "val", header: "Percent / Amount", value: (r) => valueLine(r.calculation), cell: (r) => <span className="tabular-nums">{valueLine(r.calculation)}</span> },
            { key: "from", header: "Start date", value: (r) => r.effective_from ?? "", cell: (r) => r.effective_from?.slice(0, 10) || <NotSet /> },
            { key: "to", header: "End date", value: (r) => r.effective_to ?? "", cell: (r) => r.effective_to?.slice(0, 10) || <NotSet /> },
            { key: "ver", header: "Version", value: (r) => r.rule_version, cell: (r) => `v${r.rule_version}` },
            { key: "st", header: "Status", value: (r) => lbl(r), cell: (r) => <Pill tone={tone(r)}>{lbl(r)}</Pill> },
            { key: "menu", header: "", value: () => "", cell: (r) => (
              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Rule actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!isActive(r.status) && <DropdownMenuItem onClick={() => (paused[k(r)] ? (setPaused((p) => ({ ...p, [k(r)]: false })), toast.success("Unpaused in this view")) : notYet("Make active"))}>Make active</DropdownMenuItem>}
                    {isActive(r.status) && <DropdownMenuItem onClick={() => void makeInactive(r)}>Make inactive</DropdownMenuItem>}
                    <DropdownMenuItem onClick={() => { setPaused((p) => ({ ...p, [k(r)]: true })); toast.message("Paused in this view only — the API does not accept pause yet."); }}>Pause</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditing(r)}>Edit</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setToDelete(r)}>Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) },
          ]}
        />}
      </div>
      <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
          <AlertDialogTitle>Delete {toDelete?.name} v{toDelete?.rule_version}?</AlertDialogTitle>
            <AlertDialogDescription>This hides the rule here and marks it inactive in the source. Events already calculated keep their amounts.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { const r = toDelete; setToDelete(null); if (r) void deleteRule(r); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <RuleBuilder open={open} onOpenChange={setOpen} onSaved={() => { void qc.invalidateQueries({ queryKey: rulesQuery.queryKey }); }} />
      <RuleBuilder open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }} editing={editing} onSaved={() => { setEditing(null); void qc.invalidateQueries({ queryKey: rulesQuery.queryKey }); }} />
    </div>
  );
}
