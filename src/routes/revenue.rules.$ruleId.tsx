import { createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { RuleDetailError, RuleDetailPage } from "@/components/cost-revenue/RuleDetailPage";

export const Route = createFileRoute("/revenue/rules/$ruleId")({
  validateSearch: (s: Record<string, unknown>): { v?: number } => ({ v: s.v !== undefined && !isNaN(Number(s.v)) ? Number(s.v) : undefined }),
  head: () => ({
    meta: [
      { title: "Revenue Rule · Alyson CDP" },
      { name: "description", content: "How this rule calculates Revenue, and its versions." },
      { property: "og:title", content: "Revenue Rule · Alyson CDP" },
      { property: "og:description", content: "How this rule calculates Revenue, and its versions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RevenueRuleDetail,
  errorComponent: (props: ErrorComponentProps) => <RuleDetailError {...props} rulesTo="/revenue/rules" />,
});

function RevenueRuleDetail() {
  const { ruleId } = Route.useParams();
  const { v } = Route.useSearch();
  return <RuleDetailPage ruleId={ruleId} version={v} ruleType="REVENUE" rulesTo="/revenue/rules" />;
}
