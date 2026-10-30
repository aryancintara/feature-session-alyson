// Static mock data + shared types for the Cost & Revenue MVP (frontend only).
import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CRType = "COST" | "REVENUE";
export type CRRuleStatus = "Draft" | "Active" | "Inactive";
export type CREventStatus = "Processed" | "Pending" | "Failed";
export type CondOp = "equals" | "not equals" | "greater than" | "less than" | "exists";
export type ArithOp = "+" | "-" | "×" | "÷";

export interface Condition { field: string; op: CondOp; value: string }
export type Calc =
  | { kind: "field"; field: string }
  | { kind: "fixed"; value: number }
  | { kind: "arith"; left: string; op: ArithOp; right: string };

export interface CRRule {
  id: string; name: string; type: CRType; source: string; version: number; status: CRRuleStatus;
  description: string; createdAt: string; updatedAt: string; lastRun: string;
  conditions: Condition[]; join: "AND" | "OR"; calc: Calc; custom?: boolean;
}

export interface CREvent {
  id: string; processedAt: string; sessionId: string; type: CRType; source: string; amount: number; currency: string;
  ruleId: string; ruleVersion: number; status: CREventStatus; inputs: Record<string, string | number>;
  sourceRecordId: string; runId: string;
}

export const CR_SOURCES = ["Tune", "Home Loans"];
export const COND_OPS: CondOp[] = ["equals", "not equals", "greater than", "less than", "exists"];
export const ARITH_OPS: ArithOp[] = ["+", "-", "×", "÷"];

export const SOURCE_FIELDS: Record<string, string[]> = {
  Tune: ["event_type", "session_id", "click_count", "payout"],
  "Home Loans": ["session_id", "loan_status", "loan_amount", "revenue_share_percent"],
};

const FIELD_LABEL: Record<string, string> = {
  loan_amount: "Loan Amount", revenue_share_percent: "Revenue Share", revenue_amount: "revenue_amount",
};
const PERCENT = new Set(["revenue_share_percent"]);
const MONEY = new Set(["loan_amount", "revenue_amount", "payout"]);

export const SEED_CR_RULES: CRRule[] = [
  { id: "rule_tune_qclick", name: "Tune Qualified Click Cost", type: "COST", source: "Tune", version: 1, status: "Active", description: "Charges a fixed cost for every qualified click reported by Tune.", createdAt: "2026-08-02", updatedAt: "2026-09-18", lastRun: "2026-09-24 23:05", conditions: [{ field: "event_type", op: "equals", value: "qualified_click" }, { field: "session_id", op: "exists", value: "" }], join: "AND", calc: { kind: "fixed", value: 18 } },
  { id: "rule_homeloan_share", name: "Home Loan Revenue Share", type: "REVENUE", source: "Home Loans", version: 1, status: "Active", description: "Earns a percentage of the loan amount once a loan is funded.", createdAt: "2026-08-11", updatedAt: "2026-09-22", lastRun: "2026-09-24 23:05", conditions: [{ field: "loan_status", op: "equals", value: "funded" }], join: "AND", calc: { kind: "arith", left: "loan_amount", op: "×", right: "revenue_share_percent" } },
  { id: "rule_tune_payout", name: "Tune Partner Payout Cost", type: "COST", source: "Tune", version: 2, status: "Active", description: "Uses the payout amount Tune reports for conversion events.", createdAt: "2026-07-14", updatedAt: "2026-09-10", lastRun: "2026-09-24 23:05", conditions: [{ field: "event_type", op: "equals", value: "conversion" }], join: "AND", calc: { kind: "field", field: "payout" } },
];

