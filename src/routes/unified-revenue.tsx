import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/unified-revenue")({
  component: () => <Outlet />,
});
