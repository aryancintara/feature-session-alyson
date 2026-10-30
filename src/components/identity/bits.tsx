import { cn } from "@/lib/utils";
import { HelpTip } from "@/components/identity/HelpTip";

export function MetricCard({
  label,
  value,
  sub,
  help,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  help?: string;
  tone?: "default" | "success" | "warning" | "destructive" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning-foreground"
        : tone === "destructive"
          ? "text-destructive"
          : tone === "info"
            ? "text-info"
            : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
        {help ? <HelpTip text={help} /> : null}
      </div>
      <div className={cn("mt-1.5 text-2xl font-semibold tabular-nums", toneClass)}>{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  help,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  /** Plain-language tooltip explaining what this section shows. */
  help?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-card", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h3 className="flex items-center gap-1 text-sm font-semibold">
            {title}
            {help ? <HelpTip text={help} /> : null}
          </h3>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function DataTable({
  head,
  children,
  align,
  tips,
}: {
  head: string[];
  children: React.ReactNode;
  align?: ("left" | "right")[];
  /** Optional plain-language tooltip per column header label. */
  tips?: Record<string, string>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                className={cn(
                  "whitespace-nowrap px-4 py-2 font-medium",
                  align?.[i] === "right" ? "text-right" : "text-left",
                )}
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-1",
                    align?.[i] === "right" && "flex-row-reverse",
                  )}
                >
                  {h}
                  {tips?.[h] ? <HelpTip text={tips[h]} /> : null}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({
  children,
  right,
  mono,
  className,
}: {
  children: React.ReactNode;
  right?: boolean;
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "border-t border-border px-4 py-2.5",
        right && "text-right tabular-nums",
        mono && "font-mono text-xs",
        className,
      )}
    >
      {children}
    </td>
  );
}

const PILL: Record<string, string> = {
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/15 text-warning-foreground",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  neutral: "border-border bg-muted text-muted-foreground",
  info: "border-info/30 bg-info/10 text-info",
};

export function Pill({ tone = "neutral", children }: { tone?: keyof typeof PILL; children: React.ReactNode }) {
  // Plain-text pills use sentence case (first letter only); other content keeps the old capitalize style.
  const parts = Array.isArray(children) ? children : [children];
  const plain = parts.every((c) => typeof c === "string" || typeof c === "number");
  const text = plain ? parts.join("") : "";
  return (
    <span className={cn("inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium", !plain && "capitalize", PILL[tone])}>
      {plain ? text.charAt(0).toUpperCase() + text.slice(1) : children}
    </span>
  );
}

export function Bar({ value, tone = "primary" }: { value: number; tone?: "primary" | "success" | "warning" | "destructive" }) {
  const bg =
    tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : tone === "destructive" ? "bg-destructive" : "bg-primary";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full", bg)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function accuracyTone(v: number) {
  return v >= 90 ? "success" : v >= 70 ? "warning" : "danger";
}