// ---------- Formatting ----------
/** Whole-dollar money for tables and tiles: $1,234 */
export const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
/** Exact money for the calculation drawer: $1,234.56 */
export const moneyExact = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Display-only source label. Stored values are unchanged. */
export function srcLabel(s: string | null | undefined) {
  if (!s) return "";
  const k = s.toLowerCase().replace(/\s+/g, "");
  if (k === "homeloans" || k === "homelight" || k.startsWith("homelight(")) return "Homelight";
  if (k === "tune") return "Tune";
  return s;
}
/** YYYY-MM-DD, or YYYY-MM-DD HH:mm UTC when a time is present. Never seconds. */
export function fmtTs(s: string | null | undefined) {
  if (!s) return "";
  const m = String(s).match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/);
  if (!m) return String(s);
  return m[2] ? `${m[1]} ${m[2]} UTC` : m[1];
}
export function fmtVal(field: string, v: string | number | undefined) {
  if (v === undefined || v === "") return "—";
  if (typeof v === "number" && PERCENT.has(field)) return `${v}%`;
  if (typeof v === "number" && MONEY.has(field)) return moneyExact(v);
  return String(v);
}
export function operand(x: string) { return x === "" || isNaN(Number(x)) ? x : Number(x); }
function opVal(x: string, inputs: Record<string, string | number>) {
  const n = Number(x);
  if (x !== "" && !isNaN(n)) return n;
  const v = Number(inputs[x] ?? 0);
  return PERCENT.has(x) ? v / 100 : v;
}

export function calcText(r: Pick<CRRule, "type" | "calc">) {
  const lhs = r.type === "COST" ? "Cost" : "Revenue";
  const c = r.calc;
  if (c.kind === "field") return `${lhs} = ${c.field}`;
  if (c.kind === "fixed") return `${lhs} = ${money(c.value)}`;
  return `${lhs} = ${c.left} ${c.op} ${c.right}`;
}
export function condText(c: Condition) {
  return c.op === "exists" ? `${c.field} exists` : `${c.field} ${({ equals: "=", "not equals": "≠", "greater than": ">", "less than": "<" } as const)[c.op]} ${c.value}`;
}

export function evalConds(conds: Condition[], join: "AND" | "OR", row: Record<string, string | number>) {
  const ok = (c: Condition) => {
    const v = row[c.field];
    if (c.op === "exists") return v !== undefined && v !== "";
    if (c.op === "equals") return String(v) === c.value;
    if (c.op === "not equals") return String(v) !== c.value;
    if (c.op === "greater than") return Number(v) > Number(c.value);
    return Number(v) < Number(c.value);
  };
  if (!conds.length) return true;
  return join === "AND" ? conds.every(ok) : conds.some(ok);
}

export function computeAmount(calc: Calc, inputs: Record<string, string | number>) {
  if (calc.kind === "fixed") return calc.value * Number(inputs.click_count ?? 1);
  if (calc.kind === "field") return Number(inputs[calc.field] ?? 0);
  const a = opVal(calc.left, inputs), b = opVal(calc.right, inputs);
  const r = calc.op === "+" ? a + b : calc.op === "-" ? a - b : calc.op === "×" ? a * b : b ? a / b : 0;
  return Math.round(r * 100) / 100;
}

/** Plain explanation of how an event's amount was produced. */
export function explain(rule: CRRule, e: Pick<CREvent, "inputs" | "amount">) {
  const c = rule.calc;
  const show = (x: string) => (x !== "" && !isNaN(Number(x)) ? x : fmtVal(x, e.inputs[x]));
  if (c.kind === "fixed") {
    const n = Number(e.inputs.click_count ?? 1);
    const what = String(e.inputs.event_type ?? "event").replace(/_/g, " ");
    return { inputs: [`${n} ${what}${n > 1 ? "s" : ""}`], formula: `${n} × ${money(c.value)}` };
  }
  if (c.kind === "field") return { inputs: [`${c.field} = ${fmtVal(c.field, e.inputs[c.field])}`], formula: `Use ${c.field}` };
  const lines = [c.left, c.right].filter((x) => isNaN(Number(x))).map((x) => `${FIELD_LABEL[x] ?? x} = ${fmtVal(x, e.inputs[x])}`);
  return { inputs: lines, formula: `${show(c.left)} ${c.op} ${show(c.right)}` };
}

// ---------- Mock events ----------
function rnd(seed: number) { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); }

