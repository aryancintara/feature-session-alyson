import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Download } from "lucide-react";
import { PageHeader } from "@/components/ui-bits";
import { Panel, DataTable, Td, Pill } from "@/components/identity/bits";
import { HELP } from "@/lib/identityHelpText";
import { HelpTip } from "@/components/identity/HelpTip";
import { KeyValues } from "@/components/identity/metrics";
import { TableSkeleton, FieldsSkeleton, ErrorState } from "@/components/identity/skeletons";
import { EmptyState } from "@/components/identity/ProcessDateSelect";
import { DateRangeSelect, makeLatestRange, type DateRange } from "@/components/identity/DateRangeSelect";
import { Pager, PAGE_SIZE } from "@/components/identity/Pager";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { decisionsQuery, decisionDetailQuery, openCsv, rangeParams, num, UI_SOURCES } from "@/lib/identityLiveApi";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/identity/explorer")({
  validateSearch: (search: Record<string, unknown>) => ({
    session: typeof search.session === "string" ? search.session : undefined,
    compare: typeof search.compare === "string" ? search.compare : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Audit Explorer · Identity" },
      {
        name: "description",
        content: "Investigate any live identity decision by session id, person id, email or phone with full decision history.",
      },
      { property: "og:title", content: "Audit Explorer · Identity" },
      { property: "og:description", content: "Searchable identity investigation with decision history and confidence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditExplorerPage,
});

const SEARCH_BY = [
  { key: "session", label: "Session ID", placeholder: "session id" },
  { key: "person", label: "Person ID", placeholder: "rev_user_123" },
  { key: "email", label: "Email", placeholder: "john@gmail.com" },
  { key: "phone", label: "Phone", placeholder: "5555555555" },
] as const;

const ALL_SOURCES = "All sources";

function decisionLookupId(r: { sessionId?: string; anonymousUserId?: string; entityRecordId?: string }): string {
  return (r.sessionId || "").trim() || (r.anonymousUserId || "").trim() || (r.entityRecordId || "").trim();
}

function confTone(c: string) {
  const n = Number(c);
  if (!Number.isFinite(n) || !c) return "neutral" as const;
  return n >= 90 ? ("success" as const) : n >= 60 ? ("warning" as const) : ("danger" as const);
}

function AuditExplorerPage() {
  const { session } = Route.useSearch();
  const [by, setBy] = useState<string>("session");
  const [term, setTerm] = useState(session ?? "");
  const [q, setQ] = useState(session ?? "");
  const [range, setRange] = useState<DateRange>(makeLatestRange());
  const [source, setSource] = useState(ALL_SOURCES);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(session ?? null);

  const list = useQuery(
    decisionsQuery({
      by,
      q,
      range,
      source: source === ALL_SOURCES ? undefined : source,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
  );

  const detail = useQuery(decisionDetailQuery(selected));
  const rows = list.data?.decisions ?? [];
  const total = list.data?.total ?? 0;

  const resetPage = () => setPage(1);

  return (
    <div className="space-y-4 pb-10">
      <PageHeader title="Audit Explorer" subtitle="Search any live identity decision and inspect why it was made." />

      <div className="px-6">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <div className="flex gap-1">
            {SEARCH_BY.map((s) => (
              <button
                key={s.key}
                onClick={() => {
                  setBy(s.key);
                  resetPage();
                }}
                className={cn(
                  "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  by === s.key
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  resetPage();
                  setQ(term.trim());
                }
              }}
              placeholder={SEARCH_BY.find((s) => s.key === by)?.placeholder}
              className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => {
              resetPage();
              setQ(term.trim());
            }}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Search
          </button>

          <div className="flex w-full flex-wrap items-center gap-2 border-t border-border pt-2">
            <DateRangeSelect
              value={range}
              onChange={(r) => {
                resetPage();
                setRange(r);
              }}
            />

            <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Source
              <HelpTip text={HELP.explorerFilters} />
            </span>
            <select
              value={source}
              onChange={(e) => {
                resetPage();
                setSource(e.target.value);
              }}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {[ALL_SOURCES, ...UI_SOURCES].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {(range.from || range.to || source !== ALL_SOURCES || q) && (
              <button
                onClick={() => {
                  setRange(makeLatestRange());
                  setSource(ALL_SOURCES);
                  setTerm("");
                  setQ("");
                  resetPage();
                }}
                className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-6">
        <Panel
          title="Results"
          description={list.isPending ? "Loading identity decisions…" : `${num(total)} identity decisions`}
          help={HELP.decisionsTable}
          actions={
            <button
              onClick={() =>
                openCsv("/v1/decisions", {
                  by,
                  q,
                  ...rangeParams(range),
                  source: source === ALL_SOURCES ? undefined : source,
                })
              }
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-accent"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          }
        >
          {list.isError ? (
            <ErrorState message={(list.error as Error).message} onRetry={() => list.refetch()} />
          ) : (
            <>
              <DataTable
                head={["Session", "Person ID", "Method", "Family", "Confidence", "Status", "Source", "Process date"]}
                tips={{
                  Session: HELP.decisionsTable,
                  Method: HELP.winningMethod,
                  Confidence: HELP.methodConfidence,
                  Status: HELP.decisionStatus,
                }}
                align={["left", "left", "left", "left", "right", "left", "left", "left"]}
              >
                {list.isPending ? (
                  <TableSkeleton cols={8} rows={10} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState label="No identity decisions match these filters" />
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => {
                    const lookupId = decisionLookupId(r);
                    return (
                    <tr
                      key={`${lookupId}-${i}`}
                      onClick={() => {
                        if (!lookupId) return;
                        setSelected(lookupId);
                      }}
                      className="cursor-pointer hover:bg-accent/40"
                    >
                      <Td mono className="max-w-[240px] truncate">
                        <span title={lookupId}>{(r.sessionId || "").trim() || "—"}</span>
                      </Td>
                      <Td mono>{r.personId || "—"}</Td>
                      <Td className="font-medium">{r.winningMethod}</Td>
                      <Td className="text-muted-foreground">{r.methodFamily}</Td>
                      <Td right>
                        <Pill tone={confTone(r.confidence)}>{r.confidence ? `${r.confidence}%` : "—"}</Pill>
                      </Td>
                      <Td className="capitalize text-muted-foreground">{r.status}</Td>
                      <Td className="text-muted-foreground">{r.source}</Td>
                      <Td className="tabular-nums text-muted-foreground">{r.processDate}</Td>
                    </tr>
                    );
                  })
                )}
              </DataTable>
              <Pager page={page} total={total} onPage={setPage} />
            </>
          )}
        </Panel>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{selected}</DialogTitle>
            <DialogDescription>Identity decision detail and history</DialogDescription>
          </DialogHeader>

          {detail.isPending ? (
            <FieldsSkeleton count={8} />
          ) : detail.isError ? (
            <ErrorState message={(detail.error as Error).message} onRetry={() => detail.refetch()} />
          ) : !detail.data?.found ? (
            <EmptyState label="No decision found for this record" />
          ) : (
            <div className="space-y-4">
              <KeyValues
                data={{
                  "Person ID": detail.data.personId || "—",
                  Source: detail.data.source || "—",
                  "Winning method": detail.data.winningMethod || "—",
                  "Method family": detail.data.methodFamily || "—",
                  Confidence: detail.data.confidence ? `${detail.data.confidence}%` : "—",
                  Status: detail.data.status || "—",
                  "Process date": detail.data.processDate ?? "—",
                }}
                tips={{ Confidence: HELP.methodConfidence }}
              />


              <Panel title="Identity inputs" description="The values that were available when the identity decision was made." help={HELP.decisionInputs}>
                <div className="p-4">
                  <KeyValues
                    data={{
                      Email: detail.data.profile?.email || "—",
                      Phone: detail.data.profile?.phone || "—",
                      Name: detail.data.profile?.name || "—",
                      Address: detail.data.profile?.address || "—",
                      "IP address": detail.data.profile?.ipAddress || "—",
                      "User agent": detail.data.profile?.userAgent || "—",
                    }}
                  />
                </div>
              </Panel>

              <Panel title="Decision history" description="Earlier identity decisions recorded for this same session." help={HELP.decisionHistory}>
                <DataTable head={["Process date", "Winning method", "Decided at"]}>
                  {(detail.data.history ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={3}>
                        <EmptyState label="No earlier decisions recorded" />
                      </td>
                    </tr>
                  ) : (
                    (detail.data.history ?? []).map((h, i) => (
                      <tr key={`${h.decidedAt}-${i}`}>
                        <Td className="tabular-nums">{h.processDate}</Td>
                        <Td className="font-medium">{h.winningMethod}</Td>
                        <Td mono>{h.decidedAt}</Td>
                      </tr>
                    ))
                  )}
                </DataTable>
              </Panel>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
