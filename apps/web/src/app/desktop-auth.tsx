import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { desktopAuthRequestSearchSchema } from "~/features/auth/lib/desktop-auth-contracts";
import {
  authorizeDesktopAuth,
  createDesktopDeepLink,
} from "~/features/auth/lib/desktop-handoff";

export const Route = createFileRoute("/desktop-auth")({
  component: DesktopAuth,
  validateSearch: desktopAuthRequestSearchSchema,
  beforeLoad: ({ context, search }) => {
    if (context.isAuthenticated) return;
    throw redirect({
      to: "/login",
      search: {
        redirect_uri: `/desktop-auth?request_id=${encodeURIComponent(search.request_id)}`,
      },
    });
  },
});

function DesktopAuth() {
  const requestId = Route.useSearch({
    select: (search) => search.request_id,
  });
  const [status, setStatus] = useState<"authorizing" | "error" | "ready">(
    "ready",
  );

  async function authorize() {
    if (status !== "ready") return;
    setStatus("authorizing");
    try {
      const authorizationCode = await authorizeDesktopAuth(requestId);
      window.location.assign(
        createDesktopDeepLink(requestId, authorizationCode),
      );
    } catch {
      setStatus("error");
    }
  }

  return <DesktopAuthStatus authorize={authorize} status={status} />;
}

function DesktopAuthStatus({
  authorize,
  status,
}: {
  authorize: () => Promise<void>;
  status: "authorizing" | "error" | "ready";
}) {
  if (status === "error") {
    return (
      <AuthPage
        detail="This request has expired. Return to Rodge Mail and start again."
        title="Could not finish sign-in"
      />
    );
  }
  if (status === "ready") {
    return (
      <AuthPage
        action={{ label: "Continue", onClick: authorize }}
        detail="Continue only if you started this sign-in in the Rodge Mail desktop app."
        title="Sign in to Rodge Mail?"
      />
    );
  }
  return (
    <AuthPage
      detail="Rodge Mail will reopen when this is done."
      title="Finishing sign-in"
    />
  );
}

function AuthPage({
  action,
  detail,
  title,
}: {
  action?: { label: string; onClick: () => Promise<void> };
  detail: string;
  title: string;
}) {
  return (
    <main className="mail-atmosphere bg-background flex min-h-dvh items-center justify-center px-5 py-10">
      <section className="mail-workspace w-full max-w-sm rounded-[18px] border p-8 text-center">
        <p className="font-serif text-xl font-semibold tracking-[-0.03em]">
          Rodge Mail
        </p>
        <h1 className="mt-8 font-serif text-2xl font-semibold tracking-[-0.03em]">
          {title}
        </h1>
        <p className="mail-label mt-3 text-sm leading-6">{detail}</p>
        <DesktopAuthAction action={action} />
      </section>
    </main>
  );
}

function DesktopAuthAction({
  action,
}: {
  action: { label: string; onClick: () => Promise<void> } | undefined;
}) {
  if (!action) return null;
  return (
    <button
      className="mail-brass-button mt-6 flex h-12 w-full items-center justify-center rounded-[10px] px-5 text-sm font-bold"
      onClick={() => void action.onClick()}
      type="button"
    >
      {action.label}
    </button>
  );
}
