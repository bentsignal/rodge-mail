import { useSearch } from "@tanstack/react-router";
import { Loader } from "lucide-react";

import { useAuthStore } from "../store";

export function SignInButton() {
  const signInWithPasskey = useAuthStore((store) => store.signInWithPasskey);
  const isLoading = useAuthStore((store) => store.isLoading);
  const disabled = useAuthStore((store) => isLoading || store.imSignedIn);
  const redirectUri = useSearch({
    from: "/login",
    select: (search) => search.redirect_uri,
  });

  return (
    <button
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#20251f] px-5 text-sm font-semibold text-[#f8f1e6] shadow-[0_14px_34px_rgba(32,37,31,0.16)] transition hover:-translate-y-0.5 hover:bg-[#30362f] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55"
      disabled={disabled}
      onClick={() => void signInWithPasskey(redirectUri)}
      type="button"
    >
      <SignInLoadingIndicator isLoading={isLoading} />
      Sign in
    </button>
  );
}

function SignInLoadingIndicator({ isLoading }: { isLoading: boolean }) {
  if (!isLoading) return null;
  return <Loader className="size-4 animate-spin" />;
}
