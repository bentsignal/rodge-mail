import { createFileRoute } from "@tanstack/react-router";

import { ArchivePage } from "~/features/mail/components/archive-page";

export const Route = createFileRoute("/_authed/archive")({
  component: ArchivePage,
});
