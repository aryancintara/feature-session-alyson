import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cost-revenue/")({
  beforeLoad: () => { throw redirect({ to: "/revenue/rules" }); },
});
