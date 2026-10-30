import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

export function NotSet() {
  return <span className="text-muted-foreground">Not set</span>;
}

export function CopyBtn({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard?.writeText(value).then(() => { setDone(true); toast.success(`${label} copied`); setTimeout(() => setDone(false), 1200); });
      }}
      className="ml-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}
