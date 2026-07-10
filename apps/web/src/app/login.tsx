import { createFileRoute, redirect } from "@tanstack/react-router";
import { Fingerprint, LockKeyhole, ShieldCheck } from "lucide-react";
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
  const imLoggedIn = useAuthStore((store) => store.imSignedIn);
  if (imLoggedIn) return null;

  return (
    <main className="mail-atmosphere bg-background relative min-h-dvh overflow-hidden px-5 py-6 sm:px-8 lg:px-12">
      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-3rem)] max-w-[1320px] flex-col">
        <LoginBrand />
        <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[minmax(0,1fr)_430px] lg:gap-20">
          <LoginIntroduction />
          <LoginCard />
        </div>
        <LoginFooter />
      </div>
    </main>
  );
}

function LoginBrand() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex size-10 items-center justify-center rounded-[13px] bg-[#20251f] text-[#f7f1e6] shadow-sm">
        <span className="font-serif text-xl italic">R</span>
        <span className="absolute right-1.5 bottom-1.5 size-1 rounded-full bg-[#d77a55]" />
      </div>
      <div>
        <p className="font-serif text-[17px] leading-5 font-semibold tracking-[-0.02em]">
          Rodge Mail
        </p>
        <p className="font-mono text-[8px] tracking-[0.18em] text-[#897d6f] uppercase">
          Personal dispatch
        </p>
      </div>
    </div>
  );
}

function LoginIntroduction() {
  return (
    <section className="max-w-2xl lg:pl-[8vw]">
      <p className="font-mono text-[9px] tracking-[0.2em] text-[#a15d45] uppercase">
        Private by construction
      </p>
      <h1 className="mt-5 max-w-xl font-serif text-[46px] leading-[0.98] font-semibold tracking-[-0.055em] text-balance sm:text-[62px] lg:text-[72px]">
        Your mail, behind one deliberate gesture.
      </h1>
      <p className="mt-6 max-w-lg text-[15px] leading-7 text-[#746b61] dark:text-[#aaa095]">
        No shared passwords. No social login. Rodge Mail recognizes a passkey
        stored on a device you trust.
      </p>
      <div className="mt-9 hidden gap-6 sm:flex">
        <TrustNote icon={Fingerprint} label="Biometric or device PIN" />
        <TrustNote icon={ShieldCheck} label="Phishing-resistant" />
        <TrustNote icon={LockKeyhole} label="No shared secrets" />
      </div>
    </section>
  );
}

function LoginCard() {
  return (
    <section className="border-border/80 bg-card/88 rounded-[24px] border p-5 shadow-[0_28px_90px_rgba(48,38,24,0.14)] backdrop-blur-xl sm:p-7">
      <div>
        <p className="font-mono text-[8px] tracking-[0.16em] text-[#897d6f] uppercase">
          Welcome back
        </p>
        <h2 className="mt-2 font-serif text-2xl font-semibold tracking-[-0.03em]">
          Open your mail desk
        </h2>
        <p className="mt-2 text-xs leading-5 text-[#81776c] dark:text-[#aaa095]">
          Use a passkey already saved to this device, your password manager, or
          a nearby security key.
        </p>
        <div className="mt-5">
          <SignInButton />
        </div>
      </div>

      <div className="my-7 flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="font-mono text-[8px] tracking-[0.15em] text-[#9a8f82] uppercase">
          New to Rodge Mail
        </span>
        <span className="bg-border h-px flex-1" />
      </div>

      <div>
        <p className="font-mono text-[8px] tracking-[0.16em] text-[#897d6f] uppercase">
          Create your account
        </p>
        <p className="mt-2 text-xs leading-5 text-[#81776c] dark:text-[#aaa095]">
          Register a passkey for your own Rodge Mail account. You will use it
          instead of a password each time you return.
        </p>
        <RegistrationForm />
      </div>
    </section>
  );
}

function TrustNote({
  icon: Icon,
  label,
}: {
  icon: typeof Fingerprint;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-[#80766b] dark:text-[#aaa095]">
      <Icon className="size-3.5 text-[#397367]" />
      {label}
    </div>
  );
}

function LoginFooter() {
  return (
    <footer className="flex items-center justify-between border-t border-[#d9d0c3]/70 pt-4 font-mono text-[8px] tracking-[0.14em] text-[#93877a] uppercase dark:border-[#3d413b]">
      <span>WebAuthn secure context required</span>
      <span>Rodge Mail · Passkey access</span>
    </footer>
  );
}
