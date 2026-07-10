import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

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
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const imLoggedIn = useAuthStore((store) => store.imSignedIn);
  if (imLoggedIn) return null;

  return (
    <main className="mail-atmosphere bg-background relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-10">
      <section className="border-border/80 bg-card/88 relative z-10 w-full max-w-sm rounded-[24px] border p-6 shadow-[0_28px_90px_rgba(48,38,24,0.14)] backdrop-blur-xl sm:p-8">
        <LoginBrand />
        <LoginContent
          isCreatingAccount={isCreatingAccount}
          onCancel={() => setIsCreatingAccount(false)}
          onCreateAccount={() => setIsCreatingAccount(true)}
        />
      </section>
    </main>
  );
}

function LoginContent({
  isCreatingAccount,
  onCancel,
  onCreateAccount,
}: {
  isCreatingAccount: boolean;
  onCancel: () => void;
  onCreateAccount: () => void;
}) {
  if (isCreatingAccount) return <RegistrationForm onCancel={onCancel} />;
  return <AuthActions onCreateAccount={onCreateAccount} />;
}

function LoginBrand() {
  return (
    <div className="mb-8 flex items-center gap-3">
      <div className="relative flex size-10 items-center justify-center rounded-[13px] bg-[#20251f] text-[#f7f1e6] shadow-sm">
        <span className="font-serif text-xl italic">R</span>
        <span className="absolute right-1.5 bottom-1.5 size-1 rounded-full bg-[#d77a55]" />
      </div>
      <h1 className="font-serif text-xl font-semibold tracking-[-0.03em]">
        Rodge Mail
      </h1>
    </div>
  );
}

function AuthActions({ onCreateAccount }: { onCreateAccount: () => void }) {
  return (
    <div className="space-y-3">
      <SignInButton />
      <button
        className="border-border flex h-12 w-full items-center justify-center rounded-xl border bg-transparent px-5 text-sm font-semibold text-[#343832] transition hover:border-[#a99a88] hover:bg-white/50 dark:text-[#eee6da] dark:hover:bg-white/[0.04]"
        onClick={onCreateAccount}
        type="button"
      >
        Create account
      </button>
    </div>
  );
}
