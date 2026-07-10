import { createFileRoute } from "@tanstack/react-router";

import { MailShell } from "~/features/mail/components/mail-shell";

export const Route = createFileRoute("/_authed/")({
  component: MailPage,
});

function MailPage() {
  return <MailShell />;
}
