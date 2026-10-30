export function rulePeriodSummary(from: string, to: string) {
  if (!from) return "Pick a start date";
  if (!to) return `This rule applies from ${from} until edited`;
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  return days > 0 ? `This rule applies from ${from} to ${to} (${days} ${days === 1 ? "day" : "days"})` : "End date must be on or after the start date.";
}

type SavedDates = { effective_from: string | null; effective_to: string | null };

export function returnedRuleDates(value: unknown): SavedDates | null {
  if (!value || typeof value !== "object") return null;
  if ("start_date" in value) {
    const from = value.start_date;
    const to = "end_date" in value ? value.end_date : null;
    if ((from !== null && typeof from !== "string") || (to !== null && typeof to !== "string")) return null;
    return { effective_from: from, effective_to: to };
  }
  if (!("effective_from" in value) || !("effective_to" in value)) {
    return "rule" in value ? returnedRuleDates(value.rule) : null;
  }
  const from = value.effective_from;
  const to = value.effective_to;
  if ((from !== null && typeof from !== "string") || (to !== null && typeof to !== "string")) return null;
  return { effective_from: from, effective_to: to };
}

export function savedDateWarning(from: string, to: string, saved: SavedDates) {
  const savedFrom = saved.effective_from?.slice(0, 10) ?? "";
  const savedTo = saved.effective_to?.slice(0, 10) ?? "";
  if (from === savedFrom && to === savedTo) return null;
  return `Saved, but the dates changed: you entered ${from} → ${to}, the rule was saved as ${savedFrom || "no start date"} → ${savedTo || "no end date"}.`;
}