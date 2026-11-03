import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cost-revenue/rules/$ruleId")({
  validateSearch: (s: Record<string, unknown>): { v?: number } => ({ v: s.v !== undefined && !isNaN(Number(s.v)) ? Number(s.v) : undefined }),
  beforeLoad: ({ params, search }) => {
    throw redirect({ to: "/revenue/rules/$ruleId", params: { ruleId: params.ruleId }, search });
  },
});
