import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, CalendarIcon, ChevronDown, ChevronRight, Copy, Download, Info, RefreshCw, Search, Users, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { pickRecent, presentEvent } from "@/lib/leadEvents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui-bits";
import { Pill } from "@/components/identity/bits";
import { leadsPipelineQuery, LEADS_OVERALL } from "@/components/leads/LeadsPipelinePill";
import { Shimmer, TableSkeleton } from "@/components/identity/skeletons";
import { fmtPst, pipelineTone, relTime, type ApiHealthResponse } from "@/lib/unifiedPropertiesApi";
import { stageLabel, stageTone, STAGE_NONE, FALLBACK_STAGES } from "@/lib/leadStages";
import { customIdentifiersForDisplay } from "@/lib/leadIdentifiers";
import { leadsGet, leadsDownloadCsv, type EventsResponse, type Facets, type Lead, type LeadDetail, type LeadEvent, type LeadsResponse } from "@/lib/unifiedLeadsApi";

export const Route = createFileRoute("/unified-leads/")({
  head: () => ({ meta: [
    { title: "Unified Leads — Alyson CDP" },
    { name: "description", content: "Find, investigate, and track leads across sources." },
    { property: "og:title", content: "Unified Leads — Alyson CDP" },
    { property: "og:description", content: "Find, investigate, and track leads across sources." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: UnifiedLeads,
});

type Filters = Record<string, string>;
type Origin = "default" | "user" | "broadened";
type SearchMode = "exact_email" | "exact_phone" | "exact_buyer_lead" | "exact_person" | "exact_id" | "general";
type SortKey = "datetime_pst" | "stage_at" | "buyer" | "source" | "current_stage";

const PAGE_SIZE = 25;
const SLA_MIN = 15;
const DEFAULT_SOURCE = "Leads Plus";
const ALL = "*";
// Hidden for now: source_detail, submission_method, channel, channel_detail, campaign, campaign_detail
const ADVANCED = [
  ["utm_source", "UTM source"], ["utm_medium", "UTM medium"], ["utm_campaign", "UTM campaign"], ["utm_term", "UTM term"],
  ["marketing_source", "Marketing source"], ["marketing_channel", "Marketing channel"],
] as const;
const OP_KEYS = new Set<string>(["buyer", "current_stage", ...ADVANCED.map(([k]) => k)]);
const SEARCH_FIELDS = [["q", "Search all"], ["email", "Email"], ["phone", "Phone"], ["first_name", "First name"], ["last_name", "Last name"], ["person_id", "Person ID"], ["buyer_lead_id", "Buyer lead ID"]] as const;
const MODE_LABEL: Record<SearchMode, string> = { exact_email: "exact email", exact_phone: "exact phone", exact_buyer_lead: "exact buyer lead ID", exact_person: "exact person ID", exact_id: "exact Unified Lead ID", general: "" };
const SORTS: [SortKey, string][] = [["datetime_pst", "Submitted At"], ["stage_at", "Last Update"], ["buyer", "Buyer"], ["source", "Source"], ["current_stage", "Stage"]];
const LABELS: Record<string, string> = Object.fromEntries([...ADVANCED, ["buyer", "Buyer"], ["source", "Source"], ["current_stage", "Buyer Stage"]]);

const pacificDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
// Display-only: API values say "HomeLight"; the product spelling is "Homelight". Filter values stay unchanged.
const dispSource = (s?: string | null) => (s ?? "").replace(/homelight/gi, "Homelight");
function defaultDates() { const now = new Date(); return { date_from: pacificDay(new Date(now.getTime() - 29 * 86_400_000)), date_to: pacificDay(now) }; }
function defaultFilters(): Filters { return { source: DEFAULT_SOURCE, ...defaultDates() }; }

export function detectMode(field: string, value: string): SearchMode {
  const v = value.trim();
  if (!v) return "general";
  if (field === "email") return "exact_email";
  if (field === "phone") return "exact_phone";
  if (field === "buyer_lead_id") return "exact_buyer_lead";
  if (field === "person_id") return "exact_person";
  if (field !== "q") return "general";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "exact_email";
  if (/^[\d\s()+.-]+$/.test(v) && v.replace(/\D/g, "").length >= 7) return "exact_phone";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) || /^(ul|lead)[_-][\w-]{6,}$/i.test(v)) return "exact_id";
  return "general";
}

const show = (v: unknown): string => v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);
const blank = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");
const fullName = (l: Lead) => [l.first_name, l.last_name].filter(Boolean).join(" ");
const displayName = (l: Lead) => fullName(l) || l.email || l.phone_number || l.id;
const initials = (l: Lead) => {
  const parts = [l.first_name, l.last_name].filter(Boolean) as string[];
  if (parts.length) return parts.map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (l.email || l.phone_number || l.id || "?").slice(0, 2).toUpperCase();
};
const campaignTone = (c: string | null | undefined): "success" | "info" | "neutral" => {
  const k = (c ?? "").toLowerCase();
  if (/reactiv/.test(k)) return "success";
  if (/traffic|paid|ads|affiliate/.test(k)) return "info";
  return "neutral";
};
function StagePill({ stage }: { stage: string | null | undefined }) {
  return <span className="inline-flex shrink-0 whitespace-nowrap"><Pill tone={stageTone(stage)}>{stageLabel(stage)}</Pill></span>;
}
/** Structured values (objects, JSON strings) render as an indented, scrollable monospace block. */
function Value({ v }: { v: unknown }) {
  const s = parseStructured(v);
  if (s !== undefined) return <pre className="max-h-64 overflow-auto whitespace-pre rounded border border-border bg-muted p-2 text-left font-mono text-[11px] font-normal">{JSON.stringify(s, null, 2)}</pre>;
  return <>{show(v)}</>;
}
/** Pacific display. Values with Z/offset are converted; *_pst wall-clock values are shown as-is (no double shift). */
export function ptParts(v: string | null | undefined): { date: string; time: string | null } | null {
  if (blank(v)) return null;
  const t = String(v).trim();
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(t)) {
    const d = new Date(t); if (isNaN(d.getTime())) return null;
    const tz = "America/Los_Angeles";
    return { date: new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric", year: "numeric" }).format(d), time: new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d) };
  }
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(m[2]) - 1];
  const date = `${mon} ${Number(m[3])}, ${m[1]}`;
  if (!m[4]) return { date, time: null };
  const h = Number(m[4]);
  return { date, time: `${h % 12 || 12}:${m[5]} ${h < 12 ? "AM" : "PM"}` };
}
const pst = (v: string | null | undefined) => { const p = ptParts(v); return p ? (p.time ? `${p.date} · ${p.time}` : p.date) : "—"; };
function PtCell({ v }: { v: string | null | undefined }) { const p = ptParts(v); return p ? <><div>{p.date}</div>{p.time && <div className="text-muted-foreground">{p.time}</div>}</> : <span className="text-muted-foreground">—</span>; }

