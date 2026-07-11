import { LogOut } from "lucide-react";

import { cn } from "@rodge-mail/std/cn";

import { useAuthStore } from "../store";

export function SignOutLink({
  variant = "rail",
}: {
  variant?: "rail" | "settings";
}) {
  const signOut = useAuthStore((s) => s.signOut);
  const disabled = useAuthStore((s) => s.isLoading || !s.imSignedIn);
  return (
    <button
      aria-label="Sign out"
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "settings"
          ? "h-11 justify-center border border-[var(--mail-seam)] px-4 text-sm font-semibold text-[var(--mail-highlight)] shadow-[var(--mail-shadow-inset)] hover:bg-[var(--mail-paper-soft)]"
          : "h-10 justify-center px-3 text-xs text-[var(--mail-chassis-foreground)]/72 hover:bg-white/[0.07] hover:text-[var(--mail-chassis-foreground)] xl:justify-start",
      )}
      disabled={disabled}
      onClick={signOut}
      type="button"
    >
      <LogOut className="size-4" />
      <span className={variant === "settings" ? undefined : "hidden xl:inline"}>
        Sign out
      </span>
    </button>
  );
}
