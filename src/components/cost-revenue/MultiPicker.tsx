import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { optionLabel, type FilterOption } from "@/lib/rulesApi";

// Searchable multi-select over ids. Empty selection = no filter.
export function MultiPicker({ value, options, onChange, allLabel, emptyText, loading, className }: {
  value: string[]; options: FilterOption[]; onChange: (v: string[]) => void; allLabel: string; emptyText: string; loading?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const t = q.trim().toLowerCase();
  const list = t ? options.filter((o) => optionLabel(o).toLowerCase().includes(t)) : options;
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const label = (id: string) => { const o = options.find((x) => x.id === id); return o ? optionLabel(o) : id; };
  return (
    <div ref={ref} className={cn("relative", className)}>
      <button type="button" onClick={() => { setOpen((o) => !o); setQ(""); }} className="flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-2 py-1 text-left text-sm">
        <span className="flex flex-wrap gap-1">
          {value.length ? value.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 font-mono text-xs">
              {label(id)}
              <X className="h-3 w-3 cursor-pointer" aria-label={`Remove ${id}`} onClick={(e) => { e.stopPropagation(); toggle(id); }} />
            </span>
          )) : <span className="text-muted-foreground">{allLabel}</span>}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-56 rounded-md border border-border bg-popover p-1 shadow-md">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="mb-1 h-8 w-full rounded border border-border bg-card px-2 text-sm"
            onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); if (e.key === "Enter" && list[0]) { e.preventDefault(); toggle(list[0].id); } }} />
          <div className="max-h-60 overflow-y-auto">
            {loading ? <div className="px-2 py-2 text-sm text-muted-foreground">Loading…</div>
              : !options.length ? <div className="px-2 py-2 text-sm text-muted-foreground">{emptyText}</div>
              : list.length ? list.map((o) => (
                <button type="button" key={o.id} onClick={() => toggle(o.id)} className={cn("flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent", value.includes(o.id) && "bg-accent")}>
                  <Check className={cn("h-3.5 w-3.5 shrink-0", value.includes(o.id) ? "opacity-100" : "opacity-0")} />
                  <span className="truncate font-mono">{optionLabel(o)}</span>
                </button>
              )) : <div className="px-2 py-2 text-sm text-muted-foreground">No match</div>}
          </div>
        </div>
      )}
    </div>
  );
}
