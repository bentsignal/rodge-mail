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
          ? "border-border h-11 justify-center border px-4 text-sm font-semibold text-[#8f4f3c] hover:bg-[#b95d41]/6 dark:text-[#e69a80]"
          : "h-10 justify-center px-3 text-xs text-[#756c63] hover:bg-black/[0.04] hover:text-[#20251f] xl:justify-start dark:text-[#aaa195] dark:hover:bg-white/[0.05] dark:hover:text-white",
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