function buildEvents(): CREvent[] {
  const out: CREvent[] = [];
  const featured: [string, string, Record<string, string | number>][] = [
    ["ses_123", "rule_tune_qclick", { event_type: "qualified_click", session_id: "ses_123", click_count: 1 }],
    ["ses_789", "rule_homeloan_share", { session_id: "ses_789", loan_status: "funded", loan_amount: 500000, revenue_share_percent: 1 }],
  ];
  const active = SEED_CR_RULES.filter((r) => r.status === "Active");
  for (let i = 0; i < 160; i++) {
    let sid: string, rule: CRRule, inputs: Record<string, string | number>;
    if (i < featured.length) { const [s, rid, inp] = featured[i]; sid = s; rule = SEED_CR_RULES.find((r) => r.id === rid)!; inputs = inp; }
    else {
      rule = active[Math.floor(rnd(i) * active.length)];
      sid = `ses_${(1000 + i * 7).toString()}`;
      if (rule.id === "rule_tune_qclick") inputs = { event_type: "qualified_click", session_id: sid, click_count: 5 + Math.floor(rnd(i + 1) * 36) };
      else if (rule.id === "rule_tune_payout") inputs = { event_type: "conversion", session_id: sid, payout: 150 + Math.round(rnd(i + 2) * 400) };
      else inputs = { session_id: sid, loan_status: "funded", loan_amount: 150000 + Math.round(rnd(i + 5) * 50) * 10000, revenue_share_percent: rnd(i + 6) > 0.5 ? 1 : 0.75 };
    }
    const status: CREventStatus = i > 3 && i % 23 === 0 ? "Failed" : i > 3 && i % 17 === 0 ? "Pending" : "Processed";
    const t = new Date(Date.UTC(2026, 8, 24, 23, 40) - i * 37 * 60000);
    out.push({
      id: `evt_${String(50000 - i)}`, processedAt: t.toISOString().slice(0, 16).replace("T", " "), sessionId: sid, type: rule.type, source: rule.source,
      amount: status === "Failed" ? 0 : computeAmount(rule.calc, inputs), currency: "USD", ruleId: rule.id, ruleVersion: rule.version, status, inputs,
      sourceRecordId: `${rule.source.toLowerCase().replace(/\s/g, "")}_row_${88000 + i}`, runId: `run_2026-09-24_${String(Math.floor(i / 30)).padStart(2, "0")}`,
    });
  }
  return out;
}
export const CR_EVENTS: CREvent[] = buildEvents();

/** Sample source rows used for the rule-builder preview. */
export function sampleRows(source: string): Record<string, string | number>[] {
  return Array.from({ length: 8 }, (_, i): Record<string, string | number> => {
    const sid = `ses_${101 + i}`;
    if (source === "Tune") return { session_id: sid, event_type: i % 3 === 2 ? "impression" : i % 4 === 3 ? "conversion" : "qualified_click", click_count: 1 + (i % 2), payout: 25 + i * 5 };
    return { session_id: sid, loan_status: i % 3 === 1 ? "pending" : "funded", loan_amount: 250000 + i * 50000, revenue_share_percent: 1 };
  });
}

export function ruleStatusTone(s: CRRuleStatus) { return s === "Active" ? "success" : s === "Draft" ? "warning" : "neutral"; }
export function eventStatusTone(s: CREventStatus) { return s === "Processed" ? "success" : s === "Pending" ? "warning" : "danger"; }
export function typeTone(t: CRType) { return t === "COST" ? "warning" : "info"; }

// ---------- Local store for builder-created rules ----------
interface CRState {
  custom: CRRule[];
  overrides: Record<string, { status: CRRuleStatus; updatedAt: string }>;
  addRule: (r: CRRule) => void;
  setStatus: (id: string, s: CRRuleStatus) => void;
}
const today = () => new Date().toISOString().slice(0, 10);
export const useCRStore = create<CRState>()(
  persist(
    (set) => ({
      custom: [], overrides: {},
      addRule: (r) => set((s) => ({ custom: [r, ...s.custom] })),
      setStatus: (id, status) => set((s) => s.custom.some((r) => r.id === id)
        ? { custom: s.custom.map((r) => (r.id === id ? { ...r, status, updatedAt: today() } : r)) }
        : { overrides: { ...s.overrides, [id]: { status, updatedAt: today() } } }),
    }),
    { name: "cost-revenue-rules:v1", skipHydration: true },
  ),
);
export function useCRRules(): CRRule[] {
  useEffect(() => { void useCRStore.persist.rehydrate(); }, []);
  const custom = useCRStore((s) => s.custom);
  const o = useCRStore((s) => s.overrides);
  return [...custom, ...SEED_CR_RULES.map((r) => (o[r.id] ? { ...r, ...o[r.id] } : r))];
}
export function ruleRecords(id: string) { return CR_EVENTS.filter((e) => e.ruleId === id && e.status === "Processed").length * 78; }
