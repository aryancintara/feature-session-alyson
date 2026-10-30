import { useEffect, useState } from "react";
import { ArrowDown, Building, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pill } from "@/components/identity/bits";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtMoney } from "@/lib/unifiedTablesData";
import { TENANTS, procTone, sourceName, type RevenueRecord } from "@/lib/unifiedRevenueData";

export function TenantSelect() {
  const [t, setT] = useState(TENANTS[0]?.id ?? "");
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(false); }, []);
  const selected = TENANTS.find((x) => x.id === t);
  if (loading) return <div role="status" aria-label="Loading workspace" className="flex h-8 w-44 items-center gap-2 rounded-md border border-border px-3"><Building className="h-4 w-4 shrink-0 text-muted-foreground" /><Skeleton className="h-4 w-24" /></div>;
  return (
    <Select value={t} onValueChange={setT}>
      <SelectTrigger className="h-8 w-44 text-sm" aria-label="Workspace">
        <Building className="h-4 w-4 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Select workspace"><span className="block truncate">{selected?.name?.trim() || "Select workspace"}</span></SelectValue>
      </SelectTrigger>
      <SelectContent>
        {TENANTS.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-border rounded-lg border border-border text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 px-3 py-2">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="truncate text-right font-medium tabular-nums">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RevenueEventDrawer({ record, onClose }: { record: RevenueRecord | null; onClose: () => void }) {
  const r = record;
  const [raw, setRaw] = useState(false);
  return (
    <>
    {r && <SourceRowDialog record={r} open={raw} onClose={() => setRaw(false)} />}
    <Sheet open={!!r} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {r && (
          <>
            <SheetHeader>
              <SheetTitle className="font-mono text-base">{r.revenue_summary_id}</SheetTitle>
              <div className="flex gap-2"><Pill tone={procTone(r.processing_status)}>{r.processing_status}</Pill><span className="text-xs text-muted-foreground">{r.event_timestamp}</span></div>
            </SheetHeader>
            <Section title="Revenue Summary">
              <KV rows={[
                ["Revenue type", r.revenue_type],
                ["Object type", r.revenue_object_type],
                ["Gross revenue", fmtMoney(r.gross_revenue)],
                ["Adjustments", fmtMoney(-(r.refund_amount + r.credit_amount + r.other_adjustments))],
                ["Net revenue", fmtMoney(r.net_revenue)],
                ["Currency", r.currency],
              ]} />
            </Section>
            <Section title="Lifecycle">
              <KV rows={[
                ["Estimated revenue", fmtMoney(r.estimated_revenue)],
                ["Earned revenue", fmtMoney(r.earned_revenue)],
                ["Invoiced revenue", fmtMoney(r.invoiced_revenue)],
                ["Received revenue", fmtMoney(r.received_revenue)],
              ]} />
            </Section>
            <Section title="Attribution">
              <KV rows={[["Session", r.session_id], ["Lead", r.lead_id], ["Order", r.order_id], ["Customer", r.customer_id], ["Transaction", r.transaction_id], ["Conversation", r.conversation_id]]} />
            </Section>
            <Section title="Source">
              <KV rows={[["Source name", sourceName(r.source_id)], ["Source row", r.source_row_id], ["Source event", r.source_event_id], ["Row hash", r.source_row_hash]]} />
              <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setRaw(true)}><FileText className="h-4 w-4" /> View Full Source Row</Button>
            </Section>
            <Section title="Lineage">
              <div className="flex flex-col items-center gap-1 text-sm">
                {[["Source Row", r.source_row_id], ["Revenue Processing", r.pipeline_run], ["Unified Revenue", r.revenue_summary_id]].map(([l, d], i) => (
                  <div key={l} className="flex w-full flex-col items-center gap-1">
                    {i > 0 && <ArrowDown className="h-4 w-4 text-muted-foreground" />}
                    <div className="w-full rounded-lg border border-border bg-card px-3 py-2 text-center">
                      <div className="font-medium">{l}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}
      </SheetContent>
    </Sheet>
    </>
  );
}

function SourceRowDialog({ record: r, open, onClose }: { record: RevenueRecord; open: boolean; onClose: () => void }) {
  const original = {
    event_id: r.source_event_id, amount: r.gross_revenue, refund: r.refund_amount, credit: r.credit_amount,
    currency: r.currency, lead_ref: r.lead_id, order_ref: r.order_id, customer_ref: r.customer_id,
    transaction_ref: r.transaction_id, session_ref: r.session_id || null, event_time: r.event_timestamp, product_type: r.revenue_type,
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Source row · <span className="font-mono">{r.source_row_id}</span></DialogTitle></DialogHeader>
        <Section title="Source identifier">
          <KV rows={[["Source", sourceName(r.source_id)], ["Source ID", r.source_id], ["Source event ID", r.source_event_id], ["Source row ID", r.source_row_id]]} />
        </Section>
        <Section title="Source metadata">
          <KV rows={[["Row URI", <span className="font-mono text-xs">{r.source_row_uri}</span>], ["Row hash", r.source_row_hash], ["Pipeline run", r.pipeline_run], ["Ingested at", r.created_at], ["Updated at", r.updated_at], ["Tenant", r.tenant_id]]} />
        </Section>
        <Section title="Original source fields">
          <KV rows={Object.entries(original).map(([k, v]) => [k, <span className="font-mono text-xs">{v === null ? "null" : String(v)}</span>])} />
        </Section>
        <Section title="Raw record">
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px]">{JSON.stringify({ ...original, _uri: r.source_row_uri, _hash: r.source_row_hash }, null, 2)}</pre>
        </Section>
      </DialogContent>
    </Dialog>
  );
}
