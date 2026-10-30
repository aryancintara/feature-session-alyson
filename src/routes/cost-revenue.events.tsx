import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/ui-bits";
import { TenantSelect } from "@/components/revenue/RevenueBits";
import { CostRevenueEventDrawer } from "@/components/cost-revenue/CostRevenueEventDrawer";
import { CostRevenueEventsTable, SessionGroupTable } from "@/components/cost-revenue/CostRevenueEventsTable";
import { SessionPanel } from "@/components/cost-revenue/SessionPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CR_EVENTS, CR_SOURCES, srcLabel, useCRRules, type CREvent } from "@/lib/costRevenueData";

export const Route = createFileRoute("/cost-revenue/events")({
  validateSearch: z.object({ rule: z.string().optional(), status: z.string().optional(), type: z.string().optional(), missing: z.boolean().optional() }),
  head: () => ({
    meta: [
      { title: "Cost & Revenue Events · Alyson CDP" },
      { name: "description", content: "Every calculated cost and revenue event by session, source and rule." },
      { property: "og:title", content: "Cost & Revenue Events · Alyson CDP" },
      { property: "og:description", content: "Every calculated cost and revenue event by session, source and rule." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EventsPage,
});

const selCls = "h-8 rounded-md border border-border bg-card px-2 text-sm text-foreground";
function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select aria-label={label} title={label} value={value} onChange={(e) => onChange(e.target.value)} className={cn(selCls, "max-w-[180px]")}><option value="">{label}: All</option>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
  );
}

const ATTN = "attention";
const isAttn = (e: CREvent) => e.status === "Pending" || e.status === "Failed";
const noSid = (e: CREvent) => !e.sessionId?.trim();

function EventsPage() {
  const search = Route.useSearch();
  const nav = Route.useNavigate();
  const rules = useCRRules();
  const [sel, setSel] = useState<CREvent | null>(null);
  const [sid, setSid] = useState<string | null>(null);
  const [grouped, setGrouped] = useState(false);
  const [both, setBoth] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState(search.type ?? "");
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState(search.status ?? "");
  const [missing, setMissing] = useState(!!search.missing);
  const rule = search.rule ?? "";
  const barRef = useRef<HTMLDivElement>(null);
  const [barH, setBarH] = useState(0);
  useEffect(() => {
    const el = barRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setBarH(el.offsetHeight)); ro.observe(el); setBarH(el.offsetHeight);
    return () => ro.disconnect();
  }, []);
  const setRule = (v: string) => nav({ search: (p) => ({ ...p, rule: v || undefined }), replace: true });
  const rows = CR_EVENTS.filter((e) => (!type || e.type === type) && (!source || e.source === source)
    && (!status || (status === ATTN ? isAttn(e) : e.status === status)) && (!missing || noSid(e)) && (!rule || e.ruleId === rule)
    && (!from || e.processedAt.slice(0, 10) >= from) && (!to || e.processedAt.slice(0, 10) <= to));
  const bothSids = (() => { const m = new Map<string, Set<string>>(); for (const e of rows) { if (!e.sessionId) continue; const t = m.get(e.sessionId) ?? new Set(); t.add(e.type); m.set(e.sessionId, t); } return new Set([...m].filter(([, t]) => t.has("COST") && t.has("REVENUE")).map(([k]) => k)); })();
  const groupRows = both ? rows.filter((e) => bothSids.has(e.sessionId)) : rows;
  const dirty = q || from || to || type || source || status || rule || missing;
  const clear = () => { setFrom(""); setTo(""); setType(""); setSource(""); setStatus(""); setRule(""); setQ(""); setMissing(false); };

  const chips: { key: string; label: string; n: number; on: boolean; set: () => void }[] = [
    { key: "all", label: "All", n: CR_EVENTS.length, on: !type && !status && !missing, set: () => { setType(""); setStatus(""); setMissing(false); } },
    { key: "attn", label: "Needs attention", n: CR_EVENTS.filter(isAttn).length, on: status === ATTN, set: () => { setType(""); setMissing(false); setStatus(ATTN); } },
    { key: "miss", label: "Missing session", n: CR_EVENTS.filter(noSid).length, on: missing, set: () => { setType(""); setStatus(""); setMissing(true); } },
    { key: "rev", label: "Revenue", n: CR_EVENTS.filter((e) => e.type === "REVENUE").length, on: type === "REVENUE" && !status && !missing, set: () => { setStatus(""); setMissing(false); setType("REVENUE"); } },
    { key: "cost", label: "Cost", n: CR_EVENTS.filter((e) => e.type === "COST").length, on: type === "COST" && !status && !missing, set: () => { setStatus(""); setMissing(false); setType("COST"); } },
  ];

  const toggle = (
    <button type="button" aria-pressed={grouped} onClick={() => setGrouped((g) => !g)} className={cn("inline-flex items-center rounded-md border px-2 py-1 text-xs", grouped ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-accent")}>
      Group by session
    </button>
  );

  return (
    <div className="pb-10">
      <PageHeader title="Events" subtitle="One table for every calculated Cost and Revenue event." actions={<TenantSelect />} />
      <div ref={barRef} className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-border bg-background px-6 py-2">
          {chips.map((c) => (
            <button key={c.key} type="button" onClick={c.set} aria-pressed={c.on} className={cn("rounded-full border px-3 py-1 text-xs", c.on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
              {c.label} <span className="tabular-nums opacity-80">({c.n})</span>
            </button>
          ))}
          {grouped && (
            <button type="button" onClick={() => setBoth((b) => !b)} aria-pressed={both} className={cn("rounded-full border px-3 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring", both ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
              Both cost and revenue <span className="tabular-nums opacity-80">({bothSids.size})</span>
            </button>
          )}
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <span className="inline-flex items-center gap-1 whitespace-nowrap"><input type="date" aria-label="From" title="From" value={from} onChange={(e) => setFrom(e.target.value)} className={selCls} />
          <span className="text-xs text-muted-foreground">–</span>
          <input type="date" aria-label="To" title="To" value={to} onChange={(e) => setTo(e.target.value)} className={selCls} /></span>
          <Sel label="Type" value={type} onChange={setType} options={[["COST", "Cost"], ["REVENUE", "Revenue"]]} />
          <Sel label="Source" value={source} onChange={setSource} options={CR_SOURCES.map((s) => [s, srcLabel(s)])} />
          <Sel label="Rule" value={rule} onChange={setRule} options={rules.map((r) => [r.id, r.name])} />
          <Sel label="Processing Status" value={status} onChange={setStatus} options={[["Processed", "Processed"], ["Pending", "Pending"], ["Failed", "Failed"], [ATTN, "Pending + Failed"]]} />
          {dirty && <Button variant="ghost" size="sm" onClick={clear}>Clear filters</Button>}
      </div>
      <div className="mt-3 px-6">
        {!rows.length ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">No events match these filters. Clear a filter to see more.</div>
        ) : grouped ? <SessionGroupTable rows={groupRows} onSession={setSid} toolbar={toggle} stickyTop={barH} />
          : <CostRevenueEventsTable rows={rows} onOpen={setSel} query={q} onQueryChange={setQ} onSession={setSid} toolbar={toggle} stickyTop={barH} />}
      </div>
      <SessionPanel sessionId={sid} events={CR_EVENTS} onClose={() => setSid(null)} onShowInTable={(s) => { setGrouped(false); setQ(s); setSid(null); }} onOpenEvent={(e) => { setSid(null); setSel(e); }} />
      <CostRevenueEventDrawer event={sel} onClose={() => setSel(null)} />
    </div>
  );
}
