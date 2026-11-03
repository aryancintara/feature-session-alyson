import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/revenue")({
  component: () => <div className="mx-auto w-full max-w-[1440px]"><Outlet /></div>,
});
