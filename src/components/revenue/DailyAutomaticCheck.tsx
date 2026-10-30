import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, Td, Pill } from "@/components/identity/bits";
import { dailyDetailColumns, dailyDetailCsv, dailyDetailRows, dailyReportStatus, getDailyReport, type DailyLead } from "@/lib/reconciliationDaily";

const money = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-US", { style: "currency", currency: "USD" }) : "—";
const count = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-US") : "—";
const label = (key: string) => ({ lead_id: "Lead id", session_id: "Session id", revenue: "Revenue", source_revenue: "Source", loaded_revenue: "Loaded" })[key] ?? key.replaceAll("_", " ");
const runTime = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? `${date.toLocaleString("en-US", { timeZone: "UTC" })} UTC` : value;
};

function DailyDetails({ rows, kind, filename }: { rows?: DailyLead[]; kind: "missing" | "different"; filename: string }) {
  const displayed = dailyDetailRows(rows);
  const columns = dailyDetailColumns(displayed, kind);
  const download = () => {
    const url = URL.createObjectURL(new Blob([dailyDetailCsv(rows ?? [], columns)], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
  };
  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{kind === "missing" ? "Missing" : "Different"}</h3><Button variant="outline" size="sm" onClick={download}><Download />CSV</Button></div>
    <div className="overflow-x-auto rounded-lg border border-border"><DataTable head={columns.map(label)} align={columns.map((key) => /revenue|difference/.test(key) ? "right" : "left")}>
      {displayed.map((row, index) => <tr key={index}>{columns.map((key) => <Td key={key} mono right={/revenue|difference/.test(key)} className="break-all">{/revenue|difference/.test(key) && typeof row[key] === "number" ? money(row[key]) : row[key] == null ? "—" : typeof row[key] === "object" ? JSON.stringify(row[key]) : String(row[key])}</Td>)}</tr>)}
      {!displayed.length && <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-muted-foreground">No {kind === "missing" ? "missing leads" : "amount mismatches"} were returned.</td></tr>}
    </DataTable></div>
    <p className="text-xs text-muted-foreground">showing up to 200 rows</p>
  </div>;
}

export function DailyAutomaticCheck() {
  const [mounted, setMounted] = useState(false);
  const [date, setDate] = useState("latest");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  useEffect(() => setMounted(true), []);
  const query = useQuery({ queryKey: ["reconciliation-daily", date], queryFn: ({ signal }) => getDailyReport(date === "latest" ? "" : date, signal), enabled: mounted, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false, staleTime: 60_000 });
  useEffect(() => {
    if (query.data?.available_dates.length) setAvailableDates(query.data.available_dates);
  }, [query.data]);
  const report = query.data;
  const status = report ? dailyReportStatus(report) : "";
  const matched = status === "All sources match";
  return <section aria-label="Daily automatic check" className="mx-6 mb-6 space-y-3 border-b border-border pb-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-sm font-semibold">Daily automatic check</h2>
      <Select value={date} onValueChange={(value) => { setDate(value); setExpanded({}); }}>
        <SelectTrigger aria-label="Daily report date" className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="latest">Latest report</SelectItem>{availableDates.map((day) => <SelectItem key={day} value={day}>{day}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    <div aria-live="polite">
      {query.isFetching ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading daily report…</p> : query.isError ? <p role="alert" className="text-xs text-destructive">{query.error.message}</p> : report === null ? <p className="text-xs text-muted-foreground">No report exists {date === "latest" ? "yet" : `for ${date}`}.</p> : report ? <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className={`inline-flex items-center gap-2 font-medium ${matched ? "text-success" : "text-destructive"}`}>{matched ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}{status}</span>
        <span className="text-muted-foreground">{report.start} – {report.end} · UTC (end exclusive)</span><span className="text-muted-foreground">Last run: {runTime(report.run_at)}</span>
      </div> : null}
    </div>
    {report && !query.isFetching && !query.isError && report.sources.map((source, index) => <div key={`${source.label}:${index}`} className="border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <span className="font-medium">{source.label}</span><Pill tone={source.status === "matched" ? "success" : "danger"}>{source.status}</Pill>
        <span className="text-muted-foreground">Leads (source / loaded): <span className="font-mono text-foreground">{count(source.source_leads)} / {count(source.loaded_leads)}</span></span>
        <span className="text-muted-foreground">Revenue (source / loaded): <span className="font-mono text-foreground">{money(source.source_revenue)} / {money(source.loaded_revenue)}</span></span>
        <span className="text-muted-foreground">Difference: <span className={`font-mono ${source.status === "difference" ? "text-destructive" : "text-foreground"}`}>{money(source.difference)}</span></span>
        {source.status === "difference" && <Button variant="link" size="sm" className="h-auto px-0 py-0 text-xs" aria-expanded={!!expanded[index]} aria-controls={`daily-details-${index}`} onClick={() => setExpanded((current) => ({ ...current, [index]: !current[index] }))}>{expanded[index] ? "Hide details" : "View details"}</Button>}
      </div>
      {source.error && <p className="mt-2 break-words text-xs text-destructive">{source.error}</p>}
      {source.status === "difference" && expanded[index] && <div id={`daily-details-${index}`} className="mt-4 space-y-4">
        <DailyDetails kind="missing" rows={source.missing} filename={`daily-${date}-${index}-missing.csv`} />
        <DailyDetails kind="different" rows={source.different} filename={`daily-${date}-${index}-different.csv`} />
      </div>}
    </div>)}
  </section>;
}