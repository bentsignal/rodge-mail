import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/spam")({
  component: SpamRoute,
});

function SpamRoute() {
  return <Outlet />;
}
