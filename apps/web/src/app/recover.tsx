import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

import { AuthPage } from "~/features/auth/components/auth-page";
import { RecoveryForm } from "~/features/auth/components/recovery-form";

// Not linked from anywhere: the owner's way back in when no passkey works
// (services/convex/AUTH.md).
export const Route = createFileRoute("/recover")({
  component: Recover,
  beforeLoad: ({ context }) => {
    if (context.isAuthenticated) throw redirect({ to: "/" });
  },
});

function Recover() {
  const navigate = useNavigate();
  return (
    <AuthPage>
      <RecoveryForm onCancel={() => void navigate({ to: "/login" })} />
    </AuthPage>
  );
}
