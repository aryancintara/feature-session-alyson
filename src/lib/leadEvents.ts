// Single presentation adapter for Unified Leads lifecycle events (Recent Activity + Lifecycle tab).
import { stageLabel } from "./leadStages";

export interface RawLeadEvent {
  event_type: string;
  event_subtype: string | null;
  event_source: string | null;
  old_value: string | null;
  new_value: string | null;
}

export interface EventView {
  title: string;
  summary: string | null;
  source: string | null;
  isStage: boolean;
  /** Higher = more meaningful for Recent Activity. */
  weight: number;
}

const TITLES: Record<string, string> = {
  stage_changed: "Buyer stage changed",
  auto_dial: "Automatic call initiated",
  called_no_msg: "Call attempted — no message",
  called_left_msg: "Call attempted — left message",
  called_busy: "Call attempted — line busy",
  agent_left_vm: "Agent left voicemail",
  client_left_vm: "Client left voicemail",
  ai_intro_triggered: "AI introduction triggered",
  intro_triggered: "AI introduction triggered",
  lead_created: "Lead created",
};

const SOURCES: [RegExp, string][] = [
  [/homelight/i, "Homelight"],
  [/leads?_?plus/i, "Leads Plus"],
  [/phonexa/i, "Phonexa"],
  [/tune/i, "Tune"],
  [/crm|buyer/i, "Buyer CRM"],
  [/alyson/i, "Alyson"],
];

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
const isSimple = (v: string | null | undefined) => !!v && v.trim() !== "" && !/^[[{]/.test(v.trim());
const humanize = (v: string) => v.toLowerCase().replace(/[_\s]+/g, " ").trim().replace(/^./, (c) => c.toUpperCase());

export function sourceLabel(src: string | null | undefined): string | null {
  const s = (src ?? "").trim();
  if (!s) return null;
  for (const [re, label] of SOURCES) if (re.test(s)) return label;
  return humanize(s.replace(/_?(events?|table|raw)$/i, ""));
}

export function presentEvent(e: RawLeadEvent): EventView {
  const type = norm(e.event_type);
  const sub = norm(e.event_subtype);
  const isStage = type === "stage_changed" || /stage_(update|change)/.test(type) || /stage_(update|change)/.test(sub);
  const source = sourceLabel(e.event_source);
  if (isStage) {
    const hasOld = isSimple(e.old_value);
    const hasNew = isSimple(e.new_value);
    if (hasOld && hasNew) return { title: "Buyer stage changed", summary: `${stageLabel(e.old_value)} → ${stageLabel(e.new_value)}`, source, isStage, weight: 3 };
    return { title: "Buyer stage updated", summary: hasNew ? `Buyer stage updated to ${stageLabel(e.new_value)}` : null, source, isStage, weight: 3 };
  }
  if (/fail|error/.test(`${type} ${sub}`)) return { title: "Automation issue recorded", summary: isSimple(e.new_value) ? humanize(e.new_value!) : null, source, isStage, weight: 2 };
  const title = TITLES[type] ?? TITLES[sub] ?? humanize(type || sub || "Event");
  const meaningful = /call|dial|vm|intro|created|contact/.test(`${type} ${sub}`);
  const summary = isSimple(e.new_value) && !/^(true|false)$/i.test(e.new_value!.trim()) ? (isSimple(e.old_value) ? `${humanize(e.old_value!)} → ${humanize(e.new_value!)}` : humanize(e.new_value!)) : null;
  return { title, summary, source, isStage, weight: meaningful ? 2 : 1 };
}

/** Top-N meaningful events: weight first, then newest. Returned newest first. */
export function pickRecent<T extends RawLeadEvent & { event_timestamp: string | null }>(list: T[], n = 3): T[] {
  const ts = (e: T) => String(e.event_timestamp ?? "");
  return [...list]
    .sort((a, z) => presentEvent(z).weight - presentEvent(a).weight || ts(z).localeCompare(ts(a)))
    .slice(0, n)
    .sort((a, z) => ts(z).localeCompare(ts(a)));
}
