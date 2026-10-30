import { AnalyticsTable } from "@/components/AnalyticsTable";
import { Pill } from "@/components/identity/bits";
import { NotSet } from "@/components/cost-revenue/bits";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { listRules } from "@/lib/rulesApi";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { eventStatusTone, fmtTs, money, srcLabel, typeTone, useCRRules, type CREvent, type CREventStatus } from "@/lib/costRevenueData";

function Totals({ rows, prefix }: { rows: CREvent[]; prefix: string }) {
  const rev = rows.filter((e) => e.type === "REVENUE").reduce((s, e) => s + e.amount, 0);
  const cost = rows.filter((e) => e.type === "COST").reduce((s, e) => s + e.amount, 0);
  const net = rev - cost;
  return (
    <span className="tabular-nums">{prefix} · Revenue <b className="text-foreground">{money(rev)}</b> · Cost <b className="text-foreground">{money(cost)}</b> · Net <b className={net > 0 ? "text-success" : net < 0 ? "text-destructive" : "text-foreground"}>{money(net)}</b></span>
  );
}

/** Shared Cost & Revenue events table (one table for both types). */
export function CostRevenueEventsTable({ rows, onOpen, compact, query, onQueryChange, onSession, toolbar, stickyTop }: {
  rows: CREvent[]; onOpen: (e: CREvent) => void; compact?: boolean; query?: string; onQueryChange?: (q: string) => void;
  onSession?: (sid: string) => void; toolbar?: React.ReactNode; stickyTop?: number;
}) {
  const rules = useCRRules();
  const ruleName = (id: string) => rules.find((r) => r.id === id)?.name ?? id;
  // Same cached Rules list (GET /rules) used elsewhere; dot only shows once it has loaded.
  const apiRules = useQuery({ queryKey: ["cr-rules"], queryFn: listRules, retry: false });
  const known = apiRules.isSuccess ? new Set(apiRules.data.map((r) => r.rule_id)) : null;
  return (
    <AnalyticsTable
      rows={rows}
      rowKey={(r) => r.id}
      onRowClick={onOpen}
      pageSize={20}
      stickyHeader={!compact}
      stickyTop={stickyTop}
      toolbar={toolbar}
      csvName="cost-revenue-events.csv"
      storageKey={compact ? undefined : "cost-revenue-events-cols:v4"}
      searchPlaceholder="Search Session ID or Event ID"
      query={query}
      onQueryChange={onQueryChange}
      rowClassName={(r) => (r.status === "Pending" ? "bg-warning/5" : r.status === "Failed" ? "bg-destructive/5" : undefined)}
      summary={(page, { total, paginated }) => <Totals rows={page} prefix={`${page.length} events${paginated ? ` on this page (of ${total})` : ""}`} />}
      columns={[
        { key: "id", header: "Event ID", width: "110px", defaultHidden: true, value: (r) => r.id, cell: (r) => <span title={r.id} className="block max-w-[110px] truncate font-mono text-xs">{r.id}</span> },
        { key: "at", header: "Processed at (UTC)", value: (r) => r.processedAt, cell: (r) => { const t = fmtTs(r.processedAt).replace(/ UTC$/, ""); return <span title={fmtTs(r.processedAt)} className="whitespace-nowrap tabular-nums">{t ? t.slice(5) : <NotSet />}</span>; } },
        { key: "sid", header: "Session ID", value: (r) => r.sessionId, cell: (r) => r.sessionId
          ? <button type="button" className="font-mono text-xs text-primary hover:underline" title="Open this session" onClick={(e) => { e.stopPropagation(); if (onSession) onSession(r.sessionId); else onQueryChange?.(r.sessionId); }}>{r.sessionId}</button>
          : <Pill tone="warning">Missing</Pill> },
        { key: "type", header: "Type", value: (r) => r.type, cell: (r) => <Pill tone={typeTone(r.type)}>{r.type}</Pill> },
        { key: "src", header: "Source", value: (r) => srcLabel(r.source), cell: (r) => srcLabel(r.source) || <NotSet /> },
        { key: "amt", header: "Amount", align: "right", value: (r) => r.amount, cell: (r) => <span className="tabular-nums">{money(r.amount)}</span> },
        { key: "cur", header: "Currency", defaultHidden: true, value: (r) => r.currency, cell: (r) => r.currency || <NotSet /> },
        { key: "rule", header: "Rule", value: (r) => `${ruleName(r.ruleId)} · v${r.ruleVersion}`, cell: (r) => { const t = `${ruleName(r.ruleId)} · v${r.ruleVersion}`; return <span className="flex min-w-[220px] max-w-[280px] items-center gap-1.5"><span title={t} className="truncate whitespace-nowrap">{t}</span>{known && !known.has(r.ruleId) && <TooltipProvider><Tooltip><TooltipTrigger asChild><span tabIndex={0} aria-label="Not in Rules list" className="h-2 w-2 shrink-0 rounded-full bg-warning" /></TooltipTrigger><TooltipContent>Not in Rules list.</TooltipContent></Tooltip></TooltipProvider>}</span>; } },
        { key: "st", header: "Status", sticky: "right", value: (r) => r.status, cell: (r) => <Pill tone={eventStatusTone(r.status)}>{r.status}</Pill> },
      ]}
    />
  );
}

