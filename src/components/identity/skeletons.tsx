import { cn } from "@/lib/utils";

export function Shimmer({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} />;
}

export function MetricCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Shimmer className="h-3 w-24" />
      <Shimmer className="mt-2.5 h-7 w-28" />
      <Shimmer className="mt-2 h-3 w-20" />
    </div>
  );
}

export function MetricRowSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 px-6", count >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <MetricCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Table body skeleton — matches the DataTable column count so layout never shifts. */
export function TableSkeleton({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="border-t border-border px-4 py-2.5">
              <Shimmer className={cn("h-3.5", c === 0 ? "w-40" : c % 2 ? "w-16" : "w-24")} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function ListSkeleton({ rows = 4, bar = true }: { rows?: number; bar?: boolean }) {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="px-4 py-3">
          <div className="flex items-center justify-between">
            <Shimmer className="h-3.5 w-32" />
            <Shimmer className="h-3.5 w-20" />
          </div>
          {bar ? <Shimmer className="mt-2.5 h-1.5 w-full rounded-full" /> : null}
        </li>
      ))}
    </ul>
  );
}

export function FieldsSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <Shimmer className="h-2.5 w-20" />
          <Shimmer className="mt-2 h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ bars = 7 }: { bars?: number }) {
  return (
    <div className="flex h-56 items-end gap-3 px-4 py-4">
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} className="flex flex-1 items-end" style={{ height: `${45 + ((i * 13) % 50)}%` }}>
          <Shimmer className="h-full w-full" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm text-destructive">{message}</p>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
