import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronRight, Download, Minus, Table2 } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { HelpTip } from "@/components/identity/HelpTip";
import { downloadCsv } from "@/lib/identityMetricsData";

// ---------------------------------------------------------------- metric card

export function TrendMetricCard({
  label,
  description,
  help,
  value,
  previous,
  previousLabel,
  goodDirection = "up",
  onDrillDown,
}: {
  label: string;
  description?: string;
  /** Plain-language tooltip for this KPI. */
  help?: string;
  value: string;
  previous: string;
  previousLabel: string;
  goodDirection?: "up" | "down";
  onDrillDown?: () => void;
}) {
  const numeric = (s: string) => Number(s.replace(/[^0-9.-]/g, ""));
  const delta = numeric(value) - numeric(previous);
  const flat = Math.abs(delta) < 0.0001;
  const good = goodDirection === "up" ? delta > 0 : delta < 0;
  const Icon = flat ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const tone = flat ? "text-muted-foreground" : good ? "text-success" : "text-destructive";
  const relDelta = numeric(previous) ? (delta / Math.abs(numeric(previous))) * 100 : 0;

  return (
    <div
      onClick={onDrillDown}
      role={onDrillDown ? "button" : undefined}
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        onDrillDown && "cursor-pointer transition-colors hover:border-primary/50 hover:bg-accent/30",
      )}
    >
      <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
        {help ? <HelpTip text={help} /> : null}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums", tone)}>
          <Icon className="h-3.5 w-3.5" />
          {flat ? "flat" : `${Math.abs(relDelta).toFixed(1)}%`}
        </span>
      </div>
      <div className="mt-1 text-[11px] tabular-nums text-muted-foreground">
        {previousLabel}: {previous}
      </div>
      {description ? <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{description}</p> : null}
      {onDrillDown ? (
        <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
          Audit <ChevronRight className="h-3 w-3" />
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- charts

const COLORS = ["var(--primary)", "var(--destructive)", "var(--success)", "var(--info)"];

export function MetricLineChart({
  data,
  series,
  yUnit = "%",
  height = 240,
}: {
  data: Record<string, unknown>[];
  series: { key: string; label: string }[];
  yUnit?: string;
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full px-2 pb-3 pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickLine={false} />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="var(--muted-foreground)"
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}${yUnit}`}
            width={52}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number, n: string) => [`${v}${yUnit}`, n]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------- raw data toolbar

export function RawDataActions({
  rows,
  filename,
  onViewData,
  viewing,
}: {
  rows: Record<string, unknown>[];
  filename: string;
  onViewData?: () => void;
  viewing?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {onViewData ? (
        <button
          onClick={onViewData}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
            viewing ? "border-primary bg-primary/10" : "border-border hover:bg-accent",
          )}
        >
          <Table2 className="h-3.5 w-3.5" /> View Data
        </button>
      ) : null}
      <button
        onClick={() => downloadCsv(filename, rows)}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-accent"
      >
        <Download className="h-3.5 w-3.5" /> Export CSV
      </button>
    </div>
  );
}

export function RawDataTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <div className="px-4 py-6 text-sm text-muted-foreground">No underlying records.</div>;
  const cols = Object.keys(rows[0]);
  return (
    <div className="max-h-80 overflow-auto border-t border-border">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
          <tr>
            {cols.map((c) => (
              <th key={c} className="whitespace-nowrap px-3 py-1.5 text-left font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((r, i) => (
            <tr key={i} className="hover:bg-accent/40">
              {cols.map((c) => (
                <td key={c} className="whitespace-nowrap border-t border-border px-3 py-1.5 font-mono">
                  {String(r[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- expandable row

export function ExpandToggle({ open }: { open: boolean }) {
  return open ? (
    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
  ) : (
    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
  );
}

export function useExpanded() {
  const [open, setOpen] = useState<string | null>(null);
  return {
    open,
    toggle: (k: string) => setOpen((p) => (p === k ? null : k)),
  };
}

export function KeyValues({ data, tips }: { data: Record<string, string>; tips?: Record<string, string> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-3">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="space-y-1">
          <dt className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {k.replace(/_/g, " ")}
            {tips?.[k] ? <HelpTip text={tips[k]} /> : null}
          </dt>
          <dd className="font-mono text-sm font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------- explanation panel

export function ExplainPanel({
  formula,
  inputDataset,
  comparedAgainst,
  result,
  plainEnglish,
  terms = [],
  defaultOpen = false,
}: {
  formula: string;
  inputDataset: string;
  comparedAgainst: string;
  result: string;
  plainEnglish?: string;
  terms?: { label: string; value: string }[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border bg-muted/30">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="text-xs font-semibold">How was this calculated?</span>
        <ExpandToggle open={open} />
      </button>
      {open ? (
        <div className="space-y-3 border-t border-border px-3 py-3">
          {plainEnglish ? <p className="text-xs text-muted-foreground">{plainEnglish}</p> : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Input dataset</div>
              <div className="text-xs font-medium">{inputDataset}</div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Compared against</div>
              <div className="text-xs font-medium">{comparedAgainst}</div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Result</div>
              <div className="text-xs font-semibold tabular-nums">{result}</div>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Calculation</div>
            <code className="mt-1 block rounded border border-border bg-card px-2 py-1.5 font-mono text-xs">{formula}</code>
          </div>
          {terms.length ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {terms.map((t) => (
                <div key={t.label} className="rounded border border-border bg-card px-2 py-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.label}</div>
                  <div className="text-sm font-semibold tabular-nums">{t.value}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- grain toggle chart

const GRAIN_KEYS = ["daily", "weekly", "monthly", "yoy"] as const;
export type ChartGrain = (typeof GRAIN_KEYS)[number];

export function GrainToggle({ grain, onChange }: { grain: ChartGrain; onChange: (g: ChartGrain) => void }) {
  const labels: Record<ChartGrain, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yoy: "YoY" };
  return (
    <div className="flex gap-1">
      {GRAIN_KEYS.map((g) => (
        <button
          key={g}
          onClick={() => onChange(g)}
          className={cn(
            "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
            grain === g ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {labels[g]}
        </button>
      ))}
    </div>
  );
}
