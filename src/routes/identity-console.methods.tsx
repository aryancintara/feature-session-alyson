import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { IDENTITY_METHOD_CATALOG, IDENTITY_POLICIES, timeAgo, type IdentityMethod } from "@/lib/mockData";
import { PageHeader, Mono } from "@/components/ui-bits";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/identity-console/methods")({
  head: () => ({ meta: [
    { title: "Identity Console Methods — Alyson CDP" },
    { name: "description", content: "Explore identity console methods in Alyson CDP." },
    { property: "og:title", content: "Identity Console Methods — Alyson CDP" },
    { property: "og:description", content: "Explore identity console methods in Alyson CDP." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: MethodsPage,
});

const CATEGORY_TONE: Record<IdentityMethod["category"], string> = {
  deterministic: "border-success/30 bg-success/10 text-success",
  probabilistic: "border-info/20 bg-info/10 text-info",
  partner: "border-primary/30 bg-primary/10 text-primary",
  graph: "border-warning/30 bg-warning/15 text-warning-foreground",
};

function MethodsPage() {
  const [methods, setMethods] = useState(IDENTITY_METHOD_CATALOG);

  const toggle = (id: string) => {
    setMethods(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
    const m = methods.find(x => x.id === id);
    toast.success(`${m?.name} ${m?.enabled ? "disabled" : "enabled"}`);
  };

  const setThreshold = (id: string, v: number) => {
    setMethods(prev => prev.map(m => m.id === id ? { ...m, threshold: v } : m));
  };

  return (
    <div className="pb-6">
      <PageHeader
        title="Methods & Policies"
        subtitle="Deterministic, probabilistic, partner, and graph-based identity methods — plus governing policies."
      />
      <div className="px-6">
        <Tabs defaultValue="methods">
          <TabsList>
            <TabsTrigger value="methods">Methods ({methods.length})</TabsTrigger>
            <TabsTrigger value="policies">Policies ({IDENTITY_POLICIES.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="methods">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {methods.map(m => (
                <div key={m.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{m.name}</h3>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium", CATEGORY_TONE[m.category])}>
                          {m.category}
                        </span>
                        <Mono>{m.version}</Mono>
                      </div>
                    </div>
                    <Switch checked={m.enabled} onCheckedChange={() => toggle(m.id)} />
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">{m.docs}</p>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <Stat label="Precision" value={`${m.precision}%`} />
                    <Stat label="Recall" value={`${m.recall}%`} />
                    <Stat label="Usage 24h" value={m.usage24h.toLocaleString()} />
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Threshold</span>
                      <span className="font-mono">{m.threshold}</span>
                    </div>
                    <Slider
                      value={[m.threshold]}
                      onValueChange={([v]) => setThreshold(m.id, v)}
                      max={100}
                      step={1}
                      disabled={!m.enabled}
                    />
                  </div>

                  <button
                    onClick={() => toast("Backtest queued", { description: `Testing ${m.name} on last 24h events` })}
                    className="mt-3 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    Test on last 24h events
                  </button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="policies">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {IDENTITY_POLICIES.map(p => (
                <div key={p.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">{p.name}</h3>
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase">{p.domain}</span>
                        <Mono>{p.version}</Mono>
                        <span className="text-muted-foreground">updated {timeAgo(p.updated)}</span>
                      </div>
                    </div>
                    <Switch checked={p.enabled} />
                  </div>
                  <ul className="mt-3 space-y-1.5 text-xs">
                    {p.rules.map((r, i) => (
                      <li key={i} className="flex gap-2 rounded-md border border-border bg-background px-2 py-1.5">
                        <span className="font-mono text-muted-foreground">{i + 1}.</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-xs font-semibold">{value}</div>
    </div>
  );
}
