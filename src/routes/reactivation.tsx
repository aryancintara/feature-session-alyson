import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Zap,
  Activity,
  Send,
  PhoneCall,
  Trophy,
  Plus,
  CheckCircle2,
  XCircle,
  Settings2,
} from "lucide-react";
import { PageHeader, Mono, StatusDot } from "@/components/ui-bits";
import { AnalyticsTable, VarianceCell, type Column } from "@/components/AnalyticsTable";
import { FilterBar, makeDefaultFilters } from "@/components/FilterBar";
import {
  REACTIVATION_LEADS,
  REACTIVATION_RULES,
  REACTIVATION_TIMESERIES,
  REACTIVATION_STATUS_LABEL,
  reactivationKpis,
  type ReactivationLead,
  type ReactivationStatus,
  type ReactivationRule,
} from "@/lib/reactivationData";
import { formatNum, timeAgo } from "@/lib/mockData";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reactivation")({
  head: () => ({
    meta: [
      { title: "Reactivation · Resolve.io" },
      {
        name: "description",
        content:
          "Automatically create new leads when identified visitors leave a session without submitting a lead.",
      },
    ],
  }),
  component: Reactivation,
});

const STATUS_STYLE: Record<ReactivationStatus, string> = {
  eligible: "bg-info/10 text-info border-info/20",
  lead_created: "bg-primary/10 text-primary border-primary/20",
  sent_to_destination: "bg-accent text-accent-foreground border-border",
  contact_attempted: "bg-warning/10 text-warning-foreground border-warning/30",
  converted: "bg-success/10 text-success border-success/20",
  suppressed: "bg-muted text-muted-foreground border-border",
};

function StatusPill({ status }: { status: ReactivationStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold",
        STATUS_STYLE[status],
      )}
    >
      {REACTIVATION_STATUS_LABEL[status]}
    </span>
  );
}

