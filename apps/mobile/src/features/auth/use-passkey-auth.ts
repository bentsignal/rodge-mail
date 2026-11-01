import { useState } from "react";

import { completeAuthSession } from "@rodge-mail/std/auth-session";

import { authClient } from "./client";
import {
  getPasskeySignInErrorMessage,
  retryTransientPasskeyAssociation,
} from "./native-passkey-operation";

export function usePasskeyAuth() {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [message, setMessage] = useState<string>();

  async function signIn() {
    setIsSigningIn(true);
    setMessage(undefined);
    try {
      await completeAuthSession({
        authenticate: async () =>
          await retryTransientPasskeyAssociation(
            async () => await authClient.signIn.passkey(),
          ),
        confirmSession: async () => await authClient.getSession(),
        fallbackMessage: "Passkey sign-in failed",
        refreshSession: () => authClient.$store.notify("$sessionSignal"),
      });
    } catch (error) {
      setMessage(getPasskeySignInErrorMessage(error));
    }
    setIsSigningIn(false);
  }

  return { isSigningIn, message, signIn };
}
