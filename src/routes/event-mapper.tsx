import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Zap, ArrowRight, Plus, Power, MoreHorizontal } from "lucide-react";
import { EVENT_MAPPINGS, type EventMapping, formatNum } from "@/lib/mockData";
import { PageHeader, Mono } from "@/components/ui-bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/event-mapper")({
  head: () => ({ meta: [
    { title: "Event Mapper — Alyson CDP" },
    { name: "description", content: "Explore event mapper in Alyson CDP." },
    { property: "og:title", content: "Event Mapper — Alyson CDP" },
    { property: "og:description", content: "Explore event mapper in Alyson CDP." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: EventMapper,
});

const ACTION_TONE: Record<EventMapping["actions"][number]["type"], string> = {
  audience_add: "bg-success/10 text-success border-success/30",
  audience_remove: "bg-destructive/10 text-destructive border-destructive/30",
  funnel_update: "bg-primary/10 text-primary border-primary/30",
  identity_update: "bg-info/10 text-info border-info/30",
  trigger: "bg-warning/15 text-warning-foreground border-warning/40",
};

const ACTION_LABEL: Record<EventMapping["actions"][number]["type"], string> = {
  audience_add: "Add to audience",
  audience_remove: "Remove from audience",
  funnel_update: "Update funnel stage",
  identity_update: "Update identity",
  trigger: "Trigger workflow",
};

const INCOMING_EVENTS = [
  { name: "page_view", source: "Website tracker", volume: 14_812_881 },
  { name: "ad_impression", source: "Meta / Google / TikTok", volume: 11_385_311 },
  { name: "quiz_started", source: "Quiz engine", volume: 412_881 },
  { name: "quiz_question_answered", source: "Quiz engine", volume: 1_204_991 },
  { name: "partial_lead", source: "Quiz engine", volume: 312_004 },
  { name: "lead_submitted", source: "Quiz engine", volume: 184_412 },
  { name: "email_opened", source: "Klaviyo", volume: 884_881 },
  { name: "sms_clicked", source: "Twilio", volume: 124_004 },
  { name: "appointment_set", source: "Salesforce", volume: 12_881 },
  { name: "sale", source: "Salesforce", volume: 4_812 },
];

function EventMapper() {
  const [selectedId, setSelectedId] = useState<string>(EVENT_MAPPINGS[2].id);
  const selected = EVENT_MAPPINGS.find((m) => m.id === selectedId)!;

  return (
    <div className="pb-10">
      <PageHeader
        title="Event Mapper"
        subtitle="Translate every incoming event into audience moves, funnel updates, identity changes, and downstream triggers."
        actions={
          <>
            <button className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent">
              View runtime logs
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
              <Plus className="h-3 w-3" /> New mapping
            </button>
          </>
        }
      />

      {/* 3-column flow */}
      <div className="grid grid-cols-12 gap-3 px-6">
        {/* Incoming events */}
        <div className="col-span-12 lg:col-span-3">
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Incoming events</h3>
              <p className="text-xs text-muted-foreground">Last 24 hours</p>
            </div>
            <ul className="max-h-[640px] overflow-y-auto py-1">
              {INCOMING_EVENTS.map((e) => {
                const mapping = EVENT_MAPPINGS.find((m) => m.sourceEvent === e.name);
                const active = mapping?.id === selectedId;
                return (
                  <li key={e.name}>
                    <button
                      onClick={() => mapping && setSelectedId(mapping.id)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent",
                        active && "bg-accent",
                      )}
                    >
                      <Zap className="h-3.5 w-3.5 text-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs">{e.name}</div>
                        <div className="text-[10px] text-muted-foreground">{e.source}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-[11px] tabular-nums">{formatNum(e.volume)}</div>
                        {mapping && (
                          <div className="text-[10px] text-success">{mapping.actions.length} actions</div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Mapping flow visualization */}
        <div className="col-span-12 lg:col-span-9">
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold">Mapping flow</h3>
                <p className="text-xs text-muted-foreground">
                  {selected.triggered24h.toLocaleString()} triggers in the last 24h
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-accent">
                  <Power className="h-3 w-3 text-success" /> Enabled
                </button>
                <button className="rounded p-1 text-muted-foreground hover:bg-accent">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto p-6">
              <div className="grid grid-cols-12 items-center gap-4 min-w-[720px]">
                {/* Source */}
                <div className="col-span-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Source event
                  </div>
                  <div className="mt-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      <span className="font-mono text-sm font-semibold">{selected.sourceEvent}</span>
                    </div>
                    <Mono className="mt-1 block">id: {selected.id}</Mono>
                  </div>
                </div>

                {/* Connectors */}
                <div className="col-span-1 flex items-center justify-center">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>

                {/* Conditions / context */}
                <div className="col-span-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Context
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <div className="rounded border border-border bg-muted/30 px-2 py-1.5 text-xs">
                      Person resolved <span className="text-success">✓</span>
                    </div>
                    <div className="rounded border border-border bg-muted/30 px-2 py-1.5 text-xs">
                      Consent verified <span className="text-success">✓</span>
                    </div>
                    <div className="rounded border border-border bg-muted/30 px-2 py-1.5 text-xs">
                      Dedup window 5m
                    </div>
                  </div>
                </div>

                <div className="col-span-1 flex items-center justify-center">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>

                {/* Actions */}
                <div className="col-span-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Actions
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {selected.actions.map((a, i) => (
                      <li
                        key={i}
                        className={cn("rounded-lg border px-2.5 py-1.5", ACTION_TONE[a.type])}
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                          {ACTION_LABEL[a.type]}
                        </div>
                        <div className="text-xs font-medium text-foreground">{a.target}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* All mappings table */}
          <div className="mt-3 rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">All mappings</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left font-medium">Source event</th>
                  <th className="px-4 py-2 text-left font-medium">Actions</th>
                  <th className="px-4 py-2 text-right font-medium">24h triggers</th>
                  <th className="px-4 py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {EVENT_MAPPINGS.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className={cn(
                      "cursor-pointer border-b border-border last:border-0 hover:bg-accent/40",
                      m.id === selectedId && "bg-accent/40",
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <Mono className="text-foreground">{m.sourceEvent}</Mono>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {m.actions.map((a, i) => (
                          <span
                            key={i}
                            className={cn(
                              "inline-flex rounded border px-1.5 py-0.5 text-[10px]",
                              ACTION_TONE[a.type],
                            )}
                          >
                            {ACTION_LABEL[a.type]}: {a.target}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{m.triggered24h.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 text-xs text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
