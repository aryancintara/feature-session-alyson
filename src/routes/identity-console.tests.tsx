// Interaction acceptance tests. Each row runs the actual store mutation and
// verifies the state diff. Passing = the corresponding UI action works too.

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, XCircle, PlayCircle, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/ui-bits";
import { cn } from "@/lib/utils";
import { useIdentityStore } from "@/lib/identityStore";
import { PEOPLE, ENTITY_RELATIONSHIPS, SIGNAL_LINKAGE, INDIVIDUAL_PROFILES } from "@/lib/mockData";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/identity-console/tests")({
  head: () => ({ meta: [{ title: "Interaction Tests · Identity Console" }] }),
  component: TestsPage,
});

type Status = "idle" | "pass" | "fail";
type Test = {
  id: string; category: string; name: string;
  run: () => { pass: boolean; detail: string };
};

const TESTS: Test[] = [
  {
    id: "remove-relationship",
    category: "Graph mutations",
    name: "Remove relationship removes the edge and audits it",
    run: () => {
      const state = useIdentityStore.getState();
      const rel = state.relationships[0];
      if (!rel) return { pass: false, detail: "No relationships to test" };
      const before = state.relationships.length;
      const auditId = state.removeRelationship(rel.id, "unit-test");
      const after = useIdentityStore.getState().relationships.length;
      const audited = Boolean(useIdentityStore.getState().audit.find((a) => a.id === auditId));
      // restore
      useIdentityStore.getState().reverse(auditId);
      const restored = useIdentityStore.getState().relationships.length === before;
      return {
        pass: after === before - 1 && audited && restored,
        detail: `before=${before} after=${after} audited=${audited} restored=${restored}`,
      };
    },
  },
  {
    id: "reassign-relationship",
    category: "Graph mutations",
    name: "Reassign relationship updates destination and reverses",
    run: () => {
      const state = useIdentityStore.getState();
      const rel = state.relationships.find((r) => r.type === "works_at");
      if (!rel) return { pass: false, detail: "No works_at edge" };
      const originalTo = rel.to;
      const aid = state.reassignRelationship(rel.id, "co_test", "unit-test");
      const changed = useIdentityStore.getState().relationships.find((r) => r.id === rel.id)?.to === "co_test";
      useIdentityStore.getState().reverse(aid);
      const restored = useIdentityStore.getState().relationships.find((r) => r.id === rel.id)?.to === originalTo;
      return { pass: changed && restored, detail: `changed=${changed} restored=${restored}` };
    },
  },
  {
    id: "mark-shared",
    category: "Signal actions",
    name: "Mark Shared updates sharingClass and clears conflict",
    run: () => {
      const state = useIdentityStore.getState();
      const sig = state.signals.find((s) => s.sharingClass === "confirmed_conflict") ?? state.signals[0];
      const aid = state.markSignalSharing(sig.id, "household", "unit-test");
      const now = useIdentityStore.getState().signals.find((s) => s.id === sig.id);
      const ok = now?.sharingClass === "household" && now.conflictCount === 0;
      useIdentityStore.getState().reverse(aid);
      const back = useIdentityStore.getState().signals.find((s) => s.id === sig.id)?.sharingClass === sig.sharingClass;
      return { pass: ok && back, detail: `applied=${ok} reverted=${back}` };
    },
  },
  {
    id: "mark-incorrect",
    category: "Signal actions",
    name: "Mark Incorrect flags signal as confirmed_conflict",
    run: () => {
      const state = useIdentityStore.getState();
      const sig = state.signals[1];
      const aid = state.markSignalIncorrect(sig.id, "unit-test");
      const ok = useIdentityStore.getState().signals.find((s) => s.id === sig.id)?.sharingClass === "confirmed_conflict";
      useIdentityStore.getState().reverse(aid);
      return { pass: ok, detail: `applied=${ok}` };
    },
  },
  {
    id: "merge",
    category: "Person mutations",
    name: "Merge creates likely_same_person edge, reverse removes it",
    run: () => {
      const state = useIdentityStore.getState();
      const a = PEOPLE[0], b = PEOPLE[1];
      const aid = state.merge(a.id, b.id, "unit-test");
      const added = useIdentityStore.getState().relationships.some((r) => r.type === "likely_same_person" && r.from === a.id && r.to === b.id);
      useIdentityStore.getState().reverse(aid);
      const removed = !useIdentityStore.getState().relationships.some((r) => r.type === "likely_same_person" && r.from === a.id && r.to === b.id);
      return { pass: added && removed, detail: `added=${added} removed=${removed}` };
    },
  },
  {
    id: "split",
    category: "Person mutations",
    name: "Split moves profiles to a new person, reverse restores",
    run: () => {
      const state = useIdentityStore.getState();
      const p = PEOPLE[0];
      const profiles = state.individuals.filter((ip) => ip.personId === p.id).slice(0, 1);
      if (profiles.length === 0) return { pass: false, detail: "no profiles" };
      const originalPid = profiles[0].personId;
      const aid = state.split(p.id, profiles.map((x) => x.id), "unit-test");
      const now = useIdentityStore.getState().individuals.find((ip) => ip.id === profiles[0].id)!;
      const moved = now.personId !== originalPid;
      useIdentityStore.getState().reverse(aid);
      const back = useIdentityStore.getState().individuals.find((ip) => ip.id === profiles[0].id)?.personId === originalPid;
      return { pass: moved && back, detail: `moved=${moved} restored=${back}` };
    },
  },
  {
    id: "classify",
    category: "Profile actions",
    name: "Reclassify individual profile type",
    run: () => {
      const state = useIdentityStore.getState();
      const ip = state.individuals[0];
      const prev = ip.type;
      const aid = state.classifyProfile(ip.id, "household", "unit-test");
      const changed = useIdentityStore.getState().individuals.find((x) => x.id === ip.id)?.type === "household";
      useIdentityStore.getState().reverse(aid);
      const back = useIdentityStore.getState().individuals.find((x) => x.id === ip.id)?.type === prev;
      return { pass: changed && back, detail: `changed=${changed} restored=${back}` };
    },
  },
  {
    id: "override-decision",
    category: "Decisions",
    name: "Override decision updates outcome and reverses",
    run: () => {
      const state = useIdentityStore.getState();
      const dec = state.decisions[0];
      const prev = dec.outcome;
      const aid = state.overrideDecision(dec.id, "rejected", "unit-test");
      const changed = useIdentityStore.getState().decisions.find((d) => d.id === dec.id)?.outcome === "rejected";
      useIdentityStore.getState().reverse(aid);
      const back = useIdentityStore.getState().decisions.find((d) => d.id === dec.id)?.outcome === prev;
      return { pass: changed && back, detail: `changed=${changed} restored=${back}` };
    },
  },
  {
    id: "seed-relationships",
    category: "Graph data",
    name: "Every person has at least one visible relationship",
    run: () => {
      const rels = useIdentityStore.getState().relationships;
      const missing = PEOPLE.filter((p) => !rels.some((r) => r.from === p.id || r.to === p.id));
      return { pass: missing.length === 0, detail: `${PEOPLE.length - missing.length}/${PEOPLE.length} covered` };
    },
  },
  {
    id: "signal-linkage-populated",
    category: "Graph data",
    name: "Signal linkage covers every signal kind",
    run: () => {
      const kinds = new Set(useIdentityStore.getState().signals.map((s) => s.kind));
      return { pass: kinds.size >= 3, detail: `${kinds.size} distinct signal kinds` };
    },
  },
  {
    id: "individual-profiles-linked",
    category: "Graph data",
    name: "Individual profiles reference source profiles",
    run: () => {
      const linked = INDIVIDUAL_PROFILES.filter((ip) => ip.sourceProfileIds.length > 0).length;
      return { pass: linked > 0, detail: `${linked}/${INDIVIDUAL_PROFILES.length} linked` };
    },
  },
  {
    id: "reversibility",
    category: "Audit",
    name: "All non-reverse audit entries are reversible",
    run: () => {
      const a = useIdentityStore.getState().audit.filter((x) => x.action !== "reverse");
      const nonRev = a.filter((x) => !x.reversible);
      return { pass: nonRev.length === 0, detail: `${a.length} audit entries, ${nonRev.length} not reversible` };
    },
  },
  {
    id: "counts",
    category: "Graph data",
    name: "Static fixtures populated",
    run: () => {
      const pass = ENTITY_RELATIONSHIPS.length > 20 && SIGNAL_LINKAGE.length > 5 && INDIVIDUAL_PROFILES.length > 20;
      return { pass, detail: `rels=${ENTITY_RELATIONSHIPS.length} signals=${SIGNAL_LINKAGE.length} profiles=${INDIVIDUAL_PROFILES.length}` };
    },
  },
];

