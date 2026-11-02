import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FieldPicker } from "./FieldPicker";
import { MultiPicker } from "./MultiPicker";
import { RULE_SOURCES, SMS_CONNECTORS, SMS_SOURCE_TABLE, apiSourceId, hasCostModifier, isDirectCost, ruleDatesValid, ruleSaveDates, ruleSaveCalculation, ruleSmsKey, ruleWizardSteps, smsPerSend } from "@/lib/costRulePricing";
import { returnedRuleDates, rulePeriodSummary, savedDateWarning } from "@/lib/costRevenueDisplay";
import {
  COLUMN_SOURCES, KIND_LABELS, OP_LABELS, RULE_ID_RE, SOURCE_FIELDS, SOURCE_LABELS, SOURCE_TABLES, condLine, createRule, deactivateRule, errMsg, isActive, listRevenueEventFilterOptions, listRuleColumns, listRules, saveErrMsg, optionLabel, slugRuleId,
  type ApiRule, type CalcKind, type RuleCondition, type RuleType,
} from "@/lib/rulesApi";

const STEPS = ["Where it applies", "Type of rule", "Time period", "Other filters", "Review"];
const sel = "h-9 rounded-md border border-border bg-card px-2 text-sm";
const ph = "placeholder:text-muted-foreground/60 placeholder:italic";
const KINDS: CalcKind[] = ["revenue_share", "roas", "event"];
type Cond = { field: string; op: string; value: string; list: string[]; hi: string };
const COND_OPS = ["equals", "not_equals", "in", "not_in", "contains", "not_contains", "greater_than", "gte", "less_than", "lte", "between", "is_empty", "is_not_empty"];
const NUM_OPS = ["greater_than", "gte", "less_than", "lte", "between"];
const LIST_OPS = ["in", "not_in"];
const NO_VALUE_OPS = ["is_empty", "is_not_empty"];
const MAX_CONDS = 25;
const isNum = (v: string) => v.trim() !== "" && Number.isFinite(Number(v));
const condOk = (c: Cond) => !!c.field && (NO_VALUE_OPS.includes(c.op) ? true : LIST_OPS.includes(c.op) ? c.list.length > 0 : c.op === "between" ? isNum(c.value) && isNum(c.hi) : NUM_OPS.includes(c.op) ? isNum(c.value) : c.value.trim() !== "");
const toCond = (c: RuleCondition): Cond => {
  const arr = Array.isArray(c.value) ? c.value.map(String) : null;
  if (c.op === "between") return { field: c.field, op: c.op, value: arr?.[0] ?? "", hi: arr?.[1] ?? "", list: [] };
  if (LIST_OPS.includes(c.op)) return { field: c.field, op: c.op, value: "", hi: "", list: arr ?? String(c.value ?? "").split(",").map((v) => v.trim()).filter(Boolean) };
  return { field: c.field, op: c.op, value: arr ? arr.join(", ") : String(c.value ?? ""), hi: "", list: [] };
};
const fromCond = (c: Cond): RuleCondition => {
  if (NO_VALUE_OPS.includes(c.op)) return { field: c.field, op: c.op };
  if (LIST_OPS.includes(c.op)) return { field: c.field, op: c.op, value: c.list };
  if (c.op === "between") return { field: c.field, op: c.op, value: [Number(c.value), Number(c.hi)] };
  return { field: c.field, op: c.op, value: NUM_OPS.includes(c.op) ? Number(c.value) : c.value.trim() };
};
function ChipInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [t, setT] = useState("");
  const add = () => { const parts = t.split(",").map((x) => x.trim()).filter((x) => x && !value.includes(x)); if (parts.length) onChange([...value, ...parts]); setT(""); };
  return (
    <div className="flex min-h-9 w-56 flex-wrap items-center gap-1 rounded-md border border-border bg-card px-1.5 py-1">
      {value.map((v) => <span key={v} className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 font-mono text-xs">{v}<button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}>×</button></span>)}
      <input value={t} onChange={(e) => setT(e.target.value)} onBlur={add} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } else if (e.key === "Backspace" && !t && value.length) onChange(value.slice(0, -1)); }} placeholder={value.length ? "" : "Type, press Enter"} className="min-w-16 flex-1 bg-transparent text-sm outline-none placeholder:italic placeholder:text-muted-foreground/60" />
    </div>
  );
}
// vendor_id / offer_id are stored as `in` conditions alongside the other filters, but edited with their own pickers.
const LIST_FIELDS = ["vendor_id", "offer_id"];
const listVals = (conds: RuleCondition[], field: string) => {
  const c = conds.find((x) => x.field === field && x.op === "in");
  return c ? (Array.isArray(c.value) ? c.value.map(String) : String(c.value ?? "").split(",").map((v) => v.trim()).filter(Boolean)) : [];
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">{label}{children}</label>;
}

