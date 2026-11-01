/**
 * The Data pages still on Coming Soon (Leads, Revenue, Cost).
 * Sessions is a real feature at `src/features/sessions/`.
 * Nav entries come from the workspace context (catalog keys `data_leads`,
 * `data_revenue`, `data_cost`, `data_sessions`, menu keys `data-<slug>`).
 */
export const DATA_PLACEHOLDER_PAGES = [
  { slug: "leads", title: "Leads" },
  { slug: "revenue", title: "Revenue" },
  { slug: "cost", title: "Cost" },
] as const;

export type DataPlaceholderSlug =
  (typeof DATA_PLACEHOLDER_PAGES)[number]["slug"];

export const DATA_PLACEHOLDER_BASE_PATH = "/dashboard/data";