interface SessionGroup { sid: string; revenue: number; cost: number; net: number; events: number; worst: CREventStatus }
const RANK: Record<CREventStatus, number> = { Processed: 0, Pending: 1, Failed: 2 };

/** One row per session, built from the loaded events. */
export function SessionGroupTable({ rows, onSession, toolbar, stickyTop }: { rows: CREvent[]; onSession: (sid: string) => void; toolbar?: React.ReactNode; stickyTop?: number }) {
  const m = new Map<string, SessionGroup>();
  for (const e of rows) {
    const sid = e.sessionId || "";
    const g = m.get(sid) ?? { sid, revenue: 0, cost: 0, net: 0, events: 0, worst: "Processed" as CREventStatus };
    g.events++;
    if (e.status === "Processed") { if (e.type === "REVENUE") g.revenue += e.amount; else g.cost += e.amount; }
    if (RANK[e.status] > RANK[g.worst]) g.worst = e.status;
    g.net = g.revenue - g.cost;
    m.set(sid, g);
  }
  return (
    <AnalyticsTable
      rows={[...m.values()]}
      rowKey={(g) => g.sid || "(missing)"}
      onRowClick={(g) => g.sid && onSession(g.sid)}
      pageSize={20}
      stickyHeader
      stickyTop={stickyTop}
      toolbar={toolbar}
      csvName="cost-revenue-sessions.csv"
      searchPlaceholder="Search Session ID"
      summary={() => <span>Grouped from {rows.length} loaded events</span>}
      columns={[
        { key: "sid", header: "Session", value: (g) => g.sid, cell: (g) => g.sid ? <span className="font-mono text-xs text-primary">{g.sid}</span> : <Pill tone="warning">Missing</Pill> },
        { key: "rev", header: "Revenue", align: "right", value: (g) => g.revenue, cell: (g) => <span className="tabular-nums">{money(g.revenue)}</span> },
        { key: "cost", header: "Cost", align: "right", value: (g) => g.cost, cell: (g) => <span className="tabular-nums">{money(g.cost)}</span> },
        { key: "net", header: "Net", align: "right", value: (g) => g.net, cell: (g) => <span className={cn("font-medium tabular-nums", g.net > 0 ? "text-success" : g.net < 0 ? "text-destructive" : "")}>{money(g.net)}</span> },
        { key: "n", header: "Events", align: "right", value: (g) => g.events, cell: (g) => g.events },
        { key: "w", header: "Worst status", value: (g) => RANK[g.worst], cell: (g) => <Pill tone={eventStatusTone(g.worst)}>{g.worst}</Pill> },
      ]}
    />
  );
}
