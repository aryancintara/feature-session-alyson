import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Target, AlertTriangle } from "lucide-react";
import { IDENTITY_METHODS } from "@/lib/mockData";
import { PageHeader, GradeBadge } from "@/components/ui-bits";

export const Route = createFileRoute("/accuracy")({
  head: () => ({
    meta: [
      { title: "Identity Accuracy Lab · Resolve.io" },
      { name: "description", content: "Grade every identity method against the source of truth." },
    ],
  }),
  component: Accuracy,
});

function TrendChart() {
  const series = [
    { name: "Email", color: "var(--color-success)", data: [88, 89, 90, 91, 92, 93, 94, 95, 95, 95, 96, 96] },
    { name: "Phone", color: "var(--color-info)", data: [85, 86, 87, 88, 89, 90, 91, 92, 92, 93, 93, 93] },
    { name: "Address", color: "var(--color-primary)", data: [80, 81, 82, 83, 84, 85, 86, 87, 87, 88, 88, 88] },
    { name: "Cookie", color: "var(--color-warning)", data: [62, 64, 65, 66, 67, 68, 69, 70, 70, 71, 71, 71] },
    { name: "IP+UA", color: "var(--color-destructive)", data: [50, 51, 52, 53, 54, 55, 56, 56, 57, 57, 58, 58] },
  ];
  const w = 720, h = 200;
  const points = (d: number[]) =>
    d.map((v, i) => `${(i / (d.length - 1)) * w},${h - ((v - 40) / 60) * h}`).join(" L ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-52 w-full">
      {[40, 60, 80, 100].map((y) => (
        <g key={y}>
          <line x1="0" x2={w} y1={h - ((y - 40) / 60) * h} y2={h - ((y - 40) / 60) * h} stroke="var(--color-border)" strokeDasharray="2,3" />
          <text x="2" y={h - ((y - 40) / 60) * h - 2} className="fill-muted-foreground" style={{ font: "10px var(--font-mono)" }}>
            {y}%
          </text>
        </g>
      ))}
      {series.map((s) => (
        <path key={s.name} d={`M ${points(s.data)}`} fill="none" stroke={s.color} strokeWidth="2" />
      ))}
    </svg>
  );
}

function Accuracy() {
  return (
    <div className="pb-10">
      <PageHeader
        title="Identity Accuracy Lab"
        subtitle="Source of Truth: anyone who reached SQL stage or beyond. Every method is graded against this anchor."
      />

      <div className="grid grid-cols-2 gap-3 px-6 lg:grid-cols-4">
        {[
          { icon: ShieldCheck, label: "SoT cohort", value: "142,318", sub: "leads ≥ SQL stage" },
          { icon: Target, label: "Resolution rate", value: "89.4%", sub: "events → person" },
          { icon: ShieldCheck, label: "Avg accuracy", value: "82.1%", sub: "weighted across methods" },
          { icon: AlertTriangle, label: "Conflict rate", value: "8.2%", sub: "−1.3pp vs last week" },
        ].map((k) => {
          const I = k.icon;
          return (
            <div key={k.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <I className="h-3.5 w-3.5" />
                <span className="uppercase tracking-wider">{k.label}</span>
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">{k.value}</div>
              <div className="text-xs text-muted-foreground">{k.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 px-6 pt-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card lg:col-span-2">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Accuracy trend (12 weeks)</h3>
            <p className="text-xs text-muted-foreground">Per-method accuracy vs Source of Truth</p>
          </div>
          <div className="p-4"><TrendChart /></div>
          <div className="flex flex-wrap gap-3 border-t border-border px-4 py-2 text-xs">
            {[
              ["Email", "var(--color-success)"],
              ["Phone", "var(--color-info)"],
              ["Address", "var(--color-primary)"],
              ["Cookie", "var(--color-warning)"],
              ["IP+UA", "var(--color-destructive)"],
            ].map(([l, c]) => (
              <div key={l} className="flex items-center gap-1.5">
                <span className="h-2 w-4 rounded" style={{ background: c }} />
                <span className="text-muted-foreground">{l}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">Top determinants</div>
          <ul className="divide-y divide-border">
            {[...IDENTITY_METHODS].sort((a, b) => b.finalDeterminant - a.finalDeterminant).slice(0, 6).map((m) => (
              <li key={m.name} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <div className="text-xs font-medium">{m.name}</div>
                  <div className="text-[10px] text-muted-foreground">{m.finalDeterminant}% of resolutions</div>
                </div>
                <GradeBadge grade={m.grade} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="px-6 pt-4">
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">Method scorecard</div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left font-medium">Method</th>
                <th className="px-4 py-2 text-right font-medium">Coverage</th>
                <th className="px-4 py-2 text-right font-medium">Usage</th>
                <th className="px-4 py-2 text-right font-medium">Final determinant</th>
                <th className="px-4 py-2 text-right font-medium">Accuracy vs SoT</th>
                <th className="px-4 py-2 text-right font-medium">Conflict</th>
                <th className="px-4 py-2 text-right font-medium">Confidence</th>
                <th className="px-4 py-2 text-right font-medium">Grade</th>
              </tr>
            </thead>
            <tbody>
              {IDENTITY_METHODS.map((m) => (
                <tr key={m.name} className="border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2.5 font-medium">{m.name}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{m.coverage}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{m.usage}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{m.finalDeterminant}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{m.accuracy}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{m.conflictRate}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{m.confidence}</td>
                  <td className="px-4 py-2.5 text-right"><GradeBadge grade={m.grade} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
