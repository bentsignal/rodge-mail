import { useEffect, useRef, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";

import {
  createDesktopAuthCallbackUrl,
  desktopAuthRequestSearchSchema,
} from "~/features/auth/lib/desktop-auth-contracts";
import { consumeDesktopAuthAfterSignIn } from "~/features/auth/lib/desktop-auto-authorize";
import {
  authorizeDesktopAuth,
  createDesktopDeepLink,
} from "~/features/auth/lib/desktop-handoff";

type DesktopAuthStatus =
  | { kind: "authorized"; deepLink: string }
  | { kind: "authorizing" | "error" | "ready" };

export const Route = createFileRoute("/desktop-auth")({
  component: DesktopAuth,
  validateSearch: desktopAuthRequestSearchSchema,
  beforeLoad: ({ context, search }) => {
    if (context.isAuthenticated) return;
    throw redirect({
      to: "/login",
      search: {
        redirect_uri: createDesktopAuthRedirectUrl(search),
      },
    });
  },
});

function DesktopAuth() {
  const { callbackUrl, requestId } = Route.useSearch({
    select: (search) => ({
      callbackUrl: search.callback_url,
      requestId: search.request_id,
    }),
  });
  const [autoAuthorize] = useState(() =>
    consumeDesktopAuthAfterSignIn({
      requestId,
      storage: sessionStorage,
    }),
  );
  const [status, setStatus] = useState<DesktopAuthStatus>({
    kind: autoAuthorize ? "authorizing" : "ready",
  });
  const authorization = useRef<Promise<DesktopAuthStatus>>(undefined);

  // This resumes the desktop request only after the user explicitly completed its browser sign-in.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (!autoAuthorize) return;
    let active = true;
    authorization.current ??= finishAuthorization(callbackUrl, requestId);
    void authorization.current.then((nextStatus) => {
      if (active) setStatus(nextStatus);
    });
    return () => {
      active = false;
    };
  }, [autoAuthorize, callbackUrl, requestId]);

  async function authorize() {
    if (status.kind !== "ready") return;
    setStatus({ kind: "authorizing" });
    authorization.current ??= finishAuthorization(callbackUrl, requestId);
    setStatus(await authorization.current);
  }

  return <DesktopAuthStatus authorize={authorize} status={status} />;
}

async function finishAuthorization(
  callbackUrl: string | undefined,
  requestId: string,
) {
  try {
    const authorizationCode = await authorizeDesktopAuth(requestId);
    const destination = callbackUrl
      ? createDesktopAuthCallbackUrl(callbackUrl, requestId, authorizationCode)
      : createDesktopDeepLink(requestId, authorizationCode);
    window.location.assign(destination);
    return { deepLink: destination, kind: "authorized" } as const;
  } catch {
    return { kind: "error" } as const;
  }
}

function createDesktopAuthRedirectUrl(search: {
  callback_url?: string;
  request_id: string;
}) {
  const parameters = new URLSearchParams({ request_id: search.request_id });
  if (search.callback_url) {
    parameters.set("callback_url", search.callback_url);
  }
  return `/desktop-auth?${parameters.toString()}`;
}

function DesktopAuthStatus({
  authorize,
  status,
}: {
  authorize: () => Promise<void>;
  status: DesktopAuthStatus;
}) {
  if (status.kind === "error") {
    return (
      <AuthPage
        detail="This request has expired. Return to Rodge Mail and start again."
        title="Could not finish sign-in"
      />
    );
  }
  if (status.kind === "ready") {
    return (
      <AuthPage
        action={{ label: "Continue", onClick: authorize }}
        detail="Continue only if you started this sign-in from a Rodge Mail app or command."
        title="Sign in to Rodge Mail?"
      />
    );
  }
  if (status.kind === "authorized") {
    return (
      <AuthPage
        action={{
          label: "Open Rodge Mail",
          onClick: () => {
            window.location.assign(status.deepLink);
            return Promise.resolve();
          },
        }}
        detail="If Rodge Mail did not reopen automatically, open it now to finish the secure exchange."
        title="Return to Rodge Mail"
      />
    );
  }
  return (
    <AuthPage
      detail="Return to the app or terminal when this is done."
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
