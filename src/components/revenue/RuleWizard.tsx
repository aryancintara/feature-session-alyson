import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pill } from "@/components/identity/bits";
import { cn } from "@/lib/utils";
import {
  CURRENCIES, DATASETS, OBJECT_TYPES, OPERATORS, OUTPUT_FIELDS, REVENUE_TYPES,
  getDataset, opSymbol, previewImpact, slugId, type Condition, type Operator, type RevenueRule, type RuleStatus,
} from "@/lib/revenueRulesData";
import { useRulesStore } from "@/lib/revenueRulesStore";
import { fmtCompact, fmtMoney } from "@/lib/unifiedTablesData";

const STEPS = ["Rule information", "Source data", "Conditions", "Calculation", "Preview impact", "Activate"];
const selCls = "h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground";

function F({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      {children}
      {hint ? <span className="font-normal">{hint}</span> : null}
    </label>
  );
}

export function RuleWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const nav = useNavigate();
  const addRule = useRulesStore((s) => s.addRule);
  const [step, setStep] = useState(0);
  const [info, setInfo] = useState({ name: "", description: "", revenueType: "Lead Sale", objectType: "Lead", currency: "USD", effectiveDate: "2026-10-01" });
  const [datasetId, setDatasetId] = useState("unified_leads");
  const [fields, setFields] = useState<string[]>(["expected_revenue", "lead_status", "close_date"]);
  const [logic, setLogic] = useState<"AND" | "OR">("AND");
  const [conditions, setConditions] = useState<Condition[]>([{ field: "lead_status", op: "equals", value: "closed" }, { field: "expected_revenue", op: "gt", value: "0" }]);
  const [grossField, setGross] = useState("expected_revenue");
  const [deductField, setDeduct] = useState("");
  const [confirm, setConfirm] = useState(false);

  const ds = getDataset(datasetId)!;
  const numFields = ds.fields.filter((f) => f.type === "number");
  const preview = useMemo(() => previewImpact({ datasetId, logic, conditions, grossField, deductField }), [datasetId, logic, conditions, grossField, deductField]);

  const reset = () => {
    setStep(0); setConfirm(false);
    setInfo({ name: "", description: "", revenueType: "Lead Sale", objectType: "Lead", currency: "USD", effectiveDate: "2026-10-01" });
  };
  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const changeDataset = (id: string) => {
    const d = getDataset(id)!;
    const nums = d.fields.filter((f) => f.type === "number");
    setDatasetId(id);
    setFields(d.fields.slice(1, 4).map((f) => f.name));
    setConditions([{ field: d.fields[1].name, op: "exists", value: "" }]);
    setGross(nums[0]?.name ?? ""); setDeduct("");
  };

  const canNext = step === 0 ? info.name.trim().length > 0 : step === 1 ? fields.length > 0 : step === 3 ? !!grossField : true;

  const save = (status: RuleStatus) => {
    const now = new Date().toISOString().slice(0, 10);
    const rule: RevenueRule = {
      id: slugId(info.name, info.revenueType), name: info.name.trim(), description: info.description.trim() || `Calculates ${info.revenueType.toLowerCase()} revenue.`,
      revenueType: info.revenueType, objectType: info.objectType, currency: info.currency, effectiveDate: info.effectiveDate,
      recordType: null, datasetId, fields, logic, conditions: conditions.filter((c) => c.field), grossField, deductField,
      version: "v1", status, createdBy: "Admin", created: now, updated: now,
      versions: [{ version: "v1", date: now, status: status === "Active" ? "Active" : "Draft", note: "Initial version" }], custom: true,
    };
    addRule(rule);
    close(false);
    nav({ to: "/unified-revenue/rules/$ruleId", params: { ruleId: rule.id } });
  };

  const setCond = (i: number, patch: Partial<Condition>) => setConditions((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create revenue rule</DialogTitle>
          <DialogDescription>Define what qualifies as revenue and how it is calculated.</DialogDescription>
        </DialogHeader>

        <ol className="flex flex-wrap gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s} className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]", i === step ? "border-primary bg-primary/10 text-foreground" : i < step ? "border-border text-foreground" : "border-border text-muted-foreground")}>
              <span className={cn("flex h-4 w-4 items-center justify-center rounded-full text-[10px]", i < step ? "bg-primary text-primary-foreground" : "bg-muted")}>{i < step ? <Check className="h-2.5 w-2.5" /> : i + 1}</span>
              {s}
            </li>
          ))}
        </ol>

        <div className="min-h-[300px] py-2">
          {step === 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><F label="Rule name"><Input value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} placeholder="Lead Sale Revenue Rule" /></F></div>
              <div className="sm:col-span-2"><F label="Rule description"><Textarea rows={2} value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} placeholder="Calculates revenue generated from sold leads." /></F></div>
              <F label="Revenue type"><select className={selCls} value={info.revenueType} onChange={(e) => setInfo({ ...info, revenueType: e.target.value })}>{REVENUE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></F>
              <F label="Object type"><select className={selCls} value={info.objectType} onChange={(e) => setInfo({ ...info, objectType: e.target.value })}>{OBJECT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></F>
              <F label="Currency"><select className={selCls} value={info.currency} onChange={(e) => setInfo({ ...info, currency: e.target.value })}>{CURRENCIES.map((t) => <option key={t}>{t}</option>)}</select></F>
              <F label="Effective date"><Input type="date" value={info.effectiveDate} onChange={(e) => setInfo({ ...info, effectiveDate: e.target.value })} /></F>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <F label="Source"><select className={selCls} disabled><option>Unified Tables</option></select></F>
                <F label="Source dataset"><select className={selCls} value={datasetId} onChange={(e) => changeDataset(e.target.value)}>{DATASETS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></F>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">Available fields · {fields.length} selected</div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {ds.fields.map((f) => {
                    const on = fields.includes(f.name);
                    return (
                      <button type="button" key={f.name} onClick={() => setFields((xs) => (on ? xs.filter((x) => x !== f.name) : [...xs, f.name]))}
                        className={cn("flex items-start gap-2 rounded-md border p-2 text-left", on ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40")}>
                        <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{on && <Check className="h-3 w-3" />}</span>
                        <span><span className="font-mono text-xs">{f.name}</span> <span className="text-[10px] text-muted-foreground">{f.type}</span><span className="block text-xs text-muted-foreground">{f.description}</span></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Match records when
                <div className="inline-flex rounded-md border border-border p-0.5">
                  {(["AND", "OR"] as const).map((l) => <button key={l} type="button" onClick={() => setLogic(l)} className={cn("rounded px-2 py-0.5 text-xs font-medium", logic === l ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{l === "AND" ? "ALL (AND)" : "ANY (OR)"}</button>)}
                </div>
                conditions are true
              </div>
              <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
                <div className="text-xs font-semibold text-muted-foreground">IF</div>
                {conditions.map((c, i) => (
                  <div key={i} className="space-y-2">
                    {i > 0 && <div className="text-xs font-semibold text-primary">{logic}</div>}
                    <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                      <select className={selCls} value={c.field} onChange={(e) => setCond(i, { field: e.target.value })}>{ds.fields.map((f) => <option key={f.name}>{f.name}</option>)}</select>
                      <select className={selCls} value={c.op} onChange={(e) => setCond(i, { op: e.target.value as Operator })}>{OPERATORS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
                      <Input disabled={c.op === "exists"} value={c.op === "exists" ? "" : c.value} onChange={(e) => setCond(i, { value: e.target.value })} placeholder={c.op === "exists" ? "—" : "value"} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => setConditions((cs) => cs.filter((_, j) => j !== i))} aria-label="Remove condition"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setConditions((cs) => [...cs, { field: ds.fields[1].name, op: "equals", value: "" }])}><Plus className="mr-1 h-3.5 w-3.5" /> Add condition</Button>
                <div className="pt-1 text-xs font-semibold text-muted-foreground">THEN <span className="font-normal text-foreground">Create {info.revenueType} revenue event</span></div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <F label="Gross Revenue =" hint="Numeric field used as the original amount."><select className={selCls} value={grossField} onChange={(e) => setGross(e.target.value)}>{numFields.map((f) => <option key={f.name}>{f.name}</option>)}</select></F>
                <F label="Net Revenue = Gross Revenue −" hint="Optional adjustment such as refunds."><select className={selCls} value={deductField} onChange={(e) => setDeduct(e.target.value)}><option value="">(no adjustment)</option>{numFields.filter((f) => f.name !== grossField).map((f) => <option key={f.name}>{f.name}</option>)}</select></F>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">Output fields</div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {OUTPUT_FIELDS.map((o) => (
                    <div key={o.name} className="rounded-md border border-border p-2 text-sm">
                      <div className="font-medium">{o.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.name === "Gross Revenue" ? <span className="font-mono">{grossField}</span> : o.name === "Net Revenue" ? <span className="font-mono">{deductField ? `gross_revenue − ${deductField}` : "gross_revenue"}</span> : o.name === "Currency" ? info.currency : "estimated → earned → invoiced → received"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Records matched</div><div className="mt-1 text-2xl font-semibold tabular-nums">{fmtCompact(preview.matched)}</div><div className="text-xs text-muted-foreground">of {fmtCompact(ds.totalRecords)} in {ds.name}</div></div>
                <div className="rounded-lg border border-border p-3"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Estimated revenue</div><div className="mt-1 text-2xl font-semibold tabular-nums">{fmtMoney(preview.revenue)}</div><div className="text-xs text-muted-foreground">Net, extrapolated from a {ds.rows.length}-row sample</div></div>
              </div>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground"><th className="px-3 py-2 font-medium">{ds.idField}</th><th className="px-3 py-2 font-medium">Input values</th><th className="px-3 py-2 text-right font-medium">Calculated revenue</th><th className="px-3 py-2 font-medium">Status</th></tr></thead>
                  <tbody>
                    {preview.sample.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No sample records match these conditions.</td></tr>}
                    {preview.sample.map((s) => (
                      <tr key={s.id} className="border-b border-border/50 last:border-0">
                        <td className="px-3 py-2 font-mono text-xs">{s.id}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{Object.entries(s.inputs).map(([k, v]) => `${k}=${String(v)}`).join(", ")}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(s.net)}</td>
                        <td className="px-3 py-2"><Pill tone="info">Estimated</Pill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-muted/20 p-4 font-mono text-xs leading-6">
                <div className="font-sans text-sm font-semibold">{info.name || "Untitled rule"}</div>
                <div className="text-muted-foreground">Source: {ds.name}</div>
                <div className="font-semibold">IF</div>
                {conditions.filter((c) => c.field).map((c, i) => <div key={i} className="pl-4">{i > 0 && <span className="text-primary">{logic} </span>}{c.field} {opSymbol(c.op)} {c.op === "exists" ? "" : c.value}</div>)}
                <div className="font-semibold">THEN</div>
                <div className="pl-4">Create {info.revenueType} revenue · Amount: {grossField}{deductField ? ` − ${deductField}` : ""}</div>
              </div>
              {confirm && (
                <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                  <div className="font-medium">Activate rule?</div>
                  <div className="text-muted-foreground">This will apply this rule to matching revenue records (~{fmtCompact(preview.matched)} records).</div>
                  <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => save("Active")}>Activate</Button><Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button></div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <Button variant="ghost" size="sm" onClick={() => (step === 0 ? close(false) : setStep(step - 1))}>{step === 0 ? "Cancel" : "Back"}</Button>
          <div className="flex gap-2">
            {step === 5 ? (
              <>
                <Button variant="outline" size="sm" onClick={() => save("Draft")}>Save draft</Button>
                <Button variant="outline" size="sm" onClick={() => save("Testing")}>Save as testing</Button>
                <Button size="sm" onClick={() => setConfirm(true)}>Activate</Button>
              </>
            ) : (
              <Button size="sm" disabled={!canNext} onClick={() => setStep(step + 1)}>Next</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
