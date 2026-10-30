import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, X, Code2, MousePointer2, Save, Play, Users2, Filter, GitMerge } from "lucide-react";
import { AUDIENCES, formatNum } from "@/lib/mockData";
import { PageHeader, Mono } from "@/components/ui-bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/audience-builder")({
  head: () => ({ meta: [
    { title: "Audience Builder — Alyson CDP" },
    { name: "description", content: "Explore audience builder in Alyson CDP." },
    { property: "og:title", content: "Audience Builder — Alyson CDP" },
    { property: "og:description", content: "Explore audience builder in Alyson CDP." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AudienceBuilder,
});

type Operator = "AND" | "OR" | "NOT";
type BlockKind = "event" | "funnel" | "consent" | "propensity" | "audience" | "attribute";

interface Block {
  id: string;
  kind: BlockKind;
  label: string;
  detail: string;
}

const SAMPLE_BLOCKS: Block[] = [
  { id: "b1", kind: "event", label: "Visited website", detail: "in last 7 days" },
  { id: "b2", kind: "event", label: "Started quiz", detail: "≥ 1 time" },
  { id: "b3", kind: "event", label: "Did not submit lead", detail: "in last 30 days" },
];

const PALETTE: { kind: BlockKind; icon: React.ComponentType<{ className?: string }>; label: string; suggestions: string[] }[] = [
  { kind: "event", icon: Play, label: "Event", suggestions: ["page_view", "quiz_started", "partial_lead", "lead_submitted", "sms_clicked"] },
  { kind: "funnel", icon: GitMerge, label: "Funnel stage", suggestions: ["Visit", "Quiz Start", "Lead", "MQL", "SQL", "Sale"] },
  { kind: "consent", icon: Filter, label: "Consent", suggestions: ["SMS granted", "Email granted", "Not unsubscribed", "Not litigation risk"] },
  { kind: "propensity", icon: Filter, label: "Propensity", suggestions: ["Purchase ≥ 75", "Churn ≤ 30", "Engagement ≥ 60"] },
  { kind: "audience", icon: Users2, label: "Audience", suggestions: AUDIENCES.slice(0, 6).map((a) => a.name) },
];

const KIND_TONE: Record<BlockKind, string> = {
  event: "bg-info/10 text-info border-info/30",
  funnel: "bg-primary/10 text-primary border-primary/30",
  consent: "bg-success/10 text-success border-success/30",
  propensity: "bg-warning/15 text-warning-foreground border-warning/40",
  audience: "bg-accent text-accent-foreground border-accent",
  attribute: "bg-muted text-muted-foreground border-border",
};

const SAMPLE_SQL = `-- Repeat homeowners with high purchase intent who haven't been contacted
SELECT p.person_id, p.primary_email, p.city, p.state, prop.purchase_score
FROM people p
JOIN sessions s        ON s.person_id = p.person_id
JOIN propensity prop   ON prop.person_id = p.person_id
LEFT JOIN events sms   ON sms.person_id = p.person_id
                      AND sms.type = 'sms_sent'
                      AND sms.ts > now() - interval '24 hours'
WHERE s.start_time > now() - interval '7 days'
  AND prop.purchase_score >= 75
  AND p.address_verified = true
  AND sms.event_id IS NULL
GROUP BY 1, 2, 3, 4, 5
HAVING count(distinct s.session_id) >= 2
ORDER BY prop.purchase_score DESC
LIMIT 10000;`;

function AudienceBuilder() {
  const [mode, setMode] = useState<"visual" | "sql">("visual");
  const [blocks, setBlocks] = useState<Block[]>(SAMPLE_BLOCKS);
  const [operators, setOperators] = useState<Operator[]>(["AND", "AND"]);
  const [name, setName] = useState("Repeat visitors with no lead");

  const previewSize = Math.max(12_000, 320_000 - blocks.length * 64_000);

  function addBlock(kind: BlockKind, label: string) {
    const detail =
      kind === "event" ? "in last 7 days" : kind === "funnel" ? "current stage" : kind === "propensity" ? "≥ 60" : "matches";
    setBlocks((b) => [...b, { id: `b${Date.now()}`, kind, label, detail }]);
    setOperators((o) => [...o, "AND"]);
  }
  function removeBlock(id: string, idx: number) {
    setBlocks((b) => b.filter((x) => x.id !== id));
    setOperators((o) => o.filter((_, i) => i !== Math.max(0, idx - 1)));
  }
  function cycleOperator(i: number) {
    setOperators((o) => o.map((op, idx) => (idx === i ? (op === "AND" ? "OR" : op === "OR" ? "NOT" : "AND") : op)));
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="Audience Builder"
        subtitle="Compose audiences visually or in SQL. Both modes target the same identity graph."
        actions={
          <>
            <div className="flex rounded-md border border-border bg-card p-0.5 text-xs">
              <button
                onClick={() => setMode("visual")}
                className={cn("flex items-center gap-1 rounded px-3 py-1", mode === "visual" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
              >
                <MousePointer2 className="h-3 w-3" /> Visual
              </button>
              <button
                onClick={() => setMode("sql")}
                className={cn("flex items-center gap-1 rounded px-3 py-1", mode === "sql" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
              >
                <Code2 className="h-3 w-3" /> SQL
              </button>
            </div>
            <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent">
              <Play className="h-3 w-3" /> Preview
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
              <Save className="h-3 w-3" /> Save audience
            </button>
          </>
        }
      />

      <div className="grid grid-cols-12 gap-3 px-6">
        {/* Left palette */}
        <aside className="col-span-12 lg:col-span-3">
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Building blocks</h3>
              <p className="text-xs text-muted-foreground">Drag, click, or type to add</p>
            </div>
            <div className="p-2">
              {PALETTE.map((p) => {
                const Icon = p.icon;
                return (
                  <details key={p.kind} className="group mb-1 rounded-md" open>
                    <summary className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-accent">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{p.label}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">{p.suggestions.length}</span>
                    </summary>
                    <ul className="mt-1 space-y-0.5 pl-2">
                      {p.suggestions.map((s) => (
                        <li key={s}>
                          <button
                            onClick={() => addBlock(p.kind, s)}
                            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <Plus className="h-3 w-3 opacity-50" />
                            <span className="truncate">{s}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Canvas */}
        <section className="col-span-12 lg:col-span-6">
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-transparent text-sm font-semibold outline-none"
              />
              <Mono>aud_draft_07f3</Mono>
            </div>

            {mode === "visual" ? (
              <div className="space-y-2 p-4">
                {blocks.map((b, i) => (
                  <div key={b.id}>
                    {i > 0 && (
                      <div className="my-1 flex items-center gap-2">
                        <div className="h-px flex-1 bg-border" />
                        <button
                          onClick={() => cycleOperator(i - 1)}
                          className={cn(
                            "rounded border px-2 py-0.5 font-mono text-[10px] font-bold",
                            operators[i - 1] === "AND" && "border-primary/40 bg-primary/10 text-primary",
                            operators[i - 1] === "OR" && "border-info/40 bg-info/10 text-info",
                            operators[i - 1] === "NOT" && "border-destructive/40 bg-destructive/10 text-destructive",
                          )}
                        >
                          {operators[i - 1]}
                        </button>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                    )}
                    <div className={cn("flex items-center justify-between rounded-lg border bg-background p-3", KIND_TONE[b.kind])}>
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{b.kind}</div>
                        <div className="text-sm font-medium text-foreground">{b.label}</div>
                        <div className="text-xs text-muted-foreground">{b.detail}</div>
                      </div>
                      <button
                        onClick={() => removeBlock(b.id, i)}
                        className="rounded p-1 text-muted-foreground hover:bg-background hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => addBlock("event", "New condition")}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-3 text-xs text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> Add condition
                </button>
              </div>
            ) : (
              <div className="p-0">
                <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2 text-xs">
                  <Mono>postgres · identity_warehouse</Mono>
                  <span className="text-muted-foreground">⌘↵ to run</span>
                </div>
                <pre className="overflow-x-auto p-4 font-mono text-xs leading-6 text-foreground">{SAMPLE_SQL}</pre>
              </div>
            )}
          </div>
        </section>

        {/* Right preview */}
        <aside className="col-span-12 lg:col-span-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="uppercase tracking-wider">Estimated size</span>
              <span className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">live</span>
            </div>
            <div className="mt-1 text-3xl font-semibold tabular-nums">{formatNum(previewSize)}</div>
            <div className="mt-1 text-xs text-muted-foreground">people in audience</div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-border p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Places</div>
                <div className="text-sm font-semibold">{formatNum(previewSize * 0.42)}</div>
              </div>
              <div className="rounded-md border border-border p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Reachable SMS</div>
                <div className="text-sm font-semibold">{formatNum(previewSize * 0.61)}</div>
              </div>
              <div className="rounded-md border border-border p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Reachable email</div>
                <div className="text-sm font-semibold">{formatNum(previewSize * 0.78)}</div>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reusable audiences
            </div>
            <ul className="divide-y divide-border">
              {AUDIENCES.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => addBlock("audience", a.name)}
                    className="flex w-full items-center justify-between px-4 py-2 text-left text-xs hover:bg-accent"
                  >
                    <span className="truncate">{a.name}</span>
                    <Mono>{formatNum(a.size)}</Mono>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
