import { useEffect, useRef, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { authorizeCliAuth } from "~/features/auth/lib/cli-auth";
import {
  cliAuthRequestSearchSchema,
  createCliAuthCallbackUrl,
} from "~/features/auth/lib/cli-auth-contracts";
import { consumeCliAuthAfterSignIn } from "~/features/auth/lib/cli-auto-authorize";

type CliAuthStatus =
  | { kind: "authorized"; callbackUrl: string }
  | { kind: "authorizing" | "error" | "ready" };

export const Route = createFileRoute("/desktop-auth")({
  component: CliAuth,
  validateSearch: cliAuthRequestSearchSchema,
  beforeLoad: ({ context, search }) => {
    if (context.isAuthenticated) return;
    throw redirect({
      to: "/login",
      search: {
        redirect_uri: createCliAuthRedirectUrl(search),
      },
    });
  },
});

function CliAuth() {
  const { callbackUrl, requestId } = Route.useSearch({
    select: (search) => ({
      callbackUrl: search.callback_url,
      requestId: search.request_id,
    }),
  });
  const [autoAuthorize] = useState(() =>
    consumeCliAuthAfterSignIn({
      requestId,
      storage: sessionStorage,
    }),
  );
  const [status, setStatus] = useState<CliAuthStatus>({
    kind: autoAuthorize ? "authorizing" : "ready",
  });
  const authorization = useRef<Promise<CliAuthStatus>>(undefined);

  // This resumes the CLI request only after the user explicitly completed its browser sign-in.
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

  return <CliAuthStatus authorize={authorize} status={status} />;
}

async function finishAuthorization(callbackUrl: string, requestId: string) {
  try {
    const authorizationCode = await authorizeCliAuth(requestId);
    const destination = createCliAuthCallbackUrl(
      callbackUrl,
      requestId,
      authorizationCode,
    );
    window.location.assign(destination);
    return { callbackUrl: destination, kind: "authorized" } as const;
  } catch {
    return { kind: "error" } as const;
  }
}

function createCliAuthRedirectUrl(search: {
  callback_url: string;
  request_id: string;
}) {
  const parameters = new URLSearchParams({
    request_id: search.request_id,
    callback_url: search.callback_url,
  });
  return `/desktop-auth?${parameters.toString()}`;
}

function CliAuthStatus({
  authorize,
  status,
}: {
  authorize: () => Promise<void>;
  status: CliAuthStatus;
}) {
  if (status.kind === "error") {
    return (
      <AuthPage
        detail="This request has expired. Start sign-in again from your terminal."
        title="Could not finish sign-in"
      />
    );
  }
  if (status.kind === "ready") {
    return (
      <AuthPage
        action={{ label: "Continue", onClick: authorize }}
        detail="Continue only if you started this sign-in from the Rodge Mail CLI."
        title="Sign in to Rodge Mail?"
      />
    );
  }
  if (status.kind === "authorized") {
    return (
      <AuthPage
        action={{
          label: "Retry",
          onClick: () => {
            window.location.assign(status.callbackUrl);
            return Promise.resolve();
          },
        }}
        detail="If your terminal did not finish signing in, retry the handoff."
        title="Return to your terminal"
      />
    );
  }
  return (
    <AuthPage
      detail="Return to your terminal when this is done."
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
        <CliAuthAction action={action} />
      </section>
    </main>
  );
}

function CliAuthAction({
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
