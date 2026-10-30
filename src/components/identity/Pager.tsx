import { ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZE = 20;

export function Pager({
  page,
  total,
  pageSize = PAGE_SIZE,
  onPage,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  const nums: number[] = [];
  const from = Math.max(1, Math.min(page - 2, pages - 4));
  const to = Math.min(pages, from + 4);
  for (let i = from; i <= to; i++) nums.push(i);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5">
      <span className="text-xs text-muted-foreground">
        Showing {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="inline-flex items-center rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {nums.map((n) => (
          <button
            key={n}
            onClick={() => onPage(n)}
            className={
              "min-w-[28px] rounded-md border px-2 py-1 text-xs font-medium " +
              (n === page
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground")
            }
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => onPage(Math.min(pages, page + 1))}
          disabled={page === pages}
          className="inline-flex items-center rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
