import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/ui-bits";
import { Panel, DataTable, Td, Pill, MetricCard } from "@/components/identity/bits";
import { HELP } from "@/lib/identityHelpText";
import { MetricCardSkeleton, TableSkeleton, ErrorState } from "@/components/identity/skeletons";
import { EmptyState } from "@/components/identity/ProcessDateSelect";
import { DateRangeSelect, makeLatestRange, type DateRange } from "@/components/identity/DateRangeSelect";
import { errorsQuery, openCsv, rangeParams, num, severityTone } from "@/lib/identityLiveApi";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/identity/errors")({
  head: () => ({
    meta: [
      { title: "Identity Errors · Investigation" },
      {
        name: "description",
        content: "Live identity error types by severity with affected records, examples and CSV export for investigation.",
      },
      { property: "og:title", content: "Identity Errors · Investigation" },
      { property: "og:description", content: "Conflicting sources, multiple identities and invalid assignments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ErrorsPage,
});

const SEVERITIES = ["all", "critical", "high", "medium", "low"] as const;
const STATUSES = ["all", "open", "investigating", "resolved"] as const;

function ErrorsPage() {
  const [range, setRange] = useState<DateRange>(makeLatestRange());
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("all");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");

  const q = useQuery(errorsQuery(range, status));
  const all = q.data?.errors ?? [];
  const rows = severity === "all" ? all : all.filter((e) => e.severity.toLowerCase() === severity);
  const totals = q.data?.totals ?? null;
  const critical = all.filter((e) => e.severity.toLowerCase() === "critical").reduce((a, e) => a + e.count, 0);

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        title="Identity Errors"
        subtitle={
          range.from && range.to
            ? `Live error detection · ${range.from} → ${range.to}`
            : `Live error detection · process date ${q.data?.processDate ?? "…"}`
        }
        actions={<DateRangeSelect value={range} onChange={setRange} resolved={q.data?.processDate ?? null} />}
      />

      <div className="grid grid-cols-2 gap-3 px-6 lg:grid-cols-4">
        {q.isPending ? (
          Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : (
          <>
            <Metric label="Affected records" value={num(totals?.records)} help={HELP.errorTotals} />
            <Metric label="Open" value={num(totals?.open)} help={HELP.errorStatus} />
            <Metric label="Error types" value={num(totals?.types)} help={HELP.errorsTable} />
            <Metric label="Critical records" value={num(critical)} help={HELP.errorSeverity} />
          </>
        )}
      </div>

      <div className="px-6">
        <Panel
          title="Error types"
          description="Data quality issues found during identity processing, with counts and examples."
          help={HELP.errorsTable}
          actions={
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex rounded-md border border-border p-0.5">
                {SEVERITIES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSeverity(s)}
                    className={cn(
                      "rounded px-2 py-1 text-[11px] font-medium capitalize",
                      severity === s ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
                className="rounded-md border border-border bg-background px-2 py-1 text-[11px] capitalize focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                onClick={() => openCsv("/v1/errors", { ...rangeParams(range), status })}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-accent"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            </div>
          }
        >
          {q.isError ? (
            <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
          ) : (
            <DataTable
              head={["Error type", "Severity", "Example", "Records", "Status"]}
              tips={{
                "Error type": HELP.errorsTable,
                Severity: HELP.errorSeverity,
                Example: HELP.errorExample,
                Status: HELP.errorStatus,
              }}
              align={["left", "left", "left", "right", "left"]}
            >
              {q.isPending ? (
                <TableSkeleton cols={5} rows={8} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState label="No errors for this process date and filter" />
                  </td>
                </tr>
              ) : (
                rows.map((e) => (
                  <tr key={e.errorType} className="hover:bg-muted/40">
                    <Td className="font-medium">{e.errorType}</Td>
                    <Td>
                      <Pill tone={severityTone(e.severity)}>{e.severity}</Pill>
                    </Td>
                    <Td className="max-w-[380px] truncate text-muted-foreground" >
                      <span title={e.example ?? ""}>{e.example ?? "—"}</span>
                    </Td>
                    <Td right>{num(e.count)}</Td>
                    <Td className="capitalize text-muted-foreground">{e.status}</Td>
                  </tr>
                ))
              )}
            </DataTable>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Metric({ label, value, help }: { label: string; value: string; help?: string }) {
  return <MetricCard label={label} value={value} help={help} />;
}

