import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Compass, Activity, ShieldCheck, MousePointerClick, Search, Copy, User, ChevronDown, RefreshCw, Calendar } from "lucide-react";
import {
  computeKpis,
  parseEntryUrlParams,
  formatDuration,
  timeAgo,
  parseSessions,
  utmSources,
  type Session,
} from "@/lib/sessionData";

import { fetchSessionPage, fetchSessionDetail } from "@/lib/sessionApi";
import { applySessionDetail, type SessionDetail } from "@/lib/sessionDetail";
import { JOURNEY_API_FLAGS, type JourneyFilter } from "@/lib/sessionRange";

type SessionCounts = {
  quizStart: { total: number | null; honored: boolean };
  partial: { total: number | null; honored: boolean };
  consent: { total: number | null; honored: boolean };
  rangeTotal: number | null;
};

const JOURNEY_LABELS: Record<JourneyFilter, string> = {
  visit: "Visit",
  quiz_start: "Quiz Start",
  partial_lead: "Partial Lead",
  lead: "Lead",
  otp_verified: "OTP Verified",
  qualified_connected: "Qualified / Connected",
  meeting: "Meeting",
  listing: "Listing",
  revenue: "Revenue > 0",
  consent_given: "Consent Given",
};
import { sessionDate } from "@/lib/sessionRange";
import { Button } from "@/components/ui/button";


