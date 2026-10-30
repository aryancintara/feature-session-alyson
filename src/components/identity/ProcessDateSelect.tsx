import { cn } from "@/lib/utils";

/**
 * Process date picker. Empty value means "latest available day" (API picks max(process_date)).
 */
export function ProcessDateSelect({
  value,
  onChange,
  resolved,
}: {
  value: string;
  onChange: (v: string) => void;
  resolved?: string | null;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="font-medium uppercase tracking-wider">Process date</span>
      <input
        type="date"
        value={value}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "rounded-md border border-border bg-card px-2 py-1.5 text-xs font-medium text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring",
        )}
      />
      {value ? (
        <button onClick={() => onChange("")} className="rounded-md border border-border px-2 py-1 hover:bg-accent">
          Latest
        </button>
      ) : resolved ? (
        <span className="tabular-nums">latest · {resolved}</span>
      ) : null}
    </label>
  );
}

export function EmptyState({ label = "No data for process date" }: { label?: string }) {
  return <div className="px-4 py-10 text-center text-sm text-muted-foreground">{label}</div>;
}
