import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { useAuthStore } from "~/features/auth/store";

export const Route = createFileRoute("/auth/desktop-complete")({
  component: DesktopAuthComplete,
  validateSearch: z.object({
    authorization_code: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
    request_id: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
  }),
});

function DesktopAuthComplete() {
  const { authorizationCode, requestId } = Route.useSearch({
    select: (search) => ({
      authorizationCode: search.authorization_code,
      requestId: search.request_id,
    }),
  });
  const [failed, setFailed] = useState(false);
  const finishDesktopSignIn = useAuthStore(
    (store) => store.finishDesktopSignIn,
  );
  const exchangePromise = useRef<
    ReturnType<typeof finishDesktopSignIn> | undefined
  >(undefined);

  // Exchanging the browser-approved request is the external synchronization performed by this callback route.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    let active = true;
    exchangePromise.current ??= finishDesktopSignIn(
      requestId,
      authorizationCode,
    );
    void exchangePromise.current.then((completed) => {
      if (active && !completed) setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [authorizationCode, finishDesktopSignIn, requestId]);

  return <DesktopCallbackStatus failed={failed} />;
}

function DesktopCallbackStatus({ failed }: { failed: boolean }) {
  if (failed) return <DesktopCallbackFailure />;
  return <DesktopCallbackProgress />;
}

function DesktopCallbackFailure() {
  return (
    <main className="mail-atmosphere bg-background flex min-h-dvh items-center justify-center px-5 py-10">
      <section className="border-border/80 bg-card/88 w-full max-w-sm rounded-[24px] border p-8 text-center shadow-[0_28px_90px_rgba(48,38,24,0.14)] backdrop-blur-xl">
        <p className="font-serif text-xl font-semibold tracking-[-0.03em]">
          Rodge Mail
        </p>
        <h1 className="mt-8 font-serif text-2xl font-semibold tracking-[-0.03em]">
          Sign-in expired
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#81776c] dark:text-[#aaa095]">
          Return to sign in and try again.
        </p>
        <a
          className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-[#20251f] px-5 text-sm font-semibold text-[#f8f1e6]"
          href="/login"
        >
          Try again
        </a>
      </section>
    </main>
  );
}

function DesktopCallbackProgress() {
  return (
    <main className="mail-atmosphere bg-background flex min-h-dvh items-center justify-center px-5 py-10">
      <section className="border-border/80 bg-card/88 w-full max-w-sm rounded-[24px] border p-8 text-center shadow-[0_28px_90px_rgba(48,38,24,0.14)] backdrop-blur-xl">
        <p className="font-serif text-xl font-semibold tracking-[-0.03em]">
          Rodge Mail
        </p>
        <h1 className="mt-8 font-serif text-2xl font-semibold tracking-[-0.03em]">
          Opening your mail
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#81776c] dark:text-[#aaa095]">
          This will only take a moment.
        </p>
      </section>
    </main>
  );
}
