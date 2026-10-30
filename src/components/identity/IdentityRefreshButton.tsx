import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpTip } from "@/components/identity/HelpTip";
import { HELP } from "@/lib/identityHelpText";
import { forceRefreshReportingData } from "@/lib/identityReportingCache";

/** Clears the saved daily cache and refetches every Identity query. */
export function IdentityRefreshButton({ className }: { className?: string }) {
  const [spinning, setSpinning] = useState(false);

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <button
        type="button"
        onClick={() => {
          setSpinning(true);
          forceRefreshReportingData();
          setTimeout(() => setSpinning(false), 800);
        }}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <RefreshCw className={cn("h-3 w-3", spinning && "animate-spin")} />
        Refresh data
      </button>
      <HelpTip text={HELP.refreshData} />
    </span>
  );
}
