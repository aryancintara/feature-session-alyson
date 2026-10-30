import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Pill } from "@/components/identity/bits";
import { CopyBtn, NotSet } from "@/components/cost-revenue/bits";
import { useQuery } from "@tanstack/react-query";
import { calcLine, condLine, listRules } from "@/lib/rulesApi";
import { eventStatusTone, explain, fmtTs, moneyExact, srcLabel, typeTone, useCRRules, type CREvent } from "@/lib/costRevenueData";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mt-5"><div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</div>{children}</div>;
}
function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-border rounded-lg border border-border text-sm">
      {rows.map(([k, v]) => <div key={k} className="flex min-w-0 justify-between gap-3 px-3 py-2"><dt className="shrink-0 text-muted-foreground">{k}</dt><dd className="flex min-w-0 items-center justify-end truncate text-right font-medium tabular-nums">{v || <NotSet />}</dd></div>)}
    </dl>
  );
}

export function CostRevenueEventDrawer({ event: e, onClose }: { event: CREvent | null; onClose: () => void }) {
  const rules = useCRRules();
  const rule = e ? rules.find((r) => r.id === e.ruleId) : undefined;
  const x = e && rule ? explain(rule, e) : null;
  // Rule logic and "View Rule" come only from the loaded Rules API list (GET /rules), matched by rule_id + version.
  const apiRules = useQuery({ queryKey: ["cr-rules"], queryFn: listRules, retry: false });
  const apiVersions = e ? (apiRules.data ?? []).filter((r) => r.rule_id === e.ruleId) : [];
  const apiRule = e ? apiVersions.find((r) => r.rule_version === e.ruleVersion) : undefined;
  const inList = apiVersions.length > 0;
  const label = e?.type === "COST" ? "Calculated Cost" : "Calculated Revenue";
  return (
    <Sheet open={!!e} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full max-w-full overflow-y-auto overflow-x-hidden sm:max-w-lg">
        {e && (
          <div className="min-w-0">
            <SheetHeader>
              <SheetTitle className="flex items-center font-mono text-base">{e.id}<CopyBtn value={e.id} label="Event ID" /></SheetTitle>
              <div className="flex flex-wrap items-center gap-2"><Pill tone={typeTone(e.type)}>{e.type}</Pill><Pill tone={eventStatusTone(e.status)}>{e.status}</Pill><span className="text-xs text-muted-foreground">{fmtTs(e.processedAt)}</span></div>
            </SheetHeader>

            <div aria-label="Event trace" className="mt-4 flex min-w-0 flex-nowrap items-center gap-1 whitespace-nowrap rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
              <span className="hidden shrink-0 text-muted-foreground sm:inline">Source row</span><span className="min-w-0 max-w-24 shrink truncate font-mono" title={e.sourceRecordId}>{e.sourceRecordId}</span><span className="shrink-0"><CopyBtn value={e.sourceRecordId} label="Source row" /></span>
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="hidden shrink-0 text-muted-foreground sm:inline">Rule</span><TooltipProvider><Tooltip><TooltipTrigger asChild><span tabIndex={0} className="min-w-0 flex-1 truncate font-medium">{rule?.name ?? e.ruleId} v{e.ruleVersion}</span></TooltipTrigger><TooltipContent className="max-w-xs break-words">{rule?.name ?? e.ruleId} v{e.ruleVersion}</TooltipContent></Tooltip></TooltipProvider><span className="shrink-0"><CopyBtn value={e.ruleId} label="Rule ID" /></span>
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="shrink-0 font-semibold tabular-nums">{e.status === "Failed" ? "—" : moneyExact(e.amount)}</span>{e.status !== "Failed" && <span className="shrink-0"><CopyBtn value={moneyExact(e.amount)} label="Amount" /></span>}
            </div>

            <Section title="Calculation">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="grid gap-3 text-sm">
                  <div><div className="text-xs text-muted-foreground">Input</div>{x?.inputs.map((l) => <div key={l} className="break-words font-mono">{l}</div>)}</div>
                  <div><div className="text-xs text-muted-foreground">Rule</div><div className="font-medium">{rule?.name ?? e.ruleId} <span className="text-muted-foreground">v{e.ruleVersion}</span></div></div>
                  <div><div className="text-xs text-muted-foreground">Formula</div><div className="break-words font-mono">{x?.formula}</div></div>
                </div>
                <div className="mt-4 flex items-baseline justify-between border-t border-primary/20 pt-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
                  <span className="text-2xl font-semibold tabular-nums">{e.status === "Failed" ? <NotSet /> : moneyExact(e.amount)}</span>
                </div>
                {e.status === "Failed" && <p className="mt-2 text-xs text-destructive">Processing failed, so no amount was calculated for this event.</p>}
              </div>
            </Section>

            <Section title="Source row">
              <KV rows={[["Source", srcLabel(e.source)], ["Source Record ID", <span className="font-mono text-xs">{e.sourceRecordId}</span>], ["Processing Run ID", <span className="font-mono text-xs">{e.runId}</span>], ["Processed At", fmtTs(e.processedAt)], ["Processing Status", <Pill tone={eventStatusTone(e.status)}>{e.status}</Pill>]]} />
            </Section>

            <Section title="Rule">
              <KV rows={[["Rule Name", rule?.name], ["Rule ID", <><span className="truncate font-mono">{e.ruleId}</span><CopyBtn value={e.ruleId} label="Rule ID" /></>], ["Rule Version", `v${e.ruleVersion}`]]} />
              {apiRule ? (
                <div className="mt-2 rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs">
                  <div><span className="font-semibold text-muted-foreground">IF </span>{apiRule.conditions.length ? apiRule.conditions.map(condLine).join(" AND ") : "every row"}</div>
                  <div><span className="font-semibold text-muted-foreground">THEN </span>{calcLine(apiRule)}</div>
                </div>
              ) : <p className="mt-2 text-xs text-muted-foreground">Logic not available for this rule.</p>}
              {inList ? (
                <Button asChild variant="outline" size="sm" className="mt-2 w-full"><Link to="/cost-revenue/rules/$ruleId" params={{ ruleId: e.ruleId }} search={{ v: e.ruleVersion }}>View Rule</Link></Button>
              ) : (
                <>
                  <p className="mt-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">This rule isn't in the Rules list, so its version history can't be shown</p>
                  <TooltipProvider><Tooltip><TooltipTrigger asChild><span className="mt-2 block" tabIndex={0}><Button variant="outline" size="sm" className="w-full" disabled>View Rule</Button></span></TooltipTrigger><TooltipContent>This rule isn't in the Rules list.</TooltipContent></Tooltip></TooltipProvider>
                </>
              )}
            </Section>

            <Section title="Event summary">
              <KV rows={[["Event ID", <><span className="truncate font-mono">{e.id}</span><CopyBtn value={e.id} label="Event ID" /></>], ["Session ID", e.sessionId ? <><span className="truncate font-mono">{e.sessionId}</span><CopyBtn value={e.sessionId} label="Session ID" /></> : <Pill tone="warning">Missing</Pill>], ["Type", e.type], ["Source", srcLabel(e.source)], ["Amount", moneyExact(e.amount)], ["Currency", e.currency], ["Processed At", fmtTs(e.processedAt)]]} />
            </Section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
