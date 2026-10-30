import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SEED_RULES, type RevenueRule, type RuleStatus } from "@/lib/revenueRulesData";

interface RulesState {
  custom: RevenueRule[];
  statusOverrides: Record<string, { status: RuleStatus; updated: string; versions: RevenueRule["versions"] }>;
  addRule: (r: RevenueRule) => void;
  setStatus: (id: string, status: RuleStatus) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export const useRulesStore = create<RulesState>()(
  persist(
    (set, get) => ({
      custom: [],
      statusOverrides: {},
      addRule: (r) => set((s) => ({ custom: [r, ...s.custom] })),
      setStatus: (id, status) => {
        const rule = get().custom.find((r) => r.id === id) ?? applyOverride(SEED_RULES.find((r) => r.id === id), get().statusOverrides);
        if (!rule) return;
        // Never overwrite history: activation marks the current version Active, older ones Archived.
        const versions = rule.versions.map((v, i) => ({ ...v, status: i === 0 ? (status === "Active" ? "Active" : status === "Archived" ? "Archived" : v.status) : "Archived" } as typeof v));
        if (rule.custom) set((s) => ({ custom: s.custom.map((r) => (r.id === id ? { ...r, status, updated: today(), versions } : r)) }));
        else set((s) => ({ statusOverrides: { ...s.statusOverrides, [id]: { status, updated: today(), versions } } }));
      },
    }),
    { name: "revenue-rules:v1", skipHydration: true },
  ),
);

function applyOverride(r: RevenueRule | undefined, o: RulesState["statusOverrides"]) {
  if (!r) return r;
  const x = o[r.id];
  return x ? { ...r, ...x } : r;
}

export function useAllRules(): RevenueRule[] {
  useEffect(() => { void useRulesStore.persist.rehydrate(); }, []);
  const custom = useRulesStore((s) => s.custom);
  const o = useRulesStore((s) => s.statusOverrides);
  return [...custom, ...SEED_RULES.map((r) => applyOverride(r, o)!)];
}
