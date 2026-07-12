import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

import {
  createProviderCompletionDeepLink,
  providerCompletionSearchSchema,
} from "~/features/mail/provider-completion";

export const Route = createFileRoute("/provider-complete")({
  validateSearch: providerCompletionSearchSchema,
  component: ProviderComplete,
});

function ProviderComplete() {
  const search = Route.useSearch({
    select: (value) => value,
  });
  const destination = createProviderCompletionDeepLink(search);

  // eslint-disable-next-line no-restricted-syntax -- The OAuth completion page must hand control from the system browser back to the native app.
  useEffect(() => {
    window.location.replace(destination);
  }, [destination]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <h1 className="font-serif text-2xl font-semibold">
          Return to Rodge Mail
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Your account authorization is complete.
        </p>
        <a
          className="mail-brass-button mt-5 inline-flex min-h-11 items-center rounded-lg px-5 text-sm font-bold"
          href={destination}
        >
          Open Rodge Mail
        </a>
      </div>
    </main>
  );
}
