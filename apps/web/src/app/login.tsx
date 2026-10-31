import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { RecoveryForm } from "~/features/auth/components/recovery-form";
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
  const [view, setView] = useState<"recover" | "sign-in">("sign-in");
  const imLoggedIn = useAuthStore((store) => store.imSignedIn);
  if (imLoggedIn) return null;

  return (
    <main className="mail-atmosphere bg-background relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-10">
      <section className="mail-auth-frame relative z-10 w-full max-w-[420px] rounded-[24px] border p-2.5">
        <div className="mail-auth-paper rounded-[16px] border px-7 py-8 sm:px-9 sm:py-9">
          <LoginBrand />
          <LoginContent
            onCancel={() => setView("sign-in")}
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
  onRecover,
  view,
}: {
  onCancel: () => void;
  onRecover: () => void;
  view: "recover" | "sign-in";
}) {
  if (view === "recover") return <RecoveryForm onCancel={onCancel} />;
  return <AuthActions onRecover={onRecover} />;
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

function AuthActions({ onRecover }: { onRecover: () => void }) {
  const isLoading = useAuthStore((store) => store.isLoading);

  return (
    <div className="space-y-3">
      <SignInButton />
      <button
        className="mail-label hover:text-foreground w-full py-2 text-center text-xs font-medium transition"
        disabled={isLoading}
        onClick={onRecover}
        type="button"
      >
        Sign in with email
      </button>
    </div>
  );
}
