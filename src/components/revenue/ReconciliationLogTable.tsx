import { CheckCircle2, CircleAlert } from "lucide-react";
import type { ReconciliationLogRow } from "@/lib/reconciliationLog";

const usd = (value: number | null) => value == null ? "—" : value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const count = (value: number | null) => value == null ? "—" : value.toLocaleString("en-US");
const sourceLabel = (source: string) => source === "homelight" ? "HomeLight" : source === "phonexa" ? "Phonexa" : source === "uct" ? "UCT" : source;
const when = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? `${date.toLocaleString("en-US", { timeZone: "UTC" })} UTC` : value;
};

export function ReconciliationLogTable({ rows }: { rows: ReconciliationLogRow[] }) {
  return (
    <section aria-label="Reconciliation log" className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Reconciliation log</h2>
        <p className="mt-1 text-xs text-muted-foreground">Each Check writes a row here. A date with no missing leads is saved and not checked again.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Date reconciled</th>
              <th scope="col" className="px-4 py-3 font-medium">Source</th>
              <th scope="col" className="px-4 py-3 font-medium">Checked on</th>
              <th scope="col" className="px-4 py-3 font-medium">Result</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Leads</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Missing leads</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Difference</th>
              <th scope="col" className="px-4 py-3 font-medium">Locked</th>
              <th scope="col" className="px-4 py-3 font-medium">How</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono tabular-nums">{row.period_kind === "range" ? `through ${row.date_reconciled}` : row.date_reconciled}</td>
                <td className="px-4 py-3">{sourceLabel(row.source)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{when(row.checked_at)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${row.result === "matched" ? "text-success" : "text-destructive"}`}>
                    {row.result === "matched" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
                    {row.result === "matched" ? "All leads loaded" : row.result === "failed" ? "Failed" : "Missing leads"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-xs">{count(row.source_leads)} / {count(row.loaded_leads)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-xs" title={row.missing?.map((lead) => lead.lead_id).join(", ") || undefined}>{count(row.missing_leads ?? row.missing?.length ?? null)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{usd(row.difference)}</td>
                <td className="px-4 py-3 text-xs">{row.locked ? "Yes · never again" : "No"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{row.how}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-xs">{usd(row.cost_usd)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-muted-foreground">No dates have been checked yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
