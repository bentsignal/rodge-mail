import { LogOut } from "lucide-react";

import { useAuthStore } from "../store";

export function SignOutLink() {
  const signOut = useAuthStore((s) => s.signOut);
  const disabled = useAuthStore((s) => s.isLoading || !s.imSignedIn);
  return (
    <button
      aria-label="Sign out"
      className="flex h-10 w-full items-center justify-center gap-2.5 rounded-xl px-3 text-xs text-[#756c63] transition-colors hover:bg-black/[0.04] hover:text-[#20251f] disabled:cursor-not-allowed disabled:opacity-50 xl:justify-start dark:text-[#aaa195] dark:hover:bg-white/[0.05] dark:hover:text-white"
      disabled={disabled}
      onClick={signOut}
      type="button"
    >
      <LogOut className="size-4" />
      <span className="hidden xl:inline">Sign out</span>
    </button>
  );
}
