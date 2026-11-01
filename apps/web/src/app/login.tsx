import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { AuthPage } from "~/features/auth/components/auth-page";
import { SignInButton } from "~/features/auth/components/sign-in-button";

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
  return (
    <AuthPage>
      <SignInButton />
    </AuthPage>
  );
}
