import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, AlertTriangle, BanIcon, Mail, Phone, MessageSquare } from "lucide-react";
import { PageHeader, Mono } from "@/components/ui-bits";
import { formatNum, timeAgo, PEOPLE } from "@/lib/mockData";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/consent")({
  head: () => ({
    meta: [
      { title: "Consent & Compliance · Resolve.io" },
      { name: "description", content: "Person-level consent, suppression, and TCPA risk." },
    ],
  }),
  component: Consent,
});

function Consent() {
  const recent = PEOPLE.slice(0, 8).map((p, i) => ({
    person: p.name,
    id: p.id,
    channel: ["SMS", "Email", "Call", "Email", "SMS", "All", "SMS", "Email"][i],
    action: i % 3 === 0 ? "opted out" : i % 3 === 1 ? "opted in" : "updated",
    when: p.lastSeen,
  }));

  return (
    <div className="pb-10">
      <PageHeader title="Consent & Compliance" subtitle="Person-level consent, suppression lists, and TCPA litigation monitoring." />

      <div className="grid grid-cols-2 gap-3 px-6 lg:grid-cols-4">
        {[
          { label: "SMS consent", value: "62.4%", sub: "127.4M people", icon: MessageSquare, tone: "text-success" },
          { label: "Email consent", value: "78.1%", sub: "159.5M people", icon: Mail, tone: "text-success" },
          { label: "Do Not Contact", value: formatNum(9_233_881), sub: "all channels suppressed", icon: BanIcon, tone: "text-destructive" },
          { label: "Litigation risk", value: formatNum(12_440), sub: "TCPA flagged", icon: AlertTriangle, tone: "text-warning-foreground" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="uppercase tracking-wider">{s.label}</span>
                <Icon className={cn("h-4 w-4", s.tone)} />
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 px-6 pt-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card lg:col-span-2">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">Channel coverage</div>
          <div className="space-y-3 p-4">
            {[
              { label: "Platform", granted: 97, icon: ShieldCheck },
              { label: "Email", granted: 78, icon: Mail },
              { label: "SMS", granted: 62, icon: MessageSquare },
              { label: "Call", granted: 54, icon: Phone },
              { label: "Partner data sharing", granted: 71, icon: ShieldCheck },
            ].map((c) => {
              const I = c.icon;
              return (
                <div key={c.label} className="flex items-center gap-3">
                  <div className="flex w-32 items-center gap-2 text-sm">
                    <I className="h-3.5 w-3.5 text-muted-foreground" />
                    {c.label}
                  </div>
                  <div className="relative h-3 flex-1 overflow-hidden rounded bg-muted">
                    <div className="h-full bg-success" style={{ width: `${c.granted}%` }} />
                  </div>
                  <div className="w-12 text-right font-mono text-xs">{c.granted}%</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">Compliance audiences</div>
          <table className="w-full text-sm">
            <tbody>
              {[
                ["Do Not Contact", "9.23M"],
                ["SMS suppressed", "1.84M"],
                ["Email suppressed", "2.14M"],
                ["TCPA litigation", "12.4K"],
                ["Minor (age unknown)", "412K"],
              ].map(([n, s]) => (
                <tr key={n} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-xs font-medium">{n}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">{s}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="px-6 pt-4">
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">Recent consent events</div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left font-medium">Person</th>
                <th className="px-4 py-2 text-left font-medium">Channel</th>
                <th className="px-4 py-2 text-left font-medium">Action</th>
                <th className="px-4 py-2 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{r.person}</div>
                    <Mono>{r.id}</Mono>
                  </td>
                  <td className="px-4 py-2.5"><Mono>{r.channel}</Mono></td>
                  <td className="px-4 py-2.5">
                    <span className={cn("rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
                      r.action === "opted in" ? "border-success/30 bg-success/10 text-success" :
                      r.action === "opted out" ? "border-destructive/30 bg-destructive/10 text-destructive" :
                      "border-border bg-muted text-muted-foreground"
                    )}>{r.action}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{timeAgo(r.when)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
