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
import { CalendarDays, CircleAlert, Search, CheckCircle2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui-bits";
import { TenantSelect } from "@/components/revenue/RevenueBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listReconciliationLog, postReconcileCheck, postReconcileLoadMissing, type ReconcilePreviewRow } from "@/lib/rulesApi";
import { reconciliationDifferences, type ReconciliationIntegrity } from "@/lib/reconciliationReview";
import { ReconciliationLogTable } from "@/components/revenue/ReconciliationLogTable";
import {
  coveringReconciliationLog,
  parseReconciliationLog,
  reconciliationLogId,
  upsertReconciliationLog,
  type ReconciliationLogRow,
} from "@/lib/reconciliationLog";

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
  difference: number; matched: boolean; missing: { lead_id: string; revenue: number; session_id?: string | null; affiliate?: boolean }[];
  different?: { lead_id: string; source_revenue: number; loaded_revenue: number; session_id?: string | null }[];
  integrity?: ReconciliationIntegrity | null;
}
const usd = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const shiftDay = (day: string, offset: number) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return isoDay(date);
};

export const RECONCILE_WAIT_DAYS = 5;

// Calendar periods are inclusive UTC dates; weeks run Monday through Sunday.
// A date is checkable only after RECONCILE_WAIT_DAYS, so late source revenue can land.
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
  return end <= shiftDay(today, -RECONCILE_WAIT_DAYS) ? { start, end } : null;
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

