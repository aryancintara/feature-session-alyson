import { createFileRoute } from "@tanstack/react-router";
import { RulesTablePage } from "@/components/cost-revenue/RulesTablePage";

export const Route = createFileRoute("/revenue/rules/")({
  head: () => ({
    meta: [
      { title: "Revenue Rules · Alyson CDP" },
      { name: "description", content: "Define how Revenue amounts are calculated." },
      { property: "og:title", content: "Revenue Rules · Alyson CDP" },
      { property: "og:description", content: "Define how Revenue amounts are calculated." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <RulesTablePage ruleType="REVENUE" />,
});
