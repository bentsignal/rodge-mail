import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { RecoveryForm } from "~/features/auth/components/recovery-form";
import { RegistrationForm } from "~/features/auth/components/registration-form";
import { SignInButton } from "~/features/auth/components/sign-in-button";
import { useAuthStore } from "~/features/auth/store";

export const Route = createFileRoute("/login")({
  component: Login,
  validateSearch: z.object({
    redirect_uri: z.string().optional(),
  }),
  beforeLoad: ({ context }) => {
    if (context.isAuthenticated) throw redirect({ to: "/" });
  },
});

function Login() {
  const [view, setView] = useState<"recover" | "register" | "sign-in">(
    "sign-in",
  );
  const imLoggedIn = useAuthStore((store) => store.imSignedIn);
  if (imLoggedIn) return null;

  return (
    <main className="mail-atmosphere bg-background relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-10">
      <section className="mail-auth-frame relative z-10 w-full max-w-[420px] rounded-[24px] border p-2.5">
        <div className="mail-auth-paper rounded-[16px] border px-7 py-8 sm:px-9 sm:py-9">
          <LoginBrand />
          <LoginContent
            onCancel={() => setView("sign-in")}
            onCreateAccount={() => setView("register")}
            onRecover={() => setView("recover")}
            view={view}
          />
        </div>
      </section>
    </main>
  );
}

function LoginContent({
  onCancel,
  onCreateAccount,
  onRecover,
  view,
}: {
  onCancel: () => void;
  onCreateAccount: () => void;
  onRecover: () => void;
  view: "recover" | "register" | "sign-in";
}) {
  if (view === "register") return <RegistrationForm onCancel={onCancel} />;
  if (view === "recover") return <RecoveryForm onCancel={onCancel} />;
  return (
    <AuthActions onCreateAccount={onCreateAccount} onRecover={onRecover} />
  );
}

function LoginBrand() {
  return (
    <div className="mb-9 flex flex-col items-center text-center">
      <img
        alt=""
        className="mail-auth-logo rounded-[17px] border border-[var(--mail-brass-deep)] shadow-[0_1px_0_rgba(255,255,255,0.22)_inset,0_9px_22px_rgba(18,23,15,0.28)]"
        src="/icon-192.png"
      />
      <h1 className="mt-4 font-serif text-2xl font-semibold tracking-[-0.035em]">
        Rodge Mail
      </h1>
    </div>
  );
}

function AuthActions({
  onCreateAccount,
  onRecover,
}: {
  onCreateAccount: () => void;
  onRecover: () => void;
}) {
  const cancelDesktopSignIn = useAuthStore(
    (store) => store.cancelDesktopSignIn,
  );
  const desktopAuthIsPending = useAuthStore(
    (store) => store.desktopAuthIsPending,
  );
  const isLoading = useAuthStore((store) => store.isLoading);
  const startDesktopSignIn = useAuthStore((store) => store.startDesktopSignIn);
  const usesDesktopBrowserAuth = useAuthStore(
    (store) => store.usesDesktopBrowserAuth,
  );

  if (desktopAuthIsPending) {
    return <DesktopAuthPending onCancel={cancelDesktopSignIn} />;
  }

  function createAccount() {
    if (usesDesktopBrowserAuth) {
      void startDesktopSignIn();
      return;
    }
    onCreateAccount();
  }

  function recoverAccount() {
    if (usesDesktopBrowserAuth) {
      void startDesktopSignIn();
      return;
    }
    onRecover();
  }

  return (
    <div className="space-y-3">
      <SignInButton />
      <button
        className="mail-raised flex h-12 w-full items-center justify-center rounded-[10px] border px-5 text-sm font-semibold transition hover:border-[var(--mail-brass)]"
        disabled={isLoading}
        onClick={createAccount}
        type="button"
      >
        Create account
      </button>
      <button
        className="mail-label hover:text-foreground w-full py-2 text-center text-xs font-medium transition"
        disabled={isLoading}
        onClick={recoverAccount}
        type="button"
      >
        Sign in with email
      </button>
    </div>
  );
}

function DesktopAuthPending({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="text-center">
      <h2 className="font-serif text-2xl font-semibold tracking-[-0.03em]">
        Check your browser
      </h2>
      <p className="mail-label mt-3 text-sm leading-6">
        Finish signing in there, then Rodge Mail will reopen here.
      </p>
      <button
        className="mail-label hover:text-foreground mt-6 text-xs font-medium transition"
        onClick={onCancel}
        type="button"
      >
        Cancel
      </button>
    </div>
  );
}