// A check passes when every source lead is in revenue_events. Amount diffs are shown, not blocking.
export function reconciliationCheckPassed(result?: ReconciliationCheckResult | null) {
  return !!result && result.missing.length === 0;
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
  const [log, setLog] = useState<ReconciliationLogRow[]>([]);
  const [checkedAt, setCheckedAt] = useState("");
  const [loadingMissing, setLoadingMissing] = useState(false);
  useEffect(() => {
    const day = isoDay(new Date());
    setToday(day);
    setSelected(shiftDay(day, -RECONCILE_WAIT_DAYS));
    void listReconciliationLog()
      .then((data) => setLog(parseReconciliationLog(data.rows ?? [])))
      .catch(() => { /* Keep an empty log until Check can write one. */ });
  }, []);
  const persistLog = (next: ReconciliationLogRow[]) => {
    setLog(next);
  };
  const period = today ? reconciliationPeriod(kind, selected, today) : null;
  const request = today ? reconciliationCheckRequest(kind, selected, today, source) : null;
  const key = request ? reconciliationLogId(request.source_id, request.start, request.end) : "";
  const remembered = request ? coveringReconciliationLog(log, request.source_id, request.start, request.end) : undefined;
  const historical = !!remembered && (remembered.period_kind === "range" || remembered.how.startsWith("historical load"));
  const nextCheckDay = remembered?.date_reconciled ? shiftDay(remembered.date_reconciled, 1) : "";
  const rememberedResult: ReconciliationCheckResult | undefined = remembered && !historical ? {
    source_leads: remembered.source_leads ?? 0,
    source_revenue: remembered.source_revenue ?? 0,
    loaded_leads: remembered.loaded_leads ?? 0,
    loaded_revenue: remembered.loaded_revenue ?? 0,
    difference: remembered.difference ?? 0,
    matched: true,
    missing: remembered.missing ?? [],
    different: [],
  } : undefined;
  const displayed = rememberedResult ?? result;
  const reset = () => { setResult(null); setError(""); setCheckedAt(""); };
  const differences = displayed ? reconciliationDifferences(displayed) : null;
  const passed = !!remembered || reconciliationCheckPassed(displayed);

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
    if (!body || loading || (!revalidationReason && coveringReconciliationLog(log, body.source_id, body.start, body.end))) return;
    if (revalidationReason && remembered) {
      persistLog(log.map((row) => row.id === key ? { ...row, locked: false } : row));
    }
    setLoading(true); reset();
    try {
      const value = await postReconcileCheck({ ...body, period_kind: kind });
      const parsed = parseReconciliationCheckResponse(value);
      const checked = new Date().toISOString();
      setResult(parsed); setCheckedAt(checked);
      persistLog(upsertReconciliationLog(log, {
        id: reconciliationLogId(body.source_id, body.start, body.end),
        source: body.source_id,
        period_kind: kind,
        date_reconciled: body.start,
        period_start: body.start,
        period_end: body.end,
        checked_at: checked,
        result: reconciliationCheckPassed(parsed) ? "matched" : "difference",
        source_leads: parsed.source_leads,
        loaded_leads: parsed.loaded_leads,
        source_revenue: parsed.source_revenue,
        loaded_revenue: parsed.loaded_revenue,
        difference: parsed.difference,
        how: "reconcile/check",
        locked: reconciliationCheckPassed(parsed),
        cost_usd: null,
        missing_leads: parsed.missing.length,
        missing: parsed.missing,
      }));
      void listReconciliationLog().then((data) => persistLog(parseReconciliationLog(data.rows ?? []))).catch(() => undefined);
    } catch (cause) {
      const checked = new Date().toISOString();
      setError(cause instanceof Error ? cause.message : "The check could not be completed. Please try again.");
      setCheckedAt(checked);
      persistLog(upsertReconciliationLog(log, {
        id: reconciliationLogId(body.source_id, body.start, body.end),
        source: body.source_id,
        period_kind: kind,
        date_reconciled: body.start,
        period_start: body.start,
        period_end: body.end,
        checked_at: checked,
        result: "failed",
        source_leads: null,
        loaded_leads: null,
        source_revenue: null,
        loaded_revenue: null,
        difference: null,
        how: "reconcile/check",
        locked: false,
        cost_usd: null,
        missing_leads: null,
        missing: [],
      }));
    } finally { setLoading(false); }
  };
  const loadMissingLeads = async () => {
    const body = reconciliationCheckRequest(kind, selected, isoDay(new Date()), source);
    if (!body || loading || loadingMissing || !displayed?.missing.length) return;
    setLoadingMissing(true); setError("");
    try {
      await postReconcileLoadMissing({
        ...body,
        period_kind: kind,
        lead_ids: displayed.missing.map((lead) => lead.lead_id).filter(Boolean),
      });
      await checkPeriod("loaded missing leads");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The missing leads could not be loaded. Please try again.");
    } finally { setLoadingMissing(false); }
  };
  const readyDay = today ? shiftDay(today, -RECONCILE_WAIT_DAYS) : "";
  const max = kind === "month" && today ? maxReadyMonth(today) : kind === "week" && today ? maxReadyWeekDay(today) : readyDay;
  const changeKind = (next: string) => {
    if (next !== "day" && next !== "week" && next !== "month") return;
    setKind(next);
    reset();
    setSelected(next === "month" ? maxReadyMonth(today) : next === "week" && today ? maxReadyWeekDay(today) : readyDay);
  };
  const sourceLabel = source === "homelight" ? "HomeLight" : source === "phonexa" ? "Phonexa" : "UCT";
  return (
    <div className="space-y-6 px-6 pb-10">
      <PageHeader className="px-0" title="Reconciliation" subtitle="Wait 5 days, then Check that date for missing leads." />

      <section className="rounded-xl border border-border bg-card p-5" aria-label="Check a date">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Check a date</h2>
            <p className="mt-1 text-xs text-muted-foreground">Check a date only after 5 days. That wait lets late source revenue land.</p>
          </div>
          <TenantSelect />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-[140px_minmax(180px,1fr)_minmax(200px,1fr)_auto] lg:items-end">
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
              <SelectContent><SelectItem value="homelight">HomeLight</SelectItem><SelectItem value="phonexa">Phonexa</SelectItem><SelectItem value="uct">UCT</SelectItem></SelectContent>
            </Select>
          </div>
          <Button disabled={!period || loading || !!remembered} onClick={() => void checkPeriod()}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Search className="mr-2 h-4 w-4" />}{loading ? "Checking…" : remembered ? "Locked" : "Check"}</Button>
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-4 w-4 shrink-0" />{period ? `${period.start} – ${period.end}` : "Pick a date that ended at least 5 days ago."}{kind === "week" ? " · Monday–Sunday" : ""}</p>
        {selected && !period && today && <p role="alert" className="mt-2 text-xs text-destructive">Choose a date that ended at least 5 days ago.</p>}
      </section>

      <section className="rounded-xl border border-border bg-card p-5" aria-label="Result" aria-live="polite">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Result</h2>
            <p className="mt-1 text-xs text-muted-foreground">{historical && remembered ? `All leads through ${remembered.date_reconciled} are OK. Check starts ${nextCheckDay}.` : remembered ? "No missing leads. This date will not be checked again." : checkedAt ? `Checked ${new Date(checkedAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC` : "No check yet."}</p>
          </div>
          <span className={`inline-flex items-center gap-2 text-xs font-medium ${passed ? "text-success" : displayed || error ? "text-destructive" : "text-muted-foreground"}`}>
            {passed ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
            {loading ? "Checking…" : remembered || passed ? "All leads loaded" : displayed ? "Missing leads" : error ? "Failed" : "Not checked"}
          </span>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {[{ label: "Source", detail: sourceLabel, revenue: displayed?.source_revenue, leads: displayed?.source_leads }, { label: "Loaded", detail: "revenue_events", revenue: displayed?.loaded_revenue, leads: displayed?.loaded_leads }].map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs text-muted-foreground">{item.label} · {item.detail}</p>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{item.revenue === undefined ? "—" : usd(item.revenue)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.leads === undefined ? "—" : `${item.leads.toLocaleString("en-US")} leads`}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
          {[{ label: "Difference", value: differences ? usd(differences.absolute) : "—" }, { label: "Difference %", value: differences ? differences.percentage === null ? "—" : `${differences.percentage.toFixed(2)}%` : "—" }, { label: "Lead gap", value: differences ? differences.leads.toLocaleString("en-US") : "—" }].map((item) => (
            <div key={item.label}><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 font-mono text-base font-semibold">{item.value}</p></div>
          ))}
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      </section>

      {displayed && (!passed || (displayed.different?.length ?? 0) > 0) && (
        <section className="grid gap-6 lg:grid-cols-2" aria-label="Issues">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Missing leads</h2>
                <p className="mt-1 text-xs text-muted-foreground">Next: load them into revenue_events, then Check again.</p>
              </div>
              {!!displayed.missing.length && (
                <Button size="sm" disabled={loading || loadingMissing || !!remembered} onClick={() => void loadMissingLeads()}>
                  {loadingMissing ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}
                  {loadingMissing ? "Loading…" : "Load missing leads"}
                </Button>
              )}
            </div>
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th scope="col" className="px-4 py-3 font-medium">Lead id</th><th scope="col" className="px-4 py-3 font-medium">Session</th><th scope="col" className="px-4 py-3 font-medium">Affiliate flag</th><th scope="col" className="px-4 py-3 text-right font-medium">Revenue</th></tr></thead>
                <tbody>{displayed.missing.length ? displayed.missing.map((lead, index) => <tr key={`${lead.lead_id}:${index}`} className="border-t border-border"><td className="px-4 py-3 font-mono break-all">{lead.lead_id || "—"}</td><td className="px-4 py-3 font-mono break-all">{lead.session_id || "—"}</td><td className="px-4 py-3">{lead.affiliate == null ? "—" : lead.affiliate ? "OK" : "Not"}</td><td className="px-4 py-3 text-right font-mono tabular-nums">{usd(lead.revenue)}</td></tr>) : <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">None</td></tr>}</tbody>
              </table>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Amount mismatches</h2>
            <p className="mt-1 text-xs text-muted-foreground">Loaded with a different amount</p>
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th scope="col" className="px-4 py-3 font-medium">Lead id</th><th scope="col" className="px-4 py-3 text-right font-medium">Source</th><th scope="col" className="px-4 py-3 text-right font-medium">Loaded</th></tr></thead>
                <tbody>{displayed.different?.length ? displayed.different.map((lead, index) => <tr key={`${lead.lead_id}:${index}`} className="border-t border-border"><td className="px-4 py-3 font-mono break-all">{lead.lead_id || "—"}</td><td className="px-4 py-3 text-right font-mono tabular-nums">{usd(lead.source_revenue)}</td><td className="px-4 py-3 text-right font-mono tabular-nums">{usd(lead.loaded_revenue)}</td></tr>) : <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">None</td></tr>}</tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        <ReconciliationLogTable rows={log} />
      </section>
    </div>
  );
}

function maxReadyMonth(today: string): string {
  if (!today) return "";
  const ready = shiftDay(today, -RECONCILE_WAIT_DAYS);
  const readyDate = new Date(`${ready}T00:00:00Z`);
  const monthEnd = isoDay(new Date(Date.UTC(readyDate.getUTCFullYear(), readyDate.getUTCMonth() + 1, 0)));
  if (monthEnd > ready) {
    return isoDay(new Date(Date.UTC(readyDate.getUTCFullYear(), readyDate.getUTCMonth(), 0))).slice(0, 7);
  }
  return ready.slice(0, 7);
}

function maxReadyWeekDay(today: string): string {
  if (!today) return "";
  const ready = shiftDay(today, -RECONCILE_WAIT_DAYS);
  const readyDate = new Date(`${ready}T00:00:00Z`);
  const monday = shiftDay(ready, -((readyDate.getUTCDay() + 6) % 7));
  const sunday = shiftDay(monday, 6);
  return sunday <= ready ? ready : shiftDay(monday, -1);
}
