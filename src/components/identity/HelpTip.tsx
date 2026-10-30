import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Small ℹ️ affordance used across all Identity screens to explain a KPI,
 * table, chart or control in plain language.
 */
export function HelpTip({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-help-tip=""
            aria-label={`Help: ${text}`}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "inline-flex shrink-0 items-center text-muted-foreground/70 transition-colors hover:text-foreground",
              className,
            )}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[420px] whitespace-pre-wrap text-xs leading-snug">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Title + inline help icon, used for KPI card labels and section headings. */
export function LabelWithHelp({
  label,
  help,
  className,
}: {
  label: React.ReactNode;
  help?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {label}
      {help ? <HelpTip text={help} /> : null}
    </span>
  );
}
