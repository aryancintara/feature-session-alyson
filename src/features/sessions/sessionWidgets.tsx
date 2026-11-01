import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-xs text-muted-foreground", className)}>{children}</span>;
}

export function FlagDot({ on, title }: { on: boolean; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-block h-2 w-2 rounded-full border",
        on ? "bg-success border-success" : "bg-transparent border-border",
      )}
    />
  );
}

export const FUNNEL_STAGES = [
  { key: "visit", label: "Visit" },
  { key: "quiz_start", label: "Quiz Start" },
  { key: "partial_lead", label: "Partial Lead" },
  { key: "lead", label: "Lead" },
  { key: "otp_verified", label: "OTP Verified" },
  { key: "qualified_connected", label: "Qualified / Connected" },
  { key: "meeting", label: "Meeting" },
  { key: "listing", label: "Listing" },
  { key: "revenue", label: "Revenue" },
] as const;

export type FunnelStageKey = (typeof FUNNEL_STAGES)[number]["key"];

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff; // 0..1
}

export function funnelReachedIndex(s: {
  has_visit?: boolean;
  has_quiz_start?: boolean;
  has_partial_quiz_submit?: boolean;
  has_lead?: boolean;
  has_otp_verified?: boolean;
  has_qualified_connected?: boolean;
  has_meeting?: boolean;
  has_listing?: boolean;
  has_revenue?: boolean;
}): number {
  let reached = -1;
  if (s.has_visit !== false) reached = 0;
  if (s.has_quiz_start) reached = 1;
  if (s.has_partial_quiz_submit) reached = 2;
  if (s.has_lead) reached = 3;
  if (s.has_otp_verified) reached = 4;
  if (s.has_qualified_connected) reached = 5;
  if (s.has_meeting) reached = 6;
  if (s.has_listing) reached = 7;
  if (s.has_revenue) reached = 8;
  return reached;
}

// Fraud score 0..100, heavily biased low.
export function fraudScore(sessionId: string): number {
  const r = hashString(`${sessionId}|fraud`);
  // bias low: r^3 keeps most values small; scale to 0..100
  const score = Math.round(Math.pow(r, 3) * 100);
  return Math.max(0, Math.min(100, score));
}

// Plugin execution score 0..100, biased high (most successful runs).
export function pluginScore(sessionId: string, plugin: string): number {
  const r = hashString(`${sessionId}|plugin|${plugin}`);
  // bias high: 1 - (1-r)^2 pushes most values toward 100
  const score = Math.round((1 - Math.pow(1 - r, 2)) * 40 + 60); // 60..100 typical
  return Math.max(0, Math.min(100, score));
}

export function FraudBadge({ score: _score, compact = false }: { score?: number; compact?: boolean }) {
  return (
    <span
      title="Fraud scoring — coming soon"
      className={cn(
        "inline-flex items-center gap-1 rounded border border-dashed border-border bg-muted/40 font-medium text-muted-foreground",
        compact ? "px-1 py-0 text-[10px]" : "px-1.5 py-0.5 text-[11px]",
      )}
    >
      Coming soon
    </span>
  );
}

export function FunnelBar({
  reached,
  compact = false,
  unknown,
  on: onSet,
}: {
  reached: number;
  compact?: boolean;
  unknown?: ReadonlySet<number>;
  on?: ReadonlySet<number>;
}) {
  const label = reached < 0 ? "No stage reached" : FUNNEL_STAGES[reached].label;
  return (
    <div
      title={`Reached: ${label} (${Math.max(0, reached) + 1}/${FUNNEL_STAGES.length})`}
      className="inline-flex items-center"
    >
      {FUNNEL_STAGES.map((stage, i) => {
        const on = onSet ? onSet.has(i) : i <= reached;
        const isLast = i === FUNNEL_STAGES.length - 1;
        const nextOn = !isLast && (onSet ? onSet.has(i + 1) : i < reached);
        const isUnknown = unknown?.has(i) ?? false;
        const nextUnknown = !isLast && (unknown?.has(i + 1) ?? false);
        return (
          <span key={stage.key} className="inline-flex items-center" title={stage.label}>
            <span
              className={cn(
                "rounded-full border",
                compact ? "h-1.5 w-1.5" : "h-2.5 w-2.5",
                isUnknown
                  ? "bg-transparent border-dashed border-muted-foreground/50"
                  : on ? "bg-success border-success" : "bg-background border-border",
              )}
            />
            {!isLast && (
              <span
                className={cn(
                  compact ? "h-px w-1.5" : "h-0.5 w-3",
                  nextUnknown || isUnknown
                    ? "bg-muted-foreground/25"
                    : (on && nextOn) ? "bg-success" : "bg-border",
                )}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}

export function PluginCell({ name, status, id }: { name: string; status: "on" | "off"; id: string }) {
  const on = status === "on";
  return (
    <span
      title={`${name} · ${id} · ${status}`}
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded border text-[9px] font-semibold uppercase",
        on
          ? "bg-success/15 text-success border-success/30"
          : "bg-muted/40 text-muted-foreground/50 border-border",
      )}
    >
      {name.charAt(0)}
    </span>
  );
}

export function SourcePill({ source }: { source: string }) {
  const tone: Record<string, string> = {
    inherited: "bg-info/10 text-info border-info/20",
    synthetic: "bg-warning/10 text-warning-foreground border-warning/30",
    native: "bg-success/10 text-success border-success/20",
  };
  const label: Record<string, string> = {
    native: "Site-tracked",
    inherited: "Linked",
    synthetic: "Estimated",
  };
  const tip: Record<string, string> = {
    native: "Native — the visit already had a session ID from the website",
    inherited: "Inherited — no ID on this event, but we matched it to another visit from the same person",
    synthetic: "Synthetic — no session ID found; we grouped events by visitor signals and built a session",
  };
  return (
    <span
      title={tip[source] ?? source}
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0 text-[9px] font-medium uppercase tracking-wider",
        tone[source] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {label[source] ?? source}
    </span>
  );
}
