// Previous reconciliation UI, kept so this version can be restored.
// import { CR_EVENTS } from "@/lib/costRevenueData";
// import { useEffect, useState } from "react";
// import { createFileRoute, Link } from "@tanstack/react-router";
// import { PageHeader } from "@/components/ui-bits";
// import { TenantSelect } from "@/components/revenue/RevenueBits";
// import { TableSkeleton } from "@/components/identity/skeletons";
// import { Pager } from "@/components/identity/Pager";
// import { Pill } from "@/components/identity/bits";
// import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { listRules, previewReconcile, errMsg, isActive, type ApiRule, type ReconcilePreviewRow, type ReconcileSummary } from "@/lib/rulesApi";
// import { cn } from "@/lib/utils";
// 
// const PAGE_SIZE = 50;
// 
// export const Route = createFileRoute("/cost-revenue/reconciliation")({
//   head: () => ({
//     meta: [
//       { title: "Reconciliation · Cost & Revenue · Alyson CDP" },
//       { name: "description", content: "Preview recalculated cost and revenue amounts from the current source rows. Nothing is saved." },
//       { property: "og:title", content: "Reconciliation · Cost & Revenue · Alyson CDP" },
//       { property: "og:description", content: "Preview recalculated cost and revenue amounts from the current source rows. Nothing is saved." },
//       { property: "og:type", content: "website" },
//       { name: "twitter:card", content: "summary" },
//     ],
//   }),
//   component: Reconciliation,
// });
// 
// const SOURCES = [
//   { id: "homelight", label: "HomeLight" },
//   { id: "tune", label: "Tune" },
// ];
// 
// const currentMonth = () => new Date().toISOString().slice(0, 7);
// const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
// const num = (v: unknown): number | null => {
//   if (typeof v === "number" && Number.isFinite(v)) return v;
//   if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
//   return null;
// };
// const count = (v: unknown) => num(v) ?? 0;
// const usd0 = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
// // Result tiles never show "Not set": empty money reads $0.00.
// const money = (v: unknown) => usd(num(v) ?? 0);
// const signedMoney = (v: unknown) => { const n = num(v) ?? 0; return n > 0 ? `+${usd(n)}` : n < 0 ? `−${usd(-n)}` : usd(0); };
// const rowDelta = (r: ReconcilePreviewRow) => { const st = num(r.stored_amount); const c = num(r.calculated_amount); return num(r.delta) ?? (st === null ? null : c !== null ? Math.round((c - st) * 100) / 100 : null); };
// const rowDomId = (id: string) => `recon-row-${id}`;
// const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
// const eventDates = CR_EVENTS.map((e) => e.processedAt.slice(0, 10)).filter(Boolean).sort();
// const evFirst = eventDates[0] ?? "";
// const evLast = eventDates[eventDates.length - 1] ?? "";
// const evMonths = [...new Set(eventDates.map((d) => d.slice(0, 7)))];
// export const LAST_RUN_KEY = "cost-revenue-last-run:v1";
// 
// function Kpi({ label, value, tone, placeholder }: { label: string; value: string; tone?: "good" | "bad" | "muted"; placeholder?: boolean }) {
//   return (
//     <div className={cn("rounded-xl border border-border p-3", placeholder ? "bg-muted/30" : "bg-card")}>
//       <p className="text-[11px] text-muted-foreground">{label}</p>
//       <p className={cn("mt-1 font-mono text-lg font-semibold", tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : tone === "muted" || placeholder ? "text-muted-foreground" : "text-foreground")}>{value}</p>
//     </div>
//   );
// }
// 
// const STAGES = [
//   { n: 1, label: "Initial calculation", enabled: true },
//   { n: 2, label: "Coming soon", enabled: false },
//   { n: 3, label: "Coming soon", enabled: false },
// ];
// 
// const SOURCE_NAMES: Record<string, string> = { homelight: "HomeLight", tune: "Tune" };
// 
// function Step({ n, title, children, muted }: { n: number; title: string; children: React.ReactNode; muted?: boolean }) {
//   return (
//     <section className="relative flex gap-4">
//       <div className="flex flex-col items-center">
//         <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", muted ? "border border-border bg-muted text-muted-foreground" : "bg-primary text-primary-foreground")}>{n}</span>
//         <span className="mt-1 w-px flex-1 bg-border" />
//       </div>
//       <div className="mb-4 min-w-0 flex-1 space-y-3 rounded-xl border border-border bg-card p-4">
//         <h2 className="text-sm font-semibold text-foreground">Step {n} · {title}</h2>
//         {children}
//       </div>
//     </section>
//   );
// }
// 
// function FinalRevenueForm() {
//   const [start, setStart] = useState("");
//   const [end, setEnd] = useState("");
//   const [source, setSource] = useState("homelight");
//   const [locked, setLocked] = useState("Revenue");
//   const [amount, setAmount] = useState("");
//   const [note, setNote] = useState("");
//   const [touched, setTouched] = useState(false);
//   const [confirm, setConfirm] = useState(false);
// 
//   const field = "rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring";
//   const n = Number(amount);
//   const amountOk = amount.trim() !== "" && Number.isFinite(n) && n > 0;
//   const orderOk = !start || !end || end >= start;
//   const ready = !!start && !!end && amountOk && orderOk;
//   const hint = (msg: string | false) => msg ? <span className="mt-1 block text-[11px] text-destructive">{msg}</span> : null;
// 
//   return (
//     <div className="space-y-3" onFocusCapture={() => setTouched(true)}>
//       <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
//         <label className="text-[11px] text-muted-foreground">Start date
//           <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={cn(field, "mt-1 block w-full")} />
//           {hint(touched && !start && "Pick a start date.")}
//         </label>
//         <label className="text-[11px] text-muted-foreground">End date
//           <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={cn(field, "mt-1 block w-full")} />
//           {hint(touched && (!end ? "Pick an end date." : !orderOk && "End date must be on or after the start date."))}
//         </label>
//         <label className="text-[11px] text-muted-foreground">Source
//           <select value={source} onChange={(e) => setSource(e.target.value)} className={cn(field, "mt-1 block w-full")}>
//             <option value="homelight">HomeLight</option>
//             <option value="tune">Tune</option>
//           </select>
//         </label>
//         <label className="text-[11px] text-muted-foreground">What is being locked
//           <select value={locked} onChange={(e) => setLocked(e.target.value)} className={cn(field, "mt-1 block w-full")}>
//             <option>Revenue</option>
//             <option>Cost</option>
//           </select>
//         </label>
//         <label className="text-[11px] text-muted-foreground">Final amount (USD)
//           <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={cn(field, "mt-1 block w-full")} />
//           {hint(touched && !amountOk && "Enter a final amount greater than 0.")}
//         </label>
//         <label className="text-[11px] text-muted-foreground sm:col-span-2 lg:col-span-1">Note (optional)
//           <input type="text" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" className={cn(field, "mt-1 block w-full")} />
//         </label>
//       </div>
//       <Button size="sm" disabled={!ready} onClick={() => setConfirm(true)}>Lock this amount</Button>
//       <p className="text-[11px] text-muted-foreground">Not saved yet. Locking will work once the lock API is connected. When it works, a locked amount overrides rule results for that date range.</p>
//       <Dialog open={confirm} onOpenChange={setConfirm}>
//         <DialogContent>
//           <DialogHeader><DialogTitle>Lock this amount?</DialogTitle></DialogHeader>
//           <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
//             <dt className="text-muted-foreground">Time period</dt><dd className="font-mono">{start} through {end}</dd>
//             <dt className="text-muted-foreground">Source</dt><dd>{SOURCE_NAMES[source] ?? source}</dd>
//             <dt className="text-muted-foreground">What is being locked</dt><dd>{locked}</dd>
//             <dt className="text-muted-foreground">Final amount</dt><dd className="font-mono">{amountOk ? usd(n) : "—"}</dd>
//             <dt className="text-muted-foreground">Note</dt><dd>{note.trim() || "—"}</dd>
//           </dl>
//           <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">Not saved yet. The lock API isn't connected.</p>
//           <DialogFooter><Button variant="outline" size="sm" onClick={() => setConfirm(false)}>Close</Button></DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// }
// 
// 
// // Previous reconciliation UI, kept so this version can be restored.
// // function Reconciliation() {
// //   const [month, setMonth] = useState(currentMonth);
// //   const [source, setSource] = useState(SOURCES[0].id);
// //   const [ruleKey, setRuleKey] = useState("");
// //   const ruleId = ruleKey.split("@")[0] ?? "";
// //   const [rules, setRules] = useState<ApiRule[]>([]);
// //   const [rulesState, setRulesState] = useState<"loading" | "ok" | "error">("loading");
// //   const [state, setState] = useState<"idle" | "loading" | "error" | "done">("idle");
// //   const [rows, setRows] = useState<ReconcilePreviewRow[]>([]);
// //   const [shown, setShown] = useState(0);
// //   const [page, setPage] = useState(1);
// //   const [summary, setSummary] = useState<ReconcileSummary | null>(null);
// //   const [error, setError] = useState<string | null>(null);
// // 
// //   useEffect(() => {
// //     listRules().then((r) => { setRules(r); setRulesState("ok"); }).catch(() => { setRules([]); setRulesState("error"); });
// //   }, []);
// // 
// //   const allSourceRules = rules.filter((r) => r.source_id === source);
// //   // Month window for availability: a version is available only if its dates overlap the selected month.
// //   const mStart = month ? `${month}-01` : "";
// //   const mEnd = month ? new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10) : "";
// //   const monthName = month ? new Date(`${month}-01T00:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : "";
// //   const fromD = (r: ApiRule) => r.effective_from?.slice(0, 10) || "";
// //   const toD = (r: ApiRule) => r.effective_to?.slice(0, 10) || "";
// //   const endedBefore = (r: ApiRule) => !!toD(r) && !!mStart && toD(r) < mStart;
// //   const startsAfter = (r: ApiRule) => !!fromD(r) && !!mEnd && fromD(r) > mEnd;
// //   const inMonth = (r: ApiRule) => !endedBefore(r) && !startsAfter(r);
// //   const byVer = (a: ApiRule, b: ApiRule) => b.rule_version - a.rule_version || a.name.localeCompare(b.name);
// //   const activeRules = allSourceRules.filter((r) => isActive(r.status));
// //   const sourceRules = activeRules.filter(inMonth).sort(byVer);
// //   const unavailable = activeRules.filter((r) => !inMonth(r)).sort(byVer);
// //   const latestVer = new Map<string, number>();
// //   for (const r of allSourceRules) latestVer.set(r.rule_id, Math.max(latestVer.get(r.rule_id) ?? 0, r.rule_version));
// //   const keyOf = (r: ApiRule) => `${r.rule_id}@${r.rule_version}`;
// //   const pickDefault = (list: ApiRule[]) => { const r = list.find((x) => !x.effective_to); return r ? keyOf(r) : ""; };
// //   useEffect(() => {
// //     if (rulesState !== "ok") return;
// //     if (!ruleKey || !sourceRules.some((r) => keyOf(r) === ruleKey)) setRuleKey(pickDefault(sourceRules) || (sourceRules[0] ? keyOf(sourceRules[0]) : ""));
// //     // eslint-disable-next-line react-hooks/exhaustive-deps
// //   }, [rulesState, source, month]);
// //   const selRule = sourceRules.find((r) => keyOf(r) === ruleKey);
// // 
// //   const clearRun = () => { setPage(1); setState("idle"); setRows([]); setSummary(null); setError(null); };
// //   const changeSource = (s: string) => { setSource(s); setRuleKey(""); clearRun(); };
// //   const changeRule = (r: string) => { setRuleKey(r); clearRun(); };
// //   const canRun = !!month && !!ruleId && state !== "loading";
// // 
// //   const run = async () => {
// //     if (!month || !ruleId) return;
// //     setState("loading");
// //     setError(null);
// //     try {
// //       const res = await previewReconcile(month, source, ruleId);
// //       setRows(res.rows ?? []); setPage(1);
// //       setShown(typeof res.shown === "number" ? res.shown : (res.rows ?? []).length);
// //       setSummary(res.summary ?? null);
// //       try {
// //         sessionStorage.setItem(LAST_RUN_KEY, JSON.stringify({
// //           rule: selRule?.name ?? ruleId, version: selRule?.rule_version ?? null, month, source,
// //           matched: count(res.summary?.matched ?? (res.rows ?? []).length), net_change: num(res.summary?.net_change) ?? 0,
// //           stored_total: num(res.summary?.stored_total), calculated_total: num(res.summary?.calculated_on_stored), source_label: SOURCE_NAMES[source] ?? source, at: new Date().toISOString(),
// //         }));
// //       } catch { /* ignore */ }
// //       setState("done");
// //     } catch (e) {
// //       setError(errMsg(e));
// //       setState("error");
// //     }
// //   };
// // 
// //   const input = "rounded-md border border-border bg-background px-2 py-1 text-xs";
// //   const net = num(summary?.net_change);
// //   const has = state === "done" && !!summary;
// //   const kpis: [string, string, ("good" | "bad" | "muted")?][] = has && summary ? [
// //     ["Records matched", count(summary.matched).toLocaleString()],
// //     ["Not stored yet", count(summary.not_stored).toLocaleString()],
// //     ["Unchanged", count(summary.unchanged).toLocaleString()],
// //     ["Increases", count(summary.increased).toLocaleString(), "good"],
// //     ["Decreases", count(summary.decreased).toLocaleString(), "bad"],
// //     ["Net change", signedMoney(summary.net_change), !net ? "muted" : net > 0 ? "good" : "bad"],
// //     ["Stored total", money(summary.stored_total)],
// //     ["Recalculated total", money(summary.calculated_on_stored)],
// //   ] : ["Records matched", "Not stored yet", "Unchanged", "Increases", "Decreases", "Net change", "Stored total", "Recalculated total"].map((l) => [l, "—"]);
// // 
// //   const sorted = [...rows].sort((a, b) => Math.abs(rowDelta(b) ?? 0) - Math.abs(rowDelta(a) ?? 0));
// //   const biggest = sorted.filter((r) => (rowDelta(r) ?? 0) !== 0).slice(0, 5);
// //   const [flash, setFlash] = useState<string | null>(null);
// //   const jumpTo = (id: string) => {
// //     const i = sorted.findIndex((r) => r.source_record_id === id);
// //     if (i < 0) return;
// //     setPage(Math.floor(i / PAGE_SIZE) + 1); setFlash(id);
// //     setTimeout(() => document.getElementById(rowDomId(id))?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
// //     setTimeout(() => setFlash(null), 2000);
// //   };
// // 
// //   return (
// //     <div className="pb-10">
// //       <PageHeader title="Reconciliation" subtitle="Preview recalculated amounts from the current source rows." actions={<TenantSelect />} />
// //       <div className="px-6">
// //         <div className="mb-4 flex flex-wrap items-center gap-2">
// //           {STAGES.map((s) => (
// //             <span key={s.n} title={s.enabled ? undefined : "Coming soon. This stage is not available yet."} aria-disabled={!s.enabled}
// //               className={cn("rounded-full border px-3 py-1 text-[11px] font-medium", s.enabled ? "border-primary/40 bg-primary/10 text-primary" : "cursor-not-allowed border-dashed border-border bg-muted/40 text-muted-foreground/70")}>
// //               Stage {s.n} · {s.enabled ? s.label : "Coming soon"}
// //             </span>
// //           ))}
// //           <span className="text-[11px] text-muted-foreground">Preview only. Source tables are not changed.</span>
// //         </div>
// // 
// //         <Step n={1} title="Month & source">
// //           <div className="flex flex-wrap items-end gap-3">
// //             <label className="text-[11px] text-muted-foreground">Month
// //               <input type="month" value={month} onChange={(e) => { setMonth(e.target.value); clearRun(); }} className={cn(input, "mt-1 block text-foreground")} />
// //               {evMonths.length > 0 && <span className="mt-1 block text-[11px] text-muted-foreground">Events available: {evMonths.map(monthLabel).join(", ")}</span>}
// //             </label>
// //             <label className="text-[11px] text-muted-foreground">Source
// //               <select value={source} onChange={(e) => changeSource(e.target.value)} className={cn(input, "mt-1 block text-foreground")}>
// //                 {SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
// //               </select>
// //             </label>
// //           </div>
// //         </Step>
// // 
// //         <Step n={2} title="Rule">
// //           <label className="text-[11px] text-muted-foreground">Active rule
// //             <select value={ruleKey} onChange={(e) => changeRule(e.target.value)} className={cn(input, "mt-1 block min-w-56 text-foreground")}>
// //               <option value="">Select a rule…</option>
// //               {sourceRules.map((r) => <option key={keyOf(r)} value={keyOf(r)}>{r.name} ({r.rule_id} · v{r.rule_version}){latestVer.get(r.rule_id) === r.rule_version ? " (latest)" : ""}</option>)}
// //               {unavailable.map((r) => <option key={keyOf(r)} value={keyOf(r)} disabled>{r.name} ({r.rule_id} · v{r.rule_version}) (not active in {monthName})</option>)}
// //             </select>
// //           </label>
// //           {rulesState === "loading" ? <TableSkeleton cols={4} rows={3} />
// //             : rulesState === "error" ? <p className="text-xs text-destructive">Rules could not be loaded. Reload the page to try again.</p>
// //             : !allSourceRules.length ? <p className="text-xs text-muted-foreground">No rules for {SOURCE_NAMES[source] ?? source}. Create one in <Link to="/cost-revenue/rules" className="text-primary underline">Rules</Link>.</p>
// //             : (
// //               <>
// //               {!sourceRules.length && <p className="text-xs text-warning">No rule covers {monthName} for {SOURCE_NAMES[source] ?? source}. Pick another month or check <Link to="/cost-revenue/rules" className="text-primary underline">Rules</Link>.</p>}
// //               <div className="overflow-x-auto rounded-lg border border-border">
// //                 <table className="w-full text-left text-xs">
// //                   <thead className="bg-muted/40 text-muted-foreground"><tr>{["Rule", "Version", "Status", "Start date", "End date"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
// //                   <tbody>
// //                     {allSourceRules.map((r) => (
// //                       <tr key={`${r.rule_id}@${r.rule_version}`} className="border-t border-border">
// //                         <td className="px-3 py-2">{r.name} <span className="font-mono text-muted-foreground">{r.rule_id}</span></td>
// //                         <td className="px-3 py-2">v{r.rule_version}</td>
// //                         <td className="px-3 py-2">{endedBefore(r) ? <Pill tone="neutral">Ended {toD(r)}</Pill> : startsAfter(r) ? <Pill tone="neutral">Starts {fromD(r)}</Pill> : <Pill tone={isActive(r.status) ? "success" : "neutral"}>{isActive(r.status) ? "Active · can be used" : "Inactive · not available"}</Pill>}</td>
// //                         <td className="px-3 py-2 font-mono">{r.effective_from?.slice(0, 10) || "—"}</td>
// //                         <td className="px-3 py-2 font-mono">{r.effective_to?.slice(0, 10) || "—"}</td>
// //                       </tr>
// //                     ))}
// //                   </tbody>
// //                 </table>
// //               </div>
// //               </>
// //             )}
// //         </Step>
// // 
// //         <Step n={3} title="Run & review">
// //           {has && summary && (
// //             <div className="sticky top-0 z-10 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-sm">
// //               <span className="font-medium">{monthName} · {SOURCE_NAMES[source] ?? source} · {selRule?.name ?? ruleId}{selRule ? ` v${selRule.rule_version}` : ""}</span>
// //               <span className="text-muted-foreground"> — Stored </span><span className="font-semibold tabular-nums">{money(summary.stored_total)}</span>
// //               <span className="text-muted-foreground"> → Recalculated </span><span className="font-semibold tabular-nums">{money(summary.calculated_on_stored)}</span>
// //               <span className={cn("tabular-nums", !net ? "text-muted-foreground" : net > 0 ? "text-success" : "text-destructive")}> (Δ {signedMoney(summary.net_change)})</span>
// //             </div>
// //           )}
// //           <Button size="sm" variant={ruleId ? "default" : "outline"} onClick={run} disabled={!canRun}>Run calculation</Button>
// //           <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
// //             {kpis.map(([l, v, t]) => <Kpi key={l} label={l} value={v} tone={t} placeholder={!has} />)}
// //           </div>
// //           {!has && <p className="text-[11px] text-muted-foreground">Run the calculation to fill these in. Nothing is saved.</p>}
// //           <div className="rounded-xl border border-border">
// //             {state === "done" && biggest.length > 0 && (
// //               <div className="border-b border-border p-3">
// //                 <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Biggest changes</div>
// //                 <div className="flex flex-wrap gap-2">
// //                   {biggest.map((r) => { const d = rowDelta(r) ?? 0; return (
// //                     <button key={r.source_record_id} type="button" onClick={() => jumpTo(r.source_record_id)} className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
// //                       <span className="max-w-40 truncate font-mono">{r.source_record_id}</span>
// //                       <span className={cn("font-semibold tabular-nums", d > 0 ? "text-success" : "text-destructive")}>{signedMoney(d)}</span>
// //                     </button>
// //                   ); })}
// //                 </div>
// //               </div>
// //             )}
// //             {state === "done" && (
// //               <div className="border-b border-border p-3">
// //                 <span className="text-[11px] text-muted-foreground">{shown} rows returned{shown >= 200 ? " (first 200 shown)" : ""} · showing {rows.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, rows.length)}</span>
// //               </div>
// //             )}
// //             <div className="overflow-x-auto">
// //               {state === "idle" && <p className="py-12 text-center text-sm text-muted-foreground">{selRule ? `Ready to run: ${selRule.name} v${selRule.rule_version} · ${SOURCE_NAMES[source] ?? source} · ${monthName}. Press Run calculation. Nothing is saved.` : "Pick a rule in Step 2."}</p>}
// //               {state === "error" && <p className="px-6 py-12 text-center text-sm text-destructive">{error ?? "The calculation could not be run."} Try again, or pick another rule.</p>}
// //               {(state === "loading" || state === "done") && (
// //                 <table className="w-full min-w-[720px] text-left text-xs">
// //                   <thead className="bg-muted/40 text-muted-foreground"><tr>
// //                     {["Record", "Rule", "Stored", "Recalculated", "Difference"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
// //                   </tr></thead>
// //                   <tbody>
// //                     {state === "loading" ? <TableSkeleton cols={5} rows={8} /> : sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => {
// //                       const stored = num(r.stored_amount);
// //                       const calculated = num(r.calculated_amount);
// //                       const delta = num(r.delta) ?? (stored === null ? null : calculated !== null ? Math.round((calculated - stored) * 100) / 100 : null);
// //                       const notStored = stored === null;
// //                       const tone = delta === null || delta === 0 || notStored ? "text-muted-foreground" : delta < 0 ? "text-destructive" : "text-success";
// //                       return (
// //                         <tr key={r.source_record_id} id={rowDomId(r.source_record_id)} className={cn("border-t border-border transition-colors", flash === r.source_record_id && "bg-primary/10")}>
// //                           <td className="px-3 py-2 font-mono">{r.source_record_id}</td>
// //                           <td className="px-3 py-2 font-mono">{r.rule_id} · v{r.rule_version}</td>
// //                           <td className="px-3 py-2 font-mono">{notStored ? <span className="text-muted-foreground">Not stored</span> : usd0(stored)}</td>
// //                           <td className="px-3 py-2 font-mono">{calculated === null ? <span className="text-muted-foreground">Not set</span> : usd0(calculated)}</td>
// //                           <td className={cn("px-3 py-2 font-mono", tone)}>{delta === null ? "—" : signedMoney(delta)}</td>
// //                         </tr>
// //                       );
// //                     })}
// //                     {state === "done" && !rows.length && <tr><td colSpan={5} className="py-10 text-center text-muted-foreground"><p>No {SOURCE_NAMES[source] ?? source} rows in {monthLabel(month)} matched {selRule ? `${selRule.name} v${selRule.rule_version}` : ruleId}. Nothing was changed.</p>{evFirst && <p className="mt-1">Your events run {evFirst} to {evLast}. Try {monthLabel(evLast.slice(0, 7))}, with a rule that covers that month.</p>}</td></tr>}
// //                   </tbody>
// //                 </table>
// //               )}
// //             </div>
// //             {state === "done" && rows.length > PAGE_SIZE && <Pager page={page} total={rows.length} pageSize={PAGE_SIZE} onPage={setPage} />}
// //           </div>
// //         </Step>
// // 
// //         <Step n={4} title="Lock final amount (optional)" muted>
// //           <FinalRevenueForm />
// //         </Step>
// //       </div>
// //     </div>
// //   );
// // }
// 
// // Optional attribution fields must come from the existing preview response, never from inferred joins.
// type SessionPreviewRow = ReconcilePreviewRow & {
//   utm_content?: unknown;
//   session_id?: unknown;
//   session_id_source?: unknown;
//   our_session?: unknown;
//   click_session_observations?: unknown;
// };
// 
// export function previewSessionDetails(row: SessionPreviewRow) {
//   const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
//   const sessionId = text(row.session_id);
//   const source = text(row.session_id_source);
//   // Show returned provenance as-is when the service uses an unrecognized value.
//   const labels: Record<string, string> = {
//     "utm_content is already a session id": "utm_content is already a session id",
//     "one website visit": "one website visit",
//     "click bridge": "click bridge",
//     "new session id": "new session id",
//   };
//   const observations = Array.isArray(row.click_session_observations) ? row.click_session_observations : [];
//   const otherSessions = [...new Set(observations.map((observation: unknown) => {
//     if (typeof observation === "string") return text(observation);
//     if (observation && typeof observation === "object" && "session_id" in observation) return text(observation.session_id);
//     return "";
//   }).filter((id: string) => id && id !== sessionId))];
//   return {
//     excluded: text(row.our_session).toLowerCase() === "no",
//     clickId: text(row.utm_content),
//     sessionId,
//     sessionSource: labels[source] ?? source,
//     otherSessions,
//   };
// }
// 
// function Reconciliation() {
//   const [month, setMonth] = useState(currentMonth);
//   const [source, setSource] = useState(SOURCES[0].id);
//   const [ruleKey, setRuleKey] = useState("");
//   const ruleId = ruleKey.split("@")[0] ?? "";
//   const [rules, setRules] = useState<ApiRule[]>([]);
//   const [rulesState, setRulesState] = useState<"loading" | "ok" | "error">("loading");
//   const [state, setState] = useState<"idle" | "loading" | "error" | "done">("idle");
//   const [rows, setRows] = useState<SessionPreviewRow[]>([]);
//   const [shown, setShown] = useState(0);
//   const [page, setPage] = useState(1);
//   const [summary, setSummary] = useState<ReconcileSummary | null>(null);
//   const [error, setError] = useState<string | null>(null);
// 
//   useEffect(() => {
//     listRules().then((r) => { setRules(r); setRulesState("ok"); }).catch(() => { setRules([]); setRulesState("error"); });
//   }, []);
// 
//   const allSourceRules = rules.filter((r) => r.source_id === source);
//   // Month window for availability: a version is available only if its dates overlap the selected month.
//   const mStart = month ? `${month}-01` : "";
//   const mEnd = month ? new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10) : "";
//   const monthName = month ? new Date(`${month}-01T00:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : "";
//   const fromD = (r: ApiRule) => r.effective_from?.slice(0, 10) || "";
//   const toD = (r: ApiRule) => r.effective_to?.slice(0, 10) || "";
//   const endedBefore = (r: ApiRule) => !!toD(r) && !!mStart && toD(r) < mStart;
//   const startsAfter = (r: ApiRule) => !!fromD(r) && !!mEnd && fromD(r) > mEnd;
//   const inMonth = (r: ApiRule) => !endedBefore(r) && !startsAfter(r);
//   const byVer = (a: ApiRule, b: ApiRule) => b.rule_version - a.rule_version || a.name.localeCompare(b.name);
//   const activeRules = allSourceRules.filter((r) => isActive(r.status));
//   const sourceRules = activeRules.filter(inMonth).sort(byVer);
//   const unavailable = activeRules.filter((r) => !inMonth(r)).sort(byVer);
//   const latestVer = new Map<string, number>();
//   for (const r of allSourceRules) latestVer.set(r.rule_id, Math.max(latestVer.get(r.rule_id) ?? 0, r.rule_version));
//   const keyOf = (r: ApiRule) => `${r.rule_id}@${r.rule_version}`;
//   const pickDefault = (list: ApiRule[]) => { const r = list.find((x) => !x.effective_to); return r ? keyOf(r) : ""; };
//   useEffect(() => {
//     if (rulesState !== "ok") return;
//     if (!ruleKey || !sourceRules.some((r) => keyOf(r) === ruleKey)) setRuleKey(pickDefault(sourceRules) || (sourceRules[0] ? keyOf(sourceRules[0]) : ""));
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [rulesState, source, month]);
//   const selRule = sourceRules.find((r) => keyOf(r) === ruleKey);
// 
//   const clearRun = () => { setPage(1); setState("idle"); setRows([]); setSummary(null); setError(null); };
//   const changeSource = (s: string) => { setSource(s); setRuleKey(""); clearRun(); };
//   const changeRule = (r: string) => { setRuleKey(r); clearRun(); };
//   const canRun = !!month && !!ruleId && state !== "loading";
// 
//   const run = async () => {
//     if (!month || !ruleId) return;
//     setState("loading");
//     setError(null);
//     try {
//       const res = await previewReconcile(month, source, ruleId);
//       setRows(res.rows ?? []); setPage(1);
//       setShown(typeof res.shown === "number" ? res.shown : (res.rows ?? []).length);
//       setSummary(res.summary ?? null);
//       try {
//         sessionStorage.setItem(LAST_RUN_KEY, JSON.stringify({
//           rule: selRule?.name ?? ruleId, version: selRule?.rule_version ?? null, month, source,
//           matched: count(res.summary?.matched ?? (res.rows ?? []).length), net_change: num(res.summary?.net_change) ?? 0,
//           stored_total: num(res.summary?.stored_total), calculated_total: num(res.summary?.calculated_on_stored), source_label: SOURCE_NAMES[source] ?? source, at: new Date().toISOString(),
//         }));
//       } catch { /* ignore */ }
//       setState("done");
//     } catch (e) {
//       setError(errMsg(e));
//       setState("error");
//     }
//   };
// 
//   const input = "rounded-md border border-border bg-background px-2 py-1 text-xs";
//   const net = num(summary?.net_change);
//   const has = state === "done" && !!summary;
//   const kpis: [string, string, ("good" | "bad" | "muted")?][] = has && summary ? [
//     ["Records matched", count(summary.matched).toLocaleString()],
//     ["Not stored yet", count(summary.not_stored).toLocaleString()],
//     ["Unchanged", count(summary.unchanged).toLocaleString()],
//     ["Increases", count(summary.increased).toLocaleString(), "good"],
//     ["Decreases", count(summary.decreased).toLocaleString(), "bad"],
//     ["Net change", signedMoney(summary.net_change), !net ? "muted" : net > 0 ? "good" : "bad"],
//     ["Stored total", money(summary.stored_total)],
//     ["Recalculated total", money(summary.calculated_on_stored)],
//   ] : ["Records matched", "Not stored yet", "Unchanged", "Increases", "Decreases", "Net change", "Stored total", "Recalculated total"].map((l) => [l, "—"]);
// 
//   const previewRows = rows.filter((r) => !previewSessionDetails(r).excluded);
//   const sorted = [...previewRows].sort((a, b) => Math.abs(rowDelta(b) ?? 0) - Math.abs(rowDelta(a) ?? 0));
//   const biggest = sorted.filter((r) => (rowDelta(r) ?? 0) !== 0).slice(0, 5);
//   const [flash, setFlash] = useState<string | null>(null);
//   const jumpTo = (id: string) => {
//     const i = sorted.findIndex((r) => r.source_record_id === id);
//     if (i < 0) return;
//     setPage(Math.floor(i / PAGE_SIZE) + 1); setFlash(id);
//     setTimeout(() => document.getElementById(rowDomId(id))?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
//     setTimeout(() => setFlash(null), 2000);
//   };
// 
//   return (
//     <div className="pb-10">
//       <PageHeader title="Reconciliation" subtitle="Preview recalculated amounts from the current source rows." actions={<TenantSelect />} />
//       <div className="px-6">
//         <div className="mb-4 flex flex-wrap items-center gap-2">
//           {STAGES.map((s) => (
//             <span key={s.n} title={s.enabled ? undefined : "Coming soon. This stage is not available yet."} aria-disabled={!s.enabled}
//               className={cn("rounded-full border px-3 py-1 text-[11px] font-medium", s.enabled ? "border-primary/40 bg-primary/10 text-primary" : "cursor-not-allowed border-dashed border-border bg-muted/40 text-muted-foreground/70")}>
//               Stage {s.n} · {s.enabled ? s.label : "Coming soon"}
//             </span>
//           ))}
//           <span className="text-[11px] text-muted-foreground">Preview only. Source tables are not changed.</span>
//         </div>
// 
//         <Step n={1} title="Month & source">
//           <div className="flex flex-wrap items-end gap-3">
//             <label className="text-[11px] text-muted-foreground">Month
//               <input type="month" value={month} onChange={(e) => { setMonth(e.target.value); clearRun(); }} className={cn(input, "mt-1 block text-foreground")} />
//               {evMonths.length > 0 && <span className="mt-1 block text-[11px] text-muted-foreground">Events available: {evMonths.map(monthLabel).join(", ")}</span>}
//             </label>
//             <label className="text-[11px] text-muted-foreground">Source
//               <select value={source} onChange={(e) => changeSource(e.target.value)} className={cn(input, "mt-1 block text-foreground")}>
//                 {SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
//               </select>
//             </label>
//           </div>
//         </Step>
// 
//         <Step n={2} title="Rule">
//           <label className="text-[11px] text-muted-foreground">Active rule
//             <select value={ruleKey} onChange={(e) => changeRule(e.target.value)} className={cn(input, "mt-1 block min-w-56 text-foreground")}>
//               <option value="">Select a rule…</option>
//               {sourceRules.map((r) => <option key={keyOf(r)} value={keyOf(r)}>{r.name} ({r.rule_id} · v{r.rule_version}){latestVer.get(r.rule_id) === r.rule_version ? " (latest)" : ""}</option>)}
//               {unavailable.map((r) => <option key={keyOf(r)} value={keyOf(r)} disabled>{r.name} ({r.rule_id} · v{r.rule_version}) (not active in {monthName})</option>)}
//             </select>
//           </label>
//           {rulesState === "loading" ? <TableSkeleton cols={4} rows={3} />
//             : rulesState === "error" ? <p className="text-xs text-destructive">Rules could not be loaded. Reload the page to try again.</p>
//             : !allSourceRules.length ? <p className="text-xs text-muted-foreground">No rules for {SOURCE_NAMES[source] ?? source}. Create one in <Link to="/cost-revenue/rules" className="text-primary underline">Rules</Link>.</p>
//             : (
//               <>
//               {!sourceRules.length && <p className="text-xs text-warning">No rule covers {monthName} for {SOURCE_NAMES[source] ?? source}. Pick another month or check <Link to="/cost-revenue/rules" className="text-primary underline">Rules</Link>.</p>}
//               <div className="overflow-x-auto rounded-lg border border-border">
//                 <table className="w-full text-left text-xs">
//                   <thead className="bg-muted/40 text-muted-foreground"><tr>{["Rule", "Version", "Status", "Start date", "End date"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
//                   <tbody>
//                     {allSourceRules.map((r) => (
//                       <tr key={`${r.rule_id}@${r.rule_version}`} className="border-t border-border">
//                         <td className="px-3 py-2">{r.name} <span className="font-mono text-muted-foreground">{r.rule_id}</span></td>
//                         <td className="px-3 py-2">v{r.rule_version}</td>
//                         <td className="px-3 py-2">{endedBefore(r) ? <Pill tone="neutral">Ended {toD(r)}</Pill> : startsAfter(r) ? <Pill tone="neutral">Starts {fromD(r)}</Pill> : <Pill tone={isActive(r.status) ? "success" : "neutral"}>{isActive(r.status) ? "Active · can be used" : "Inactive · not available"}</Pill>}</td>
//                         <td className="px-3 py-2 font-mono">{r.effective_from?.slice(0, 10) || "—"}</td>
//                         <td className="px-3 py-2 font-mono">{r.effective_to?.slice(0, 10) || "—"}</td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//               </>
//             )}
//         </Step>
// 
//         <Step n={3} title="Run & review">
//           {has && summary && (
//             <div className="sticky top-0 z-10 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-sm">
//               <span className="font-medium">{monthName} · {SOURCE_NAMES[source] ?? source} · {selRule?.name ?? ruleId}{selRule ? ` v${selRule.rule_version}` : ""}</span>
//               <span className="text-muted-foreground"> — Stored </span><span className="font-semibold tabular-nums">{money(summary.stored_total)}</span>
//               <span className="text-muted-foreground"> → Recalculated </span><span className="font-semibold tabular-nums">{money(summary.calculated_on_stored)}</span>
//               <span className={cn("tabular-nums", !net ? "text-muted-foreground" : net > 0 ? "text-success" : "text-destructive")}> (Δ {signedMoney(summary.net_change)})</span>
//             </div>
//           )}
//           <Button size="sm" variant={ruleId ? "default" : "outline"} onClick={run} disabled={!canRun}>Run calculation</Button>
//           <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
//             {kpis.map(([l, v, t]) => <Kpi key={l} label={l} value={v} tone={t} placeholder={!has} />)}
//           </div>
//           {!has && <p className="text-[11px] text-muted-foreground">Run the calculation to fill these in. Nothing is saved.</p>}
//           <div className="rounded-xl border border-border">
//             {state === "done" && biggest.length > 0 && (
//               <div className="border-b border-border p-3">
//                 <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Biggest changes</div>
//                 <div className="flex flex-wrap gap-2">
//                   {biggest.map((r) => { const d = rowDelta(r) ?? 0; return (
//                     <button key={r.source_record_id} type="button" onClick={() => jumpTo(r.source_record_id)} className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
//                       <span className="max-w-40 truncate font-mono">{r.source_record_id}</span>
//                       <span className={cn("font-semibold tabular-nums", d > 0 ? "text-success" : "text-destructive")}>{signedMoney(d)}</span>
//                     </button>
//                   ); })}
//                 </div>
//               </div>
//             )}
//             {state === "done" && (
//               <div className="border-b border-border p-3">
//                 <span className="text-[11px] text-muted-foreground">{shown} rows returned{shown >= 200 ? " (first 200 shown)" : ""} · {previewRows.length} included in preview · showing {previewRows.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, previewRows.length)}</span>
//               </div>
//             )}
//             <div className="overflow-x-auto">
//               {state === "idle" && <p className="py-12 text-center text-sm text-muted-foreground">{selRule ? `Ready to run: ${selRule.name} v${selRule.rule_version} · ${SOURCE_NAMES[source] ?? source} · ${monthName}. Press Run calculation. Nothing is saved.` : "Pick a rule in Step 2."}</p>}
//               {state === "error" && <p className="px-6 py-12 text-center text-sm text-destructive">{error ?? "The calculation could not be run."} Try again, or pick another rule.</p>}
//               {(state === "loading" || state === "done") && (
//                 <table className="w-full min-w-[1120px] text-left text-xs">
//                   <thead className="bg-muted/40 text-muted-foreground"><tr>
//                     {["Record", "Click id", "Session id", "How the session was chosen", "Other session ids", "Rule", "Stored", "Recalculated", "Difference"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
//                   </tr></thead>
//                   <tbody>
//                     {state === "loading" ? <TableSkeleton cols={9} rows={8} /> : sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => {
//                       const session = previewSessionDetails(r);
//                       const stored = num(r.stored_amount);
//                       const calculated = num(r.calculated_amount);
//                       const delta = num(r.delta) ?? (stored === null ? null : calculated !== null ? Math.round((calculated - stored) * 100) / 100 : null);
//                       const notStored = stored === null;
//                       const tone = delta === null || delta === 0 || notStored ? "text-muted-foreground" : delta < 0 ? "text-destructive" : "text-success";
//                       return (
//                         <tr key={r.source_record_id} id={rowDomId(r.source_record_id)} className={cn("border-t border-border transition-colors", flash === r.source_record_id && "bg-primary/10")}>
//                           <td className="px-3 py-2 font-mono">{r.source_record_id}</td>
//                           <td className="px-3 py-2 font-mono"><span className="block max-w-48 truncate" title={session.clickId || undefined}>{session.clickId || "—"}</span></td>
//                           <td className="px-3 py-2 font-mono"><span className="block max-w-48 truncate" title={session.sessionId || undefined}>{session.sessionId || "—"}</span></td>
//                           <td className="px-3 py-2"><span className="block w-44 break-words">{session.sessionSource || "—"}</span></td>
//                           <td className="px-3 py-2">{session.otherSessions.length ? <div className="space-y-1"><Pill tone="warning">ambiguous</Pill>{session.otherSessions.map((id) => <span key={id} title={id} className="block max-w-48 truncate font-mono">{id}</span>)}</div> : <span className="text-muted-foreground">—</span>}</td>
//                           <td className="px-3 py-2 font-mono">{r.rule_id} · v{r.rule_version}</td>
//                           <td className="px-3 py-2 font-mono">{notStored ? <span className="text-muted-foreground">Not stored</span> : usd0(stored)}</td>
//                           <td className="px-3 py-2 font-mono">{calculated === null ? <span className="text-muted-foreground">Not set</span> : usd0(calculated)}</td>
//                           <td className={cn("px-3 py-2 font-mono", tone)}>{delta === null ? "—" : signedMoney(delta)}</td>
//                         </tr>
//                       );
//                     })}
//                     {state === "done" && !previewRows.length && <tr><td colSpan={9} className="py-10 text-center text-muted-foreground"><p>No included {SOURCE_NAMES[source] ?? source} rows in {monthLabel(month)} matched {selRule ? `${selRule.name} v${selRule.rule_version}` : ruleId}. Nothing was changed.</p>{evFirst && <p className="mt-1">Your events run {evFirst} to {evLast}. Try {monthLabel(evLast.slice(0, 7))}, with a rule that covers that month.</p>}</td></tr>}
//                   </tbody>
//                 </table>
//               )}
//             </div>
//             {state === "done" && previewRows.length > PAGE_SIZE && <Pager page={page} total={previewRows.length} pageSize={PAGE_SIZE} onPage={setPage} />}
//           </div>
//           <p className="text-[11px] text-muted-foreground">The visit is joined on session_id. The click id is only the lookup.</p>
//           <p className="text-[11px] text-muted-foreground">Leads with our_session = no are excluded.</p>
//         </Step>
// 
//         <Step n={4} title="Lock final amount (optional)" muted>
//           <FinalRevenueForm />
//         </Step>
//       </div>
//     </div>
//   );
// }

