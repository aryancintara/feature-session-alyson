import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search, Filter, Copy, ArrowRight, ExternalLink, ShieldCheck, AlertTriangle,
  CheckCircle2, XCircle, Clock, Zap, Cpu, ChevronRight, RotateCcw,
} from "lucide-react";
import {
  IDENTITY_EVENTS, PEOPLE, SOURCE_PROFILES, GRAPH_CONFLICTS, IDENTITY_INCIDENTS,
  UNIFIED_PROFILES, type IdentityEventRecord, type TimelineStep, type CandidateMatch,
  timeAgo,
} from "@/lib/mockData";
import { PageHeader, Mono, StatusDot, GradeBadge } from "@/components/ui-bits";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const SAVED_VIEWS = [
  { id: "sv_1", name: "Merges last 24h", desc: "decisionResult = merged" },
  { id: "sv_2", name: "Rejected low confidence", desc: "confidence < 0.6" },
  { id: "sv_3", name: "Pending human review", desc: "status = pending_review" },
  { id: "sv_4", name: "Conflicts on shared signals", desc: "has_conflict = true" },
];

function toCSV(rows: IdentityEventRecord[]): string {
  const headers = ["id", "kind", "personId", "profileId", "sourceProfileId", "decisionResult", "confidence", "at"];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map(r => headers.map(h => escape((r as unknown as Record<string, unknown>)[h])).join(","))].join("\n");
}
function downloadCSV(name: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export const Route = createFileRoute("/identity-console/")({
  head: () => ({ meta: [
    { title: "Identity Console — Alyson CDP" },
    { name: "description", content: "Explore identity console in Alyson CDP." },
    { property: "og:title", content: "Identity Console — Alyson CDP" },
    { property: "og:description", content: "Explore identity console in Alyson CDP." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: IdentityConsole,
});

const OUTCOME_TONE: Record<IdentityEventRecord["decisionResult"], string> = {
  matched: "text-success",
  created: "text-info",
  merged: "text-primary",
  split: "text-warning",
  rejected: "text-destructive",
  pending_review: "text-muted-foreground",
};

const STATUS_TONE: Record<TimelineStep["status"], string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/15 text-warning-foreground border-warning/30",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  retried: "bg-info/10 text-info border-info/20",
  skipped: "bg-muted text-muted-foreground border-border",
  pending: "bg-muted text-muted-foreground border-border",
  superseded: "bg-muted text-muted-foreground border-border",
  reversed: "bg-destructive/10 text-destructive border-destructive/20",
};

const SCORE_LABELS: [keyof IdentityEventRecord["scores"], string][] = [
  ["entityMatch", "Entity match"],
  ["unifiedAccuracy", "Unified accuracy"],
  ["coherence", "Coherence"],
  ["fieldAccuracy", "Field accuracy"],
  ["sourceReliability", "Source reliability"],
  ["identifierConsistency", "Identifier consistency"],
  ["relationshipConsistency", "Relationship consistency"],
  ["mergeConfidence", "Merge confidence"],
  ["falseMergeRisk", "False-merge risk"],
  ["falseSplitRisk", "False-split risk"],
  ["conflictRisk", "Conflict risk"],
  ["fraudRisk", "Fraud risk"],
  ["prepopSuitability", "Pre-pop suitability"],
  ["consentEligibility", "Consent eligibility"],
  ["dataFreshness", "Data freshness"],
  ["completeness", "Completeness"],
  ["businessValue", "Business value"],
  ["revenueLift", "Revenue lift"],
  ["verifiedLeadProb", "Verified-lead prob."],
];

const RISK_KEYS = new Set(["falseMergeRisk", "falseSplitRisk", "conflictRisk", "fraudRisk"]);

function scoreColor(value: number, isRisk: boolean): string {
  if (isRisk) {
    if (value >= 20) return "bg-destructive";
    if (value >= 10) return "bg-warning";
    return "bg-success";
  }
  if (value >= 85) return "bg-success";
  if (value >= 70) return "bg-info";
  if (value >= 55) return "bg-warning";
  return "bg-destructive";
}

function IdentityConsole() {
  const [selectedEventId, setSelectedEventId] = useState(IDENTITY_EVENTS[0].id);
  const [query, setQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [scoreDrawer, setScoreDrawer] = useState<{ key: keyof IdentityEventRecord["scores"]; label: string } | null>(null);
  const [stepDrawer, setStepDrawer] = useState<TimelineStep | null>(null);
  const [tab, setTab] = useState("signals");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return IDENTITY_EVENTS.filter((e) => {
      if (outcomeFilter !== "all" && e.decisionResult !== outcomeFilter) return false;
      if (!q) return true;
      return (
        e.id.toLowerCase().includes(q) ||
        e.requestId.toLowerCase().includes(q) ||
        e.traceId.toLowerCase().includes(q) ||
        e.personId.toLowerCase().includes(q) ||
        (e.campaign?.toLowerCase().includes(q) ?? false) ||
        e.source.toLowerCase().includes(q)
      );
    }).slice(0, 80);
  }, [query, outcomeFilter]);

  const event = IDENTITY_EVENTS.find((e) => e.id === selectedEventId) ?? IDENTITY_EVENTS[0];
  const person = PEOPLE.find((p) => p.id === event.personId) ?? PEOPLE[0];
  const sourceProfile = SOURCE_PROFILES.find((s) => s.id === event.sourceProfileId);
  const profile = UNIFIED_PROFILES.find((u) => u.id === event.profileId);
  const conflicts = GRAPH_CONFLICTS.filter((c) => c.involvedPersonIds.includes(person.id));
  const incidents = IDENTITY_INCIDENTS.filter((i) => i.affectedEventId === event.id || i.affectedPersonId === person.id).slice(0, 6);

  return (
    <div className="pb-6">
      <PageHeader
        title="Identity Events"
        subtitle="Audit every identity decision — search, inspect, and reverse."
        actions={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent">
                  <Filter className="mr-1 inline h-3 w-3" /> Saved views
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Saved event views</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SAVED_VIEWS.map(v => (
                  <DropdownMenuItem key={v.id} onClick={() => { setQuery(v.desc); toast(`Applied view: ${v.name}`, { description: v.desc }); }}>
                    <div>
                      <div className="text-xs font-medium">{v.name}</div>
                      <div className="text-[10px] text-muted-foreground">{v.desc}</div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={() => {
                const rows = filtered.slice(0, 500);
                downloadCSV(`decisions-${Date.now()}.csv`, toCSV(rows));
                toast("Export ready", { description: `${rows.length} decisions exported to CSV` });
              }}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Export decision batch
            </button>
          </div>
        }
      />


      <div className="grid grid-cols-12 gap-3 px-6">
        {/* Column 1 — Event search + results */}
        <aside className="col-span-12 lg:col-span-3">
          <div className="rounded-xl border border-border bg-card">
            <div className="space-y-2 border-b border-border p-3">
              <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Event / request / trace / person ID"
                  className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {(["all", "matched", "created", "merged", "split", "rejected", "pending_review"] as const).map((o) => (
                  <button
                    key={o}
                    onClick={() => setOutcomeFilter(o)}
                    className={cn(
                      "rounded-md border px-1.5 py-0.5 text-[10px] transition-colors",
                      outcomeFilter === o ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {o.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
            <ul className="max-h-[calc(100vh-320px)] overflow-y-auto">
              {filtered.map((e) => {
                const p = PEOPLE.find((x) => x.id === e.personId);
                const active = e.id === selectedEventId;
                return (
                  <li key={e.id}>
                    <button
                      onClick={() => setSelectedEventId(e.id)}
                      className={cn(
                        "flex w-full flex-col gap-1 border-b border-border px-3 py-2 text-left text-xs transition-colors hover:bg-accent",
                        active && "bg-accent",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Mono className="truncate">{e.id}</Mono>
                        <span className={cn("font-medium", OUTCOME_TONE[e.decisionResult])}>
                          {e.decisionResult.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{p?.name ?? "(anon)"}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {Math.round(e.scores.overall)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <StatusDot status={e.hygieneStatus === "clean" ? "healthy" : e.hygieneStatus === "warning" ? "warning" : "error"} />
                        <span>{e.channel}</span>
                        <span>·</span>
                        <span>{e.source}</span>
                        <span className="ml-auto">{timeAgo(e.timestamp)}</span>
                      </div>
                      {(e.errorCount > 0 || e.warningCount > 0) && (
                        <div className="flex gap-1 text-[10px]">
                          {e.errorCount > 0 && (
                            <span className="rounded border border-destructive/20 bg-destructive/10 px-1 text-destructive">
                              {e.errorCount}E
                            </span>
                          )}
                          {e.warningCount > 0 && (
                            <span className="rounded border border-warning/30 bg-warning/15 px-1 text-warning-foreground">
                              {e.warningCount}W
                            </span>
                          )}
                          <span className="ml-auto font-mono text-muted-foreground">{e.latencyMs}ms</span>
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
              {filtered.length} of {IDENTITY_EVENTS.length} events
            </div>
          </div>
        </aside>

        {/* Column 2 — Summary + Scores */}
        <section className="col-span-12 lg:col-span-3 space-y-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Event</div>
                <div className="text-sm font-semibold">{event.kind} · {event.decisionResult.replace("_", " ")}</div>
                <Mono className="mt-0.5 block break-all">{event.id}</Mono>
              </div>
              <button
                onClick={() => {
                  const ids = [event.id, event.requestId, event.traceId, event.personId, event.profileId].filter(Boolean).join("\n");
                  navigator.clipboard.writeText(ids).then(
                    () => toast("Copied IDs to clipboard", { description: `${ids.split("\n").length} identifiers` }),
                    () => toast.error("Copy failed")
                  );
                }}
                className="rounded-md border border-border p-1 text-muted-foreground hover:bg-accent"
                title="Copy IDs"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
            <dl className="mt-3 space-y-1.5 text-xs">
              <Row label="Request"><Mono>{event.requestId}</Mono></Row>
              <Row label="Trace"><Mono>{event.traceId}</Mono></Row>
              <Row label="Person">
                <Link to="/people" search={{ personId: event.personId } as never} className="font-mono text-xs text-primary hover:underline">{event.personId}</Link>
              </Row>
              <Row label="Profile">
                <Link to="/identity-graph" search={{ mode: "profile_detail", centerId: event.profileId, personId: event.personId } as never} className="font-mono text-xs text-primary hover:underline">
                  {profile?.label ?? event.profileId}
                </Link>
              </Row>
              <Row label="Source"><span>{event.source}</span></Row>
              {event.partner && <Row label="Partner"><span>{event.partner}</span></Row>}
              <Row label="Channel"><span>{event.channel}</span></Row>
              {event.campaign && <Row label="Campaign"><span className="truncate">{event.campaign}</span></Row>}
              <Row label="Environment">
                <span className={cn("rounded border px-1 text-[10px]", event.environment === "prod" ? "border-success/20 bg-success/10 text-success" : "border-warning/30 bg-warning/15 text-warning-foreground")}>
                  {event.environment}
                </span>
              </Row>
              <Row label="Winning method"><Mono>{event.winningMethod}</Mono></Row>
              <Row label="Decision · Policy · Model">
                <span className="font-mono text-[10px] text-muted-foreground">{event.decisionVersion} · {event.policyVersion} · {event.modelVersion}</span>
              </Row>
              <Row label="Latency"><span className="font-mono">{event.latencyMs}ms</span></Row>
              <Row label="Hygiene">
                <span className="inline-flex items-center gap-1">
                  <StatusDot status={event.hygieneStatus === "clean" ? "healthy" : event.hygieneStatus === "warning" ? "warning" : "error"} />
                  {event.hygieneStatus}
                </span>
              </Row>
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Link to="/people" search={{ personId: event.personId } as never} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium hover:bg-accent">
                People Explorer <ArrowRight className="h-3 w-3" />
              </Link>
              <Link to="/identity-graph" search={{ mode: "entity_relationships", personId: event.personId } as never} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium hover:bg-accent">
                Identity Graph <ArrowRight className="h-3 w-3" />
              </Link>
              <Link to="/identity-graph" search={{ mode: "consolidated_profile", personId: event.personId } as never} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium hover:bg-accent">
                Consolidated Profile <ArrowRight className="h-3 w-3" />
              </Link>
              <Link to="/identity-console/decisions" search={{ decisionId: event.id } as never} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium hover:bg-accent">
                Decision <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Score panel */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Scores</h3>
                <Mono>{SCORE_LABELS.length} components</Mono>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="relative h-16 w-16">
                  <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--color-muted)" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9"
                      fill="none"
                      stroke="var(--color-primary)"
                      strokeWidth="3"
                      strokeDasharray={`${event.scores.overall} ${100 - event.scores.overall}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-mono text-sm font-semibold">{Math.round(event.scores.overall)}</span>
                  </div>
                </div>
                <div className="text-xs">
                  <div className="text-muted-foreground">Overall identity score</div>
                  <div className="mt-0.5 font-medium">
                    {event.scores.overall >= 85 ? "High confidence" : event.scores.overall >= 70 ? "Good" : "Needs review"}
                  </div>
                </div>
              </div>
            </div>
            <div className="max-h-[380px] divide-y divide-border overflow-y-auto">
              {SCORE_LABELS.map(([key, label]) => {
                const val = event.scores[key];
                const isRisk = RISK_KEYS.has(key as string);
                return (
                  <button
                    key={key}
                    onClick={() => setScoreDrawer({ key, label })}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent"
                  >
                    <div className="w-32 shrink-0 text-[11px] text-muted-foreground">{label}</div>
                    <div className="flex-1">
                      <div className="h-1.5 overflow-hidden rounded bg-muted">
                        <div className={cn("h-full", scoreColor(val, isRisk))} style={{ width: `${val}%` }} />
                      </div>
                    </div>
                    <div className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums">{val}</div>
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Column 3 — Timeline */}
        <section className="col-span-12 lg:col-span-3">
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold">Processing timeline</h3>
                <p className="text-[11px] text-muted-foreground">{event.steps.length} steps · {event.latencyMs}ms total</p>
              </div>
              <div className="flex gap-1 text-[10px]">
                {["Processing", "Decision", "Errors"].map((m, i) => (
                  <button
                    key={m}
                    className={cn(
                      "rounded border px-1.5 py-0.5",
                      i === 0 ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <ul className="max-h-[calc(100vh-260px)] divide-y divide-border overflow-y-auto">
              {event.steps.map((s, i) => (
                <li key={i}>
                  <button
                    onClick={() => setStepDrawer(s)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-accent"
                  >
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-background font-mono text-[9px] text-muted-foreground">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium">{s.name.replace(/_/g, " ")}</span>
                        <span className={cn("rounded border px-1 py-0 text-[9px] font-medium", STATUS_TONE[s.status])}>
                          {s.status}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <Cpu className="h-2.5 w-2.5" />
                        <span className="font-mono">{s.worker}·{s.workerVersion}</span>
                        <span className="ml-auto font-mono">{s.durationMs}ms</span>
                      </div>
                      {(s.candidateCount > 0 || s.retryCount > 0 || s.reasonCodes.length > 0) && (
                        <div className="mt-1 flex flex-wrap gap-1 text-[9px] text-muted-foreground">
                          {s.candidateCount > 0 && <span className="rounded bg-muted px-1">c:{s.candidateCount}</span>}
                          {s.retryCount > 0 && <span className="rounded bg-info/10 px-1 text-info">r:{s.retryCount}</span>}
                          {s.reasonCodes.map((r) => (
                            <span key={r} className="rounded bg-muted px-1 font-mono">{r}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Column 4 — Evidence tabs */}
        <aside className="col-span-12 lg:col-span-3">
          <div className="rounded-xl border border-border bg-card">
            <Tabs value={tab} onValueChange={setTab}>
              <div className="border-b border-border px-2 py-2">
                <TabsList className="flex h-auto flex-wrap gap-0.5 bg-transparent p-0">
                  {[
                    ["signals", "Signals"],
                    ["source", "Source"],
                    ["candidates", "Candidates"],
                    ["relationships", "Relations"],
                    ["conflicts", "Conflicts"],
                    ["errors", "Errors"],
                    ["consent", "Consent"],
                    ["raw", "Raw"],
                  ].map(([v, l]) => (
                    <TabsTrigger key={v} value={v} className="h-6 px-2 text-[10px] data-[state=active]:bg-accent">
                      {l}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <TabsContent value="signals" className="m-0 max-h-[calc(100vh-240px)] divide-y divide-border overflow-y-auto">
                {person.signals.map((s) => (
                  <div key={s.id} className="px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{s.type}</div>
                        <div className="mt-0.5 truncate font-mono text-xs">{s.value}</div>
                      </div>
                      <GradeBadge grade={s.grade} />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>via {s.source}</span>
                      <span className="font-mono">{s.confidence}%</span>
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="source" className="m-0 p-3">
                {sourceProfile ? (
                  <>
                    <div className="text-xs font-semibold">{sourceProfile.source}</div>
                    <Mono className="block">{sourceProfile.id}</Mono>
                    <dl className="mt-2 space-y-1 text-xs">
                      {Object.entries(sourceProfile.fields).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">{k}</dt>
                          <dd className="truncate font-mono text-[11px]">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-2 rounded bg-muted p-2">
                      <div className="text-[9px] uppercase text-muted-foreground">Immutable hash</div>
                      <div className="mt-0.5 break-all font-mono text-[10px]">{sourceProfile.hash}</div>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">No source profile bound.</div>
                )}
              </TabsContent>

              <TabsContent value="candidates" className="m-0 max-h-[calc(100vh-240px)] divide-y divide-border overflow-y-auto">
                {event.candidates.map((c) => <CandidateRow key={c.id} c={c} />)}
              </TabsContent>

              <TabsContent value="relationships" className="m-0 p-3 text-xs space-y-2">
                <RelRow label="Household" value={UNIFIED_PROFILES.filter(u => u.type === "household" && u.personId === person.id).length + " member(s)"} />
                <RelRow label="Work profile" value={UNIFIED_PROFILES.find(u => u.type === "work" && u.personId === person.id)?.label ?? "—"} />
                <RelRow label="Verified leads" value={UNIFIED_PROFILES.filter(u => u.type === "verified_lead" && u.personId === person.id).length.toString()} />
                <RelRow label="Devices" value={person.sessions.length.toString()} />
                <RelRow label="Audiences" value={person.audiences.length + " memberships"} />
              </TabsContent>

              <TabsContent value="conflicts" className="m-0 max-h-[calc(100vh-240px)] overflow-y-auto p-3">
                {conflicts.length === 0 && <div className="text-xs text-muted-foreground">No graph conflicts.</div>}
                <ul className="space-y-2">
                  {conflicts.map((c) => (
                    <li key={c.id} className="rounded border border-border p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{c.kind.replace(/_/g, " ")}</span>
                        <span className={cn("rounded border px-1 text-[10px]",
                          c.severity === "critical" ? "border-destructive/20 bg-destructive/10 text-destructive" :
                          c.severity === "high" ? "border-warning/30 bg-warning/15 text-warning-foreground" :
                          "border-border bg-muted text-muted-foreground")}>
                          {c.severity}
                        </span>
                      </div>
                      <Mono className="block break-all">{c.signalValue}</Mono>
                      <div className="mt-1 text-[10px] text-muted-foreground">{c.involvedPersonIds.length} persons involved</div>
                    </li>
                  ))}
                </ul>
              </TabsContent>

              <TabsContent value="errors" className="m-0 max-h-[calc(100vh-240px)] overflow-y-auto p-3">
                {incidents.length === 0 && <div className="text-xs text-muted-foreground">No incidents.</div>}
                <ul className="space-y-2">
                  {incidents.map((i) => (
                    <li key={i.id} className="rounded border border-border p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className={cn("rounded border px-1 text-[10px]",
                          i.severity === "critical" ? "border-destructive/20 bg-destructive/10 text-destructive" :
                          i.severity === "error" ? "border-destructive/20 bg-destructive/10 text-destructive" :
                          i.severity === "warning" ? "border-warning/30 bg-warning/15 text-warning-foreground" :
                          "border-border bg-muted text-muted-foreground")}>
                          {i.severity}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">{i.category}</span>
                      </div>
                      <div className="mt-1">{i.message}</div>
                    </li>
                  ))}
                </ul>
              </TabsContent>

              <TabsContent value="consent" className="m-0 p-3">
                <div className="space-y-1 text-xs">
                  <ConsentLine label="Platform" on={person.consent.platform} />
                  <ConsentLine label="Partner" on={person.consent.partner} />
                  <ConsentLine label="SMS" on={person.consent.sms} />
                  <ConsentLine label="Call" on={person.consent.call} />
                  <ConsentLine label="Email" on={person.consent.email} />
                  <ConsentLine label="Subscribed" on={!person.consent.unsubscribed} />
                  {person.consent.litigationRisk && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded border border-destructive/20 bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">
                      <AlertTriangle className="h-3 w-3" /> Litigation risk
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="raw" className="m-0 p-2">
                <pre className="max-h-[calc(100vh-260px)] overflow-auto rounded bg-muted p-2 font-mono text-[10px] leading-relaxed">
{JSON.stringify(event, null, 2)}
                </pre>
              </TabsContent>
            </Tabs>
          </div>
        </aside>
      </div>

      {/* Score drawer */}
      <Sheet open={!!scoreDrawer} onOpenChange={(o) => !o && setScoreDrawer(null)}>
        <SheetContent side="right" className="w-[440px] sm:max-w-[440px]">
          {scoreDrawer && (
            <>
              <SheetHeader>
                <SheetTitle>{scoreDrawer.label}</SheetTitle>
                <SheetDescription>
                  Value: <span className="font-mono">{event.scores[scoreDrawer.key]}</span> · Model {event.modelVersion}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4 text-sm">
                <Section title="Definition">
                  Composite {scoreDrawer.label.toLowerCase()} for this decision, computed from the underlying evidence and calibrated against labeled ground truth.
                </Section>
                <Section title="Formula">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                    weight(sig_i) × conf(sig_i) × policy_factor / normalizer
                  </code>
                </Section>
                <Section title="Threshold">
                  <div className="mt-1 h-2 overflow-hidden rounded bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${event.scores[scoreDrawer.key]}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>0</span><span>threshold 75</span><span>100</span>
                  </div>
                </Section>
                <Section title="Supporting evidence">
                  <ul className="ml-4 list-disc space-y-0.5 text-xs">
                    {event.candidates.filter((c) => c.outcome === "won").map((c) => (
                      <li key={c.id}><Mono>{c.method}</Mono> · score {c.score}</li>
                    ))}
                    {event.supportingMethods.map((m) => (
                      <li key={m}><Mono>{m}</Mono></li>
                    ))}
                  </ul>
                </Section>
                <Section title="Conflicting evidence">
                  <ul className="ml-4 list-disc space-y-0.5 text-xs">
                    {event.conflictingMethods.length === 0 && <li className="text-muted-foreground">None</li>}
                    {event.conflictingMethods.map((m) => <li key={m}><Mono>{m}</Mono></li>)}
                  </ul>
                </Section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Step drawer */}
      <Sheet open={!!stepDrawer} onOpenChange={(o) => !o && setStepDrawer(null)}>
        <SheetContent side="right" className="w-[520px] sm:max-w-[520px]">
          {stepDrawer && (
            <>
              <SheetHeader>
                <SheetTitle className="capitalize">{stepDrawer.name.replace(/_/g, " ")}</SheetTitle>
                <SheetDescription>
                  <span className="font-mono">{stepDrawer.worker}·{stepDrawer.workerVersion}</span> · {stepDrawer.durationMs}ms
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-1">
                  <span className={cn("rounded border px-2 py-0.5 text-[10px] font-medium", STATUS_TONE[stepDrawer.status])}>
                    {stepDrawer.status}
                  </span>
                  {stepDrawer.retryCount > 0 && <span className="rounded border border-info/20 bg-info/10 px-2 py-0.5 text-[10px] text-info">{stepDrawer.retryCount} retries</span>}
                  {stepDrawer.candidateCount > 0 && <span className="rounded border border-border bg-muted px-2 py-0.5 text-[10px]">{stepDrawer.candidateCount} candidates</span>}
                </div>
                <Section title="Reason codes">
                  <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                    {stepDrawer.reasonCodes.length === 0 && <span className="text-muted-foreground">—</span>}
                    {stepDrawer.reasonCodes.map((r) => <span key={r} className="rounded bg-muted px-1.5 py-0.5">{r}</span>)}
                  </div>
                </Section>
                <Section title="Inputs">
                  <pre className="overflow-auto rounded bg-muted p-2 font-mono text-[10px]">{JSON.stringify(stepDrawer.inputs, null, 2)}</pre>
                </Section>
                <Section title="Outputs">
                  <pre className="overflow-auto rounded bg-muted p-2 font-mono text-[10px]">{JSON.stringify(stepDrawer.outputs, null, 2)}</pre>
                </Section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function CandidateRow({ c }: { c: CandidateMatch }) {
  const won = c.outcome === "won";
  return (
    <div className={cn("px-3 py-2 text-xs", won && "bg-success/5")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {won ? <CheckCircle2 className="h-3 w-3 text-success" /> : <XCircle className="h-3 w-3 text-muted-foreground" />}
          <span className="font-medium">{c.entityLabel}</span>
        </div>
        <span className={cn("font-mono text-[11px]", won ? "text-success" : "text-muted-foreground")}>{c.score}</span>
      </div>
      <Mono className="block truncate">{c.entityId} · {c.method}</Mono>
      <div className="mt-1 text-[10px] text-muted-foreground">{c.reason}</div>
    </div>
  );
}

function RelRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between rounded border border-border bg-background px-2 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ConsentLine({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("inline-flex items-center gap-1", on ? "text-success" : "text-destructive")}>
        {on ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
        {on ? "granted" : "denied"}
      </span>
    </div>
  );
}