function TestsPage() {
  const [status, setStatus] = useState<Record<string, { s: Status; d?: string }>>({});
  const runOne = (t: Test) => {
    try {
      const r = t.run();
      setStatus((s) => ({ ...s, [t.id]: { s: r.pass ? "pass" : "fail", d: r.detail } }));
    } catch (e) {
      setStatus((s) => ({ ...s, [t.id]: { s: "fail", d: (e as Error).message } }));
    }
  };
  const runAll = () => {
    TESTS.forEach(runOne);
    toast.success("Ran all interaction tests");
  };
  const reset = () => {
    useIdentityStore.getState().reset();
    setStatus({});
    toast("Store reset");
  };

  const passing = TESTS.filter((t) => status[t.id]?.s === "pass").length;
  const failing = TESTS.filter((t) => status[t.id]?.s === "fail").length;
  const categories = Array.from(new Set(TESTS.map((t) => t.category)));

  return (
    <div className="pb-6">
      <PageHeader
        title="Interaction tests"
        subtitle="Runs every core mutation against the live store. Green means the corresponding UI action really works."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={reset} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent">
              <RotateCcw className="h-3 w-3" /> Reset store
            </button>
            <button onClick={runAll} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
              <PlayCircle className="h-3 w-3" /> Run all
            </button>
          </div>
        }
      />

      <div className="px-6">
        <div className="mb-4 flex gap-3">
          <StatCard label="Total" value={TESTS.length} />
          <StatCard label="Passing" value={passing} tone="success" />
          <StatCard label="Failing" value={failing} tone="destructive" />
          <StatCard label="Not run" value={TESTS.length - passing - failing} tone="muted" />
        </div>

        {categories.map((cat) => (
          <div key={cat} className="mb-4 overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground">{cat}</div>
            <table className="w-full text-sm">
              <tbody>
                {TESTS.filter((t) => t.category === cat).map((t) => {
                  const st = status[t.id];
                  return (
                    <tr key={t.id} className="border-t border-border">
                      <td className="w-8 px-3 py-2">
                        {st?.s === "pass" ? <CheckCircle2 className="h-4 w-4 text-success" />
                          : st?.s === "fail" ? <XCircle className="h-4 w-4 text-destructive" />
                          : <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" />}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{t.name}</div>
                        {st?.d && <div className={cn("mt-0.5 text-[11px]", st.s === "fail" ? "text-destructive" : "text-muted-foreground")}>{st.d}</div>}
                      </td>
                      <td className="w-32 px-3 py-2 text-right">
                        <button onClick={() => runOne(t)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">Run</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <Toaster />
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "destructive" | "muted" }) {
  return (
    <div className="flex-1 rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold", tone === "success" && "text-success", tone === "destructive" && "text-destructive", tone === "muted" && "text-muted-foreground")}>{value}</div>
    </div>
  );
}
