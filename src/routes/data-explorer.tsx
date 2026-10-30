import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, Mono } from "@/components/ui-bits";
import { DATASETS, type Dataset, type DatasetField } from "@/lib/destinationsData";
import { formatNum } from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { Database, Play, Lock, Hash, Type, Calendar, ToggleLeft, Braces } from "lucide-react";

export const Route = createFileRoute("/data-explorer")({
  head: () => ({
    meta: [
      { title: "Data Explorer · Resolve.io" },
      { name: "description", content: "Browse datasets, inspect schemas, and run ad-hoc queries." },
    ],
  }),
  component: DataExplorer,
});

const TYPE_ICON: Record<DatasetField["type"], React.ReactNode> = {
  string: <Type className="h-3 w-3" />,
  number: <Hash className="h-3 w-3" />,
  timestamp: <Calendar className="h-3 w-3" />,
  boolean: <ToggleLeft className="h-3 w-3" />,
  json: <Braces className="h-3 w-3" />,
};

const SAMPLE_ROWS: Record<string, Array<Record<string, string | number | boolean>>> = {
  ds_people: [
    { person_id: "prs_1f4a3e2", place_id: "plc_8a2", primary_email: "s***@example.com", current_stage: "SQL", identity_score: 94, source_of_truth: true },
    { person_id: "prs_2c8b1d9", place_id: "plc_3f4", primary_email: "j***@example.com", current_stage: "Lead", identity_score: 82, source_of_truth: false },
    { person_id: "prs_9e2f7c1", place_id: "plc_8a2", primary_email: "e***@example.com", current_stage: "Sale", identity_score: 98, source_of_truth: true },
    { person_id: "prs_4a1d6b8", place_id: "plc_2c1", primary_email: "m***@example.com", current_stage: "Quiz Start", identity_score: 71, source_of_truth: false },
  ],
  ds_sessions: [
    { session_id: "ses_prs_1f4a_0", person_id: "prs_1f4a3e2", page_views: 8, exit_reason: "heartbeat_exit", source: "meta_ads" },
    { session_id: "ses_prs_2c8b_1", person_id: "prs_2c8b1d9", page_views: 3, exit_reason: "inactivity_timeout", source: "google_ads" },
    { session_id: "ses_prs_9e2f_0", person_id: "prs_9e2f7c1", page_views: 14, exit_reason: "heartbeat_exit", source: "klaviyo" },
  ],
  ds_events: [
    { event_id: "evt_8c2_4", event_type: "lead_submitted", source: "quiz_engine", person_id: "prs_2c8b1d9" },
    { event_id: "evt_8c2_5", event_type: "sms_clicked", source: "twilio", person_id: "prs_2c8b1d9" },
    { event_id: "evt_8c2_6", event_type: "appointment_set", source: "calendar", person_id: "prs_9e2f7c1" },
  ],
};

function defaultRowsFor(d: Dataset) {
  const key = d.id;
  const rows = SAMPLE_ROWS[key];
  if (rows) return rows;
  // Generate placeholder
  return Array.from({ length: 4 }).map((_, i) => {
    const row: Record<string, string | number | boolean> = {};
    d.fields.slice(0, 6).forEach((f) => {
      if (f.type === "number") row[f.name] = (i + 1) * 17;
      else if (f.type === "boolean") row[f.name] = i % 2 === 0;
      else if (f.type === "timestamp") row[f.name] = new Date(Date.now() - i * 3600e3).toISOString();
      else row[f.name] = `${f.name}_${i + 1}`;
    });
    return row;
  });
}

function DataExplorer() {
  const [activeId, setActiveId] = useState(DATASETS[0].id);
  const dataset = DATASETS.find((d) => d.id === activeId)!;
  const [query, setQuery] = useState(`SELECT person_id, current_stage, identity_score
FROM ${dataset.name}
WHERE source_of_truth = true
  AND identity_score >= 90
LIMIT 100;`);

  const rows = useMemo(() => defaultRowsFor(dataset), [dataset]);
  const visibleCols = useMemo(() => Object.keys(rows[0] ?? {}), [rows]);

  const totalRows = useMemo(() => DATASETS.reduce((s, d) => s + d.rowCount, 0), []);

  return (
    <div className="pb-10">
      <PageHeader
        title="Data Explorer"
        subtitle="Browse the underlying datasets, inspect schemas, and run ad-hoc queries against the identity warehouse."
      />

      <div className="grid grid-cols-12 gap-3 px-6">
        {/* Dataset list */}
        <aside className="col-span-12 lg:col-span-3">
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Datasets
              </div>
              <Mono>{formatNum(totalRows)}</Mono>
            </div>
            <ul className="py-1">
              {DATASETS.map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => {
                      setActiveId(d.id);
                      setQuery(`SELECT *\nFROM ${d.name}\nLIMIT 100;`);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-accent",
                      d.id === activeId && "bg-accent",
                    )}
                  >
                    <Database className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono font-semibold">{d.name}</div>
                      <Mono>{formatNum(d.rowCount)} rows · {d.freshness}</Mono>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Schema + samples */}
        <section className="col-span-12 lg:col-span-9 space-y-3">
          {/* Header */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <h2 className="font-mono text-lg font-semibold">{dataset.name}</h2>
                  {dataset.partitioned && (
                    <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      partitioned
                    </span>
                  )}
                </div>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">{dataset.description}</p>
              </div>
              <div className="flex items-center gap-4 text-right text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Rows</div>
                  <div className="font-mono text-base">{formatNum(dataset.rowCount)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Freshness</div>
                  <div className="font-mono text-base">{dataset.freshness}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Fields</div>
                  <div className="font-mono text-base">{dataset.fields.length}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Schema */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-2.5 text-sm font-semibold">Schema</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left">Field</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">PII</th>
                  <th className="px-3 py-2 text-left">Description</th>
                </tr>
              </thead>
              <tbody>
                {dataset.fields.map((f) => (
                  <tr key={f.name} className="border-b border-border/60">
                    <td className="px-3 py-2 font-mono text-xs">{f.name}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                        {TYPE_ICON[f.type]}
                        {f.type}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {f.pii ? (
                        <span className="inline-flex items-center gap-1 rounded border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning-foreground">
                          <Lock className="h-3 w-3" /> PII
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Ad-hoc query */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div className="text-sm font-semibold">Ad-hoc query</div>
              <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                <Play className="h-3 w-3" /> Run
              </button>
            </div>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              spellCheck={false}
              className="block h-32 w-full resize-none bg-background px-4 py-3 font-mono text-xs leading-relaxed text-foreground outline-none"
            />
            <div className="border-t border-border bg-muted/30 px-4 py-1.5">
              <Mono>Returned {rows.length} rows · 142ms · scanned {formatNum(dataset.rowCount * 0.001)}</Mono>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {visibleCols.map((c) => (
                      <th key={c} className="px-3 py-2 text-left font-mono">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-border/60">
                      {visibleCols.map((c) => (
                        <td key={c} className="px-3 py-2 font-mono text-xs">
                          {String(r[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
