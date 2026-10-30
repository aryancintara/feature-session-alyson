import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Code2 } from "lucide-react";
import { PEOPLE, timeAgo, type EventType } from "@/lib/mockData";
import { PageHeader, Mono } from "@/components/ui-bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Event Explorer · Resolve.io" },
      { name: "description", content: "Raw event payloads and derived audience updates." },
    ],
  }),
  component: Events,
});

function Events() {
  const events = useMemo(
    () =>
      PEOPLE.flatMap((p) => p.events.map((e) => ({ ...e, personId: p.id, personName: p.name })))
        .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)),
    [],
  );

  const counts = events.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const types = Object.keys(counts) as EventType[];

  const [filter, setFilter] = useState<"all" | EventType>("all");
  const [q, setQ] = useState("");
  const filtered = events.filter((e) => (filter === "all" || e.type === filter) && (!q || `${e.id} ${e.personName} ${e.source}`.toLowerCase().includes(q.toLowerCase())));
  const [selected, setSelected] = useState(events[0]);

  return (
    <div className="pb-10">
      <PageHeader
        title="Event Explorer"
        subtitle="Inspect raw event payloads, sources, and the audience updates each event triggered."
      />

      <div className="grid grid-cols-2 gap-3 px-6 lg:grid-cols-4">
        {[
          { label: "Loaded events", value: events.length.toString() },
          { label: "Distinct types", value: types.length.toString() },
          { label: "Unique sources", value: new Set(events.map((e) => e.source)).size.toString() },
          { label: "Most common", value: types.sort((a, b) => counts[b] - counts[a])[0] ?? "—" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-3 px-6 pt-4">
        <div className="col-span-12 lg:col-span-7">
          <div className="rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
              <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by event id, person, source…" className="w-full bg-transparent text-sm outline-none" />
              </div>
            </div>
            <div className="flex flex-wrap gap-1 border-b border-border p-2 text-xs">
              <button
                onClick={() => setFilter("all")}
                className={cn("rounded-md border px-2 py-1", filter === "all" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent")}
              >
                all <span className="ml-1 font-mono text-[10px]">{events.length}</span>
              </button>
              {types.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={cn("rounded-md border px-2 py-1", filter === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent")}
                >
                  <span className="font-mono">{t}</span>
                  <span className="ml-1 font-mono text-[10px]">{counts[t]}</span>
                </button>
              ))}
            </div>

            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left font-medium">Event</th>
                    <th className="px-4 py-2 text-left font-medium">Type</th>
                    <th className="px-4 py-2 text-left font-medium">Person</th>
                    <th className="px-4 py-2 text-right font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 60).map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => setSelected(e)}
                      className={cn("cursor-pointer border-b border-border last:border-0 hover:bg-accent/40", selected.id === e.id && "bg-accent/40")}
                    >
                      <td className="px-4 py-2"><Mono>{e.id}</Mono></td>
                      <td className="px-4 py-2"><Mono>{e.type}</Mono></td>
                      <td className="px-4 py-2 text-xs">{e.personName}</td>
                      <td className="px-4 py-2 text-right text-xs text-muted-foreground">{timeAgo(e.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold"><Code2 className="h-4 w-4" /> Payload</div>
              <Mono>{selected.id}</Mono>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-5">
{JSON.stringify(
  {
    event_id: selected.id,
    type: selected.type,
    timestamp: selected.timestamp,
    source: selected.source,
    person_id: selected.personId,
    session_id: selected.sessionId,
    properties: selected.meta ?? {},
    derived: {
      audience_adds: ["All Visitors", selected.type === "lead_submitted" ? "Leads" : null, selected.type === "quiz_started" ? "Quiz Started" : null].filter(Boolean),
      audience_removes: selected.type === "lead_submitted" ? ["Partial Leads"] : [],
      funnel_update:
        selected.type === "lead_submitted" ? "Lead" :
        selected.type === "quiz_started" ? "Quiz Start" :
        selected.type === "appointment_set" ? "Appointment" :
        null,
      identity_delta: { confidence: selected.type === "lead_submitted" ? 25 : 5 },
    },
  },
  null,
  2,
)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