import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CircleAlert, ArrowRight, Search, CheckCircle2, Loader2, Info } from "lucide-react";
import { PageHeader } from "@/components/ui-bits";
import { TenantSelect } from "@/components/revenue/RevenueBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type ReconcilePreviewRow } from "@/lib/rulesApi";
import { ReconciliationReview, type EvidenceMethod, type ReviewEntry } from "@/components/revenue/ReconciliationReview";
import { reconciliationDifferences, reconciliationReviewStatus, type ReconciliationIntegrity } from "@/lib/reconciliationReview";
import { DailyAutomaticCheck } from "@/components/revenue/DailyAutomaticCheck";

export const Route = createFileRoute("/cost-revenue/reconciliation")({
  head: () => ({ meta: [
    { title: "Revenue Reconciliation · Alyson CDP" },
    { name: "description", content: "Check source revenue against loaded revenue for completed days, weeks and months." },
    { property: "og:title", content: "Revenue Reconciliation · Alyson CDP" },
    { property: "og:description", content: "Compare source and loaded totals and identify missing revenue leads for past periods." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Reconciliation,
});

export type CheckPeriod = "day" | "week" | "month";
type CheckSource = "homelight" | "uct" | "phonexa";
export interface ReconciliationCheckResult {
  source_leads: number; source_revenue: number; loaded_leads: number; loaded_revenue: number;
  difference: number; matched: boolean; missing: { lead_id: string; revenue: number; session_id?: string | null }[];
  different?: { lead_id: string; source_revenue: number; loaded_revenue: number; session_id?: string | null }[];
  integrity?: ReconciliationIntegrity | null;
}
const DONE_KEY = "cost-revenue-reconciliation-done:v1";
const usd = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const shiftDay = (day: string, offset: number) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return isoDay(date);
};

// Calendar periods are inclusive UTC dates; weeks run Monday through Sunday.
export function reconciliationPeriod(kind: CheckPeriod, selected: string, today: string): { start: string; end: string } | null {
  const input = kind === "month" ? `${selected}-01` : selected;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const date = new Date(`${input}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || isoDay(date) !== input) return null;
  let start = input;
  let end = input;
  if (kind === "week") {
    start = shiftDay(input, -((date.getUTCDay() + 6) % 7));
    end = shiftDay(start, 6);
  } else if (kind === "month") {
    end = isoDay(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
  }
  return end < today ? { start, end } : null;
}

export function reconciliationCheckRequest(kind: CheckPeriod, selected: string, today: string, source_id: CheckSource) {
  const period = reconciliationPeriod(kind, selected, today);
  return period ? { source_id, start: period.start, end: shiftDay(period.end, 1) } : null;
}

export function isReconciliationCheckResult(value: unknown): value is ReconciliationCheckResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return ["source_leads", "source_revenue", "loaded_leads", "loaded_revenue", "difference"].every((key) => typeof result[key] === "number" && Number.isFinite(result[key]))
    && typeof result.matched === "boolean" && Array.isArray(result.missing)
    && result.missing.every((row: unknown) => {
      if (!row || typeof row !== "object") return false;
      const lead = row as Record<string, unknown>;
      return typeof lead.lead_id === "string" && typeof lead.revenue === "number" && Number.isFinite(lead.revenue);
    });
}

// A check passes only when totals match and no missing or amount-mismatched leads are returned.
export function reconciliationCheckPassed(result?: ReconciliationCheckResult | null) {
  return !!result && result.matched && result.missing.length === 0 && (result.different?.length ?? 0) === 0;
}

export function parseReconciliationCheckResponse(value: unknown): ReconciliationCheckResult {
  let payload = value;
  if (payload && typeof payload === "object" && "body" in payload) {
    const wrapper = payload as { statusCode?: unknown; body: unknown };
    payload = typeof wrapper.body === "string" ? JSON.parse(wrapper.body) : wrapper.body;
    if (typeof wrapper.statusCode === "number" && wrapper.statusCode >= 400) {
      const message = payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string" ? payload.message : `The check could not be completed (${wrapper.statusCode}). Please try again.`;
      throw new Error(message);
    }
  }
  if (!isReconciliationCheckResult(payload)) throw new Error("The check returned an incomplete result. Please try again.");
  return payload;
}

// Optional attribution fields must come from the existing preview response, never from inferred joins.
type SessionPreviewRow = ReconcilePreviewRow & {
  utm_content?: unknown;
  session_id?: unknown;
  session_id_source?: unknown;
  our_session?: unknown;
  click_session_observations?: unknown;
};

export function previewSessionDetails(row: SessionPreviewRow) {
  const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
  const sessionId = text(row.session_id);
  const source = text(row.session_id_source);
  // Show returned provenance as-is when the service uses an unrecognized value.
  const labels: Record<string, string> = {
    "utm_content is already a session id": "utm_content is already a session id",
    "one website visit": "one website visit",
    "click bridge": "click bridge",
    "new session id": "new session id",
  };
  const observations = Array.isArray(row.click_session_observations) ? row.click_session_observations : [];
  const otherSessions = [...new Set(observations.map((observation: unknown) => {
    if (typeof observation === "string") return text(observation);
    if (observation && typeof observation === "object" && "session_id" in observation) return text(observation.session_id);
    return "";
  }).filter((id: string) => id && id !== sessionId))];
  return {
    excluded: text(row.our_session).toLowerCase() === "no",
    clickId: text(row.utm_content),
    sessionId,
    sessionSource: labels[source] ?? source,
    otherSessions,
  };
}


function Reconciliation() {
  const [today, setToday] = useState("");
  const [kind, setKind] = useState<CheckPeriod>("day");
  const [selected, setSelected] = useState("");
  const [source, setSource] = useState<CheckSource>("homelight");
  const [result, setResult] = useState<ReconciliationCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Record<string, ReconciliationCheckResult>>({});
  const [method, setMethod] = useState<EvidenceMethod>("automated");
  const [approved, setApproved] = useState(false);
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [checkedAt, setCheckedAt] = useState("");
  useEffect(() => {
    const day = isoDay(new Date());
    setToday(day);
    setSelected(shiftDay(day, -1));
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(DONE_KEY) ?? "{}");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        setDone(Object.fromEntries(Object.entries(saved).filter(([, value]) => isReconciliationCheckResult(value) && value.matched)));
      }
    } catch { /* A missing or invalid reminder does not imply a completed check. */ }
  }, []);
  const period = today ? reconciliationPeriod(kind, selected, today) : null;
  const request = today ? reconciliationCheckRequest(kind, selected, today, source) : null;
  const key = request ? `${request.source_id}:${request.start}:${request.end}` : "";
  const remembered = key ? done[key] : undefined;
  const displayed = remembered ?? result;
  const reset = () => { setResult(null); setError(""); setApproved(false); setCheckedAt(""); };
  const activity = (action: string, detail: string) => setEntries((previous) => [...previous, { id: previous.length + 1, at: new Date().toISOString(), scope: key, action, detail }]);
  const status = reconciliationReviewStatus({ matched: displayed?.matched, manual: method !== "automated", approved });
  const differences = displayed ? reconciliationDifferences(displayed) : null;
  const passed = reconciliationCheckPassed(displayed);

  // Previous reconciliation check, kept so this version can be restored.
  // const checkPeriod = () => setAttempted(true);

  // Previous reconciliation check, kept so this version can be restored.
  // const checkPeriod = async () => {
  //   const body = reconciliationCheckRequest(kind, selected, isoDay(new Date()), source);
  //   if (!body || loading || done[`${body.source_id}:${body.start}:${body.end}`]) return;
  //   setLoading(true); reset();
  //   try {
  //     const response = await fetch(`${RULES_API_BASE}/reconcile/check`, {
  //       method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  //     });
  //     if (!response.ok) throw new Error(`The check could not be completed (${response.status}). Please try again.`);
  //     const value: unknown = await response.json();
  //     if (!isReconciliationCheckResult(value)) throw new Error("The check returned an incomplete result. Please try again.");
  //     setResult(value);
  //   } catch (cause) {
  //     setError(cause instanceof Error ? cause.message : "The check could not be completed. Please try again.");
  //   } finally { setLoading(false); }
  // };

  // Previous reconciliation check, kept so this version can be restored.
  // const checkPeriod = async () => {
  //   const body = reconciliationCheckRequest(kind, selected, isoDay(new Date()), source);
  //   if (!body || loading || done[`${body.source_id}:${body.start}:${body.end}`]) return;
  //   setLoading(true); reset();
  //   try {
  //     const response = await fetch("https://i4mf0v33aa.execute-api.us-west-2.amazonaws.com/reconcile/check", {
  //       method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  //     });
  //     if (!response.ok) throw new Error(`The check could not be completed (${response.status}). Please try again.`);
  //     const value: unknown = await response.json();
  //     setResult(parseReconciliationCheckResponse(value));
  //   } catch (cause) {
  //     setError(cause instanceof Error ? cause.message : "The check could not be completed. Please try again.");
  //   } finally { setLoading(false); }
  // };

  const checkPeriod = async (revalidationReason?: string) => {
    const body = reconciliationCheckRequest(kind, selected, isoDay(new Date()), source);
    if (!body || loading || (!revalidationReason && done[`${body.source_id}:${body.start}:${body.end}`])) return;
    if (revalidationReason && remembered) {
      try {
        const updated = { ...done }; delete updated[key];
        localStorage.setItem(DONE_KEY, JSON.stringify(updated)); setDone(updated);
      } catch { setError("This browser could not clear its reminder for revalidation."); return; }
    }
    setLoading(true); reset();
    if (revalidationReason) activity("Revalidation requested", revalidationReason);
    try {
      const response = await fetch("https://i4mf0v33aa.execute-api.us-west-2.amazonaws.com/reconcile/check", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`The check could not be completed (${response.status}). Please try again.`);
      const value: unknown = await response.json();
      const parsed = parseReconciliationCheckResponse(value);
      setResult(parsed); setCheckedAt(new Date().toISOString());
      activity("Period checked", parsed.matched ? "Aggregate revenue matched; integrity checks remain separate" : `Aggregate mismatch · ${usd(parsed.difference)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The check could not be completed. Please try again.");
      activity("Check unavailable", "No comparison totals confirmed");
    } finally { setLoading(false); }
  };
  const markDone = () => {
    if (!key || !result?.matched || remembered) return;
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(DONE_KEY) ?? "{}");
      const previous = stored && typeof stored === "object" && !Array.isArray(stored) ? Object.fromEntries(Object.entries(stored).filter(([, value]) => isReconciliationCheckResult(value) && value.matched)) : {};
      const updated = { ...previous, ...done, [key]: result };
      localStorage.setItem(DONE_KEY, JSON.stringify(updated));
      setDone(updated); setError("");
      activity("Browser reminder set", "Mark done · no shared approval or revenue lock");
    } catch { setError("This browser could not remember the period. It has not been marked done."); }
  };
  const yesterday = today ? shiftDay(today, -1) : "";
  const max = kind === "month" && today ? isoDay(new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 0))).slice(0, 7) : kind === "week" && today ? shiftDay(today, -7) : yesterday;
  const changeKind = (next: string) => {
    if (next !== "day" && next !== "week" && next !== "month") return;
    setKind(next);
    reset();
    setSelected(next === "month" ? maxPreviousMonth(today) : next === "week" && today ? shiftDay(today, -7) : yesterday);
  };
  return (
    <div className="pb-10">
      <PageHeader title="Reconciliation" subtitle="Compare source revenue with loaded revenue for a completed period." actions={<TenantSelect />} />
      <DailyAutomaticCheck />
      <section aria-label="Automated daily check" className="mx-6 mb-6 flex gap-3 rounded-md border border-info/20 bg-info/10 p-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        <p>
          <span className="font-medium text-foreground">Automated daily check:</span> every day at 9:00 AM IST, Homelight, Non-HL (UCT) and Phonexa are reconciled for the last 30 days. If any difference is found, a detailed report is emailed automatically. Note: daily revenue and cost loading is not automated yet, so new leads and updated revenue may show as differences.
        </p>
      </section>
      <div className="space-y-6 px-6">
        <section aria-label="Check period" className="border-b border-border pb-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[140px_minmax(180px,1fr)_minmax(180px,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <label id="period-label" className="text-xs font-medium text-muted-foreground">Period</label>
              <Select value={kind} onValueChange={changeKind} disabled={loading}>
                <SelectTrigger aria-labelledby="period-label"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="day">Day</SelectItem><SelectItem value="week">Week</SelectItem><SelectItem value="month">Month</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="check-date" className="text-xs font-medium text-muted-foreground">{kind === "week" ? "Week containing" : kind === "month" ? "Month" : "Day"}</label>
              <Input id="check-date" type={kind === "month" ? "month" : "date"} value={selected} max={max} disabled={!today || loading} onChange={(event) => { setSelected(event.target.value); reset(); }} aria-invalid={!!selected && !period} />
            </div>
            <div className="space-y-2">
              <label id="source-label" className="text-xs font-medium text-muted-foreground">Source</label>
              <Select value={source} disabled={loading} onValueChange={(value) => { if (value === "homelight" || value === "uct" || value === "phonexa") { setSource(value); reset(); } }}>
                <SelectTrigger aria-labelledby="source-label"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="homelight">Homelight</SelectItem><SelectItem value="phonexa">Phonexa</SelectItem><SelectItem value="uct">Third-party revenue (UCT)</SelectItem></SelectContent>
              </Select>
            </div>
            <Button disabled={!period || loading || !!remembered} onClick={() => void checkPeriod()}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Search className="mr-2 h-4 w-4" />}{loading ? "Checking…" : "Check period"}</Button>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-4 w-4 shrink-0" />
            <span>{period ? `${period.start} – ${period.end} · UTC` : "Select a completed past period."}{kind === "week" ? " · Monday–Sunday" : ""}</span>
          </div>
          {selected && !period && today && <p role="alert" className="mt-2 text-xs text-destructive">Choose a valid period that ends before today. Today and unfinished weeks or months cannot be checked.</p>}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Aggregate comparison</h2>
          <span className={`inline-flex items-center gap-2 text-xs font-medium ${status === "Failed" ? "text-destructive" : status === "Warning" || status === "Awaiting Evidence" ? "text-warning" : "text-muted-foreground"}`}><CircleAlert className="h-4 w-4" />{loading ? "Checking…" : status}</span>
        </div>
        <section aria-label="Revenue totals" className="grid gap-4 sm:grid-cols-2">
          {[{ label: "Source", detail: source === "homelight" ? "Homelight · expected revenue" : source === "phonexa" ? "Phonexa · expected vendor revenue" : "Third-party (UCT) · expected vendor revenue", revenue: displayed?.source_revenue, leads: displayed?.source_leads }, { label: "Loaded", detail: "Revenue loaded for the same source and period", revenue: displayed?.loaded_revenue, leads: displayed?.loaded_leads }].map((item) => (
            <div key={item.label} className="min-w-0 rounded-lg border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">{item.label}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              <p className="mt-5 font-mono text-3xl font-semibold tabular-nums">{item.revenue === undefined ? "—" : usd(item.revenue)}</p>
              <p className="mt-2 text-xs text-muted-foreground">Lead count: {item.leads === undefined ? "—" : item.leads.toLocaleString("en-US")}</p>
            </div>
          ))}
        </section>

        <section aria-label="Aggregate differences" className="grid grid-cols-1 gap-4 border-y border-border py-4 sm:grid-cols-3">
          {[{ label: "Absolute revenue difference", value: differences ? usd(differences.absolute) : "—" }, { label: "Revenue difference (%)", value: differences ? differences.percentage === null ? "Not applicable" : `${differences.percentage.toFixed(2)}%` : "—" }, { label: "Lead count difference · source − loaded", value: differences ? differences.leads.toLocaleString("en-US") : "—" }].map((item) => <div key={item.label}><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-2 font-mono text-lg font-semibold">{item.value}</p></div>)}
        </section>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>Provenance: {displayed ? "Existing reconciliation check service · source and loaded totals" : "No result returned"}</span><span>{remembered ? "Legacy browser reminder · not shared verification" : checkedAt ? `Checked ${new Date(checkedAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC` : "Not checked"}</span></div>

        <section aria-label="Check status" className="border-y border-border py-4" aria-live="polite">
          <div className="flex items-start gap-3">
            {passed ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : <CircleAlert className={`mt-0.5 h-5 w-5 shrink-0 ${displayed ? "text-destructive" : "text-warning"}`} />}
            <div>
              <h2 className={`text-sm font-semibold ${displayed ? passed ? "text-success" : "text-destructive" : ""}`}>{displayed ? passed ? "Matched" : displayed.matched ? "Lead-level differences" : "Not matched" : "Comparison unavailable"}</h2>
              {displayed ? passed ? <p className="mt-1 text-sm text-muted-foreground">{remembered ? "Done · Browser reminder only. Use targeted revalidation when the scope changes." : displayed.integrity ? "Source and loaded revenue match. See Integrity checks for returned results." : "Source and loaded revenue match. Integrity checks are not yet verified."}</p> : <p className="mt-1 text-sm text-destructive">Difference: <span className="font-mono font-semibold">{usd(displayed.difference)}</span></p> : <p className="mt-1 text-sm text-muted-foreground">{loading ? "Checking source and loaded revenue…" : error ? "Comparison unavailable. No totals were confirmed." : "No comparison has been run for this period."}</p>}
              {passed && !remembered && <Button className="mt-3" size="sm" onClick={markDone}><CheckCircle2 className="mr-2 h-4 w-4" />Mark done</Button>}
              {passed && !remembered && <p className="mt-2 text-xs text-muted-foreground">Remembers this period in this browser only. No revenue amount is locked.</p>}
              {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
            </div>
          </div>
        </section>

        <ReconciliationReview scope={key} source={source === "homelight" ? "Homelight" : source === "phonexa" ? "Phonexa" : "Third-party (UCT)"} start={period?.start ?? ""} end={period?.end ?? ""} method={method} onMethod={setMethod} approved={approved} onApprove={setApproved} checked={!!displayed} integrity={displayed?.integrity} entries={entries} onActivity={activity} onRevalidate={(reason) => void checkPeriod(reason)} loading={loading} />
        {!passed && <section aria-label="Missing leads">
          <div className="mb-3 flex items-center gap-2"><h2 className="text-sm font-semibold">Missing leads</h2><ArrowRight className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">In source, not loaded</span></div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th scope="col" className="px-4 py-3 font-medium">Lead id</th><th scope="col" className="px-4 py-3 font-medium">Session id</th><th scope="col" className="px-4 py-3 text-right font-medium">Revenue</th></tr></thead>
              <tbody>{displayed?.missing.length ? displayed.missing.map((lead, index) => <tr key={`${lead.lead_id}:${index}`} className="border-t border-border"><td className="px-4 py-3 font-mono break-all">{lead.lead_id || "—"}</td><td className="px-4 py-3 font-mono break-all">{lead.session_id || "—"}</td><td className="px-4 py-3 text-right font-mono tabular-nums">{usd(lead.revenue)}</td></tr>) : <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">{displayed ? "No missing leads were returned for this period." : "Missing leads are unavailable until the check returns."}</td></tr>}</tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Leads with our_session = no or no utm_content are intentionally excluded from missing-lead errors.</p>
        </section>}
        {!passed && <section aria-label="Amount mismatches">
          <div className="mb-3 flex items-center gap-2"><h2 className="text-sm font-semibold">Amount mismatches</h2><ArrowRight className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Loaded with a different amount</span></div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th scope="col" className="px-4 py-3 font-medium">Lead id</th><th scope="col" className="px-4 py-3 font-medium">Session id</th><th scope="col" className="px-4 py-3 text-right font-medium">Source</th><th scope="col" className="px-4 py-3 text-right font-medium">Loaded</th></tr></thead>
              <tbody>{displayed?.different?.length ? displayed.different.map((lead, index) => <tr key={`${lead.lead_id}:${index}`} className="border-t border-border"><td className="px-4 py-3 font-mono break-all">{lead.lead_id || "—"}</td><td className="px-4 py-3 font-mono break-all">{lead.session_id || "—"}</td><td className="px-4 py-3 text-right font-mono tabular-nums">{usd(lead.source_revenue)}</td><td className="px-4 py-3 text-right font-mono tabular-nums">{usd(lead.loaded_revenue)}</td></tr>) : <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">{displayed ? "No amount mismatches were returned for this period." : "Amount mismatches are unavailable until the check returns."}</td></tr>}</tbody>
            </table>
          </div>
        </section>}
      </div>
    </div>
  );
}

function maxPreviousMonth(today: string): string {
  if (!today) return "";
  return isoDay(new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 0))).slice(0, 7);
}
