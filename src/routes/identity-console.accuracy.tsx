import { createFileRoute } from "@tanstack/react-router";
import { IDENTITY_ACCURACY_METHODS, IDENTITY_CALIBRATION_BINS, IDENTITY_DECISIONS, PEOPLE, timeAgo } from "@/lib/mockData";
import { PageHeader, Mono } from "@/components/ui-bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/identity-console/accuracy")({
  head: () => ({ meta: [
    { title: "Identity Console Accuracy — Alyson CDP" },
    { name: "description", content: "Explore identity console accuracy in Alyson CDP." },
    { property: "og:title", content: "Identity Console Accuracy — Alyson CDP" },
    { property: "og:description", content: "Explore identity console accuracy in Alyson CDP." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AccuracyPage,
});

function AccuracyPage() {
  const overall = 94.2;
  const precision = 96.1;
  const recall = 88.7;
  const falseMerge = 1.8;
  const falseSplit = 2.4;

  const recentLabels = IDENTITY_DECISIONS.slice(0, 12).map((d, i) => ({
    id: d.id,
    person: PEOPLE.find((p) => p.id === d.personId)?.name ?? d.personId,
    ts: d.ts,
    label: i % 4 === 0 ? "incorrect" : "correct",
    source: i % 3 === 0 ? "manual review" : i % 2 === 0 ? "partner feedback" : "customer report",
  }));

  return (
    <div className="pb-6">
      <PageHeader
        title="Identity Decision Accuracy"
        subtitle="Precision, recall, and calibration for identity decisions (distinct from audience accuracy)."
      />
      <div className="space-y-4 px-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Kpi label="Overall accuracy" value={`${overall}%`} tone="success" />
          <Kpi label="Precision" value={`${precision}%`} tone="success" />
          <Kpi label="Recall" value={`${recall}%`} tone="info" />
          <Kpi label="False-merge rate" value={`${falseMerge}%`} tone="warning" />
          <Kpi label="False-split rate" value={`${falseSplit}%`} tone="warning" />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Method breakdown */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Method × precision/recall</h3>
              <p className="text-xs text-muted-foreground">Ranked by labeled sample size</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Method</th>
                  <th className="px-3 py-2 text-right font-medium">Prec.</th>
                  <th className="px-3 py-2 text-right font-medium">Recall</th>
                  <th className="px-3 py-2 text-right font-medium">FM%</th>
                  <th className="px-3 py-2 text-right font-medium">FS%</th>
                  <th className="px-3 py-2 text-right font-medium">Labeled</th>
                </tr>
              </thead>
              <tbody>
                {IDENTITY_ACCURACY_METHODS.map((m) => (
                  <tr key={m.method} className="border-t border-border">
                    <td className="px-3 py-2 text-xs">{m.method}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{m.precision}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{m.recall}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{m.falseMerge.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{m.falseSplit.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{m.labeled.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Calibration */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Probability calibration</h3>
              <p className="text-xs text-muted-foreground">Predicted vs actual match probability, 10 bins</p>
            </div>
            <div className="p-4">
              <svg viewBox="0 0 300 220" className="h-56 w-full">
                {/* grid */}
                {Array.from({ length: 6 }).map((_, i) => (
                  <line key={i} x1="30" x2="290" y1={20 + i * 32} y2={20 + i * 32} stroke="var(--color-border)" strokeWidth="0.5" />
                ))}
                {/* diagonal reference */}
                <line x1="30" y1="180" x2="290" y2="20" stroke="var(--color-muted-foreground)" strokeDasharray="3 3" strokeWidth="1" opacity="0.5" />
                {/* bars */}
                {IDENTITY_CALIBRATION_BINS.map((b, i) => {
                  const x = 30 + i * 26;
                  const yPred = 180 - (b.predicted * 1.6);
                  const yAct = 180 - (b.actual * 1.6);
                  return (
                    <g key={i}>
                      <rect x={x} y={yPred} width="10" height={180 - yPred} fill="var(--color-primary)" opacity="0.4" />
                      <rect x={x + 10} y={yAct} width="10" height={180 - yAct} fill="var(--color-info)" opacity="0.7" />
                      <text x={x + 10} y={195} fontSize="8" textAnchor="middle" fill="var(--color-muted-foreground)">{b.predicted}</text>
                    </g>
                  );
                })}
                <text x="30" y="12" fontSize="9" fill="var(--color-muted-foreground)">predicted</text>
                <text x="90" y="12" fontSize="9" fill="var(--color-muted-foreground)">actual</text>
              </svg>
            </div>
          </div>
        </div>

        {/* Recent labels */}
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Recent accuracy labels</h3>
            <p className="text-xs text-muted-foreground">Ground truth received from partners, reviewers, and customers</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Decision</th>
                <th className="px-3 py-2 text-left font-medium">Person</th>
                <th className="px-3 py-2 text-left font-medium">Label</th>
                <th className="px-3 py-2 text-left font-medium">Source</th>
                <th className="px-3 py-2 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {recentLabels.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2"><Mono>{r.id}</Mono></td>
                  <td className="px-3 py-2 text-xs">{r.person}</td>
                  <td className={cn("px-3 py-2 text-xs font-medium", r.label === "correct" ? "text-success" : "text-destructive")}>{r.label}</td>
                  <td className="px-3 py-2 text-xs">{r.source}</td>
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground">{timeAgo(r.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "success" | "info" | "warning" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-mono text-2xl font-semibold tabular-nums",
        tone === "success" && "text-success", tone === "info" && "text-info", tone === "warning" && "text-warning-foreground")}>
        {value}
      </div>
    </div>
  );
}
