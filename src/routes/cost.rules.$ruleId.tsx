import { createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { RuleDetailError, RuleDetailPage } from "@/components/cost-revenue/RuleDetailPage";

export const Route = createFileRoute("/cost/rules/$ruleId")({
  validateSearch: (s: Record<string, unknown>): { v?: number } => ({ v: s.v !== undefined && !isNaN(Number(s.v)) ? Number(s.v) : undefined }),
  head: () => ({
    meta: [
      { title: "Cost Rule · Alyson CDP" },
      { name: "description", content: "How this rule calculates Cost, and its versions." },
      { property: "og:title", content: "Cost Rule · Alyson CDP" },
      { property: "og:description", content: "How this rule calculates Cost, and its versions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CostRuleDetail,
  errorComponent: (props: ErrorComponentProps) => <RuleDetailError {...props} rulesTo="/cost/rules" />,
});

function CostRuleDetail() {
  const { ruleId } = Route.useParams();
  const { v } = Route.useSearch();
  return <RuleDetailPage ruleId={ruleId} version={v} ruleType="COST" rulesTo="/cost/rules" />;
}
