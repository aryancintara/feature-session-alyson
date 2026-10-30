import { cn } from "@/lib/utils";
import { HelpTip } from "@/components/identity/HelpTip";
import { IdentityRefreshButton } from "@/components/identity/IdentityRefreshButton";
import { HELP } from "@/lib/identityHelpText";

/**
 * Shared Identity date range (inclusive, max 7 calendar days).
 * Empty from/to means "latest available day" — the API picks it.
 */
export type DateRange = { from: string; to: string };

export const MAX_RANGE_DAYS = 7;

export function makeLatestRange(): DateRange {
  return { from: "", to: "" };
}

export function isLatest(r: DateRange) {
  return !r.from && !r.to;
}

const DAY = 86_400_000;

function parse(d: string) {
  return new Date(`${d}T00:00:00Z`).getTime();
}

function fmt(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function daysInRange(r: DateRange) {
  if (!r.from || !r.to) return r.from || r.to ? 1 : 0;
  return Math.round((parse(r.to) - parse(r.from)) / DAY) + 1;
}

/** Clamps a range to at most MAX_RANGE_DAYS inclusive days, keeping `anchor` fixed. */
export function clampRange(r: DateRange, anchor: "from" | "to"): DateRange {
  if (!r.from || !r.to) return r;
  let from = parse(r.from);
  let to = parse(r.to);
  if (to < from) {
    if (anchor === "from") to = from;
    else from = to;
  }
  const span = Math.round((to - from) / DAY) + 1;
  if (span > MAX_RANGE_DAYS) {
    if (anchor === "from") to = from + (MAX_RANGE_DAYS - 1) * DAY;
    else from = to - (MAX_RANGE_DAYS - 1) * DAY;
  }
  return { from: fmt(from), to: fmt(to) };
}

/** Builds a trailing range of `days` days ending at `end` (defaults to yesterday, UTC). */
export function lastNDays(days: number, end?: string | null): DateRange {
  const n = Math.min(Math.max(days, 1), MAX_RANGE_DAYS);
  const to = end ? parse(end) : Date.now() - DAY;
  const toDay = parse(fmt(to));
  return { from: fmt(toDay - (n - 1) * DAY), to: fmt(toDay) };
}

const PRESETS = [
  { label: "1d", days: 1 },
  { label: "3d", days: 3 },
  { label: "7d", days: 7 },
];

export function DateRangeSelect({
  value,
  onChange,
  resolved,
  className,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  /** Latest process date reported by the API, used as the preset anchor. */
  resolved?: string | null;
  className?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const span = daysInRange(value);

  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-xs text-muted-foreground", className)}>
      <span className="inline-flex items-center gap-1 font-medium uppercase tracking-wider">
        Date range
        <HelpTip text={HELP.dateRange} />
      </span>

      <div className="flex rounded-md border border-border p-0.5">
        <button
          onClick={() => onChange(makeLatestRange())}
          className={cn(
            "rounded px-2 py-1 text-[11px] font-medium",
            isLatest(value) ? "bg-primary text-primary-foreground" : "hover:bg-accent",
          )}
        >
          Latest
        </button>
        {PRESETS.map((p) => {
          const active = !isLatest(value) && span === p.days;
          return (
            <button
              key={p.label}
              onClick={() => onChange(lastNDays(p.days, resolved ?? null))}
              className={cn(
                "rounded px-2 py-1 text-[11px] font-medium",
                active ? "bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <input
        type="date"
        aria-label="From date"
        value={value.from}
        max={today}
        onChange={(e) => {
          const from = e.target.value;
          onChange(clampRange({ from, to: value.to || from }, "from"));
        }}
        className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <span>to</span>
      <input
        type="date"
        aria-label="To date"
        value={value.to}
        max={today}
        onChange={(e) => {
          const to = e.target.value;
          onChange(clampRange({ from: value.from || to, to }, "to"));
        }}
        className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />

      <IdentityRefreshButton />

      {isLatest(value) ? (
        resolved ? <span className="tabular-nums">latest · {resolved}</span> : null
      ) : (
        <span className="tabular-nums">
          {span} day{span === 1 ? "" : "s"} · max {MAX_RANGE_DAYS}
        </span>
      )}
    </div>
  );
}
