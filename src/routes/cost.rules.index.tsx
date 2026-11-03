import { createFileRoute } from "@tanstack/react-router";
import { RulesTablePage } from "@/components/cost-revenue/RulesTablePage";

export const Route = createFileRoute("/cost/rules/")({
  head: () => ({
    meta: [
      { title: "Cost Rules · Alyson CDP" },
      { name: "description", content: "Define how Cost amounts are calculated." },
      { property: "og:title", content: "Cost Rules · Alyson CDP" },
      { property: "og:description", content: "Define how Cost amounts are calculated." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <RulesTablePage ruleType="COST" />,
});
