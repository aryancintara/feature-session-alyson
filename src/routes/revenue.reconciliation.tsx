import { createFileRoute } from "@tanstack/react-router";
import { Reconciliation } from "./cost-revenue.reconciliation";

export const Route = createFileRoute("/revenue/reconciliation")({
  head: () => ({ meta: [
    { title: "Revenue Reconciliation · Alyson CDP" },
    { name: "description", content: "Check source revenue against loaded revenue for completed days, weeks and months." },
    { property: "og:title", content: "Revenue Reconciliation · Alyson CDP" },
    { property: "og:description", content: "Compare source and loaded totals and identify missing revenue leads for past periods." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Reconciliation,
});