import {
  PageHeader,
  Mono,
  SourcePill,
  FunnelBar,
  FUNNEL_STAGES,
  funnelReachedIndex,
  fraudScore,
  FraudBadge,
} from "@/components/ui-bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sessions")({
  head: () => ({
    meta: [
      { title: "Session Explorer · Resolve.io" },
      { name: "description", content: "Inspect every session with its full event timeline." },
      { property: "og:title", content: "Session Explorer · Alyson CDP" },
      { property: "og:description", content: "Inspect session identity, attribution, and event timelines." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Sessions,
});

type DatePreset = "24h" | "7d" | "30d" | "custom";

// Custom range uses plain date pickers (YYYY-MM-DD). A datetime-local input stays
// empty until a time is also chosen, which left Apply disabled after picking a date.
const parseLocalDateTime = sessionDate;

function rangeForPreset(preset: DatePreset, customFrom = "", customTo = "") {
  const anchor = new Date();
  const toIso = new Date(anchor.getTime() + 60_000).toISOString();
  const fromIso = (days: number) => new Date(anchor.getTime() - days * 86400_000).toISOString();
  if (preset === "24h") return { from: fromIso(1), to: toIso };
  if (preset === "7d") return { from: fromIso(7), to: toIso };
  if (preset === "30d") return { from: fromIso(30), to: toIso };
  const from = parseLocalDateTime(customFrom);
  const to = parseLocalDateTime(customTo, true);
  if (!from || !to || from >= to) return { from: fromIso(1), to: toIso };
  return { from: from.toISOString(), to: to.toISOString() };
}

// UCT-attributed revenue sessions have no intermediate funnel telemetry for
// Qualified/Connected (5), Meeting (6), Listing (7) — render those as unknown
// rather than implicitly "passed" just because Revenue (8) fired.
const UCT_UNKNOWN_STAGES: ReadonlySet<number> = new Set([5, 6, 7]);
function unknownStagesFor(s: Session): ReadonlySet<number> | undefined {
  const src = (s.raw?.expected_revenue_source ?? "").toLowerCase();
  if (src === "uct_revenue" && s.has_revenue) return UCT_UNKNOWN_STAGES;
  return undefined;
}

// Show a stage as "on" only when the corresponding Athena flag is true.
// No cumulative fill-in — stages without a truthy flag stay off, even if a
// later stage fired.
function onStagesFor(s: Session): ReadonlySet<number> {
  const on = new Set<number>();
  if (s.has_visit) on.add(0);
  if (s.has_quiz_start) on.add(1);
  if (s.has_partial_quiz_submit) on.add(2);
  if (s.has_lead) on.add(3);
  if (s.has_otp_verified) on.add(4);
  if (s.has_qualified_connected) on.add(5);
  if (s.has_meeting) on.add(6);
  if (s.has_listing) on.add(7);
  if (s.has_revenue) on.add(8);
  return on;
}

function Sessions() {
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "inherited" | "synthetic" | "native">("all");
  const [utmFilter, setUtmFilter] = useState<string>("all");
  const [flagFilter, setFlagFilter] = useState<"all" | JourneyFilter>("all");

  const [preset, setPreset] = useState<DatePreset>("24h");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>("");

  // Live Athena state — real rows only, no mock fallback.
  // is linked (or if a query fails), so the explorer always renders.
  const [athena, setAthena] = useState<{
    connected: boolean;
    rows: Session[];
    total: number | null;
    error: string | null;
    loading: boolean;
    latestSessionAt: string | null;
    journeyHonored: boolean;
    counts: SessionCounts | null;
  }>({ connected: false, rows: [], total: null, error: null, loading: false, latestSessionAt: null, journeyHonored: true, counts: null });
  const [requestedRange, setRequestedRange] = useState<{ from: string; to: string; journey: JourneyFilter | null }>(() => ({
    ...rangeForPreset("24h"),
    journey: null,
  }));
  const appliedJourney = requestedRange.journey;
  const draftJourney = flagFilter === "all" ? null : flagFilter;

  const live = athena.connected && !athena.error;

  const statusQuery = {
    isSuccess: true,
    data: {
      last_synced_at: lastSyncedAt as string | null,
      last_status: (athena.error ? "error" : "success") as string | null,
      last_rows: athena.rows.length as number | null,
      last_error: athena.error,
      total_cached: athena.total,
      latest_session_at: (athena.latestSessionAt ?? null) as string | null,
    },
  };

  const range = useMemo(() => rangeForPreset(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const loadRange = (nextPreset: DatePreset, from = customFrom, to = customTo, journey = draftJourney) => {
    setRequestedRange({ ...rangeForPreset(nextPreset, from, to), journey });
  };

  const draftFromDate = parseLocalDateTime(draftFrom);
  const draftToDate = parseLocalDateTime(draftTo, true);
  const customError =
    draftFrom && !draftFromDate
      ? "Enter a valid start."
      : draftTo && !draftToDate
        ? "Enter a valid end."
        : draftFromDate && draftToDate && draftFromDate >= draftToDate
          ? "End date must be on or after start date."
          : "";
  const customValid = Boolean(draftFromDate && draftToDate && !customError);

  // Fetch exactly one API page. Never replace the API total with sample/page counts.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setAthena((s) => ({ ...s, rows: [], total: null, error: null, loading: true, counts: null }));
    fetchSessionPage(requestedRange.from, requestedRange.to, requestedRange.journey, controller.signal)
      .then((res) => {
        if (cancelled) return;
        setAthena({
          connected: true,
          rows: parseSessions(res.rows),
          total: res.total,
          error: null,
          loading: false,
          latestSessionAt: res.rows[0]?.session_start ?? null,
          journeyHonored: res.journeyHonored,
          counts: res.counts,
        });
        setLastSyncedAt(new Date().toISOString());
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAthena({
          connected: false,
          rows: [],
          total: null,
          error: error instanceof Error ? error.message : "Failed to load sessions.",
          loading: false,
          latestSessionAt: null,
          journeyHonored: true,
          counts: null,
        });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [requestedRange]);


  // Real API rows only — no demo/mock fallback. If the API ignored the journey
  // parameter, its rows are not the requested sessions, so none are shown.
  const journeyIgnored = Boolean(appliedJourney) && !athena.journeyHonored;
  const rows = journeyIgnored ? [] : athena.rows;
  const matchingTotal = journeyIgnored ? null : athena.total;

  const sessionsQuery = {
    data: rows,
    isLoading: athena.loading && rows.length === 0,
    isFetching: athena.loading,
    isError: Boolean(athena.error),
    error: athena.error ? new Error(athena.error) : null,
  };

  const syncMutation = {
    isPending: athena.loading,
    isError: Boolean(athena.error),
    error: athena.error ? new Error(athena.error) : null,
    mutate: () => {
      if (athena.loading) return;
      setRequestedRange({ ...range, journey: draftJourney });
    },
  };



  const sessions = sessionsQuery.data ?? [];
  const kpis = useMemo(() => computeKpis(sessions), [sessions]);
  const UTM_SOURCES = useMemo(() => utmSources(sessions), [sessions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s: Session) => {
      if (sourceFilter !== "all" && s.session_id_source !== sourceFilter) return false;
      if (utmFilter !== "all" && s.entry_utm_source !== utmFilter) return false;
      if (q) {
        const url = s.entry_page_url.toLowerCase();
        if (
          !s.session_id.toLowerCase().includes(q) &&
          !s.anonymous_id.toLowerCase().includes(q) &&
          !url.includes(q)
        )
          return false;
      }
      return true;
    });
  }, [sessions, query, sourceFilter, utmFilter]);

  const [selectedId, setSelectedId] = useState<string>("");
  const [detailRequest, setDetailRequest] = useState<{ sessionId: string } | null>(null);
  const [detailState, setDetailState] = useState<{ sessionId: string; data: SessionDetail | null; loading: boolean; error: string | null }>({ sessionId: "", data: null, loading: false, error: null });
  // A session looked up by its full ID may not be in the loaded page; use the detail response's own summary.
  const lookedUp = !filtered.some((s) => s.session_id === selectedId) && detailState.sessionId === selectedId && detailState.data?.session ? detailState.data.session : null;
  const selectedRow = filtered.find((s) => s.session_id === selectedId) ?? lookedUp ?? filtered[0];
  const detailForRow = selectedRow?.session_id === detailState.sessionId ? detailState : null;
  const selected = selectedRow && detailForRow?.data ? applySessionDetail(selectedRow, detailForRow.data) : selectedRow;
  const lookupId = query.trim();
  const canLookup = lookupId.length >= 20 && !/\s/.test(lookupId) && !filtered.some((s) => s.session_id === lookupId);
  const lookupLoading = detailState.loading && detailState.sessionId === lookupId && !lookedUp;
  const openSession = (id: string) => { setSelectedId(id); setDetailState({ sessionId: id, data: null, loading: true, error: null }); setDetailRequest({ sessionId: id }); };
  const detailLoading = Boolean(detailForRow?.loading);
  const detailReady = Boolean(detailForRow?.data);
  useEffect(() => {
    if (!detailRequest) return;
    const controller = new AbortController();
    let cancelled = false;
    setDetailState({ sessionId: detailRequest.sessionId, data: null, loading: true, error: null });
    fetchSessionDetail(detailRequest.sessionId, controller.signal).then((data) => {
      if (!cancelled) setDetailState({ sessionId: detailRequest.sessionId, data, loading: false, error: null });
    }).catch((error: unknown) => {
      if (!cancelled) setDetailState({ sessionId: detailRequest.sessionId, data: null, loading: false, error: error instanceof Error ? error.message : "Session details could not be loaded." });
    });
    return () => { cancelled = true; controller.abort(); };
  }, [detailRequest]);
  const [funnelExpanded, setFunnelExpanded] = useState(false);

  const urlParams = useMemo(() => (selected ? parseEntryUrlParams(selected.entry_page_url) : {}), [selected]);


  // Journey KPIs use API totals for the whole range, not the 200 downloaded rows.
  const apiCount = (c?: { total: number | null; honored: boolean }) => (c && c.honored && c.total != null ? c.total : null);
  const quizStartTotal = apiCount(athena.counts?.quizStart);
  const partialTotal = apiCount(athena.counts?.partial);
  const consentTotal = apiCount(athena.counts?.consent);
  const rangeTotal = athena.counts?.rangeTotal ?? null;
  const fmt = (n: number | null) => (n == null ? "—" : n.toLocaleString());
  const partialRate = quizStartTotal && partialTotal != null ? `${((partialTotal / quizStartTotal) * 100).toFixed(0)}% Submit` : athena.counts ? "Not filterable by the API yet" : undefined;
  const consentRate = rangeTotal && consentTotal != null ? `${((consentTotal / rangeTotal) * 100).toFixed(0)}% Of Sessions` : athena.counts ? "Not filterable by the API yet" : undefined;
  const journeyLabel = (j: JourneyFilter | null) => (j ? JOURNEY_LABELS[j] : "Any Journey");
  const syncBusy = syncMutation.isPending || sessionsQuery.isFetching;
  const showSkeleton = syncBusy && sessions.length === 0;

  return (
    <div className="pb-10">
      <PageHeader
        title="Session Explorer"
        subtitle="Per-session identity, entry attribution, and journey flags."
      />

      {/* Date range + sync bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2 px-6">
        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
          <Calendar className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
          {(
            [
              { key: "24h", label: "Last 24h" },
              { key: "7d", label: "7 days" },
              { key: "30d", label: "30 days" },
              { key: "custom", label: "Custom" },
            ] as const
          ).map((p) => (
            <button
              key={p.key}
              onClick={() => {
                if (p.key === preset) return;
                setPreset(p.key);
                if (p.key !== "custom") loadRange(p.key);
              }}
              className={cn(
                "rounded px-2 py-1 text-[11px] uppercase tracking-wider",
                preset === p.key ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <input
              type="date"
              aria-label="Custom start"
              value={draftFrom}
              max={draftTo || undefined}
              onChange={(e) => setDraftFrom(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2 text-xs"
            />
            <span className="text-muted-foreground">→</span>
            <input
              type="date"
              aria-label="Custom end"
              value={draftTo}
              min={draftFrom || undefined}
              onChange={(e) => setDraftTo(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2 text-xs"
            />
            <button
              type="button"
              disabled={!customValid}
              onClick={() => {
                setCustomFrom(draftFrom);
                setCustomTo(draftTo);
                loadRange("custom", draftFrom, draftTo);
              }}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply
            </button>
            {customError && <span className="text-[11px] text-destructive">{customError}</span>}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">



          {statusQuery.data?.last_synced_at ? (
            <span title={new Date(statusQuery.data.last_synced_at).toISOString()}>
              Last synced {timeAgo(statusQuery.data.last_synced_at)}
              {typeof statusQuery.data.last_rows === "number" ? ` · ${statusQuery.data.last_rows} rows` : ""}
            </span>
          ) : (
            <span>Never synced</span>
          )}
          {statusQuery.data?.last_status === "error" && (
            <span
              title={statusQuery.data.last_error ?? ""}
              className="rounded border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-destructive"
            >
              last sync failed
            </span>
          )}
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncBusy}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground hover:bg-accent",
              syncBusy && "opacity-60",
            )}
          >
            <RefreshCw className={cn("h-3 w-3", syncBusy && "animate-spin")} />
            {syncMutation.isPending ? "Syncing…" : "Refresh"}
          </button>
        </div>
      </div>

      {sessionsQuery.isError && (
        <div className="mx-6 mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Failed to load sessions: {(sessionsQuery.error as Error)?.message ?? "unknown error"}
        </div>
      )}
      {syncMutation.isError && (
        <div className="mx-6 mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Sync failed: {(syncMutation.error as Error)?.message ?? "unknown error"}
        </div>
      )}
      {(sessionsQuery.isLoading || syncMutation.isPending) && (
        <div className="mx-6 mb-3 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          {syncMutation.isPending ? "Refreshing From Source…" : "Loading Sessions From Cache…"}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 px-6 lg:grid-cols-4">
        {[
          {
            icon: Compass,
            label: appliedJourney ? "Matching Sessions" : "Sessions Loaded",
            value: fmt(matchingTotal),
            sub: appliedJourney ? `${journeyLabel(appliedJourney)} · of ${fmt(rangeTotal)} in range` : undefined,
          },
          {
            icon: Activity,
            label: "Quiz Start → Partial",
            value: athena.counts ? `${fmt(quizStartTotal)} → ${fmt(partialTotal)}` : "—",
            sub: partialRate,
          },
          { icon: ShieldCheck, label: "Consent Given", value: athena.counts ? fmt(consentTotal) : "—", sub: consentRate },
          {
            icon: MousePointerClick,
            label: "Avg Events / Session",
            value: journeyIgnored ? "—" : kpis.avgEvents.toFixed(0),
            sub: `Median ${formatDuration(kpis.medianDuration)}`,
          },
        ].map((k) => {
          const I = k.icon;
          return (
            <div key={k.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <I className="h-3.5 w-3.5" />
                <span className="uppercase tracking-wider">{k.label}</span>
                {showSkeleton && <RefreshCw className="ml-auto h-3 w-3 animate-spin text-muted-foreground" />}
              </div>
              {showSkeleton ? (
                <>
                  <div className="mt-2 h-7 w-24 animate-pulse rounded bg-muted/60" />
                  <div className="mt-1.5 h-3 w-16 animate-pulse rounded bg-muted/40" />
                </>
              ) : (
                <>
                  <div className="mt-2 text-2xl font-semibold tabular-nums">{k.value}</div>
                  {k.sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{k.sub}</div>}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="mt-4 flex flex-wrap items-center gap-2 px-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Session, Anon ID, Email…"
            className="h-8 w-52 rounded-md border border-border bg-card pl-7 pr-2 text-xs outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
          {(
            [
              { key: "all", label: "All", tip: "All sessions — every session in the date range" },
              { key: "native", label: "Site-tracked", tip: "Native — the visit already had a session ID from the website" },
              { key: "inherited", label: "Linked", tip: "Inherited — no ID on this event, but we matched it to another visit from the same person" },
              { key: "synthetic", label: "Estimated", tip: "Synthetic — no session ID found; we grouped events by visitor signals and built a session" },
            ] as const
          ).map((s) => (
            <button
              key={s.key}
              onClick={() => setSourceFilter(s.key)}
              title={s.tip}
              className={cn(
                "rounded px-2 py-1 text-[11px] uppercase tracking-wider",
                sourceFilter === s.key ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <select
          value={utmFilter}
          onChange={(e) => setUtmFilter(e.target.value)}
          className="h-8 rounded-md border border-border bg-card px-2 text-xs"
        >
          <option value="all">All UTM Sources</option>
          {UTM_SOURCES.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>

        <select
          value={flagFilter}
          onChange={(e) => {
            const next = e.target.value as typeof flagFilter;
            if (next === flagFilter) return;
            setFlagFilter(next);
            loadRange(preset, customFrom, customTo, next === "all" ? null : next);
          }}
          className="h-8 rounded-md border border-border bg-card px-2 text-xs"
        >
          <option value="all">Any Journey</option>
          {(Object.keys(JOURNEY_LABELS) as JourneyFilter[]).map((j) => (
            <option key={j} value={j}>{JOURNEY_LABELS[j]}</option>
          ))}
        </select>

        <div className="ml-auto text-[11px] text-muted-foreground">
          {filtered.length.toLocaleString()} shown · {fmt(matchingTotal)} matching
          {matchingTotal != null && <span className="ml-2">{sessions.length.toLocaleString()} loaded</span>}
        </div>
      </div>
      {journeyIgnored && !syncBusy && (
        <div className="mx-6 mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          The session service did not apply the {journeyLabel(appliedJourney)} filter — it returned sessions without that step, so no rows or count are shown. It needs to support <code>{JOURNEY_API_FLAGS[appliedJourney as JourneyFilter]}=true</code>.
        </div>
      )}

      <div className="grid grid-cols-12 items-start gap-3 px-6 pt-4">
        {/* List */}
        <div className="col-span-12 flex flex-col lg:col-span-7">
          <div className="flex h-[min(72vh,760px)] min-h-[420px] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-card text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left font-medium">Session</th>
                    <th className="px-2 py-2 text-left font-medium">Source</th>
                    <th className="px-2 py-2 text-center font-medium" title="consent → quiz_start → partial_submit">Journey</th>
                    <th className="px-2 py-2 text-center font-medium" title="Fraud score — coming soon">Fraud Score</th>
                    <th className="px-2 py-2 text-right font-medium">Events</th>
                    <th className="px-3 py-2 text-right font-medium">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {!syncBusy && filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center">
                        <p className="text-sm font-medium">{athena.error ? "Sessions could not be loaded" : "No results found"}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {athena.error
                            ? athena.error
                            : sessions.length
                              ? `None of the ${sessions.length.toLocaleString()} loaded sessions match the search, source or UTM filters.`
                              : appliedJourney
                                ? `No ${journeyLabel(appliedJourney)} sessions in this date range.`
                                : athena.total === 0
                                  ? "No sessions in this date range."
                                  : ""}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                          {canLookup && (
                            <Button size="sm" disabled={lookupLoading} onClick={() => openSession(lookupId)}>
                              <Search className="h-3.5 w-3.5" />
                              {lookupLoading ? "Looking up session…" : "Look up this session ID"}
                            </Button>
                          )}
                          {(query || sourceFilter !== "all" || utmFilter !== "all" || flagFilter !== "all") && (
                            <Button variant="outline" size="sm" onClick={() => {
                              setQuery("");
                              setSourceFilter("all");
                              setUtmFilter("all");
                              setFlagFilter("all");
                              if (flagFilter !== "all") loadRange(preset, customFrom, customTo, null);
                            }}>
                              Clear filters
                            </Button>
                          )}
                        </div>
                        {detailState.sessionId === lookupId && detailState.error && <p role="alert" className="mt-2 text-xs text-destructive">{detailState.error}</p>}
                      </td>
                    </tr>
                  )}
                  {syncBusy && filtered.length === 0 &&
                    Array.from({ length: 16 }).map((_, i) => (
                      <tr key={`sk-${i}`} className="border-b border-border last:border-0">
                        {Array.from({ length: 6 }).map((__, j) => (
                          <td key={j} className="px-3 py-3">
                            <div className="h-3 w-full animate-pulse rounded bg-muted/60" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  {filtered.map((s) => (
                    <tr
                      key={s.session_id}
                      onClick={() => { setSelectedId(s.session_id); setDetailState({ sessionId: s.session_id, data: null, loading: true, error: null }); setDetailRequest({ sessionId: s.session_id }); }}
                      className={cn(
                        "cursor-pointer border-b border-border last:border-0 hover:bg-accent/40",
                        s.session_id === selected?.session_id && "bg-accent/40",
                      )}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <Mono>{s.session_id.slice(0, 8)}</Mono>
                          <SourcePill source={s.session_id_source} />
                          {s.user_id && <User className="h-3 w-3 text-success" aria-label="user_id present" />}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="truncate text-xs">{s.entry_utm_source || "—"}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{s.entry_utm_campaign || "—"}</div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-center">
                          <FunnelBar reached={funnelReachedIndex(s)} compact unknown={unknownStagesFor(s)} on={onStagesFor(s)} />
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <FraudBadge score={fraudScore(s.session_id)} compact />
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-xs">{s.event_count}</td>
                      <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">{timeAgo(s.session_start)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Detail */}
        <div className="col-span-12 lg:col-span-5 lg:h-[min(72vh,760px)] lg:min-h-[420px]">
          {showSkeleton && !selected && (
            <div className="flex h-full flex-col rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">Session Detail</h3>
                <RefreshCw className="ml-auto h-3 w-3 animate-spin text-muted-foreground" />
              </div>
              <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-3 p-4">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className="flex min-w-0 flex-col justify-center">
                    <div className="h-3 w-20 animate-pulse rounded bg-muted/40" />
                    <div className="mt-2 h-4 w-32 max-w-full animate-pulse rounded bg-muted/60" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {!showSkeleton && !selected && (
            <div className="flex h-full min-h-64 flex-col rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">Session Detail</h3>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
                <Compass className="mb-3 h-6 w-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">No results found</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {appliedJourney || query || sourceFilter !== "all" || utmFilter !== "all"
                    ? "Try another filter or date range."
                    : "No session details available yet."}
                </p>
              </div>
            </div>
          )}
          {selected && (
            <div className="flex h-full min-h-0 flex-col overflow-y-auto rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">Session Detail</h3>
                  <SourcePill source={selected.session_id_source} />
                  {detailLoading && <RefreshCw aria-label="Loading session details" className="ml-auto h-3 w-3 animate-spin text-muted-foreground" />}
                </div>
                <Mono className="break-all">{selected.session_id}</Mono>
                {detailForRow?.error && <p role="alert" className="mt-2 text-xs text-destructive">{detailForRow.error}</p>}
              </div>

              {selected.session_id_source !== "native" && (
                <div className="flex w-full min-w-0 items-center gap-2 border-b border-border bg-warning/10 px-4 py-1.5 text-[11px] text-warning">
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                  <span className="font-medium whitespace-nowrap shrink-0">Session ID Not Generated On Page</span>
                  <span title={selected.entry_page_url} className="min-w-0 flex-1 truncate">
                    <Mono>{(selected.entry_page_url || "—").slice(0, 40)}{selected.entry_page_url && selected.entry_page_url.length > 40 ? "…" : ""}</Mono>
                  </span>
                </div>
              )}

              {/* Overview */}
              <dl className="grid grid-cols-2 gap-3 p-4 text-xs">
                <div>
                  <dt className="text-muted-foreground">Anonymous ID</dt>
                  <dd className="mt-0.5"><Mono className="break-all">{selected.anonymous_id || "—"}</Mono></dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">User ID</dt>
                  <dd className="mt-0.5"><Mono className="break-all">{selected.user_id || "—"}</Mono></dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">RevCloud Person ID</dt>
                  <dd className="mt-0.5"><Mono className="break-all">{selected.revcloud_person_id || "—"}</Mono></dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Started</dt>
                  <dd className="mt-0.5">{timeAgo(selected.session_start)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Duration</dt>
                  <dd className="mt-0.5">{formatDuration(selected.duration_seconds)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Events</dt>
                  <dd className="mt-0.5 tabular-nums">{selected.event_count}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Journey Stage</dt>
                  <dd className="mt-0.5 tabular-nums">{selected.journey_stage || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">IP</dt>
                  <dd className="mt-0.5"><Mono>{selected.ip.ip || "—"}</Mono></dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Website Metadata ID</dt>
                  <dd className="mt-0.5"><Mono>{selected.website_metadata_id || "—"}</Mono></dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Expected Revenue</dt>
                  <dd className="mt-0.5 tabular-nums">${selected.expected_revenue.toFixed(2)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Terms/Privacy Opened</dt>
                  <dd className="mt-0.5">
                    {(() => {
                      const v = String(selected.raw?.has_litigant ?? "").toLowerCase();
                      const yes = v === "on" || v === "true" || v === "yes" || v === "1";
                      return yes ? (
                      <span className="inline-flex items-center gap-1 rounded border border-success/30 bg-success/10 px-1.5 py-0 text-[10px] font-medium text-success">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                        No
                      </span>
                      );
                    })()}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Consent Given</dt>
                  <dd className="mt-0.5">
                    {(() => {
                      const evt = selected.events.find((e) => e.event_name === "consent_given");
                      if (evt) {
                        return (
                          <span
                            title={evt.timestamp || "consent_given event fired"}
                            className="inline-flex items-center gap-1 rounded border border-success/30 bg-success/10 px-1.5 py-0 text-[10px] font-medium text-success"
                          >
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                            Yes{evt.timestamp ? ` · ${timeAgo(evt.timestamp)}` : ""}
                          </span>
                        );
                      }
                      return (
                        <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                          No
                        </span>
                      );
                    })()}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Bot</dt>
                  <dd className="mt-0.5">
                    {(() => {
                      if (!detailReady || selected.ip.is_bot == null) return <span className="text-muted-foreground">—</span>;
                      const isBot = selected.ip.is_bot;
                      const reason = "";
                      return isBot ? (
                        <span
                          title={`Suspected bot (${reason})`}
                          className="inline-flex items-center gap-1 rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0 text-[10px] font-medium text-destructive"
                        >
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive" />
                          Suspected {reason && `(${reason})`}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded border border-success/30 bg-success/10 px-1.5 py-0 text-[10px] font-medium text-success">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                          Human
                        </span>
                      );
                    })()}
                  </dd>
                </div>
              </dl>

              {/* Journey funnel */}
              <div className="border-t border-border px-4 py-3">
                {(() => {
                  const reached = funnelReachedIndex(selected);
                  const currentLabel = reached < 0 ? "None" : FUNNEL_STAGES[reached].label;
                  const unknown = unknownStagesFor(selected);
                  const onSet = onStagesFor(selected);
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => setFunnelExpanded((v) => !v)}
                        aria-expanded={funnelExpanded}
                        className="flex w-full items-center justify-between gap-3 rounded-md text-left hover:bg-accent/40 -mx-1 px-1 py-1"
                      >
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Journey funnel
                          </div>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                            {currentLabel}
                          </span>
                          <span className="text-[10px] tabular-nums text-muted-foreground">
                            {Math.max(0, reached) + 1}/{FUNNEL_STAGES.length}
                          </span>
                        </div>
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 text-muted-foreground transition-transform",
                            funnelExpanded && "rotate-180",
                          )}
                        />
                      </button>
                      {!funnelExpanded && (
                        <div className="mt-2">
                          <FunnelBar reached={reached} unknown={unknown} on={onSet} />
                        </div>
                      )}
                      {funnelExpanded && (
                    <ol className="flex flex-col">
                      {FUNNEL_STAGES.map((stage, i) => {
                        const on = onSet.has(i);
                        const nextOn = i + 1 < FUNNEL_STAGES.length && onSet.has(i + 1);
                        const isFurthest = i === reached;
                        const isLast = i === FUNNEL_STAGES.length - 1;
                        const isUnknown = unknown?.has(i) ?? false;
                        const nextUnknown = !isLast && (unknown?.has(i + 1) ?? false);
                        return (
                          <li key={stage.key} className="flex items-stretch gap-3">
                            <div className="relative flex w-7 flex-col items-center">
                              <div
                                className={cn(
                                  "z-10 flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-semibold",
                                  isUnknown
                                    ? "border-dashed border-muted-foreground/50 bg-transparent text-muted-foreground"
                                    : on
                                      ? "border-success bg-success text-success-foreground"
                                      : "border-border bg-muted/40 text-muted-foreground",
                                  isFurthest && !isUnknown && "ring-2 ring-success/30",
                                )}
                              >
                                {i + 1}
                              </div>
                              {!isLast && (
                                <div
                                  className={cn(
                                    "w-0.5 flex-1",
                                    nextUnknown || isUnknown
                                      ? "bg-muted-foreground/25"
                                      : (on && nextOn) ? "bg-success" : "bg-border",
                                  )}
                                />
                              )}
                            </div>
                            <div className={cn("flex-1 pb-3 pt-1", isLast && "pb-1")}>
                              <div
                                className={cn(
                                  "text-xs font-medium",
                                  isUnknown ? "text-muted-foreground" : on ? "text-foreground" : "text-muted-foreground",
                                )}
                              >
                                {stage.label}
                              </div>
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                {isUnknown ? "No Data (UCT)" : on ? (isFurthest ? "Reached" : "Passed") : "Not Reached"}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                      )}
                    </>
                  );
                })()}
                {selected.has_button_click && (
                  <div className="mt-2 text-[10px] text-muted-foreground">
                    Also recorded: <span className="text-foreground">button_click</span>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Attribution — full-width row */}
        {showSkeleton && !selected && (
          <div className="col-span-12">
            <CardSkeleton title="Attribution" rows={6} />
          </div>
        )}
        {selected && (
          <div className="col-span-12">
            <div className="flex flex-col rounded-xl border border-border bg-card">
              {/* Attribution */}
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Attribution
                </div>
                <button
                  onClick={() => navigator.clipboard?.writeText(selected.entry_page_url)}
                  className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
                >
                  <Copy className="h-3 w-3" /> URL
                </button>
              </div>
              <div className="flex-1 p-3">
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {([
                    ["Channel", selected.entry_channel],
                    ["UTM Source", selected.entry_utm_source],
                    ["UTM Medium", selected.entry_utm_medium],
                    ["UTM Campaign", selected.entry_utm_campaign],
                    ["UTM Term", selected.entry_utm_term],
                    ["UTM Content", selected.entry_utm_content],
                  ] as const).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5">
                      <span className="whitespace-nowrap text-[11px] text-muted-foreground">{k}</span>
                      <span className="min-w-0 break-all text-right"><Mono>{v || "—"}</Mono></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Event payloads — full-width card below the grid */}
        {showSkeleton && !selected && (
          <div className="col-span-12 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <CardSkeleton title="Click IDs" rows={10} />
            <CardSkeleton title="IP Address" rows={13} />
          </div>
        )}
        {selected && (
          <div className="col-span-12 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {/* Click IDs */}
            <div className="flex flex-col rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Click IDs
                </div>
                <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                  {Object.keys(selected.clickids).length} present
                </span>
              </div>
              <div className="flex-1 p-3">
                <div className="flex h-full flex-col overflow-auto rounded border border-border bg-muted/20">
                  <table className="w-full flex-1 text-[11px]">
                    <tbody>
                      {([
                        ["Google Click ID (gclid)", "gclid"],
                        ["Facebook Click ID (fbclid)", "fbclid"],
                        ["Pixel ID", "pixel_id"],
                        ["Transaction ID", "txn_id"],
                        ["Campaign ID (cid)", "cid"],
                        ["Affiliate ID (affid)", "affid"],
                        ["Click ID", "clickid"],
                        ["Router Event ID", "router_event_id"],
                        ["Task Event ID", "task_event_id"],
                        ["Tune Click ID", "tune_click_id"],
                      ] as const).map(([label, key]) => (
                        <tr key={key} className="border-t border-border first:border-0">
                          <td className="whitespace-nowrap px-2 py-1 text-muted-foreground">{label}</td>
                          <td className="px-2 py-1 break-all"><Mono>{selected.clickids[key] || "—"}</Mono></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* IP address */}
            {detailLoading ? <CardSkeleton title="IP Address" rows={13} /> :
            <div className="flex flex-col rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  IP address
                </div>
                <div className="flex items-center gap-1">
                  {selected.ip.is_vpn && (
                    <span className="rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">VPN</span>
                  )}
                  {selected.ip.is_proxy && (
                    <span className="rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">Proxy</span>
                  )}
                  <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                    {selected.ip.country_code || "—"}
                  </span>
                </div>
              </div>
              <div className="p-3">
                {!detailReady ? <p className="text-xs text-muted-foreground">{detailForRow?.error ?? "Open a session row to load its IP address."}</p> :
                <div className="overflow-auto rounded border border-border bg-muted/20">
                  <table className="w-full text-[11px]">
                    <tbody>
                      {([
                        ["IP Address", selected.ip.ip],
                        ["Country Code", selected.ip.country_code],
                        ["Country", selected.ip.country_name],
                        ["Region", selected.ip.region_name],
                        ["District", selected.ip.district],
                        ["City", selected.ip.city_name],
                        ["Latitude", selected.ip.latitude],
                        ["Longitude", selected.ip.longitude],
                        ["Area Code", selected.ip.area_code],
                        ["Time Zone", selected.ip.time_zone],
                        ["ZIP Code", selected.ip.zip_code],
                        ["Proxy", selected.ip.is_proxy == null ? "—" : selected.ip.is_proxy ? "Yes" : "No"],
                        ["VPN", selected.ip.is_vpn == null ? "—" : selected.ip.is_vpn ? "Yes" : "No"],
                        ["Bot", selected.ip.is_bot == null ? "—" : selected.ip.is_bot ? "Yes" : "No"],
                      ] as const).map(([k, v]) => (
                        <tr key={k} className="border-t border-border first:border-0">
                          <td className="whitespace-nowrap px-2 py-1 text-muted-foreground">{k}</td>
                          <td className="px-2 py-1 break-all"><Mono>{v || "—"}</Mono></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>}
              </div>
            </div>}
          </div>
        )}

        {/* Event payloads — full-width card below the grid */}
        {showSkeleton && !selected && (
          <div className="col-span-12">
            <CardSkeleton title="Event Payloads" rows={6} />
          </div>
        )}
        {selected && (
          <div className="col-span-12">
            {detailLoading ? <CardSkeleton title="Event Payloads" rows={6} /> :
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Event payloads
                  </div>
                  <Mono className="break-all">{selected.session_id.slice(0, 12)}…</Mono>
                </div>
                <span
                  title="Events returned by the session detail call"
                  className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground"
                >
                  {detailReady ? `${selected.events.length} ${selected.events.length === 1 ? "event" : "events"} returned` : "—"}
                </span>
              </div>
              <div className="p-3">
                {detailReady ? <EventPayloads key={selected.session_id} session={selected} /> :
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">{detailForRow?.error ?? `${selected.event_count} events reported; payloads not loaded yet.`}</p>
                    <Button variant="outline" size="sm" onClick={() => setDetailRequest({ sessionId: selected.session_id })}>
                      <RefreshCw className="h-3.5 w-3.5" />
                      {detailForRow?.error ? "Retry loading events" : "Load events"}
                    </Button>
                  </div>}
              </div>
            </div>}
          </div>
        )}
      </div>
    </div>
  );
}

function EventPayloads({ session }: { session: Session }) {
  const [open, setOpen] = useState<number | null>(1);

  return _EventPayloadsBody({ session, open, setOpen });
}

function CardSkeleton({ title, rows, twoCol }: { title: string; rows: number; twoCol?: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
        <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
      </div>
      <div className={cn("grid flex-1 auto-rows-fr gap-1.5 p-3", twoCol ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex min-h-[32px] items-center justify-between gap-2 rounded-md border border-border bg-background/40 px-2 py-2">
            <div className="h-3 w-24 animate-pulse rounded bg-muted/60" />
            <div className="h-3 w-32 animate-pulse rounded bg-muted/40" />
          </div>
        ))}
      </div>
    </div>
  );
}

function _EventPayloadsBody({
  session,
  open,
  setOpen,
}: {
  session: Session;
  open: number | null;
  setOpen: (n: number | null) => void;
}) {
  const events = useMemo(
    () =>
      session.events.map((e, i) => ({
        idx: i + 1,
        type: e.type,
        name: e.event_name,
        timestamp: e.timestamp,
        payload: e.raw,
      })),
    [session],
  );

  if (!events.length) {
    return <div className="text-xs text-muted-foreground">{session.event_count > 0 ? `This session reports ${session.event_count} events, but the detail response returned no event payloads.` : "No events recorded."}</div>;
  }

  return (
    <ol className="flex flex-col gap-1">
      {events.map((ev) => {
        const isOpen = open === ev.idx;
        return (
          <li key={ev.idx} className="rounded-md border border-border bg-background/40">
            <Button variant="ghost"
              type="button"
              aria-expanded={isOpen}
              aria-label={`${isOpen ? "Hide" : "Show"} payload for event ${ev.idx}: ${ev.name || ev.type || "Event"}`}
              onClick={() => setOpen(isOpen ? null : ev.idx)}
              className="flex h-auto w-full flex-wrap items-center gap-2 whitespace-normal px-2 py-1.5 text-left hover:bg-accent/40"
            >
              <span className="inline-flex h-5 w-6 items-center justify-center rounded bg-muted text-[10px] tabular-nums text-muted-foreground">
                {ev.idx}
              </span>
              <span className="text-[10px] text-muted-foreground">{ev.type}</span>
              <span className="min-w-0 break-all text-xs font-medium">{ev.name || "—"}</span>
              <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                {ev.timestamp || "—"}
              </span>
              <span className="text-[10px] text-muted-foreground">{isOpen ? "Hide payload" : "Show payload"}</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </Button>
            {isOpen && (
              <pre className="max-h-64 overflow-auto border-t border-border px-3 py-2 font-mono text-[10px] leading-5 text-muted-foreground">
{JSON.stringify(ev.payload, null, 2)}
              </pre>
            )}
          </li>
        );
      })}
    </ol>
  );
}