function parseStructured(v: unknown): unknown | undefined {
  if (v !== null && typeof v === "object") return v;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!/^[[{]/.test(t)) return undefined;
  try { return JSON.parse(t); } catch { /* try ruby hash */ }
  try { return JSON.parse(t.replace(/:([A-Za-z_][\w]*)\s*=>/g, '"$1"=>').replace(/=>/g, ":").replace(/\bnil\b/g, "null")); } catch { return undefined; }
}
function CopyId({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" aria-label="Copy Unified Lead ID" title="Copy Unified Lead ID" onKeyDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(id).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }); }} className="inline-flex shrink-0 items-center rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">{done ? <span className="text-[10px]">Copied</span> : <Copy className="h-3 w-3" />}</button>;
}

/* ---------------- Health strip ---------------- */
function HealthStrip() {
  const pipe = useQuery(leadsPipelineQuery);
  const api = useQuery({ queryKey: ["unified-leads", "api-health", 1], queryFn: () => leadsGet<ApiHealthResponse>("/v1/api-health", { hours: 1 }), retry: 1 });
  const p = pipe.data;
  const last = p?.pipelines.map((x) => x.lastSuccessfulAt).filter(Boolean).sort().at(-1) ?? null;
  const lag = p?.pipelines.reduce<number | null>((m, x) => x.lagMinutes == null ? m : Math.max(m ?? 0, x.lagMinutes), null) ?? null;
  const failed = p?.overallStatus === "failed";
  const stale = !failed && (p?.overallStatus === "stale" || (lag != null && lag > SLA_MIN));
  const vol = api.data?.counts?.estimatedTotalVolume ?? api.data?.counts?.total ?? 0;
  const e5 = api.data?.counts?.logged5xx ?? 0;
  const apiState = api.error ? "Unavailable" : !api.data ? null : vol > 0 && e5 >= vol ? "Unavailable" : e5 > 0 && e5 / Math.max(vol, 1) > 0.01 ? "Degraded" : "Healthy";
  const apiTone = apiState === "Healthy" ? "success" : apiState === "Degraded" ? "warning" : "danger";
  const card = "flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-xs hover:bg-accent/40";
  return <div className="space-y-3 py-4">
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link to="/unified-leads/pipeline-api-health" className={card} aria-label="Open pipeline health">
        <div className="min-w-0"><div className="font-medium text-foreground">Pipeline Health</div>
          <div className="truncate text-muted-foreground">{pipe.isLoading ? "Checking…" : pipe.error ? "Status unavailable" : <>Last successful sync: <span title={last ? fmtPst(last) : undefined}>{relTime(last)}</span></>}</div></div>
        {pipe.isLoading ? <Shimmer className="h-5 w-24" /> : <Pill tone={pipe.error ? "danger" : pipelineTone(p?.overallStatus)}>{pipe.error ? "Unavailable" : LEADS_OVERALL[p?.overallStatus ?? "unknown"]}</Pill>}
      </Link>
      <Link to="/unified-leads/pipeline-api-health" className={card} aria-label="Open API health">
        <div className="min-w-0"><div className="font-medium text-foreground">API Health</div>
          <div className="truncate text-muted-foreground">{api.isLoading ? "Checking…" : api.error ? "Health check failed" : <>Last check: {relTime(new Date(api.dataUpdatedAt).toISOString())} · {vol.toLocaleString()} requests · {e5.toLocaleString()} server errors</>}</div></div>
        {api.isLoading ? <Shimmer className="h-5 w-20" /> : apiState && <Pill tone={apiTone}>{apiState}</Pill>}
      </Link>
    </div>
    {(failed || stale) && <div role="alert" className="flex flex-wrap items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1"><strong>{failed ? "Lead ingestion has failed." : "Lead data may be stale."}</strong> Last successful sync: {last ? `${relTime(last)} (${fmtPst(last)})` : "not reported"}. The 15-minute freshness SLA has been exceeded.</div>
      <Link to="/unified-leads/pipeline-api-health" className="font-medium underline">View Pipeline & API Health</Link>
    </div>}
    {(apiState === "Unavailable" || apiState === "Degraded") && <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" /><strong className="flex-1">{apiState === "Unavailable" ? "Unable to retrieve lead data." : "API health is degraded."}</strong><Link to="/unified-leads/pipeline-api-health" className="font-medium underline">View Pipeline & API Health</Link></div>}
    <div className="text-right"><Link to="/unified-leads/pipeline-api-health" className="text-xs font-medium text-primary hover:underline">View Pipeline & API Health →</Link></div>
  </div>;
}

/* ---------------- Drawer ---------------- */
function Rows({ rows }: { rows: [string, unknown][] }) {
  const r = rows.filter(([, v]) => !blank(v));
  if (!r.length) return null;
  return <dl className="divide-y divide-border border-y border-border text-xs">{r.map(([k, v]) => <div key={k} className="grid grid-cols-[38%_1fr] gap-3 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words text-right font-medium"><Value v={v} /></dd></div>)}</dl>;
}
function Section({ title, rows, children }: { title: string; rows?: [string, unknown][]; children?: React.ReactNode }) {
  if (!children && (!rows || rows.every(([, v]) => blank(v)))) return null;
  return <section className="mt-6"><h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</h3>{children ?? <Rows rows={rows!} />}</section>;
}
function Fold({ title, rows }: { title: string; rows: [string, unknown][] }) {
  const [open, setOpen] = useState(false);
  if (rows.every(([, v]) => blank(v))) return null;
  return <section className="mt-4 border-t border-border pt-3"><button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center gap-1 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground">{open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}{title}</button>{open && <div className="mt-2"><Rows rows={rows} /></div>}</section>;
}
const ptOrNull = (v: string | null | undefined) => blank(v) ? null : ptParts(v) ? pst(v) : null;
function IsoDateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const sel = value ? new Date(`${value}T12:00:00`) : undefined;
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><button type="button" aria-label={label} className="inline-flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-border bg-card px-2 text-left font-mono text-xs text-foreground hover:bg-accent"><CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{value || <span className="font-sans text-muted-foreground">Any date</span>}</span></button></PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={sel} defaultMonth={sel} onSelect={(d) => { onChange(d ? iso(d) : ""); setOpen(false); }} initialFocus className="pointer-events-auto p-3" />{value && <div className="border-t border-border p-2"><Button size="sm" variant="ghost" className="w-full text-xs" onClick={() => { onChange(""); setOpen(false); }}>Clear date</Button></div>}</PopoverContent></Popover>;
}
function Technical({ value }: { value: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(value, null, 2);
  const payload = value.event_payload;
  return <div className="mt-2"><button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">{open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}Technical details</button>
    {open && <div className="mt-1">{payload !== undefined && <button type="button" onClick={() => navigator.clipboard?.writeText(typeof payload === "string" ? payload : JSON.stringify(payload, null, 2)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); })} className="mb-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"><Copy className="h-3 w-3" />{copied ? "Copied" : "Copy raw payload"}</button>}<pre className="overflow-x-auto whitespace-pre-wrap break-all rounded border border-border bg-muted p-2 font-mono text-[11px]">{text}</pre></div>}</div>;
}
function EventItem({ e }: { e: LeadEvent }) {
  const v = presentEvent(e);
  const tech: Record<string, unknown> = { event_type: e.event_type, event_subtype: e.event_subtype, event_source: e.event_source, event_id: e.id, source_event_id: e.source_event_id, old_value: parseStructured(e.old_value) ?? e.old_value, new_value: parseStructured(e.new_value) ?? e.new_value };
  if (!blank(e.event_payload)) tech.event_payload = parseStructured(e.event_payload) ?? e.event_payload;
  Object.keys(tech).forEach((k) => blank(tech[k]) && delete tech[k]);
  const simpleNew = v.isStage && !blank(e.new_value) && parseStructured(e.new_value) === undefined;
  const simpleOld = simpleNew && !blank(e.old_value) && parseStructured(e.old_value) === undefined;
  return <article className={`border-b border-border py-3 text-xs ${v.isStage ? "-ml-[17px] border-l-2 border-l-primary bg-primary/5 pl-[15px] pr-2" : ""}`}>
    <div className="flex justify-between gap-3"><strong className={v.isStage ? "text-primary" : "text-foreground"}>{v.title}</strong><time className="shrink-0 text-muted-foreground">{pst(e.event_timestamp)}</time></div>
    {simpleNew ? <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-medium">{simpleOld && <><StagePill stage={e.old_value} /> →</>}<StagePill stage={e.new_value} /></div> : v.summary && <div className="mt-0.5 text-foreground">{v.summary}</div>}
    {v.source && <div className="mt-1 text-[11px] text-muted-foreground">Source: {v.source}</div>}
    {Object.keys(tech).length > 0 && <Technical value={tech} />}
  </article>;
}
function LeadDrawer({ id, close }: { id: string | null; close: () => void }) {
  const [tab, setTab] = useState("overview");
  const detail = useQuery({ queryKey: ["unified-lead", id], queryFn: () => leadsGet<LeadDetail>(`/v1/leads/${encodeURIComponent(id ?? "")}`), enabled: !!id, retry: 1 });
  const events = useQuery({ queryKey: ["unified-lead-events", id], queryFn: () => leadsGet<EventsResponse>(`/v1/leads/${encodeURIComponent(id ?? "")}/events`, { limit: 200 }), enabled: !!id, retry: 1 });
  const d = detail.data; const lead = d?.lead; const b = d?.bridge;
  const list = useMemo(() => [...(events.data?.events ?? [])].sort((a, z) => String(z.event_timestamp ?? "").localeCompare(String(a.event_timestamp ?? ""))), [events.data]);
  const recent = useMemo(() => pickRecent(list, 3), [list]);
  const stage = d?.current_stage ?? lead?.current_stage; const stageAt = d?.stage_at ?? lead?.stage_at; const stageSrc = d?.stage_source ?? lead?.stage_source;
  const money = (v: number | null) => v == null ? null : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
  return <Sheet open={!!id} onOpenChange={(o) => { if (!o) { close(); setTab("overview"); } }}><SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
    <div className="sticky top-0 z-10 border-b border-border bg-background px-6 pb-4 pt-6">
      <SheetHeader><SheetTitle className="truncate pr-6">{lead ? displayName(lead) : "Lead details"}</SheetTitle>
        <SheetDescription asChild><div className="flex items-center gap-1 font-mono text-xs"><span className="truncate">{id}</span>{id && <CopyId id={id} />}</div></SheetDescription></SheetHeader>
      {detail.isLoading ? <Shimmer className="mt-3 h-5 w-48" /> : lead && <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"><span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Buyer Stage</span><StagePill stage={stage} /><span className="text-muted-foreground">Last changed: {blank(stageAt) ? "—" : pst(stageAt)}{stageSrc === "event" ? " · from latest buyer stage event" : stageSrc === "crm" ? " · from buyer CRM" : ""}</span></div>}
    </div>
    <div className="px-6 pb-8">
      {detail.isLoading && <div className="mt-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Shimmer key={i} className="h-4 w-full" />)}</div>}
      {detail.error && <p role="alert" className="mt-6 text-sm text-destructive">Unable to load this lead. {(detail.error as Error).message}</p>}
      {lead && <Tabs value={tab} onValueChange={setTab} className="mt-4"><TabsList className="w-full"><TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger><TabsTrigger value="lifecycle" className="flex-1">Lifecycle ({d?.events_count ?? list.length})</TabsTrigger></TabsList>
        <TabsContent value="overview">
          <Section title="Lead snapshot" rows={[["Name", fullName(lead)], ["Email", lead.email], ["Phone", lead.phone_number], ["Buyer", (d?.buyer_name ?? lead.buyer_name) ? dispSource(d?.buyer_name ?? lead.buyer_name) : null], ["Source", dispSource(lead.source)], ["Submitted at", blank(lead.datetime_pst ?? lead.date_pst) ? null : pst(lead.datetime_pst ?? lead.date_pst)], ["Submission method", lead.submission_method], ["Channel", lead.channel], ["Campaign", lead.campaign], ["User type", lead.lead_user_type], ["Lead score", lead.lead_score]]} />
          <Section title="Recent activity">{events.isLoading ? <Shimmer className="h-16 w-full" /> : events.error ? <p className="text-xs text-destructive">Unable to load activity.</p> : recent.length === 0 ? <p className="text-xs text-muted-foreground">No activity reported.</p> : <div className="border-l border-border pl-4">{recent.map((e) => <EventItem key={e.id} e={e} />)}<button type="button" onClick={() => setTab("lifecycle")} className="mt-2 text-xs font-medium text-primary hover:underline">View Full Lifecycle →</button></div>}</Section>
          <Fold title="Contact & identity" rows={[["Name", fullName(lead)], ["Email", lead.email], ["Phone", lead.phone_number], ["Phone verified", lead.phone_verified == null ? null : lead.phone_verified ? "Yes" : "No"], ["Verification source", lead.phone_verified_source], ["Person ID (may span multiple leads)", lead.person_id]]} />
          <Fold title="Bridge identifiers" rows={[["Unified Lead ID", lead.id || id], ["Buyer lead ID", b?.buyer_lead_id ?? lead.buyer_lead_id], ["Routing platform lead ID", b?.routing_platform_lead_id ?? lead.routing_platform_lead_id], ["Alyson session ID", b?.alyson_session_id ?? lead.alyson_session_id], ["Client lead ID", b?.client_lead_id ?? lead.client_lead_id], ["Custom identifiers", customIdentifiersForDisplay(b?.custom_identifiers)]]} />
          <section className="mt-6"><h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Acquisition attribution</h3>
            {(() => { const rows: [string, unknown][] = [["Source", dispSource(lead.source)], ["Source detail", lead.source_detail], ["Submission method", lead.submission_method], ["Channel", lead.channel], ["Channel detail", lead.channel_detail], ["Campaign", lead.campaign], ["Campaign detail", lead.campaign_detail], ["Publisher", lead.publisher], ["Publisher channel", lead.publisher_channel], ["Page type", lead.source_page_type], ["Source form", lead.source_form], ["UTM source", lead.utm_source], ["UTM medium", lead.utm_medium], ["UTM campaign", lead.utm_campaign], ["UTM term", lead.utm_term], ["UTM content", lead.utm_content], ["Marketing source", lead.marketing_source], ["Marketing channel", lead.marketing_channel], ["Referrer", lead.referrer]]; return rows.some(([, v]) => !blank(v)) ? <Rows rows={rows} /> : <p className="text-xs text-muted-foreground">Not reported.</p>; })()}
          </section>
          <Fold title="Property information" rows={[["Address", lead.address_line_1], ["City", lead.city], ["State", lead.state], ["ZIP", lead.zip], ["Property type", lead.property_type], ["Property price", money(lead.property_price)]]} />
          <Fold title="Notes" rows={[["Client notes", lead.client_notes], ["From agent", lead.notes_from_agent], ["To agents", lead.notes_to_agents], ["Custom attributes", lead.custom_attributes]]} />
          <Fold title="Additional metadata" rows={[["Buyer ID", lead.buyer_id], ["Buyer date", ptOrNull(lead.buyer_date)], ["Client ID", lead.client_id], ["Workspace ID", lead.workspace_id], ["Vertical ID", lead.vertical_id], ["Sub-vertical ID", lead.sub_vertical_id], ["Offer ID", lead.offer_id], ["Sub-offer ID", lead.sub_offer_id], ["Created", ptOrNull(lead.created_at)], ["Updated", ptOrNull(lead.updated_at)], ["Closed", ptOrNull(lead.closed_at)]]} />
        </TabsContent>
        <TabsContent value="lifecycle" className="mt-4">
          <p className="mb-3 text-xs text-muted-foreground">What happened to this lead, and when? Newest first, Pacific time.</p>
          {events.isLoading && <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} className="h-14 w-full" />)}</div>}
          {events.error && <p role="alert" className="text-sm text-destructive">Unable to load lifecycle events. {(events.error as Error).message}</p>}
          {!events.isLoading && !events.error && list.length === 0 && <div role="status" className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-xs">
            <p className="font-medium text-foreground">Stage exists in buyer CRM; event history is not yet shown</p>
            <ul className="space-y-0.5 text-muted-foreground">
              <li>Current stage: <StagePill stage={stage} /></li>
              <li>Last stage change: {blank(stageAt) ? "Not reported" : pst(stageAt)}</li>
              <li>Reported by: {stageSrc === "crm" ? "Buyer CRM" : stageSrc === "event" ? "Latest buyer stage event" : blank(stageSrc) ? "Not reported" : String(stageSrc)}</li>
            </ul>
            <p className="text-muted-foreground">To trace it, look up the buyer lead ID ({show(b?.buyer_lead_id ?? lead.buyer_lead_id)}) in the buyer CRM feed. A stage change with no matching event here usually means an ingestion gap — check Pipeline &amp; API Health.</p>
          </div>}
          <div className="border-l border-border pl-4">{list.map((e) => <EventItem key={e.id} e={e} />)}</div>
          {(events.data?.total ?? 0) > list.length && <p className="mt-3 text-xs text-muted-foreground">Showing {list.length} of {events.data?.total} events.</p>}
        </TabsContent>
      </Tabs>}
    </div>
  </SheetContent></Sheet>;
}

/* ---------------- Explorer ---------------- */
function UnifiedLeads() {
  const client = useQueryClient();
  const [searchField, setSearchField] = useState<string>("q");
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState<{ field: string; value: string; mode: SearchMode }>({ field: "q", value: "", mode: "general" });
  const [filterDraft, setFilterDraft] = useState<Filters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(defaultFilters);
  const [sourceOrigin, setSourceOrigin] = useState<Origin>("default");
  const [dateOrigin, setDateOrigin] = useState<Origin>("default");
  const [sortKey, setSortKey] = useState<SortKey>("datetime_pst");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [offset, setOffset] = useState(0);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [exportNote, setExportNote] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const facets = useQuery({ queryKey: ["unified-leads-facets"], queryFn: () => leadsGet<Facets>("/v1/meta/facets"), staleTime: 5 * 60_000, retry: 1 });

  const requestParams = useMemo(() => {
    const out: Record<string, string> = {};
    Object.entries(appliedFilters).forEach(([k, v]) => {
      if (k.endsWith("_op") || !v) return;
      out[k] = v;
      if (OP_KEYS.has(k)) out[`${k}_op`] = appliedFilters[`${k}_op`] === "contains" ? "contains" : "eq";
    });
    if (appliedSearch.value) {
      out[appliedSearch.field] = appliedSearch.value;
      if (appliedSearch.mode !== "general") { out.exact_lookup = "1"; out[`${appliedSearch.field}_op`] = "eq"; }
    }
    out.sort = sortKey; out.order = sortOrder;
    return out;
  }, [appliedFilters, appliedSearch, sortKey, sortOrder]);

  const query = useQuery({ queryKey: ["unified-leads", "list", requestParams, offset], queryFn: () => leadsGet<LeadsResponse>("/v1/leads", { ...requestParams, limit: PAGE_SIZE, offset }), retry: 1 });
  const data = query.data; const leads = data?.leads ?? []; const total = data?.total ?? 0;

  const sourceOptions = useMemo(() => { const s = Array.isArray(facets.data?.source) ? (facets.data!.source as string[]) : []; return [DEFAULT_SOURCE, ...s.filter((x) => x !== DEFAULT_SOURCE)]; }, [facets.data]);
  const facetOptions = (key: string) => key === "buyer" ? (facets.data?.buyers ?? []).map((b) => b.buyer_name || b.buyer_id) : Array.isArray(facets.data?.[key]) ? (facets.data![key] as string[]) : [];

  const stageOptions = useMemo(() => { const f = facets.data?.current_stage; const live = Array.isArray(f) ? (f as unknown[]).filter((x): x is string => typeof x === "string" && x.trim() !== "") : []; return live.length ? live : FALLBACK_STAGES; }, [facets.data]);
  const commit = (f: Filters, s = appliedSearch, so = sourceOrigin, dO = dateOrigin) => { setBannerDismissed(false); setAppliedFilters(f); setFilterDraft(f); setAppliedSearch(s); setSourceOrigin(so); setDateOrigin(dO); setOffset(0); };
  const restoreDefaultsIfBroadened = (f: Filters) => { const d = defaultFilters(); const next = { ...f }; let so = sourceOrigin, dO = dateOrigin; if (so === "broadened") { next.source = d.source; so = "default"; } if (dO === "broadened") { next.date_from = d.date_from; next.date_to = d.date_to; dO = "default"; } return { next, so, dO }; };

  const submitSearch = () => {
    const value = searchDraft.trim(); const mode = detectMode(searchField, value);
    const s = { field: searchField, value, mode };
    if (mode !== "general") {
      const next = { ...appliedFilters }; let so = sourceOrigin, dO = dateOrigin;
      if (so !== "user") { next.source = ALL; so = "broadened"; }
      if (dO !== "user") { next.date_from = ""; next.date_to = ""; dO = "broadened"; }
      commit(next, s, so, dO);
    } else { const r = restoreDefaultsIfBroadened(appliedFilters); commit(r.next, s, r.so, r.dO); }
  };
  const applyFilters = () => {
    const so: Origin = filterDraft.source !== appliedFilters.source ? "user" : sourceOrigin;
    const dO: Origin = filterDraft.date_from !== appliedFilters.date_from || filterDraft.date_to !== appliedFilters.date_to ? "user" : dateOrigin;
    commit(filterDraft, appliedSearch, so, dO);
  };
  const clearAll = () => { setSearchDraft(""); setSearchField("q"); setSortKey("datetime_pst"); setSortOrder("desc"); commit(defaultFilters(), { field: "q", value: "", mode: "general" }, "default", "default"); };
  const broadenAll = () => commit({ ...appliedFilters, source: ALL, date_from: "", date_to: "" }, appliedSearch, "user", "user");
  const resetSearch = () => { setSearchDraft(""); const r = restoreDefaultsIfBroadened(appliedFilters); commit(r.next, { field: "q", value: "", mode: "general" }, r.so, r.dO); };
  const setSort = (k: SortKey) => { if (k === sortKey) setSortOrder(sortOrder === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortOrder(k === "datetime_pst" || k === "stage_at" ? "desc" : "asc"); } setOffset(0); };

  const unapplied = JSON.stringify(filterDraft) !== JSON.stringify(appliedFilters);
  const srcLabel = (s?: string) => !s || s === ALL ? "all sources" : dispSource(s);
  const dateLabel = appliedFilters.date_from || appliedFilters.date_to ? `${appliedFilters.date_from || "start"} to ${appliedFilters.date_to || "today"} (PT)${dateOrigin === "default" ? " · last 30 days" : ""}` : "all dates";
  const scope = `Searching ${srcLabel(appliedFilters.source)} and ${dateLabel}${appliedSearch.mode !== "general" ? ` (${MODE_LABEL[appliedSearch.mode]})` : ""}`;

  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (appliedSearch.value) chips.push({ key: "search", label: `${SEARCH_FIELDS.find(([k]) => k === appliedSearch.field)?.[1]}: ${appliedSearch.value}`, remove: resetSearch });
  if (sourceOrigin === "user" && appliedFilters.source !== DEFAULT_SOURCE) chips.push({ key: "source", label: `Source: ${appliedFilters.source === ALL ? "All sources" : dispSource(appliedFilters.source)}`, remove: () => commit({ ...appliedFilters, source: DEFAULT_SOURCE }, appliedSearch, "default", dateOrigin) });
  if (dateOrigin === "user") chips.push({ key: "date", label: `Dates: ${appliedFilters.date_from || "any"} – ${appliedFilters.date_to || "any"}`, remove: () => commit({ ...appliedFilters, ...defaultDates() }, appliedSearch, sourceOrigin, "default") });
  if (appliedFilters.current_stage) chips.push({ key: "current_stage", label: `Buyer Stage: ${appliedFilters.current_stage === STAGE_NONE ? "Not reported" : stageLabel(appliedFilters.current_stage)}`, remove: () => { const n: Filters = { ...appliedFilters, current_stage: "" }; delete n.current_stage_op; commit(n); } });
  ["buyer", ...ADVANCED.map(([k]) => k)].forEach((k) => { if (appliedFilters[k]) chips.push({ key: k, label: `${LABELS[k]} ${appliedFilters[`${k}_op`] === "contains" ? "contains" : "="} ${dispSource(appliedFilters[k])}`, remove: () => { const n = { ...appliedFilters, [k]: "" }; delete n[`${k}_op`]; commit(n); } }); });

  const doExport = async () => {
    setExporting(true); setExportNote(null);
    try {
      const info = await leadsDownloadCsv("/v1/leads", { ...requestParams, format: "csv", limit: 10000 });
      const matched = info.matchedTotal ?? total;
      setExportNote(info.truncated ? { tone: "info", text: `Exported the first ${(info.rowCount ?? 10000).toLocaleString()} of ${matched.toLocaleString()} matching leads (10,000 row export limit).` } : { tone: "info", text: `Exported ${(info.rowCount ?? matched).toLocaleString()} leads.` });
    } catch (e) { setExportNote({ tone: "error", text: `Export failed: ${(e as Error).message}` }); }
    finally { setExporting(false); }
  };

  const sel = "ui-select-chevron h-9 rounded-md border border-border bg-card px-2 text-xs text-foreground";
  const SortHead = ({ k, label }: { k: SortKey; label: string }) => <button type="button" onClick={() => setSort(k)} className={`inline-flex items-center gap-1 ${sortKey === k ? "text-foreground" : ""} hover:text-foreground`} aria-label={`Sort by ${label}`}>{label}{sortKey === k && (sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</button>;
  const headers: [string, SortKey | null][] = [["Contact", null], ["Stage", "current_stage"], ["Buyer", "buyer"], ["Unified Lead ID", null], ["Source", "source"], ["Submitted At", "datetime_pst"], ["Last Update", "stage_at"], ["Campaign", null]];

  return <div className="pb-12">
    <PageHeader title="Unified Leads" subtitle={query.isLoading ? "Loading matching leads…" : query.error ? "Find, investigate, and track leads across sources." : `${total.toLocaleString()} matching leads · ${appliedFilters.source && appliedFilters.source !== ALL ? appliedFilters.source : "All sources"} · ${appliedFilters.date_from || appliedFilters.date_to ? `${appliedFilters.date_from || "start"} – ${appliedFilters.date_to || "today"} (PT)` : "All dates"}`} actions={<div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => { client.invalidateQueries({ queryKey: ["unified-leads"] }); client.invalidateQueries({ queryKey: ["unified-leads-facets"] }); }}><RefreshCw className="mr-1.5 h-4 w-4" /> Refresh</Button>
    </div>} />
    <div className="px-4 sm:px-6">
      <HealthStrip />

      {/* Search & filters panel */}
      <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
        <form className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center" onSubmit={(e) => { e.preventDefault(); submitSearch(); }}>
          <select aria-label="Search field" value={searchField} onChange={(e) => setSearchField(e.target.value)} className={`${sel} sm:w-36`}>{SEARCH_FIELDS.map(([k, l]) => <option value={k} key={k}>{l}</option>)}</select>
          <div className="relative min-w-0 flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="Search name, email, phone, Unified Lead ID, buyer lead ID, or person ID" className="pl-9" aria-label="Search leads" /></div>
          <Button type="submit"><Search className="mr-1.5 h-4 w-4" />Search</Button>
        </form>
        <div className="flex flex-col gap-2 p-4 sm:flex-row sm:flex-wrap sm:items-center" role="group" aria-label="Source">
          <span className="mr-2 text-sm font-semibold text-foreground">Source</span>
          {[[ALL, "All sources"] as const, ...sourceOptions.map((o) => [o, dispSource(o)] as const)].map(([v, l]) => <button key={v} type="button" aria-pressed={(filterDraft.source ?? "") === v} onClick={() => setFilterDraft({ ...filterDraft, source: v })} className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${(filterDraft.source ?? "") === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-accent"}`}>{l}</button>)}
        </div>
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-4">
          <div className="min-w-0 text-xs"><span className="mb-1.5 block font-medium text-muted-foreground">From (PT)</span><IsoDateField label="From date" value={filterDraft.date_from ?? ""} onChange={(v) => setFilterDraft({ ...filterDraft, date_from: v })} /></div>
          <div className="min-w-0 text-xs"><span className="mb-1.5 block font-medium text-muted-foreground">To (PT)</span><IsoDateField label="To date" value={filterDraft.date_to ?? ""} onChange={(v) => setFilterDraft({ ...filterDraft, date_to: v })} /></div>
          <label className="min-w-0 text-xs"><span className="mb-1.5 block font-medium text-muted-foreground">Buyer</span><select aria-label="Buyer" value={filterDraft.buyer ?? ""} onChange={(e) => setFilterDraft({ ...filterDraft, buyer: e.target.value })} className={`${sel} w-full`}><option value="">All buyers</option>{facetOptions("buyer").map((o) => <option key={o} value={o}>{dispSource(o)}</option>)}</select>
            {filterDraft.buyer && <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pl-2.5 pr-1">{dispSource(filterDraft.buyer)}<button type="button" aria-label="Remove buyer" onClick={() => setFilterDraft({ ...filterDraft, buyer: "" })} className="rounded-full p-0.5 hover:bg-accent"><X className="h-3 w-3" /></button></span>}</label>
          <label className="min-w-0 text-xs"><span className="mb-1.5 block font-medium text-muted-foreground">Buyer Stage</span><select aria-label="Buyer Stage" value={filterDraft.current_stage ?? ""} onChange={(e) => setFilterDraft({ ...filterDraft, current_stage: e.target.value })} className={`${sel} w-full`}><option value="">Any stage</option><option value={STAGE_NONE}>Not reported</option>{stageOptions.map((o) => <option key={o} value={o}>{stageLabel(o)}</option>)}</select>
            {filterDraft.current_stage && <span className="mt-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-border bg-muted/50 py-0.5 pl-2.5 pr-1">{filterDraft.current_stage === STAGE_NONE ? "Not reported" : stageLabel(filterDraft.current_stage)}<button type="button" aria-label="Remove buyer stage" onClick={() => setFilterDraft({ ...filterDraft, current_stage: "" })} className="rounded-full p-0.5 hover:bg-accent"><X className="h-3 w-3" /></button></span>}</label>
        </div>
        <div className="p-4">
          <div className="mb-3 flex items-center gap-1.5"><h3 className="text-sm font-semibold">Attribution</h3><Info className="h-3.5 w-3.5 text-muted-foreground" /></div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{ADVANCED.map(([key, label]) => { const cur = filterDraft[`${key}_op`] === "contains" ? "contains" : "eq"; return <label key={key} className="block min-w-0 text-xs text-muted-foreground">
            <span className="mb-1 flex items-center justify-between gap-1"><span className="truncate">{label}</span><span className="inline-flex shrink-0 overflow-hidden rounded border border-border text-[10px]">{(["eq", "contains"] as const).map((op) => <button type="button" key={op} aria-pressed={cur === op} onClick={() => setFilterDraft({ ...filterDraft, [`${key}_op`]: op, ...(cur !== op ? { [key]: "" } : {}) })} className={cur === op ? "bg-primary px-1.5 py-0.5 text-primary-foreground" : "px-1.5 py-0.5 hover:bg-accent"}>{op === "eq" ? "=" : "contains"}</button>)}</span></span>
            {cur === "contains" ? <Input aria-label={label} value={filterDraft[key] ?? ""} placeholder="Contains…" onChange={(e) => setFilterDraft({ ...filterDraft, [key]: e.target.value })} className="h-9 text-xs" /> : <select aria-label={label} value={filterDraft[key] ?? ""} onChange={(e) => setFilterDraft({ ...filterDraft, [key]: e.target.value })} className={`${sel} w-full`}><option value="">All</option>{facetOptions(key).map((o) => <option value={o} key={o}>{o}</option>)}</select>}
          </label>; })}</div>
          {facets.error && <span className="mt-2 block text-xs text-destructive">Filter options unavailable. Try refreshing.</span>}
        </div>
        <div className="flex flex-col gap-2 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <Button onClick={applyFilters}>Apply Filters</Button>
          {unapplied && <Button variant="outline" onClick={() => setFilterDraft(appliedFilters)}>Discard Changes</Button>}
          <Button variant="ghost" onClick={clearAll}><X className="mr-1 h-4 w-4" />Clear All</Button>
          {unapplied && <span role="status" className="inline-flex items-center gap-1.5 self-start rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning-foreground sm:self-center"><span className="h-1.5 w-1.5 rounded-full bg-warning" />Pending filter changes</span>}
        </div>
      </div>

      {/* Scope + chips */}
      <div className="flex flex-wrap items-center gap-2 py-3 text-xs">
        <span className="text-muted-foreground">{scope}</span>
        {chips.map((c) => <span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pl-2.5 pr-1">{c.label}<button type="button" aria-label={`Remove ${c.label}`} onClick={c.remove} className="rounded-full p-0.5 hover:bg-accent"><X className="h-3 w-3" /></button></span>)}
      </div>

      {appliedSearch.mode !== "general" && (sourceOrigin === "broadened" || dateOrigin === "broadened") && !bannerDismissed && <div role="status" className="mb-3 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs"><Search className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="flex-1">Searching all sources and dates for {MODE_LABEL[appliedSearch.mode]}: <strong>{appliedSearch.value}</strong></span><button type="button" aria-label="Dismiss" onClick={() => setBannerDismissed(true)} className="rounded p-0.5 hover:bg-accent"><X className="h-3 w-3" /></button></div>}

      {/* Lead Records header: count + sort + download */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="h-5 w-5" /></span>
          <div><h2 className="text-base font-semibold">Lead Records</h2><p className="text-xs text-muted-foreground">{query.isLoading ? "Loading…" : query.error ? "Results unavailable" : `${total.toLocaleString()} matching leads${total ? ` · Showing ${(offset + 1).toLocaleString()}–${Math.min(offset + PAGE_SIZE, total).toLocaleString()}` : ""}`}{query.isFetching && !query.isLoading ? " · Refreshing…" : ""}</p></div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Sort by</span>
          <select aria-label="Sort by" value={sortKey} onChange={(e) => setSort(e.target.value as SortKey)} className={sel}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <Button size="sm" variant="outline" aria-label="Toggle sort order" onClick={() => { setSortOrder(sortOrder === "asc" ? "desc" : "asc"); setOffset(0); }}>{sortOrder === "asc" ? <><ArrowUp className="mr-1 h-3 w-3" />Asc</> : <><ArrowDown className="mr-1 h-3 w-3" />Desc</>}</Button>
          <Button size="sm" variant="outline" disabled={exporting || !!query.error} onClick={doExport}><Download className="mr-1.5 h-4 w-4" />{exporting ? "Exporting…" : "Download"}</Button>
        </div>
      </div>
      {exportNote && <p role={exportNote.tone === "error" ? "alert" : "status"} className={`mb-3 text-xs ${exportNote.tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>{exportNote.text}</p>}

      {query.error ? <div role="alert" className="flex flex-col items-center gap-3 border-y border-border py-12 text-center"><AlertTriangle className="h-5 w-5 text-destructive" /><p className="text-sm font-medium text-destructive">Unable to load leads</p><p className="text-xs text-muted-foreground">{(query.error as Error).message}</p><Button size="sm" variant="outline" onClick={() => query.refetch()}>Retry</Button></div> :
      <div className="overflow-x-auto border-y border-border"><table className="w-full min-w-[1100px] text-left text-xs">
        <thead className="bg-muted/40 text-muted-foreground"><tr>{headers.map(([h, k]) => <th key={h} className="whitespace-nowrap px-3 py-2.5 font-medium" aria-sort={k && sortKey === k ? (sortOrder === "asc" ? "ascending" : "descending") : undefined}>{k ? <SortHead k={k} label={h} /> : h}</th>)}</tr></thead>
        <tbody>
          {!query.isLoading && leads.map((l) => <tr key={l.id} tabIndex={0} role="button" aria-label={`Open lead ${displayName(l)}`} onClick={() => setSelectedLeadId(l.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedLeadId(l.id); } }} className="cursor-pointer border-t border-border hover:bg-accent/50 focus:bg-accent/50 focus:outline-none">
            <td className="w-[240px] max-w-[240px] px-3 py-3"><div className="flex items-center gap-2.5"><span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">{initials(l)}</span><div className="min-w-0"><div className="truncate font-medium" title={fullName(l) || undefined}>{fullName(l) || "—"}</div><div className="truncate text-muted-foreground" title={l.email ?? l.phone_number ?? undefined}>{show(l.email ?? l.phone_number)}</div></div></div></td>
            <td className="px-3 py-3"><StagePill stage={l.current_stage} /></td>
            <td className="px-3 py-3">{show(l.buyer_name ? dispSource(l.buyer_name) : l.buyer_name)}</td>
            <td className="px-3 py-3"><div className="flex max-w-40 items-center gap-1 font-mono"><span className="truncate" title={l.id}>{l.id}</span><CopyId id={l.id} /></div></td>
            <td className="px-3 py-3">{show(dispSource(l.source))}</td>
            <td className="whitespace-nowrap px-3 py-3"><PtCell v={l.datetime_pst ?? l.date_pst} /></td>
            <td className="whitespace-nowrap px-3 py-3"><PtCell v={l.stage_at} /></td>
            <td className="max-w-40 px-3 py-3">{blank(l.campaign) ? "—" : <span title={l.campaign ?? undefined}><Pill tone={campaignTone(l.campaign)}>{l.campaign}</Pill></span>}</td>
          </tr>)}
          {query.isLoading && <TableSkeleton cols={headers.length} rows={10} />}
        </tbody></table>
        {!query.isLoading && leads.length === 0 && <div className="flex flex-col items-center gap-2 py-12 text-center text-sm"><p className="font-medium">No leads match{appliedSearch.value ? ` “${appliedSearch.value}”` : " these filters"}.</p><p className="text-xs text-muted-foreground">{scope}</p><div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={broadenAll}>Search all sources and dates</Button>{appliedSearch.value && <Button size="sm" variant="ghost" onClick={resetSearch}>Reset search</Button>}</div></div>}
      </div>}

      {!query.error && <div className="flex items-center justify-between gap-4 py-4 text-xs text-muted-foreground"><span>{total ? `Showing ${(offset + 1).toLocaleString()}–${Math.min(offset + PAGE_SIZE, total).toLocaleString()} of ${total.toLocaleString()} matching leads` : "0 matching leads"}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={offset === 0 || query.isFetching} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</Button><Button size="sm" variant="outline" disabled={offset + PAGE_SIZE >= total || query.isFetching} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</Button></div></div>}
    </div>
    <LeadDrawer id={selectedLeadId} close={() => setSelectedLeadId(null)} />
  </div>;
}
