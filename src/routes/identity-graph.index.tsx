// Identity Graph — 5-mode investigation workspace built on React Flow + dagre.
// Every mode renders real, visible edges via `buildXMode` in components/graph/modes.ts.
// Every action mutates useIdentityStore and is audited & reversible.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight, GitMerge, Split, Trash2, ArrowRightLeft, Flag, XCircle,
  ExternalLink, RotateCcw, Search as SearchIcon, Layers, Star, Fingerprint, Network, User as UserIcon,
  PanelLeft, PanelRight, Eye, Filter, Download, Clock, ChevronRight as ChevRight,
  Undo2, Redo2,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ReactFlowProvider } from "@xyflow/react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PageHeader, Mono } from "@/components/ui-bits";
import { cn } from "@/lib/utils";
import {
  PEOPLE, CONSOLIDATED_PROFILES, INDIVIDUAL_PROFILES, GOLDEN_RECORDS,
  SIGNAL_LINKAGE, HOUSEHOLDS, COMPANIES, PLACES,
  type GoldenRecordPurpose,
} from "@/lib/mockData";
import { GraphCanvas, type GNodeData, type GEdgeData } from "@/components/graph/GraphCanvas";
import {
  buildEntityMode, buildConsolidatedMode, buildGoldenRecordMode,
  buildProfileDetailMode, buildSignalMode, type Mode,
} from "@/components/graph/modes";
import { useIdentityStore } from "@/lib/identityStore";
import {
  MergeDialog, SplitDialog, RemoveLinkDialog, ReassignLinkDialog,
  MarkSharedDialog, MarkIncorrectDialog, ReverseDialog, UnavailableActionCard,
} from "@/components/graph/Dialogs";

type Search = {
  mode?: Mode;
  centerId?: string;
  personId?: string;
  signalId?: string;
  profileId?: string;
  goldenRecordId?: string;
  grPurpose?: GoldenRecordPurpose;
};

export const Route = createFileRoute("/identity-graph/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    mode: s.mode as Mode | undefined,
    centerId: s.centerId as string | undefined,
    personId: s.personId as string | undefined,
    signalId: s.signalId as string | undefined,
    profileId: s.profileId as string | undefined,
    goldenRecordId: s.goldenRecordId as string | undefined,
    grPurpose: s.grPurpose as GoldenRecordPurpose | undefined,
  }),
  head: () => ({
    meta: [
      { title: "Identity Graph · Resolve.io" },
      { name: "description", content: "Progressive investigation across entities, profiles, golden records, and signals." },
    ],
  }),
  component: IdentityGraph,
});

const MODE_LABEL: Record<Mode, string> = {
  entity: "Entity Relationships",
  consolidated: "Consolidated Profile",
  golden_record: "Golden Record",
  profile_detail: "Profile Detail",
  signal: "Signal Linkage",
};

const MODE_ICON: Record<Mode, React.ComponentType<{ className?: string }>> = {
  entity: Network, consolidated: Layers, golden_record: Star, profile_detail: UserIcon, signal: Fingerprint,
};

interface HistoryState { mode: Mode; centerId: string; grPurpose?: GoldenRecordPurpose }

