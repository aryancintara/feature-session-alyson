import { useState } from "react";
import { Calendar, Bookmark, X, ChevronDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export type DatePreset = "24h" | "7d" | "30d" | "90d" | "custom";

const DATE_LABELS: Record<DatePreset, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  custom: "Custom",
};

export interface FilterState {
  date: DatePreset;
  channel: string;
  audience: string;
}

const CHANNELS = ["All channels", "Web", "Meta Ads", "Google Ads", "TikTok Ads", "Email", "SMS", "Partner"];
const AUDIENCES = ["All audiences", "All Visitors", "Repeat Visitors", "Leads", "SQL Audience", "High Purchase Propensity", "Do Not Contact"];

interface FilterBarProps {
  value: FilterState;
  onChange: (next: FilterState) => void;
  /** Show audience filter (default true) */
  showAudience?: boolean;
}

const DEFAULT_FILTERS: FilterState = { date: "30d", channel: "All channels", audience: "All audiences" };

export function makeDefaultFilters(): FilterState {
  return { ...DEFAULT_FILTERS };
}

export function FilterBar({ value, onChange, showAudience = true }: FilterBarProps) {
  const [savedOpen, setSavedOpen] = useState(false);
  const [presets, setPresets] = useState<{ name: string; state: FilterState }[]>([
    { name: "Acquisition · 7d", state: { date: "7d", channel: "Meta Ads", audience: "All Visitors" } },
    { name: "SQL pipeline", state: { date: "30d", channel: "All channels", audience: "SQL Audience" } },
  ]);
  const isDirty =
    value.date !== DEFAULT_FILTERS.date ||
    value.channel !== DEFAULT_FILTERS.channel ||
    value.audience !== DEFAULT_FILTERS.audience;

  const savePreset = () => {
    const name = prompt("Name this filter preset");
    if (!name) return;
    setPresets((p) => [...p, { name, state: value }]);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
      <Filter className="h-3.5 w-3.5 text-muted-foreground" />

      {/* Quick date presets */}
      <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
        {(["24h", "7d", "30d", "90d"] as DatePreset[]).map((p) => (
          <button
            key={p}
            onClick={() => onChange({ ...value, date: p })}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium transition-colors",
              value.date === p
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {p}
          </button>
        ))}
      </div>

      <Select
        icon={<Calendar className="h-3 w-3" />}
        label={DATE_LABELS[value.date]}
        options={Object.entries(DATE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
        value={value.date}
        onChange={(v) => onChange({ ...value, date: v as DatePreset })}
      />

      <Select
        label={value.channel}
        options={CHANNELS.map((c) => ({ value: c, label: c }))}
        value={value.channel}
        onChange={(v) => onChange({ ...value, channel: v })}
      />

      {showAudience && (
        <Select
          label={value.audience}
          options={AUDIENCES.map((a) => ({ value: a, label: a }))}
          value={value.audience}
          onChange={(v) => onChange({ ...value, audience: v })}
        />
      )}

      {/* Saved presets */}
      <div className="relative">
        <button
          onClick={() => setSavedOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-accent"
        >
          <Bookmark className="h-3 w-3" />
          Saved
          <ChevronDown className="h-3 w-3" />
        </button>
        {savedOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-border bg-popover p-1 shadow-lg">
            {presets.map((p) => (
              <button
                key={p.name}
                onClick={() => {
                  onChange(p.state);
                  setSavedOpen(false);
                }}
                className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
              >
                {p.name}
                <div className="font-mono text-[10px] text-muted-foreground">
                  {DATE_LABELS[p.state.date]} · {p.state.channel}
                </div>
              </button>
            ))}
            <button
              onClick={() => {
                savePreset();
                setSavedOpen(false);
              }}
              className="mt-1 block w-full rounded border-t border-border px-2 py-1.5 text-left text-xs text-primary hover:bg-accent"
            >
              + Save current as preset
            </button>
          </div>
        )}
      </div>

      {isDirty && (
        <button
          onClick={() => onChange(makeDefaultFilters())}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  );
}

function Select({
  icon,
  label,
  options,
  value,
  onChange,
}: {
  icon?: React.ReactNode;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="relative inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-accent">
      {icon}
      <span>{label}</span>
      <ChevronDown className="h-3 w-3 text-muted-foreground" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
