import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui-bits";
import { Panel, DataTable, Td, Pill, MetricCard } from "@/components/identity/bits";
import { HELP } from "@/lib/identityHelpText";
import { MetricCardSkeleton, TableSkeleton, ErrorState } from "@/components/identity/skeletons";
import { EmptyState } from "@/components/identity/ProcessDateSelect";
import { DateRangeSelect, makeLatestRange, type DateRange } from "@/components/identity/DateRangeSelect";
import { Pager, PAGE_SIZE } from "@/components/identity/Pager";
import { compareQuery, openCsv, rangeParams, num, pctPoints, COMPARE_SOURCES } from "@/lib/identityLiveApi";

export const Route = createFileRoute("/identity/compare")({
  head: () => ({
    meta: [
      { title: "Source Comparison · Identity" },
      {
        name: "description",
        content: "Compare each identity source against Revenue Leads Plus, the fixed source of truth, on email, name and address agreement.",
      },
      { property: "og:title", content: "Source Comparison · Identity" },
      { property: "og:description", content: "Per-session agreement between the identity graph and the source of truth." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const [range, setRange] = useState<DateRange>(makeLatestRange());
  const [sourceB, setSourceB] = useState<string>("Session Summary");
  const [page, setPage] = useState(1);

  const q = useQuery(compareQuery(sourceB, range));
  const rows = q.data?.rows ?? [];
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const s = q.data?.summary;

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        title="Source Comparison"
        subtitle={
          range.from && range.to
            ? `Source of truth: Revenue Leads Plus · ${range.from} → ${range.to}`
            : `Source of truth: Revenue Leads Plus · process date ${q.data?.processDate ?? "…"}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sourceB}
              onChange={(e) => {
                setSourceB(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {COMPARE_SOURCES.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
            <DateRangeSelect
              value={range}
              onChange={(r) => {
                setRange(r);
                setPage(1);
              }}
              resolved={q.data?.processDate ?? null}
            />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 px-6 lg:grid-cols-4">
        {q.isPending ? (
          Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : (
          <>
            <Metric help={HELP.overlap} label="Overlap sampled" value={num(s?.overlapSampled)} sub={`${q.data?.sourceB ?? sourceB} vs SOT`} />
            <Metric help={HELP.fieldAgreement} label="Email agreement" value={num(s?.emailAgreement)} sub="rows matching SOT email" />
            <Metric help={HELP.fieldAgreement} label="Name agreement" value={num(s?.nameAgreement)} sub="rows matching SOT name" />
            <Metric
              help={HELP.bySourceAccuracy}
              label="Source accuracy"
              value={pctPoints(s?.bySourceAccuracy?.accuracyPct)}
              sub={`${num(s?.bySourceAccuracy?.compared)} compared`}
            />
          </>
        )}
      </div>

      <div className="px-6">
        <Panel
          title="Compared sessions"
          description="Example joined records showing where fields agree or differ with trusted Lead Plus."
          help={HELP.compareRows}
          actions={
            <button
              onClick={() => openCsv("/v1/compare", { source_b: sourceB, ...rangeParams(range) })}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-accent"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          }
        >
          {q.isError ? (
            <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
          ) : (
            <>
              <DataTable
                head={["SOT lead", "Session", "Person ID", "Method", "Email", "Name", "Address", "Audit"]}
                tips={{
                  "SOT lead": HELP.sot,
                  Method: HELP.winningMethod,
                  Email: HELP.fieldAgreement,
                  Name: HELP.fieldAgreement,
                  Address: HELP.fieldAgreement,
                  Audit: HELP.auditLink,
                }}
                align={["left", "left", "left", "left", "left", "left", "left", "left"]}
              >
                {q.isPending ? (
                  <TableSkeleton cols={8} rows={8} />
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState label="No overlapping sessions for this source and date" />
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r, i) => (
                    <tr key={`${r.sessionId}-${i}`} className="hover:bg-muted/40">
                      <Td mono>{r.sotLeadId}</Td>
                      <Td mono className="max-w-[220px] truncate">
                        <span title={r.sessionId}>{r.sessionId}</span>
                      </Td>
                      <Td mono>{r.personId || "—"}</Td>
                      <Td>{r.identityMethod}</Td>
                      <Td><Agree ok={r.emailAgree} /></Td>
                      <Td><Agree ok={r.nameAgree} /></Td>
                      <Td><Agree ok={r.addressAgree} /></Td>
                      <Td>
                        <Link
                          to="/identity/explorer"
                          search={{ session: r.sessionId, compare: r.graphSource }}
                          aria-label={`Audit session ${r.sessionId}`}
                          className="inline-flex items-center text-primary hover:underline"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Td>
                    </tr>
                  ))
                )}
              </DataTable>
              <Pager page={current} total={rows.length} onPage={setPage} />
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Agree({ ok }: { ok: boolean }) {
  return <Pill tone={ok ? "success" : "danger"}>{ok ? "match" : "differs"}</Pill>;
}

function Metric({ label, value, sub, help }: { label: string; value: string; sub?: string; help?: string }) {
  return <MetricCard label={label} value={value} sub={sub} help={help} />;
}