function IdentityGraph() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const initialMode: Mode = search.mode
    ?? (search.signalId ? "signal"
    : search.profileId ? "profile_detail"
    : search.goldenRecordId ? "golden_record"
    : search.personId ? "consolidated" : "entity");
  const initialCenter =
    search.centerId
    ?? search.signalId
    ?? search.profileId
    ?? search.goldenRecordId
    ?? search.personId
    ?? PEOPLE[0].id;

  const [mode, setModeState] = useState<Mode>(initialMode);
  const [centerId, setCenterIdState] = useState<string>(initialCenter);
  const [grPurpose, setGrPurpose] = useState<GoldenRecordPurpose>(search.grPurpose ?? "prepopulation");
  const [history, setHistory] = useState<HistoryState[]>([{ mode: initialMode, centerId: initialCenter, grPurpose: search.grPurpose }]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [showHistorical, setShowHistorical] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(false);

  const [selectedNode, setSelectedNode] = useState<{ id: string; data: GNodeData } | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<{ id: string; data: GEdgeData } | null>(null);

  const [dialogState, setDialogState] = useState<{
    merge?: { a?: string; b?: string };
    split?: { personId?: string };
    remove?: { id?: string; label?: string };
    reassign?: { id?: string; label?: string };
    markShared?: { signalId?: string };
    markIncorrect?: { signalId?: string };
    reverse?: { auditId?: string };
  }>({});

  const relationships = useIdentityStore((s) => s.relationships);
  const signals = useIdentityStore((s) => s.signals);
  const individuals = useIdentityStore((s) => s.individuals);
  const audit = useIdentityStore((s) => s.audit);

  // Build graph for current mode.
  const { nodes, edges } = useMemo(() => {
    if (mode === "entity") return buildEntityMode(centerId, relationships, { showHistorical });
    if (mode === "consolidated") {
      const personId = PEOPLE.some((p) => p.id === centerId)
        ? centerId
        : CONSOLIDATED_PROFILES.find((c) => c.id === centerId)?.personId ?? PEOPLE[0].id;
      return buildConsolidatedMode(personId, { showSources, showHistorical });
    }
    if (mode === "golden_record") {
      const personId = GOLDEN_RECORDS.find((g) => g.id === centerId)?.personId ?? centerId;
      return buildGoldenRecordMode(personId, grPurpose, { showAlternatives });
    }
    if (mode === "profile_detail") {
      const profileId = individuals.find((ip) => ip.id === centerId) ? centerId : individuals[0].id;
      return buildProfileDetailMode(profileId);
    }
    // signal
    const signalId = signals.find((s) => s.id === centerId) ? centerId : signals[0].id;
    return buildSignalMode(signalId, signals);
  }, [mode, centerId, grPurpose, relationships, signals, individuals, showHistorical, showAlternatives, showSources]);

  const pushHistory = useCallback((next: HistoryState) => {
    setHistory((h) => [...h.slice(0, historyIdx + 1), next]);
    setHistoryIdx((i) => i + 1);
  }, [historyIdx]);

  const goto = useCallback((next: HistoryState, addHistory = true) => {
    setModeState(next.mode);
    setCenterIdState(next.centerId);
    if (next.grPurpose) setGrPurpose(next.grPurpose);
    setSelectedNode(null); setSelectedEdge(null);
    if (addHistory) pushHistory(next);
    navigate({ search: { mode: next.mode, centerId: next.centerId, grPurpose: next.grPurpose } });
  }, [navigate, pushHistory]);

  const back = () => {
    if (historyIdx <= 0) return;
    const next = history[historyIdx - 1];
    setHistoryIdx(historyIdx - 1);
    setModeState(next.mode); setCenterIdState(next.centerId);
    if (next.grPurpose) setGrPurpose(next.grPurpose);
  };
  const forward = () => {
    if (historyIdx >= history.length - 1) return;
    const next = history[historyIdx + 1];
    setHistoryIdx(historyIdx + 1);
    setModeState(next.mode); setCenterIdState(next.centerId);
    if (next.grPurpose) setGrPurpose(next.grPurpose);
  };

  const centerOnNode = (id: string, data: GNodeData) => {
    // Double-click auto-drills: no confirmation, no extra step.
    if (data.kind === "signal") { toast.success(`Centered on signal · ${data.label}`); return goto({ mode: "signal", centerId: id }); }
    if (data.kind === "individual") { toast.success(`Centered on profile · ${data.label}`); return goto({ mode: "profile_detail", centerId: id }); }
    if (data.kind === "golden_record") { toast.success(`Centered on golden record · ${data.label}`); return goto({ mode: "golden_record", centerId: id, grPurpose }); }
    if (data.kind === "consolidated") {
      const personId = CONSOLIDATED_PROFILES.find((c) => c.id === id)?.personId;
      if (personId) { toast.success(`Centered on ${data.label}`); return goto({ mode: "consolidated", centerId: personId }); }
    }
    if (data.kind === "person") { toast.success(`Centered on ${data.label}`); return goto({ mode: "consolidated", centerId: id }); }
    if (["household", "company", "place", "legal_case"].includes(data.kind)) {
      toast.success(`Centered on ${data.label}`);
      return goto({ mode: "entity", centerId: id });
    }
    if (data.kind === "source") {
      // Source profiles don't have a dedicated mode — drill into the person it maps to via profile detail.
      const ip = INDIVIDUAL_PROFILES.find((p) => p.id === id);
      if (ip) { toast.success(`Centered on ${data.label}`); return goto({ mode: "profile_detail", centerId: id }); }
      toast.info("Source profile — no dedicated view. Use Signal Linkage to explore.");
      return;
    }
    toast.info(`${data.label} — no drill-in available for this node type.`);
  };

  // Search
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    return {
      persons: PEOPLE.filter((p) => p.name.toLowerCase().includes(q) || p.id.includes(q)).slice(0, 5),
      profiles: individuals.filter((ip) => ip.label.toLowerCase().includes(q) || ip.id.includes(q)).slice(0, 5),
      signals: signals.filter((s) => s.value.toLowerCase().includes(q) || s.id.includes(q)).slice(0, 5),
      companies: COMPANIES.filter((c) => c.label.toLowerCase().includes(q)).slice(0, 3),
      households: HOUSEHOLDS.filter((h) => h.label.toLowerCase().includes(q)).slice(0, 3),
      places: PLACES.filter((p) => p.label.toLowerCase().includes(q)).slice(0, 3),
    };
  }, [query, individuals, signals]);

  const centerNode = nodes.find((n) => (n.data as GNodeData).center) || nodes[0];
  const trailLabel = centerNode ? (centerNode.data as GNodeData).label : "—";

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Identity Graph"
        subtitle="Progressive investigation across entities, consolidated profiles, golden records, individual profiles, and identity signals."
        actions={
          <div className="flex items-center gap-1.5">
            <Link to="/identity-console" className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent">
              Identity Console
            </Link>
            <Link to="/identity-console/tests" className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent">
              Interaction tests
            </Link>
          </div>
        }
      />

      {/* Mode tabs — underlined, matches page-level sub-nav */}
      <div className="flex flex-wrap items-center gap-1 border-t border-b border-border bg-card px-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          {(["entity", "consolidated", "golden_record", "profile_detail", "signal"] as Mode[]).map((m) => {
            const on = m === mode;
            return (
              <button
                key={m}
                onClick={() => goto({ mode: m, centerId, grPurpose })}
                className={cn(
                  "relative px-3 py-2.5 text-[13px] font-medium transition-colors",
                  on ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {MODE_LABEL[m]}
                {on && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-1 py-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <button className="grid h-7 w-7 place-items-center rounded-md border border-border bg-card text-muted-foreground hover:bg-accent" title="View options">
                <Eye className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2 space-y-1">
              <ToggleRow label="Show historical edges" on={showHistorical} onChange={setShowHistorical} />
              {mode === "golden_record" && <ToggleRow label="Show alternatives" on={showAlternatives} onChange={setShowAlternatives} />}
              {mode === "consolidated" && <ToggleRow label="Show source profiles" on={showSources} onChange={setShowSources} />}
              <ToggleRow label="Mini-map" on={showMiniMap} onChange={setShowMiniMap} />
            </PopoverContent>
          </Popover>
          <button className="ml-1 flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[12px] text-foreground hover:bg-accent" title="Filters">
            <Filter className="h-3.5 w-3.5" /> Filters
          </button>
        </div>
      </div>

      {/* Timeline + search/download row */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2">
        <button className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] text-foreground hover:bg-accent">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Timeline: current
        </button>

        {mode === "golden_record" && (
          <select value={grPurpose} onChange={(e) => setGrPurpose(e.target.value as GoldenRecordPurpose)} className="rounded-md border border-border bg-card px-2 py-1 text-[11px]">
            {(["prepopulation", "reactivation", "personal", "work", "customer_support", "full_investigation"] as GoldenRecordPurpose[]).map((p) => (
              <option key={p} value={p}>{p.replace(/_/g, " ")}</option>
            ))}
          </select>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <Sheet>
            <SheetTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] text-foreground hover:bg-accent" title="Search & recent">
                <SearchIcon className="h-3.5 w-3.5" /> Search
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[340px] overflow-y-auto p-3">
              <LeftRailBody
                query={query} setQuery={setQuery} results={results} audit={audit}
                goto={goto} setDialogState={setDialogState}
              />
            </SheetContent>
          </Sheet>
          <button
            onClick={() => {
              const rows = [["id", "label", "kind"], ...nodes.map((n) => [n.id, (n.data as GNodeData).label, (n.data as GNodeData).kind])];
              const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = `identity-graph-${mode}.csv`; a.click();
              URL.revokeObjectURL(url);
            }}
            className="grid h-7 w-7 place-items-center rounded-md border border-border bg-card text-muted-foreground hover:bg-accent"
            title="Export nodes as CSV"
          ><Download className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Trail breadcrumb + doc-style back/forward */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-1.5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-0.5 pr-2 mr-1 border-r border-border">
          <button
            onClick={back}
            disabled={historyIdx <= 0}
            title="Back (previous view)"
            className="grid h-7 w-7 place-items-center rounded-md text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:text-muted-foreground/40 disabled:hover:bg-transparent"
          ><Undo2 className="h-4 w-4" /></button>
          <button
            onClick={forward}
            disabled={historyIdx >= history.length - 1}
            title="Forward (next view)"
            className="grid h-7 w-7 place-items-center rounded-md text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:text-muted-foreground/40 disabled:hover:bg-transparent"
          ><Redo2 className="h-4 w-4" /></button>
        </div>
        <span className="font-medium text-foreground">Trail:</span>
        <button
          onClick={() => { setHistoryIdx(0); const h = history[0]; setModeState(h.mode); setCenterIdState(h.centerId); if (h.grPurpose) setGrPurpose(h.grPurpose); }}
          className="rounded px-1 text-primary hover:bg-accent"
        >root</button>
        <ChevRight className="h-3 w-3" />
        <span>{MODE_LABEL[mode]}</span>
        <ChevRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{trailLabel}</span>
        <span className="ml-auto text-[10px] text-muted-foreground/70">Tip: double-click any node to center &amp; drill in</span>
      </div>

      {/* Body: canvas + inspector */}
      <div className="relative flex flex-1 min-h-0 bg-muted/20">
        <section className="relative flex min-h-[540px] min-w-0 flex-1 flex-col">
          <div className="relative flex-1 min-h-0">
            <ReactFlowProvider>
              <GraphCanvas
                nodes={nodes} edges={edges}
                selectedId={selectedNode?.id}
                showMiniMap={showMiniMap}
                onSelectNode={(id, data) => { setSelectedNode({ id, data }); setSelectedEdge(null); }}
                onSelectEdge={(id, data) => { setSelectedEdge({ id, data }); setSelectedNode(null); }}
                onCenterNode={centerOnNode}
              />
            </ReactFlowProvider>
          </div>
          <div className="border-t border-border bg-card px-3 py-1.5 text-[10px] text-muted-foreground">
            {nodes.length} nodes · {edges.length} edges · mode: {MODE_LABEL[mode]}
            {edges.length === 0 && <span className="ml-2 text-warning">No relationships found for this center — try a different node.</span>}
          </div>

          {/* Inspector trigger under xl */}
          <div className="absolute right-2 top-2 xl:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <button className="grid h-8 w-8 place-items-center rounded-md border border-border bg-card text-muted-foreground shadow-sm hover:bg-accent" title="Inspector">
                  <PanelRight className="h-4 w-4" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[380px] overflow-y-auto p-3">
                <Inspector
                  mode={mode}
                  selectedNode={selectedNode}
                  selectedEdge={selectedEdge}
                  onMakeCenter={(id, data) => centerOnNode(id, data)}
                  onOpenDialog={(next) => setDialogState(next)}
                />
              </SheetContent>
            </Sheet>
          </div>
        </section>

        {/* Inspector — inline on xl */}
        <div className="hidden xl:block w-[380px] shrink-0 border-l border-border bg-card">
          <div className="h-full overflow-y-auto p-3">
            <Inspector
              mode={mode}
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              onMakeCenter={(id, data) => centerOnNode(id, data)}
              onOpenDialog={(next) => setDialogState(next)}
            />
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <MergeDialog open={Boolean(dialogState.merge)} onOpenChange={(v) => !v && setDialogState({})} aPersonId={dialogState.merge?.a} bPersonId={dialogState.merge?.b} />
      <SplitDialog open={Boolean(dialogState.split)} onOpenChange={(v) => !v && setDialogState({})} personId={dialogState.split?.personId} />
      <RemoveLinkDialog open={Boolean(dialogState.remove)} onOpenChange={(v) => !v && setDialogState({})} relationshipId={dialogState.remove?.id} label={dialogState.remove?.label} />
      <ReassignLinkDialog open={Boolean(dialogState.reassign)} onOpenChange={(v) => !v && setDialogState({})} relationshipId={dialogState.reassign?.id} label={dialogState.reassign?.label} />
      <MarkSharedDialog open={Boolean(dialogState.markShared)} onOpenChange={(v) => !v && setDialogState({})} signalId={dialogState.markShared?.signalId} />
      <MarkIncorrectDialog open={Boolean(dialogState.markIncorrect)} onOpenChange={(v) => !v && setDialogState({})} signalId={dialogState.markIncorrect?.signalId} />
      <ReverseDialog open={Boolean(dialogState.reverse)} onOpenChange={(v) => !v && setDialogState({})} entry={audit.find((a) => a.id === dialogState.reverse?.auditId)} />

      <Toaster />
    </div>
  );
}

// ---------------- Shared toggle row ------------------------------------------

function ToggleRow({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-accent"
    >
      <span>{label}</span>
      <span className={cn("h-4 w-7 rounded-full transition-colors", on ? "bg-primary" : "bg-muted")}>
        <span className={cn("block h-4 w-4 rounded-full bg-background shadow transition-transform", on && "translate-x-3")} />
      </span>
    </button>
  );
}

// ---------------- Result group in search --------------------------------------

function ResultGroup({ title, items }: { title: string; items: { id: string; label: string; sub?: string; onSelect: () => void }[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <ul className="space-y-0.5">
        {items.map((it) => (
          <li key={it.id}>
            <button onClick={it.onSelect} className="w-full rounded px-2 py-1 text-left text-xs hover:bg-accent">
              <div className="truncate font-medium">{it.label}</div>
              {it.sub && <div className="truncate text-[10px] text-muted-foreground">{it.sub}</div>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------- LeftRailBody --------------------------------------------

type LeftRailProps = {
  query: string;
  setQuery: (v: string) => void;
  results: {
    persons: typeof PEOPLE;
    profiles: ReturnType<typeof useIdentityStore.getState>["individuals"];
    signals: ReturnType<typeof useIdentityStore.getState>["signals"];
    companies: typeof COMPANIES;
    households: typeof HOUSEHOLDS;
    places: typeof PLACES;
  } | null;
  audit: ReturnType<typeof useIdentityStore.getState>["audit"];
  goto: (n: HistoryState) => void;
  setDialogState: (s: { reverse?: { auditId?: string } }) => void;
};

function LeftRailBody({ query, setQuery, results, audit, goto, setDialogState }: LeftRailProps) {
  return (
    <>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search person / signal / profile…"
          className="w-full rounded-md border border-border bg-background pl-7 pr-2 py-1.5 text-xs outline-none focus:border-primary"
        />
      </div>
      {results ? (
        <div className="space-y-2 text-xs">
          <ResultGroup title="People" items={results.persons.map((p) => ({ id: p.id, label: p.name, sub: p.id, onSelect: () => goto({ mode: "consolidated", centerId: p.id }) }))} />
          <ResultGroup title="Profiles" items={results.profiles.map((p) => ({ id: p.id, label: p.label, sub: p.type, onSelect: () => goto({ mode: "profile_detail", centerId: p.id }) }))} />
          <ResultGroup title="Signals" items={results.signals.map((s) => ({ id: s.id, label: s.value, sub: `${s.kind} · ${s.sharingClass}`, onSelect: () => goto({ mode: "signal", centerId: s.id }) }))} />
          <ResultGroup title="Companies" items={results.companies.map((c) => ({ id: c.id, label: c.label, sub: c.sub, onSelect: () => goto({ mode: "entity", centerId: c.id }) }))} />
          <ResultGroup title="Households" items={results.households.map((h) => ({ id: h.id, label: h.label, sub: h.sub, onSelect: () => goto({ mode: "entity", centerId: h.id }) }))} />
          <ResultGroup title="Places" items={results.places.map((p) => ({ id: p.id, label: p.label, sub: p.sub, onSelect: () => goto({ mode: "entity", centerId: p.id }) }))} />
        </div>
      ) : (
        <>
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recent people</div>
            <ul className="space-y-0.5">
              {PEOPLE.slice(0, 8).map((p) => (
                <li key={p.id}>
                  <button onClick={() => goto({ mode: "consolidated", centerId: p.id })} className="w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-accent">
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Audit log ({audit.length})</div>
            <ul className="space-y-1">
              {audit.slice(0, 8).map((a) => (
                <li key={a.id} className="rounded border border-border p-1.5 text-[10px]">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium truncate">{a.summary}</span>
                    {a.reversible && !a.reversedBy && (
                      <button
                        onClick={() => setDialogState({ reverse: { auditId: a.id } })}
                        className="shrink-0 rounded px-1 text-primary hover:bg-primary/10"
                        title="Reverse this action"
                      ><RotateCcw className="h-3 w-3" /></button>
                    )}
                  </div>
                  <div className="text-muted-foreground">{new Date(a.ts).toLocaleTimeString()}</div>
                  {a.reversedBy && <div className="text-warning">reversed</div>}
                </li>
              ))}
              {audit.length === 0 && <li className="text-[10px] text-muted-foreground">No actions yet — mutations will appear here.</li>}
            </ul>
          </div>
        </>
      )}
    </>
  );
}



// ---------------- Inspector -------------------------------------------------

function Inspector({
  mode, selectedNode, selectedEdge, onMakeCenter, onOpenDialog,
}: {
  mode: Mode;
  selectedNode: { id: string; data: GNodeData } | null;
  selectedEdge: { id: string; data: GEdgeData } | null;
  onMakeCenter: (id: string, data: GNodeData) => void;
  onOpenDialog: (s: { merge?: { a?: string; b?: string }; split?: { personId?: string }; remove?: { id?: string; label?: string }; reassign?: { id?: string; label?: string }; markShared?: { signalId?: string }; markIncorrect?: { signalId?: string } }) => void;
}) {
  const navigate = useNavigate();
  const relationships = useIdentityStore((s) => s.relationships);
  const signals = useIdentityStore((s) => s.signals);
  const individuals = useIdentityStore((s) => s.individuals);

  if (selectedEdge) {
    const rel = relationships.find((r) => r.id === selectedEdge.id);
    return (
      <aside className="flex min-h-0 flex-col overflow-y-auto rounded-lg border border-border bg-card p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Relationship</div>
        <div className="mt-1 text-sm font-semibold">{selectedEdge.data.label}</div>
        {rel && (
          <div className="mt-2 space-y-1 text-xs">
            <Row k="From" v={<Mono>{rel.from}</Mono>} />
            <Row k="To" v={<Mono>{rel.to}</Mono>} />
            <Row k="Type" v={rel.type} />
            <Row k="Confidence" v={`${rel.confidence}%`} />
            <Row k="Status" v={rel.status} />
            <Row k="First observed" v={new Date(rel.firstObserved).toLocaleDateString()} />
            <Row k="Last observed" v={new Date(rel.lastObserved).toLocaleDateString()} />
            {rel.decisionId && <Row k="Decision" v={<Mono>{rel.decisionId}</Mono>} />}
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <ActionBtn onClick={() => onOpenDialog({ remove: { id: selectedEdge.id, label: selectedEdge.data.label } })}><Trash2 className="h-3 w-3" />Remove link</ActionBtn>
          <ActionBtn onClick={() => onOpenDialog({ reassign: { id: selectedEdge.id, label: selectedEdge.data.label } })}><ArrowRightLeft className="h-3 w-3" />Reassign</ActionBtn>
        </div>
      </aside>
    );
  }

  if (!selectedNode) {
    return (
      <aside className="flex min-h-0 flex-col overflow-y-auto rounded-lg border border-border bg-card p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Inspector</div>
        <div className="mt-4 text-xs text-muted-foreground">
          Click a node or edge to inspect. Double-click a node to make it the center and drill in.
        </div>
        <div className="mt-4 rounded-md border border-border bg-muted/30 p-2 text-[11px]">
          <div className="mb-1 font-semibold">Modes</div>
          <ul className="space-y-1 text-muted-foreground">
            <li><b>Entity Relationships</b> — real-world entities only.</li>
            <li><b>Consolidated Profile</b> — Person → profiles.</li>
            <li><b>Golden Record</b> — field provenance per purpose.</li>
            <li><b>Profile Detail</b> — attributes of one Individual Profile.</li>
            <li><b>Signal Linkage</b> — everything connected to a signal.</li>
          </ul>
        </div>
      </aside>
    );
  }

  const d = selectedNode.data;
  const nodeId = selectedNode.id;

  // Adaptive actions per node kind.
  const isPerson = d.kind === "person";
  const isSignal = d.kind === "signal";
  const isIndividual = d.kind === "individual";
  const isGrField = d.kind === "gr_field";
  const isConsolidated = d.kind === "consolidated";

  const sig = isSignal ? signals.find((s) => s.id === nodeId) : undefined;
  const ip = isIndividual ? individuals.find((x) => x.id === nodeId) : undefined;

  const possibleMerge = isPerson
    ? relationships.find((r) => r.type === "possible_duplicate" && (r.from === nodeId || r.to === nodeId))
    : undefined;

  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{d.kind.replace(/_/g, " ")}</div>
          <div className="mt-0.5 truncate text-sm font-semibold">{d.label}</div>
          {d.sub && <div className="truncate text-[11px] text-muted-foreground">{d.sub}</div>}
        </div>
      </div>

      <div className="mt-3 space-y-1 text-xs">
        <Row k="ID" v={<Mono>{nodeId}</Mono>} />
        {typeof d.score === "number" && <Row k="Score" v={`${d.score}`} />}
        {d.hygiene && <Row k="Hygiene" v={d.hygiene} />}
        {d.status && <Row k="Status" v={d.status} />}
        {d.warning && <Row k="Warning" v={<span className="text-warning">has conflict</span>} />}
      </div>

      <div className="mt-3 space-y-1.5">
        <ActionBtn onClick={() => onMakeCenter(nodeId, d)}>Make center / Drill in</ActionBtn>
        {isPerson && (
          <>
            <ActionBtn onClick={() => navigate({ to: "/people", search: { personId: nodeId } as never })}>
              <ExternalLink className="h-3 w-3" /> Open in People Explorer
            </ActionBtn>
            <ActionBtn onClick={() => navigate({ to: "/identity-console", search: { personId: nodeId } as never })}>
              <ExternalLink className="h-3 w-3" /> Open in Identity Console
            </ActionBtn>
            <ActionBtn
              onClick={() => onOpenDialog({ merge: { a: nodeId, b: possibleMerge ? (possibleMerge.from === nodeId ? possibleMerge.to : possibleMerge.from) : undefined } })}
              disabled={!possibleMerge}
              disabledReason="No possible-duplicate found for this person"
            ><GitMerge className="h-3 w-3" /> Merge with possible duplicate</ActionBtn>
            <ActionBtn onClick={() => onOpenDialog({ split: { personId: nodeId } })}>
              <Split className="h-3 w-3" /> Split off profile(s)
            </ActionBtn>
          </>
        )}
        {isSignal && sig && (
          <>
            <ActionBtn onClick={() => onOpenDialog({ markShared: { signalId: nodeId } })}>
              <Flag className="h-3 w-3" /> Mark shared / classify
            </ActionBtn>
            <ActionBtn onClick={() => onOpenDialog({ markIncorrect: { signalId: nodeId } })}>
              <XCircle className="h-3 w-3" /> Mark incorrect
            </ActionBtn>
          </>
        )}
        {isIndividual && ip && (
          <ActionBtn onClick={() => navigate({ to: "/identity-console", search: { profileId: nodeId } as never })}>
            <ExternalLink className="h-3 w-3" /> Open profile in Console
          </ActionBtn>
        )}
        {isGrField && (
          <UnavailableActionCard
            title="Field cannot be reversed independently"
            reason="This field was selected by the Golden Record rendering rule. Choose an alternative action:"
            actions={[
              { label: "Show alternatives", onClick: () => toast("Enable 'Alternatives' toggle above to see rejected values") },
              { label: "Re-render Golden Record", onClick: () => toast.success("Golden Record re-rendered") },
              { label: "Exclude from Golden Record", onClick: () => toast.success("Field excluded from this Golden Record purpose") },
            ]}
          />
        )}
        {isConsolidated && (
          <ActionBtn onClick={() => onMakeCenter(nodeId, d)}>Drill into consolidated profile</ActionBtn>
        )}
      </div>

      {isSignal && sig && (
        <div className="mt-3 rounded-md border border-border p-2 text-[11px]">
          <div className="mb-1 font-semibold">Linked</div>
          <div className="text-muted-foreground">
            {sig.connectedPersonIds.length} person(s) · {sig.connectedProfileIds.length} profile(s) · {sig.connectedHouseholdIds.length} household(s) · {sig.connectedCompanyIds.length} company(ies)
          </div>
          <div className="mt-1 text-muted-foreground">Sharing class: <span className="font-medium text-foreground">{sig.sharingClass}</span></div>
        </div>
      )}

      <div className="mt-3 text-[10px] text-muted-foreground">
        Mode: {MODE_LABEL[mode]}
      </div>
    </aside>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/50 py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

function ActionBtn({ children, onClick, disabled, disabledReason }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; disabledReason?: string }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className={cn(
        "flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 text-xs hover:bg-accent",
        disabled && "cursor-not-allowed opacity-50 hover:bg-card",
      )}
    >{children}</button>
  );
}
