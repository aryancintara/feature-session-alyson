import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, ArrowDown, ArrowUp, Columns3, Download, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type Trend = number[];

export type Column<T> = {
  key: string;
  header: string;
  /** Cell renderer */
  cell: (row: T) => React.ReactNode;
  /** Raw value for sorting / filtering / CSV. */
  value?: (row: T) => string | number;
  align?: "left" | "right";
  width?: string;
  className?: string;
  /** Optional default-hidden column */
  defaultHidden?: boolean;
  /** Pin the column to the right edge of the table */
  sticky?: "right";
};

interface AnalyticsTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  searchPlaceholder?: string;
  /** Override download filename */
  csvName?: string;
  /** Optional toolbar slot rendered to the left of column/CSV controls */
  toolbar?: React.ReactNode;
  /** Persist column visibility in localStorage under this key */
  storageKey?: string;
  /** Optional controlled search value */
  query?: string;
  onQueryChange?: (q: string) => void;
  /** Optional per-row class (e.g. status tint) */
  rowClassName?: (row: T) => string | undefined;
  /** Optional summary rendered above the table for the rows on the current page */
  summary?: (pageRows: T[], info: { total: number; paginated: boolean }) => React.ReactNode;
  /** Keep the header row visible while scrolling the table body */
  stickyHeader?: boolean;
  /** When sticky, offset (px) from the top of the page scroll area, e.g. below a sticky filter bar */
  stickyTop?: number;
}

export function Sparkline({ data, className }: { data: Trend; className?: string }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 60;
  const h = 18;
  const step = w / (data.length - 1 || 1);
  const points = data
    .map((v, i) => `${i * step},${h - ((v - min) / range) * h}`)
    .join(" ");
  const up = data[data.length - 1] >= data[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-4 w-[60px]", className)}>
      <polyline
        points={points}
        fill="none"
        stroke={up ? "var(--color-success)" : "var(--color-destructive)"}
        strokeWidth="1.25"
      />
    </svg>
  );
}

export function VarianceCell({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-mono text-xs tabular-nums",
        positive ? "text-success" : "text-destructive",
      )}
    >
      {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
}

function toCsv<T>(rows: T[], cols: Column<T>[]): string {
  const head = cols.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(",");
  const body = rows
    .map((r) =>
      cols
        .map((c) => {
          const v = c.value ? c.value(r) : "";
          const s = String(v ?? "").replace(/"/g, '""');
          return `"${s}"`;
        })
        .join(","),
    )
    .join("\n");
  return `${head}\n${body}`;
}

export function AnalyticsTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  pageSize = 25,
  searchPlaceholder = "Search rows…",
  csvName = "export.csv",
  toolbar,
  storageKey,
  query: queryProp,
  onQueryChange,
  rowClassName,
  summary,
  stickyHeader,
  stickyTop = 0,
}: AnalyticsTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [queryState, setQueryState] = useState("");
  const query = queryProp ?? queryState;
  const setQuery = (q: string) => { setQueryState(q); onQueryChange?.(q); };
  useEffect(() => { if (queryProp !== undefined) setPage(0); }, [queryProp]);
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const prefKey = storageKey ? `table-cols:${storageKey}` : null;
  useEffect(() => {
    if (!prefKey) return;
    try { const v = localStorage.getItem(prefKey); if (v) setHidden(new Set(JSON.parse(v))); } catch { /* ignore */ }
  }, [prefKey]);
  useEffect(() => {
    if (prefKey) localStorage.setItem(prefKey, JSON.stringify([...hidden]));
  }, [prefKey, hidden]);

  const visibleCols = useMemo(() => columns.filter((c) => !hidden.has(c.key)), [columns, hidden]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      columns.some((c) => {
        const v = c.value ? c.value(r) : "";
        return String(v).toLowerCase().includes(q);
      }),
    );
  }, [rows, query, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col || !col.value) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = col.value!(a);
      const bv = col.value!(b);
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return arr;
  }, [filtered, sortKey, sortDir, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const paged = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const exportCsv = () => {
    const csv = toCsv(sorted, visibleCols);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-[200px] flex-1 items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </div>
        {toolbar}
        <div className="relative">
          <button
            onClick={() => setPickerOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-accent"
          >
            <Columns3 className="h-3.5 w-3.5" />
            Columns
          </button>
          {pickerOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-border bg-popover p-2 shadow-lg">
              <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Show columns
              </div>
              {columns.map((c) => {
                const on = !hidden.has(c.key);
                return (
                  <label
                    key={c.key}
                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => {
                        setHidden((prev) => {
                          const next = new Set(prev);
                          if (on) next.add(c.key);
                          else next.delete(c.key);
                          return next;
                        });
                      }}
                    />
                    {c.header}
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-accent"
        >
          <Download className="h-3.5 w-3.5" />
          CSV
        </button>
      </div>

      {summary && <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">{summary(paged, { total: sorted.length, paginated: pageCount > 1 })}</div>}
      {/* Table */}
      <div className={stickyHeader ? undefined : "overflow-x-auto"}>
        <table className="w-full text-sm">
          <thead className={stickyHeader ? "sticky z-10 bg-card shadow-[0_1px_0_var(--color-border)]" : undefined} style={stickyHeader ? { top: stickyTop } : undefined}>
            <tr className="border-b border-border bg-muted/30 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {visibleCols.map((c) => (
                <th
                  key={c.key}
                  style={{ width: c.width }}
                  className={cn(
                    "px-3 py-2 text-left",
                    c.sticky === "right" && "sticky right-0 z-[1] bg-card shadow-[-1px_0_0_var(--color-border)]",
                    c.align === "right" && "text-right",
                  )}
                >
                  {c.value ? (
                    <button
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-foreground",
                        c.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {c.header}
                      {sortKey === c.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "border-b border-border/60 transition-colors",
                  rowClassName?.(row),
                  onRowClick && "cursor-pointer hover:bg-accent/50",
                )}
              >
                {visibleCols.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-3 py-2 align-middle",
                      c.align === "right" && "text-right",
                      c.sticky === "right" && "sticky right-0 bg-card shadow-[-1px_0_0_var(--color-border)]",
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={visibleCols.length} className="px-3 py-10 text-center text-xs text-muted-foreground">
                  No results match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <div>
          {sorted.length === 0
            ? "0 rows"
            : `${safePage * pageSize + 1}–${Math.min((safePage + 1) * pageSize, sorted.length)} of ${sorted.length.toLocaleString()}`}
        </div>
        <div className="flex items-center gap-1">
          <button
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
            className="rounded p-1 hover:bg-accent disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="font-mono">
            {safePage + 1} / {pageCount}
          </span>
          <button
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(safePage + 1)}
            className="rounded p-1 hover:bg-accent disabled:opacity-40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
