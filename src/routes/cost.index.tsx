import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cost/")({
  beforeLoad: () => { throw redirect({ to: "/cost/rules" }); },
});
