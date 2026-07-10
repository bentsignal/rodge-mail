import { LogOut } from "lucide-react";

import { Button } from "@rodge-mail/ui-web/button";

import { useAuthStore } from "../store";

export function SignOutLink() {
  const signOut = useAuthStore((s) => s.signOut);
  const disabled = useAuthStore((s) => s.isLoading || !s.imSignedIn);
  return (
    <Button
      variant="link"
      onClick={signOut}
      disabled={disabled}
      className="px-0!"
    >
      <LogOut size={16} />
      <span>Sign out</span>
    </Button>
  );
}