const DEFAULT_FIELDS: Record<string, string> = { homelight: "expected_revenue", tune: "payout_cents", uct: "expected_revenue_vendor" };
const defaultField = (src: string) => DEFAULT_FIELDS[src] ?? SOURCE_FIELDS[src]?.[0] ?? "";
const sourcesFor = (t: RuleType) => RULE_SOURCES[t];

/** Cost/Revenue rule wizard. Saves to the Rules API; editing posts a new version of the same rule_id. */
export function RuleBuilder({ open, onOpenChange, onSaved, editing }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: (id: string, version: number) => void; editing?: ApiRule | null }) {
  const queryClient = useQueryClient();
  const init = () => {
    const c = editing?.calculation;
    const known = c && (c.kind === "revenue_share" || c.kind === "roas" || c.kind === "event") ? c : c?.kind === "event_based" ? { kind: "event" as const, field: "", percent: null, amount: c.amount } : c?.kind === "sms_per_count" ? { kind: "event" as const, field: "", percent: null, amount: c.amount, per: c.per_count } : null;
    const source = (editing && ruleSmsKey(editing)) || (editing?.source_id ?? "homelight");
    return {
      name: editing?.name ?? "", type: (editing?.type ?? "REVENUE") as RuleType, source,
      field: (c && "field" in c ? c.field : "") || defaultField(source),
      kind: (known?.kind ?? "revenue_share") as CalcKind,
      percent: known?.percent != null ? String(known.percent) : "",
      amount: known?.amount != null ? String(known.amount) : "",
      smsQty: known && (known as { per?: number }).per != null ? String((known as { per?: number }).per) : "1",
      from: editing?.effective_from?.slice(0, 10) ?? "", to: editing?.effective_to?.slice(0, 10) ?? "",
      conds: ((editing?.conditions ?? []) as RuleCondition[]).filter((c) => !(editing?.source_id === "sms" && c.field === "connector_id")).filter((c) => !(LIST_FIELDS.includes(c.field) && c.op === "in")).map(toCond),
      vendors: listVals((editing?.conditions ?? []) as RuleCondition[], "vendor_id"),
      offers: listVals((editing?.conditions ?? []) as RuleCondition[], "offer_id"),
    };
  };
  const [step, setStep] = useState(0);
  const [f, setF] = useState(init);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState<string | undefined>(editing ? `${editing.rule_id}:${editing.rule_version}` : undefined);
  const curKey = editing ? `${editing.rule_id}:${editing.rule_version}` : undefined;
  if (key !== curKey) { setKey(curKey); setF(init()); setStep(0); setError(null); }

  const sms = hasCostModifier(f.type, f.source);
  const direct = isDirectCost(f.type, f.source);
  const steps = ruleWizardSteps(f.type, f.source);
  const perSend = smsPerSend(f.amount, f.smsQty);
  const ruleId = editing?.rule_id ?? slugRuleId(f.name);
  const setConds = (conds: Cond[]) => setF({ ...f, conds });
  const apiSource = apiSourceId(f.source);
  const colsQ = useQuery({ queryKey: ["cr-rule-columns", apiSource], queryFn: () => listRuleColumns(apiSource), retry: false, enabled: open && COLUMN_SOURCES.includes(apiSource), staleTime: Infinity, refetchOnMount: false, refetchOnWindowFocus: false });
  const colNames = colsQ.data?.columns.map((c) => c.name) ?? [];
  const fields = colNames.length ? colNames : (SOURCE_FIELDS[f.source] ?? []);
  const sourceTable = sms ? SMS_SOURCE_TABLE : colsQ.data?.table || SOURCE_TABLES[f.source];
  const mappingReady = !!sourceTable;
  const showVendor = f.type === "REVENUE" && (f.source === "homelight" || f.source === "uct");
  const showOffer = f.type === "REVENUE" && (f.source === "homelight" || f.source === "uct");
  // Switching Applies to: keep the source only if it is still allowed; otherwise clear source,
  // field, and filters so nothing from the old source leaks into the new type.
  const setType = (t: RuleType) => {
    const source = sourcesFor(t).includes(f.source) ? f.source : "";
    const field = source && fields.includes(f.field) ? f.field : "";
    setF({ ...f, type: t, source, field, amount: "", percent: "", smsQty: "1", vendors: [], offers: [], conds: source === f.source ? f.conds : [] });
  };
  const [tried, setTried] = useState(false);
  const reset = () => { setStep(0); setF(init()); setError(null); setTried(false); };
  // Close first, then reset after the close animation so the dialog never flashes back to step 1.
  const close = () => { onOpenChange(false); setTimeout(reset, 300); };
  const Hint = ({ show, children }: { show: boolean; children: React.ReactNode }) => (tried && show ? <p className="mt-1 text-xs text-destructive">{children}</p> : null);
  const pct = Number(f.percent); const amt = Number(f.amount);
  const valueOk = direct ? true : sms ? perSend !== null : f.kind === "event" ? f.amount.trim() !== "" && amt >= 0 : f.percent.trim() !== "" && (f.kind === "revenue_share" ? pct >= 1 && pct <= 100 : pct > 0);
  const datesOk = ruleDatesValid(f.from, f.to);
  const canNext = [
    f.name.trim().length > 0 && RULE_ID_RE.test(ruleId) && sourcesFor(f.type).includes(f.source) && (sms || direct || fields.length === 0 || !!f.field),
    valueOk,
    datesOk,
    f.conds.every(condOk),
    true,
  ][step];
  const missing = (() => {
    const m: string[] = [];
    if (step === 0) { if (!f.name.trim()) m.push("add a rule name"); else if (!RULE_ID_RE.test(ruleId)) m.push("fix the rule name"); if (!f.source) m.push("choose a source"); if (!sms && !direct && fields.length > 0 && !f.field) m.push("choose a field"); }
    if (step === 1 && !valueOk) m.push(sms ? "enter a dollar amount" : f.kind === "event" ? "enter a dollar amount" : f.kind === "revenue_share" ? "enter a percent from 1 to 100" : "enter a percent above 0");
    if (step === 2) { if (!f.from) m.push("pick a start date"); if (f.to && f.from && f.to < f.from) m.push("make the end date on or after the start date"); }
    if (step === 3 && !f.conds.every(condOk)) m.push("fill in every filter or remove it");
    if (!m.length) return "";
    const t = m.length > 1 ? `${m.slice(0, -1).join(", ")} and ${m[m.length - 1]}` : m[0];
    return t[0].toUpperCase() + t.slice(1);
  })();
  const filterOpts = useQuery({ queryKey: ["cr-revenue-event-filter-options", apiSource], queryFn: () => listRevenueEventFilterOptions(apiSource), retry: false, enabled: open && step === 3 && (showVendor || showOffer), staleTime: 5 * 60_000 });
  const existing = useQuery({ queryKey: ["cr-rules"], queryFn: listRules, retry: false, enabled: open });
  const nameTaken = !editing && !!f.name.trim() && (existing.data ?? []).some((r) => r.name.trim().toLowerCase() === f.name.trim().toLowerCase() || r.rule_id === ruleId);
  const qtyNum = Number(f.smsQty);
  const qtyLabel = Number.isFinite(qtyNum) && qtyNum > 0 ? (qtyNum === 1 ? "SMS" : `${qtyNum.toLocaleString("en-US")} SMS`) : "SMS";
  const valueText = sms ? `$${f.amount || "—"} per ${Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum.toLocaleString("en-US") : "—"} SMS` : direct ? "Source amount · no modifier" : f.kind === "event" ? `$${f.amount || "—"} per event` : `${f.percent || "—"}%`;

  const save = async () => {
    if (!mappingReady) { setError("Saving is unavailable until this source’s Rules API mapping is connected."); return; }
    setSaving(true); setError(null);
    try {
      const res = await createRule({
        rule_id: ruleId, name: f.name.trim(), description: editing?.description ?? "", type: f.type, source_id: apiSourceId(f.source), source_table: sourceTable,
        conditions: [
          ...(sms ? [{ field: "connector_id", op: "equals", value: SMS_CONNECTORS[f.source].connector }] : []),
          ...(f.type === "REVENUE" ? f.conds.map(fromCond) : []),
          ...(showVendor && f.vendors.length ? [{ field: "vendor_id", op: "in", value: f.vendors }] : []),
          ...(showOffer && f.offers.length ? [{ field: "offer_id", op: "in", value: f.offers }] : []),
        ],
        calculation: ruleSaveCalculation(f.type, f.source, f.field, f.kind, pct, amt, Number(f.smsQty), editing?.calculation),
        ...ruleSaveDates(f.from, f.to), created_by: "ui",
      });
      // Editing creates a new version; stop older active versions so only the new one stays active.
      if (editing) {
        const older = (queryClient.getQueryData<ApiRule[]>(["cr-rules"]) ?? [])
          .filter((r) => r.rule_id === res.rule_id && Number(r.rule_version) !== Number(res.rule_version) && isActive(r.status));
        const targets = older.length ? older : [editing];
        const results = await Promise.allSettled(targets.map((r) => deactivateRule(r.rule_id, Number(r.rule_version))));
        if (results.some((x) => x.status === "rejected")) toast.error("New version saved, but an older version could not be made inactive.");
      }
      const toastId = `saved-rule:${res.rule_id}:${res.rule_version}`;
      const showDates = (saved: NonNullable<ReturnType<typeof returnedRuleDates>>) => {
        const warning = savedDateWarning(f.from, f.to, saved);
        if (warning) toast.warning(warning, { id: toastId, duration: Infinity, closeButton: true, className: "border-warning/40! bg-warning/10! text-warning!" });
        else toast.success(`Rule saved as ${f.name.trim()} v${res.rule_version}`, { id: toastId });
      };
      const returned = returnedRuleDates(res);
      if (returned) showDates(returned);
      else {
        toast.success(`Rule saved as ${f.name.trim()} v${res.rule_version}`, { id: toastId });
        // Observe the caller's existing refresh only; do not fetch or change query behavior.
        const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
          if (event.type !== "updated" || event.query.queryKey[0] !== "cr-rules" || event.action.type !== "success") return;
          unsubscribe();
          const loaded = queryClient.getQueryData<ApiRule[]>(["cr-rules"]);
          const version = loaded?.find((r) => r.rule_id === res.rule_id && Number(r.rule_version) === Number(res.rule_version));
          const saved = returnedRuleDates(version);
          if (saved) showDates(saved);
        });
      }
      close();
      onSaved(res.rule_id, Number(res.rule_version));
    } catch (e) { setError(saveErrMsg(e)); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) onOpenChange(true); else close(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? `Edit Rule · new version of ${editing.rule_id}` : "Create Rule"}</DialogTitle></DialogHeader>
        <ol className="flex gap-2 text-xs">
          {steps.map((i, index) => (
            <li key={i} className={cn("flex-1 rounded-md border px-2 py-1.5", i === step ? "border-primary bg-primary/5 text-foreground" : i < step ? "border-border text-foreground" : "border-border text-muted-foreground")}>
              <span className="font-semibold">{index + 1}.</span> {i === 1 && sms ? "Modifier" : STEPS[i]}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Rule Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Homelight October share" className={ph} /></Field>
              <p className="mt-1 text-xs text-muted-foreground">Rule ID: <span className="font-mono">{ruleId || "—"}</span>{f.name && !RULE_ID_RE.test(ruleId) && <span className="text-destructive"> · must start with a letter; lowercase letters, numbers, underscores</span>}</p>
              <Hint show={!f.name.trim()}>Add a rule name.</Hint>
              {nameTaken && <p className="mt-1 text-xs text-warning">A rule with this name already exists. Saving will create a new version of it.</p>}</div>
            <Field label="Applies to"><div className="flex gap-1">{(["REVENUE", "COST"] as const).map((t) => <Button key={t} type="button" size="sm" variant={f.type === t ? "default" : "outline"} onClick={() => setType(t)}>{t === "COST" ? "Cost" : "Revenue"}</Button>)}</div></Field>
            <Field label="Source">
              <select className={sel} value={f.source} disabled={!!editing} onChange={(e) => { const s = e.target.value; setF({ ...f, source: s, field: defaultField(s), kind: SMS_CONNECTORS[s] ? "event" : "revenue_share", amount: "", percent: "", smsQty: "1", vendors: [], offers: [], conds: [] }); }}>
                <option value="">Choose source</option>
                {sourcesFor(f.type).map((s) => <option key={s} value={s}>{SMS_CONNECTORS[s]?.label ?? SOURCE_LABELS[s]}</option>)}
              </select>
              <Hint show={!f.source}>Choose a source.</Hint>
            </Field>
            {!sms && !direct && fields.length > 0 && <div className="sm:col-span-2"><Field label="Field the rule uses">
              <FieldPicker value={f.field} options={fields} onChange={(v) => setF({ ...f, field: v })} />
            </Field><Hint show={!f.field}>Choose a field.</Hint></div>}
          </div>
        )}

        {step === 1 && sms && (
          <div className="space-y-3">
            <div className="text-sm font-medium">Modifier</div>
            <Field label="Per how many SMS">
              <div className="flex flex-wrap items-center gap-2">
                <Input type="number" min={0} step="any" value={f.smsQty} onChange={(e) => setF({ ...f, smsQty: e.target.value })} placeholder="e.g. 1, 1000, 10000" className={cn(ph, "w-40")} />
                {([1, 1000, 10000] as const).map((q) => <Button key={q} type="button" size="sm" variant={qtyNum === q ? "default" : "outline"} onClick={() => setF({ ...f, smsQty: String(q) })}>{q === 1 ? "Per SMS" : `Per ${q.toLocaleString("en-US")}`}</Button>)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Enter any quantity — per 1,000 SMS, per 10,000 SMS, or per SMS.</p>
            </Field>
            <Field label={`Dollars per ${qtyLabel}`}><Input type="number" min={0} step="any" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder={qtyNum === 1 ? "e.g. 0.01" : "e.g. 10"} className={ph} /></Field>
            <Hint show={perSend === null}>Enter a positive SMS quantity and a non-negative dollar amount.</Hint>
            {perSend !== null && <p className="text-sm tabular-nums">${perSend} per send · ${perSend * 1000} per 1,000 SMS</p>}
          </div>
        )}

        {step === 1 && !sms && !direct && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              {KINDS.map((k) => (
                <Button variant="outline" key={k} type="button" onClick={() => setF({ ...f, kind: k })} className={cn("h-auto flex-col items-start whitespace-normal rounded-lg border p-3 text-left text-sm", f.kind === k ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40")}>
                  <div className="font-medium">{KIND_LABELS[k]}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{k === "revenue_share" ? "Amount = field × percent / 100" : k === "roas" ? "Amount = field ÷ (percent / 100)" : "A fixed dollar amount per event"}</div>
                </Button>
              ))}
            </div>
            {f.kind === "event" ? (
              <Field label="Dollars per event"><Input type="number" min={0} step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="e.g. 25.00" className={ph} /></Field>
            ) : (
              <Field label={f.kind === "revenue_share" ? "Percent (1–100)" : "ROAS percent (may be over 100)"}><Input type="number" min={1} max={f.kind === "revenue_share" ? 100 : undefined} value={f.percent} onChange={(e) => setF({ ...f, percent: e.target.value })} placeholder={f.kind === "roas" ? "e.g. 500" : "e.g. 100"} className={ph} /></Field>
            )}
            {!valueOk && (tried || f.percent || f.amount) && <p className="text-xs text-destructive">{f.kind === "revenue_share" ? "Enter a percent from 1 to 100." : f.kind === "roas" ? "Enter a percent above 0." : "Enter a dollar amount."}</p>}
            <p className="text-xs text-muted-foreground">{f.kind === "roas" ? "Example: field is $1,000 and ROAS is 500%, amount is $200." : f.kind === "event" ? "This amount is booked per event, even if the source field is different." : `Example: ${f.field || "expected_revenue"} × ${f.percent.trim() ? f.percent : "[percent]"} / 100`}</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Field label="Start date"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field><Hint show={!f.from}>Pick a start date.</Hint></div>
              <div><Field label="End date (optional)"><Input type="date" value={f.to} min={f.from || undefined} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field></div>
            </div>
            <p className="text-sm">{rulePeriodSummary(f.from, f.to)}</p>
            {f.from && f.to && f.to < f.from && <p className="text-xs text-destructive">End date must be on or after the start date.</p>}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Optional. Only rows matching every filter use this rule.</p>
            {colsQ.isLoading && <p className="text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Loading columns…</p>}
            {colsQ.isError && <p className="text-xs text-destructive">Couldn't load columns: {errMsg(colsQ.error)}</p>}
            {f.conds.map((c, i) => {
              const upd = (p: Partial<Cond>) => setConds(f.conds.map((x, j) => (j === i ? { ...x, ...p } : x)));
              const num = NUM_OPS.includes(c.op);
              return (
              <div key={i} className="space-y-1"><div className="flex flex-wrap items-center gap-2">
                <span className="w-10 text-xs font-semibold text-muted-foreground">{i === 0 ? "IF" : "AND"}</span>
                <FieldPicker className="w-56" value={c.field} options={colNames} onChange={(v) => upd({ field: v })} />
                <select className={sel} value={c.op} onChange={(e) => upd({ op: e.target.value })}>{COND_OPS.map((o) => <option key={o} value={o}>{OP_LABELS[o] ?? o}</option>)}</select>
                {LIST_OPS.includes(c.op) ? <ChipInput value={c.list} onChange={(list) => upd({ list })} />
                  : c.op === "between" ? <><Input type="number" step="any" className={cn("h-9 w-24", ph)} value={c.value} onChange={(e) => upd({ value: e.target.value })} placeholder="min" /><span className="text-xs text-muted-foreground">and</span><Input type="number" step="any" className={cn("h-9 w-24", ph)} value={c.hi} onChange={(e) => upd({ hi: e.target.value })} placeholder="max" /></>
                  : NO_VALUE_OPS.includes(c.op) ? null
                  : <Input type={num ? "number" : "text"} step={num ? "any" : undefined} className={cn("h-9 w-40", ph)} value={c.value} onChange={(e) => upd({ value: e.target.value })} placeholder={num ? "e.g. 100" : "e.g. value"} />}
                <Button type="button" variant="ghost" size="icon" aria-label="Remove filter" onClick={() => setConds(f.conds.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {tried && !condOk(c) && <p className="pl-12 text-xs text-destructive">{num ? "Enter a number" : "Fill in this filter"} or remove it.</p>}
              </div>
            ); })}
            <Button type="button" variant="outline" size="sm" disabled={f.conds.length >= MAX_CONDS || !colNames.length} onClick={() => setConds([...f.conds, { field: colNames[0] ?? "", op: "equals", value: "", list: [], hi: "" }])}><Plus className="mr-1 h-4 w-4" /> Add filter</Button>
            {f.conds.length >= MAX_CONDS && <p className="text-xs text-muted-foreground">Up to {MAX_CONDS} filters.</p>}
            {(showVendor || showOffer) && <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
              {showVendor && <Field label="Vendor">
                <MultiPicker value={f.vendors} options={filterOpts.data?.vendors ?? []} loading={filterOpts.isLoading} onChange={(vendors) => setF({ ...f, vendors })} allLabel="All vendors" emptyText="No vendor ids for this source yet." />
                {filterOpts.isSuccess && !filterOpts.data.vendors.length && <span className="font-normal">No vendor ids for this source yet.</span>}
              </Field>}
              {showOffer && <Field label="Offer">
                <MultiPicker value={f.offers} options={filterOpts.data?.offers ?? []} loading={filterOpts.isLoading} onChange={(offers) => setF({ ...f, offers })} allLabel="All offers" emptyText="No offer ids for this source yet." />
                {!filterOpts.isLoading && !(filterOpts.data?.offers.length) && <span className="font-normal">No offer ids for this source yet.</span>}
              </Field>}
              {filterOpts.isError && <p className="text-xs text-destructive sm:col-span-2">Couldn't load vendor and offer ids: {errMsg(filterOpts.error)}</p>}
              <p className="text-xs text-muted-foreground sm:col-span-2">Leave empty to match every vendor or offer. You can also add vendor_id or offer_id as a normal filter above.</p>
            </div>}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 text-sm">
            <dl className="divide-y divide-border rounded-lg border border-border">
              {([["Name", f.name], ["Rule ID", ruleId], ["Applies to", f.type === "COST" ? "Cost" : "Revenue"], ["Source", SMS_CONNECTORS[f.source]?.label ?? SOURCE_LABELS[f.source]], ["Field", direct ? f.source === "phonexa" ? "publisher_payout" : (editing?.calculation as { field?: string } | undefined)?.field || "payout_cents" : sms ? "SMS sends" : f.field], ["Rule type", sms ? "Modifier per send" : direct ? "No modifier" : KIND_LABELS[f.kind]], [sms || direct || f.kind === "event" ? "Amount" : "Percent", valueText], ["Start date", f.from], ["End date", f.to || (sms ? "—" : "Until edited")]] as const).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v || "—"}</dd></div>
              ))}
              {f.type === "REVENUE" && <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted-foreground">Filters</dt><dd className="text-right font-medium">{f.conds.length ? f.conds.map((c, i) => <div key={i} className="font-mono text-xs">{condLine(fromCond(c))}</div>) : "None"}</dd></div>}
              {f.type === "REVENUE" && ([...(showVendor ? [["Vendors", f.vendors, "vendors", "All vendors"] as const] : []), ...(showOffer ? [["Offers", f.offers, "offers", "All offers"] as const] : [])] as const).map(([k, ids, kind, all]) => (
                <div key={k} className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{ids.length ? ids.map((id) => { const o = filterOpts.data?.[kind].find((x) => x.id === id); return <div key={id} className="font-mono text-xs">{o ? optionLabel(o) : id}</div>; }) : all}</dd></div>
              ))}
            </dl>
            {editing && <p className="text-xs text-muted-foreground">Saving adds a new version. v{editing.rule_version} will be made inactive.</p>}
            {error && <pre className="whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">{error}</pre>}
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="ghost" disabled={saving} onClick={() => (step ? setStep(steps[Math.max(0, steps.indexOf(step) - 1)]) : close())}>{step ? "Back" : "Cancel"}</Button>
          {!direct && (step < 4 ? <Button aria-disabled={!canNext} className={cn(!canNext && "opacity-50")} title={!canNext && missing ? missing : undefined} onClick={() => { if (!canNext) { setTried(true); return; } setTried(false); setStep(steps[steps.indexOf(step) + 1]); }}>Next</Button>
            : <Button disabled={saving || !mappingReady} onClick={save}>{saving ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Saving…</> : "Save & Activate"}</Button>)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
