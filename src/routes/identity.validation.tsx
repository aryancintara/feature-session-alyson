import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/identity/validation")({
  head: () => ({ meta: [
    { title: "Identity Validation — Alyson CDP" },
    { name: "description", content: "Explore identity validation in Alyson CDP." },
    { property: "og:title", content: "Identity Validation — Alyson CDP" },
    { property: "og:description", content: "Explore identity validation in Alyson CDP." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/identity/errors" });
  },
  component: () => null,
});
