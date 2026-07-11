import { useLayoutEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { useMailStore } from "~/features/mail/store";

export const Route = createFileRoute("/_authed/")({
  component: MailPage,
});

function MailPage() {
  const closeMobileReader = useMailStore((store) => store.closeMobileReader);

  useLayoutEffect(() => closeMobileReader(), [closeMobileReader]);
  return null;
}
