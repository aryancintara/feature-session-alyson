import { createFileRoute, Link, type ErrorComponentProps } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-bits";
import { DataTable, Panel, Pill, Td } from "@/components/identity/bits";
import { ErrorState, FieldsSkeleton } from "@/components/identity/skeletons";
import { RuleBuilder } from "@/components/cost-revenue/RuleBuilder";
import { Button } from "@/components/ui/button";
import { SOURCE_LABELS, calcLine, condLine, deactivateRule, errMsg, isActive, listRules, statusLabel } from "@/lib/rulesApi";
import { fmtTs, typeTone } from "@/lib/costRevenueData";
import { NotSet } from "@/components/cost-revenue/bits";

export const Route = createFileRoute("/cost-revenue/rules/$ruleId")({
  validateSearch: (s: Record<string, unknown>): { v?: number } => ({ v: s.v !== undefined && !isNaN(Number(s.v)) ? Number(s.v) : undefined }),
  head: () => ({
    meta: [
      { title: "Rule Detail · Cost & Revenue · Alyson CDP" },
      { name: "description", content: "How this rule calculates Cost or Revenue, and its versions." },
      { property: "og:title", content: "Rule Detail · Cost & Revenue · Alyson CDP" },
      { property: "og:description", content: "How this rule calculates Cost or Revenue, and its versions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RuleDetail,
  errorComponent: RuleError,
});

function RuleError({ error }: ErrorComponentProps) {
  return (
    <div className="mx-auto max-w-lg p-10 text-center">
      <h1 className="text-lg font-semibold">This page couldn't load</h1>
      <p className="mt-1 text-sm text-muted-foreground">Something went wrong showing this rule. Go back and try again.</p>
      <Button asChild size="sm" className="mt-4"><Link to="/cost-revenue/rules">Back to Rules</Link></Button>
      <details className="mt-6 text-left text-xs text-muted-foreground">
        <summary className="cursor-pointer">Technical details</summary>
        <pre className="mt-2 whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-3 font-mono">{error instanceof Error ? error.message : String(error)}</pre>
      </details>
    </div>
  );
}

function RuleDetail() {
  const { ruleId } = Route.useParams();
  const { v } = Route.useSearch();
  const nav = Route.useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cr-rules"], queryFn: listRules, retry: false });
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(false);
  const back = <div className="px-6 pt-4"><Link to="/cost-revenue/rules" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Rules</Link></div>;

  if (q.isPending) return <div>{back}<div className="p-6"><FieldsSkeleton count={8} /></div></div>;
  if (q.isError) return <div>{back}<ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /></div>;
  const versions = (q.data ?? []).filter((r) => r.rule_id === ruleId).sort((a, b) => b.rule_version - a.rule_version);
  const rule = versions.find((r) => r.rule_version === v) ?? versions[0];
  if (!rule) return <div>{back}<p className="p-6 text-sm text-muted-foreground">Rule not found.</p></div>;

  const deactivate = async () => {
    setBusy(true);
    try { await deactivateRule(rule.rule_id, rule.rule_version); toast.success(`v${rule.rule_version} deactivated`); await qc.invalidateQueries({ queryKey: ["cr-rules"] }); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="pb-10">
      {back}
      <PageHeader
        className="pt-2"
        title={rule.name}
        subtitle={`${rule.rule_id} · v${rule.rule_version}`}
        actions={<div className="flex items-center gap-2">
          <Pill tone={typeTone(rule.type)}>{rule.type}</Pill><Pill tone={isActive(rule.status) ? "success" : "neutral"}>{statusLabel(rule.status)}</Pill>
          <Button size="sm" variant="outline" onClick={() => setEdit(true)}>Edit (new version)</Button>
          {isActive(rule.status) && <Button size="sm" variant="outline" disabled={busy} onClick={deactivate}>{busy ? "Deactivating…" : "Deactivate this version"}</Button>}
        </div>}
      />
      <div className="space-y-4 px-6">
        {versions.filter((r) => isActive(r.status)).length > 1 && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm font-medium text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />{versions.filter((r) => isActive(r.status)).length} versions of this rule are active at the same time.
          </div>
        )}
        <Panel title="Logic" description="This rule in plain English">
          <div className="space-y-3 p-4 font-mono text-sm">
            <div><div className="text-xs font-semibold text-muted-foreground">IF</div>{rule.conditions.length ? rule.conditions.map((c, i) => <div key={i} className="pl-4">{i > 0 && <span className="text-muted-foreground">AND </span>}{condLine(c)}</div>) : <div className="pl-4 text-muted-foreground">all rows</div>}</div>
            <div><div className="text-xs font-semibold text-muted-foreground">THEN</div><div className="pl-4 font-semibold">{calcLine(rule)}</div></div>
          </div>
        </Panel>
        <Panel title="Overview">
          <dl className="grid gap-x-6 sm:grid-cols-2">
            {([["Rule Name", rule.name], ["Type", rule.type], ["Source", SOURCE_LABELS[rule.source_id] ?? rule.source_id], ["Source Table", rule.source_table], ["Status", statusLabel(rule.status)], ["Version", `v${rule.rule_version}`], ["Effective From", fmtTs(rule.effective_from) || <NotSet />], ["Effective To", fmtTs(rule.effective_to) || <NotSet />], ["Created By", rule.created_by || <NotSet />], ["Created At", fmtTs(rule.created_at) || <NotSet />], ["Description", rule.description || <NotSet />]] as [string, React.ReactNode][]).map(([k, val]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-border px-4 py-2.5 text-sm"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{val}</dd></div>
            ))}
          </dl>
        </Panel>
        <Panel title="Versions" description="Older versions are kept, never overwritten">
          <DataTable head={["Version", "Status", "Effective From", "Effective To", "Created At"]}>
            {versions.map((r) => (
              <tr key={r.rule_version} className={`cursor-pointer hover:bg-muted/40 ${r.rule_version === rule.rule_version ? "bg-muted/30" : ""}`} onClick={() => nav({ search: { v: r.rule_version } })}>
                <Td mono>v{r.rule_version}</Td><Td><Pill tone={isActive(r.status) ? "success" : "neutral"}>{statusLabel(r.status)}</Pill></Td><Td>{fmtTs(r.effective_from) || <NotSet />}</Td><Td>{fmtTs(r.effective_to) || <NotSet />}</Td><Td>{fmtTs(r.created_at) || <NotSet />}</Td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      </div>
      <RuleBuilder open={edit} onOpenChange={setEdit} editing={rule} onSaved={(_, ver) => { void qc.invalidateQueries({ queryKey: ["cr-rules"] }); nav({ search: { v: ver } }); }} />
    </div>
  );
}
