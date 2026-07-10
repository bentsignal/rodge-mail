import { useSearch } from "@tanstack/react-router";
import { Fingerprint, Loader } from "lucide-react";

import { useAuthStore } from "../store";

export function SignInButton({ compact = false }: { compact?: boolean }) {
  const signInWithPasskey = useAuthStore((store) => store.signInWithPasskey);
  const isLoading = useAuthStore((store) => store.isLoading);
  const disabled = useAuthStore((store) => isLoading || store.imSignedIn);
  const redirectUri = useSearch({
    from: "/login",
    select: (search) => search.redirect_uri,
  });

  return (
    <button
      className="group flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#20251f] px-5 text-sm font-semibold text-[#f8f1e6] shadow-[0_14px_34px_rgba(32,37,31,0.16)] transition hover:-translate-y-0.5 hover:bg-[#30362f] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55"
      disabled={disabled}
      onClick={() => void signInWithPasskey(redirectUri)}
      type="button"
    >
      <SignInButtonIcon isLoading={isLoading} />
      {getButtonLabel(compact)}
      <span className="ml-auto font-mono text-[8px] tracking-[0.12em] text-white/45 uppercase">
        WebAuthn
      </span>
    </button>
  );
}

function getButtonLabel(compact: boolean) {
  if (compact) return "Use this passkey";
  return "Sign in with a passkey";
}

function SignInButtonIcon({ isLoading }: { isLoading: boolean }) {
  if (isLoading) return <Loader className="size-4 animate-spin" />;
  return <Fingerprint className="size-[18px]" />;
}
