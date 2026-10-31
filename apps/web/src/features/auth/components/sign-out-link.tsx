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
          ? "border-border text-destructive hover:bg-accent h-11 justify-center border px-4 text-sm font-semibold"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground h-10 justify-center px-3 text-xs xl:justify-start",
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
