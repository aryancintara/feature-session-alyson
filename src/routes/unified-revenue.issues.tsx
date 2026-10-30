import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/ui-bits";
import { Pill } from "@/components/identity/bits";
import { AnalyticsTable } from "@/components/AnalyticsTable";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { TenantSelect } from "@/components/revenue/RevenueBits";
import { REVENUE_ISSUES, issueStatusTone, issueTone, type IssueStatus, type RevenueIssue, sourceIdByName } from "@/lib/unifiedRevenueData";

export const Route = createFileRoute("/unified-revenue/issues")({
  head: () => ({
    meta: [
      { title: "Revenue Issues · Resolve.io" },
      { name: "description", content: "Data quality and processing issues detected in Unified Revenue." },
      { property: "og:title", content: "Revenue Issues · Resolve.io" },
      { property: "og:description", content: "Track and investigate Unified Revenue issues." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IssuesPage,
});

const H = "mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground";
const STATUSES: IssueStatus[] = ["Open", "Investigating", "Resolved", "Ignored"];

function IssuesPage() {
  const [status, setStatus] = useState<IssueStatus | "">("");
  const [sel, setSel] = useState<RevenueIssue | null>(null);
  const rows = REVENUE_ISSUES.filter((i) => !status || i.status === status);
  return (
    <div className="pb-10">
      <PageHeader title="Issues" subtitle="Problems detected in revenue data and processing." actions={<TenantSelect />} />
      <div className="mb-3 flex gap-2 px-6">
        {(["", ...STATUSES] as const).map((s) => (
          <button key={s || "all"} onClick={() => setStatus(s)} className={`rounded-full border px-3 py-1 text-xs ${status === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
            {s || "All"} ({s ? REVENUE_ISSUES.filter((i) => i.status === s).length : REVENUE_ISSUES.length})
          </button>
        ))}
      </div>
      <div className="px-6">
        <AnalyticsTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={setSel}
          pageSize={20}
          csvName="revenue-issues.csv"
          columns={[
            { key: "sev", header: "Severity", value: (r) => r.severity, cell: (r) => <Pill tone={issueTone(r.severity)}>{r.severity}</Pill> },
            { key: "issue", header: "Issue", value: (r) => r.title, cell: (r) => <span className="font-medium">{r.title}</span> },
            { key: "source", header: "Source", value: (r) => r.source, cell: (r) => r.source },
            { key: "status", header: "Status", value: (r) => r.status, cell: (r) => <Pill tone={issueStatusTone(r.status)}>{r.status}</Pill> },
            { key: "created", header: "Created date", value: (r) => r.created, cell: (r) => r.created },
          ]}
        />
      </div>
      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {sel && (
            <>
              <SheetHeader><SheetTitle>{sel.title}</SheetTitle></SheetHeader>
              <div className="mt-5 space-y-5 text-sm">
                <div>
                  <div className={H}>Issue Summary</div>
                  <dl className="divide-y divide-border rounded-lg border border-border">
                    {([["Issue name", sel.title], ["Severity", <Pill tone={issueTone(sel.severity)}>{sel.severity}</Pill>], ["Status", <Pill tone={issueStatusTone(sel.status)}>{sel.status}</Pill>], ["Created date", sel.created], ["Source", sel.source]] as const).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
                    ))}
                  </dl>
                </div>
                <div>
                  <div className={H}>Investigation Details</div>
                  <div className="space-y-3">
                    <div><div className="text-xs text-muted-foreground">What happened</div>{sel.whatHappened}</div>
                    <div><div className="text-xs text-muted-foreground">Why it was detected</div>{sel.whyDetected}</div>
                    <div><div className="text-xs text-muted-foreground">Affected records</div><span className="font-medium tabular-nums">{sel.affected}</span></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-border p-3"><div className="text-[11px] uppercase text-muted-foreground">Expected value</div><div className="mt-1 font-medium">{sel.expected}</div></div>
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3"><div className="text-[11px] uppercase text-muted-foreground">Actual value</div><div className="mt-1 font-medium text-destructive">{sel.actual}</div></div>
                    </div>
                    <div><div className="text-xs text-muted-foreground">Investigation steps</div><ol className="list-decimal space-y-1 pl-5">{sel.steps.map((s) => <li key={s}>{s}</li>)}</ol></div>
                  </div>
                </div>
                <div>
                  <div className={H}>Related Actions</div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm"><Link to="/unified-revenue/sources" search={{ source: sourceIdByName(sel.source) }}>View Source</Link></Button>
                    <Button asChild variant="outline" size="sm"><Link to="/unified-revenue/events" search={{ source: sourceIdByName(sel.source), status: undefined }}>View Revenue Events</Link></Button>
                    <Button asChild variant="outline" size="sm"><Link to="/unified-revenue/runs" search={{ run: sel.runId }}>View Processing Run</Link></Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
