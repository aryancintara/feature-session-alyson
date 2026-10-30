import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Pill } from "@/components/identity/bits";
import { CopyBtn } from "@/components/cost-revenue/bits";
import { cn } from "@/lib/utils";
import { eventStatusTone, money, srcLabel, typeTone, useCRRules, type CREvent } from "@/lib/costRevenueData";

/** Session view built only from events already loaded for that session ID. */
export function SessionPanel({ sessionId, events, onClose, onShowInTable, onOpenEvent }: {
  sessionId: string | null; events: CREvent[]; onClose: () => void; onShowInTable: (sid: string) => void; onOpenEvent: (e: CREvent) => void;
}) {
  const rules = useCRRules();
  const rows = sessionId ? events.filter((e) => e.sessionId === sessionId) : [];
  const ok = rows.filter((e) => e.status === "Processed");
  const revRows = rows.filter((e) => e.type === "REVENUE");
  const costRows = rows.filter((e) => e.type === "COST");
  const rev = ok.filter((e) => e.type === "REVENUE").reduce((s, e) => s + e.amount, 0);
  const cost = ok.filter((e) => e.type === "COST").reduce((s, e) => s + e.amount, 0);
  const net = rev - cost;
  const name = (id: string) => rules.find((r) => r.id === id)?.name ?? id;
  return (
    <Sheet open={!!sessionId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full max-w-full overflow-y-auto sm:max-w-lg">
        {sessionId && (
          <div className="min-w-0 space-y-4">
            <SheetHeader>
              <SheetTitle className="flex items-center font-mono text-base">{sessionId}<CopyBtn value={sessionId} label="Session ID" /></SheetTitle>
              <p className="text-xs text-muted-foreground">{rows.length} event{rows.length === 1 ? "" : "s"} in the loaded data. Totals count processed rows only.</p>
            </SheetHeader>
            {revRows.length > 0 && costRows.length > 0 && (
              <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium tabular-nums">Spend {money(cost)} → Earned {money(rev)} → Net <span className={net > 0 ? "text-success" : net < 0 ? "text-destructive" : ""}>{money(net)}</span></p>
            )}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border p-3"><div className="text-[11px] text-muted-foreground">Revenue</div><div className="font-semibold tabular-nums">{revRows.length ? money(rev) : "—"}</div></div>
              <div className="rounded-lg border border-border p-3"><div className="text-[11px] text-muted-foreground">Cost</div><div className="font-semibold tabular-nums">{costRows.length ? money(cost) : "—"}</div></div>
              <div className="rounded-lg border border-border p-3"><div className="text-[11px] text-muted-foreground">Net</div><div className={cn("font-semibold tabular-nums", net > 0 ? "text-success" : net < 0 ? "text-destructive" : "")}>{money(net)}</div></div>
            </div>
            {!costRows.length && <p className="text-xs text-muted-foreground">No cost rows for this session in the loaded data.</p>}
            {!revRows.length && <p className="text-xs text-muted-foreground">No revenue rows for this session in the loaded data.</p>}
            <div className="divide-y divide-border rounded-lg border border-border text-sm">
              {rows.map((e) => (
                <button key={e.id} type="button" onClick={() => onOpenEvent(e)} className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left hover:bg-muted/40">
                  <Pill tone={typeTone(e.type)}>{e.type}</Pill>
                  <span className="text-muted-foreground">{srcLabel(e.source)}</span>
                  <span className="ml-auto font-medium tabular-nums">{money(e.amount)}</span>
                  <span className="w-full text-xs text-muted-foreground">{name(e.ruleId)} · v{e.ruleVersion} · <Pill tone={eventStatusTone(e.status)}>{e.status}</Pill></span>
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => onShowInTable(sessionId)}>Show in table</Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
