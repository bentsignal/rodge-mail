import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/sent")({
  component: SentRoute,
});

function SentRoute() {
  return <Outlet />;
}
