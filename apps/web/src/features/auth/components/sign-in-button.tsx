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
      className="mail-brass-button flex h-12 w-full items-center justify-center gap-2 rounded-[10px] px-5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-55"
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
