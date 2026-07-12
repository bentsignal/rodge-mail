import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/archive")({
  component: ArchiveRoute,
});

function ArchiveRoute() {
  return null;
}