function TimeSeriesChart() {
  const points = REACTIVATION_TIMESERIES;
  const w = 100;
  const h = 28;
  const max = Math.max(...points.map((p) => p.opportunities));
  const series = [
    { key: "opportunities" as const, color: "var(--color-info)", label: "Opportunities" },
    { key: "leads" as const, color: "var(--color-primary)", label: "Leads created" },
    { key: "sent" as const, color: "var(--color-accent-foreground)", label: "Sent" },
    { key: "conversions" as const, color: "var(--color-success)", label: "Conversions" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Reactivation pipeline · 14 days</h3>
          <p className="text-xs text-muted-foreground">
            Heartbeat exits → eligibility → leads → destinations → conversions
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              <span className="text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="p-4">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-48 w-full">
          {series.map((s) => {
            const path = points
              .map((p, i) => {
                const x = (i / (points.length - 1)) * w;
                const y = h - (p[s.key] / max) * h;
                return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
              })
              .join(" ");
            return (
              <path
                key={s.key}
                d={path}
                fill="none"
                stroke={s.color}
                strokeWidth="0.5"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
        <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>{points[0].t}</span>
          <span>{points[Math.floor(points.length / 2)].t}</span>
          <span>{points[points.length - 1].t}</span>
        </div>
      </div>
    </div>
  );
}

function RuleCard({ rule }: { rule: ReactivationRule }) {
  const [enabled, setEnabled] = useState(rule.enabled);
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between border-b border-border px-4 py-3">
        <div className="flex items-start gap-2">
          <Settings2 className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <h4 className="text-sm font-semibold">{rule.name}</h4>
            <Mono>{rule.id} · {formatNum(rule.triggered24h)} triggers · 24h</Mono>
          </div>
        </div>
        <button
          onClick={() => setEnabled((v) => !v)}
          className={cn(
            "relative h-5 w-9 rounded-full border transition-colors",
            enabled ? "border-success/30 bg-success/30" : "border-border bg-muted",
          )}
          aria-pressed={enabled}
        >
          <span
            className={cn(
              "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-background shadow transition-all",
              enabled ? "left-[18px]" : "left-0.5",
            )}
          />
        </button>
      </div>
      <ul className="divide-y divide-border">
        {rule.conditions.map((c, i) => (
          <li key={i} className="flex items-center justify-between px-4 py-2 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-success" />
              <span>{c.label}</span>
            </div>
            <Mono>{c.value}</Mono>
          </li>
        ))}
      </ul>
      <div className="border-t border-border px-4 py-2.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Destinations
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {rule.destinations.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px]"
            >
              <Send className="h-2.5 w-2.5 text-muted-foreground" />
              {d}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Reactivation() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(makeDefaultFilters());
  const [status, setStatus] = useState<ReactivationStatus | "all">("all");

  const kpis = useMemo(() => reactivationKpis(), []);

  const rows = useMemo(
    () => (status === "all" ? REACTIVATION_LEADS : REACTIVATION_LEADS.filter((l) => l.status === status)),
    [status],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: REACTIVATION_LEADS.length };
    for (const l of REACTIVATION_LEADS) counts[l.status] = (counts[l.status] ?? 0) + 1;
    return counts;
  }, []);

  const columns: Column<ReactivationLead>[] = [
    {
      key: "person",
      header: "Person",
      value: (r) => r.person_name,
      cell: (r) => (
        <div>
          <div className="font-medium">{r.person_name}</div>
          <Mono>{r.person_id}</Mono>
        </div>
      ),
    },
    {
      key: "place",
      header: "Place",
      value: (r) => r.place_id,
      cell: (r) => (
        <div className="text-xs">
          <Mono>{r.place_id}</Mono>
          <div className="text-muted-foreground">{r.city}, {r.state}</div>
        </div>
      ),
      defaultHidden: true,
    },
    {
      key: "session",
      header: "Session",
      value: (r) => r.session_id,
      cell: (r) => <Mono>{r.session_id}</Mono>,
    },
    {
      key: "last_session",
      header: "Last session",
      value: (r) => -new Date(r.created_at).getTime(),
      cell: (r) => <span className="text-xs">{timeAgo(r.created_at)}</span>,
      width: "110px",
    },
    {
      key: "stage",
      header: "Last funnel stage",
      value: (r) => r.last_funnel_stage,
      cell: (r) => <Mono>{r.last_funnel_stage}</Mono>,
    },
    {
      key: "bucket",
      header: "Repeat",
      value: (r) => r.repeat_bucket,
      cell: (r) => <span className="text-xs">{r.repeat_bucket}</span>,
      width: "100px",
    },
    {
      key: "consent",
      header: "Consent",
      value: (r) => r.consent_channel,
      cell: (r) => (
        <span className="inline-flex items-center gap-1 rounded border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">
          <CheckCircle2 className="h-2.5 w-2.5" />
          {r.consent_channel.toUpperCase()}
        </span>
      ),
      width: "100px",
    },
    {
      key: "confidence",
      header: "Identity",
      value: (r) => r.identity_confidence,
      align: "right",
      cell: (r) => (
        <span
          className={cn(
            "font-mono text-xs tabular-nums",
            r.identity_confidence >= 85 ? "text-success" : r.identity_confidence >= 70 ? "text-info" : "text-warning",
          )}
        >
          {r.identity_confidence}
        </span>
      ),
      width: "90px",
    },
    {
      key: "status",
      header: "Status",
      value: (r) => r.status,
      cell: (r) => <StatusPill status={r.status} />,
      width: "120px",
    },
    {
      key: "destination",
      header: "Destination",
      value: (r) => r.destination,
      cell: (r) => <span className="text-xs">{r.destination}</span>,
    },
  ];

  const KPIs = [
    { label: "Reactivation opportunities", value: kpis.opportunities.total, variance: kpis.opportunities.variance, icon: Zap },
    { label: "Leads created", value: kpis.leads.total, variance: kpis.leads.variance, icon: Activity },
    { label: "Sent to destination", value: kpis.sent.total, variance: kpis.sent.variance, icon: Send },
    { label: "Contact attempts", value: kpis.attempts.total, variance: kpis.attempts.variance, icon: PhoneCall },
    { label: "Conversions", value: kpis.conversions.total, variance: kpis.conversions.variance, icon: Trophy },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="Reactivation"
        subtitle="Automatically create leads when identified visitors leave without submitting — routed to dialers, CRM, and lead marketplaces."
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-3 w-3" /> New rule
          </button>
        }
      />

      <div className="space-y-3 px-6">
        <FilterBar value={filters} onChange={setFilters} />

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {KPIs.map((k) => {
            const I = k.icon;
            return (
              <div key={k.label} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <I className="h-3 w-3" />
                    {k.label}
                  </div>
                </div>
                <div className="mt-1 font-mono text-2xl tabular-nums">{formatNum(k.value)}</div>
                <div className="mt-1"><VarianceCell value={k.variance} /></div>
              </div>
            );
          })}
        </div>

        {/* Time series */}
        <TimeSeriesChart />

        {/* Status chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(["all", "eligible", "lead_created", "sent_to_destination", "contact_attempted", "converted", "suppressed"] as const).map(
            (s) => (
              <button
                key={s}
                onClick={() => setStatus(s as ReactivationStatus | "all")}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  status === s
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-accent",
                )}
              >
                {s === "all" ? "All" : REACTIVATION_STATUS_LABEL[s as ReactivationStatus]}
                <span className="ml-1.5 font-mono text-[10px] opacity-70">{statusCounts[s] ?? 0}</span>
              </button>
            ),
          )}
        </div>

        {/* Opportunities table */}
        <AnalyticsTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.reactivation_lead_id}
          // Identity Console is hidden pending the new UI.
          // Previously: onRowClick={() => navigate({ to: "/identity-console" })}

          searchPlaceholder="Search by person, session, destination…"
          csvName="reactivation-opportunities.csv"
          pageSize={10}
        />

        {/* Rules + destination routing */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 lg:col-span-8">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Reactivation rules</h3>
              <Mono>{REACTIVATION_RULES.filter((r) => r.enabled).length} of {REACTIVATION_RULES.length} active</Mono>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {REACTIVATION_RULES.map((r) => (
                <RuleCard key={r.id} rule={r} />
              ))}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Routing summary</h3>
              <Mono>Last hour</Mono>
            </div>
            <div className="rounded-xl border border-border bg-card">
              <ul className="divide-y divide-border">
                {[
                  { dst: "Salesforce Sales Cloud", count: 412, status: "active" as const },
                  { dst: "HubSpot CRM", count: 188, status: "active" as const },
                  { dst: "Twilio Dialer Queue", count: 244, status: "active" as const },
                  { dst: "Five9 Call Center", count: 96, status: "active" as const },
                  { dst: "Klaviyo Lists", count: 612, status: "active" as const },
                  { dst: "Lead Marketplace · Verify", count: 0, status: "warning" as const },
                ].map((row) => (
                  <li key={row.dst} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <StatusDot status={row.status} />
                      <span>{row.dst}</span>
                    </div>
                    <span className="font-mono text-xs tabular-nums">{formatNum(row.count)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-3 rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Suppression checks
              </div>
              <div className="mt-2 space-y-1.5 text-xs">
                {[
                  { label: "Unsubscribed", on: false, note: "Auto-blocked" },
                  { label: "Litigation risk (TCPA)", on: false, note: "Auto-blocked" },
                  { label: "Consent revoked < 24h", on: false, note: "Auto-blocked" },
                  { label: "Identity confidence ≥ 70", on: true, note: "Required" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {s.on ? (
                        <CheckCircle2 className="h-3 w-3 text-success" />
                      ) : (
                        <XCircle className="h-3 w-3 text-destructive" />
                      )}
                      <span>{s.label}</span>
                    </div>
                    <Mono>{s.note}</Mono>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
