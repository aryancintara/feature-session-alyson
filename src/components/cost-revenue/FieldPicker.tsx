import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Searchable column dropdown: case-insensitive "contains" filter over a fixed list.
export function FieldPicker({ value, options, onChange, className }: { value: string; options: string[]; onChange: (v: string) => void; className?: string }) {
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
  const list = t ? options.filter((o) => o.toLowerCase().includes(t)) : options;
  return (
    <div ref={ref} className={cn("relative", className)}>
      <button type="button" onClick={() => { setOpen((o) => !o); setQ(""); }} className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-2 text-left font-mono text-sm">
        <span className="truncate">{value || "Choose column"}</span><ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-56 rounded-md border border-border bg-popover p-1 shadow-md">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search columns…" className="mb-1 h-8 w-full rounded border border-border bg-card px-2 text-sm"
            onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); if (e.key === "Enter" && list[0]) { e.preventDefault(); onChange(list[0]); setOpen(false); } }} />
          <div className="max-h-60 overflow-y-auto">
            {list.length ? list.map((o) => (
              <button type="button" key={o} onClick={() => { onChange(o); setOpen(false); }} className={cn("block w-full truncate rounded px-2 py-1 text-left font-mono text-sm hover:bg-accent", o === value && "bg-accent")}>{o}</button>
            )) : <div className="px-2 py-2 text-sm text-muted-foreground">No matching column</div>}
          </div>
        </div>
      )}
    </div>
  );
}
