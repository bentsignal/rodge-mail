import { useState } from "react";
import { useRouteContext } from "@tanstack/react-router";
import { createStore } from "rostra";

import { completeAuthSession } from "@rodge-mail/std/auth-session";
import { useLoading } from "@rodge-mail/std/use-loading";
import { toast } from "@rodge-mail/ui-web/toast";

import { authClient } from "./lib/client";
import { rememberDesktopAuthAfterSignIn } from "./lib/desktop-auto-authorize";
import {
  beginDesktopAuth,
  cancelDesktopAuth,
  exchangeDesktopAuth,
  readPendingDesktopAuth,
  usesDesktopBrowserAuth,
} from "./lib/desktop-handoff";
import { completeEmailCodeSignIn } from "./lib/email-code-sign-in";
import { getSafeAppRedirect } from "./lib/safe-redirect";

interface RegistrationCodeRequest {
  email: string;
}

interface RecoveryVerification {
  code: string;
  email: string;
  redirectUri?: string;
}

interface RegistrationVerification {
  code: string;
  email: string;
  name: string;
  redirectUri?: string;
}

interface NormalizedRegistrationVerification {
  code: string;
  email: string;
  name: string;
}

function useInternalStore() {
  const [desktopAuthIsPending, setDesktopAuthIsPending] = useState(false);
  const { isLoading, run } = useLoading();
  const isAuthenticated = useRouteContext({
    from: "__root__",
    select: (context) => context.isAuthenticated,
  });
  const registrationActions = createRegistrationActions(isAuthenticated, run);
  const recoveryActions = createRecoveryActions(isAuthenticated, run);
  function signInWithPasskey(redirectUri?: string) {
    if (isAuthenticated) return Promise.resolve(false);
    if (usesDesktopBrowserAuth()) return startDesktopSignIn();
    return run({
      fn: () => authenticateWithPasskey(redirectUri),
      onError: (error) => {
        toast.error(getErrorMessage(error, "Could not sign in with a passkey"));
      },
    });
  }

  function startDesktopSignIn() {
    if (isAuthenticated || desktopAuthIsPending) return Promise.resolve(false);
    return run({
      fn: async () => {
        await beginDesktopAuth();
        setDesktopAuthIsPending(true);
        return true;
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, "Could not open browser sign-in"));
      },
    });
  }

  function cancelDesktopSignIn() {
    setDesktopAuthIsPending(false);
    void cancelDesktopAuth().catch(() => undefined);
  }

  function finishDesktopSignIn(requestId: string, authorizationCode: string) {
    return run({
      fn: async () => {
        await exchangeDesktopAuth(requestId, authorizationCode);
        window.location.replace("/");
        return true;
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, "Could not finish desktop sign-in"));
      },
    });
  }

  function addAuthenticatedPasskey() {
    if (!isAuthenticated) return Promise.resolve(false);
    return run({
      fn: addPasskey,
      onError: (error) => {
        toast.error(getErrorMessage(error, "Could not add this passkey"));
      },
    });
  }

  function signOut() {
    if (!isAuthenticated) return;
    void run({
      fn: signOutAndRedirect,
      onError: () => {
        toast.error("Failed to sign out");
      },
    });
  }

  return {
    addAuthenticatedPasskey,
    cancelDesktopSignIn,
    desktopAuthIsPending: desktopAuthIsPending || !!readPendingDesktopAuth(),
    finishDesktopSignIn,
    finishRecovery: recoveryActions.finishRecovery,
    finishRegistration: registrationActions.finishRegistration,
    imSignedIn: isAuthenticated,
    imSignedOut: !isAuthenticated,
    isLoading,
    usesDesktopBrowserAuth: usesDesktopBrowserAuth(),
    requestRegistrationCode: registrationActions.requestRegistrationCode,
    requestRecoveryCode: recoveryActions.requestRecoveryCode,
    signInWithPasskey,
    signOut,
    startDesktopSignIn,
  };
}

function createRegistrationActions(
  isAuthenticated: boolean,
  run: ReturnType<typeof useLoading>["run"],
) {
  function requestRegistrationCode(details: RegistrationCodeRequest) {
    const email = details.email.trim().toLowerCase();
    if (isAuthenticated || !email) return Promise.resolve(false);
    return run({
      fn: () => sendRegistrationCode(email),
      onError: (error) => {
        toast.error(getErrorMessage(error, "Could not send the code"));
      },
    });
  }

  function finishRegistration(details: RegistrationVerification) {
    const normalized = normalizeRegistrationVerification(details);
    if (isAuthenticated || !normalized) return Promise.resolve(false);
    return run({
      fn: () => completeRegistration(normalized, details.redirectUri),
      onError: (error) => {
        toast.error(getErrorMessage(error, "Could not create your account"));
      },
    });
  }

  return { finishRegistration, requestRegistrationCode };
}

function createRecoveryActions(
  isAuthenticated: boolean,
  run: ReturnType<typeof useLoading>["run"],
) {
  function requestRecoveryCode(details: RegistrationCodeRequest) {
    const email = details.email.trim().toLowerCase();
    if (isAuthenticated || !email) return Promise.resolve(false);
    return run({
      fn: () => sendRecoveryCode(email),
      onError: (error) => {
        toast.error(getErrorMessage(error, "Could not send the sign-in code"));
      },
    });
  }

  function finishRecovery(details: RecoveryVerification) {
    const email = details.email.trim().toLowerCase();
    const code = details.code.trim();
    if (isAuthenticated || !email || !code) return Promise.resolve(false);
    return run({
      fn: () => completeRecovery(email, code, details.redirectUri),
      onError: (error) => {
        toast.error(getErrorMessage(error, "Could not sign in with email"));
      },
    });
  }

  return { finishRecovery, requestRecoveryCode };
}

function normalizeRegistrationVerification(details: RegistrationVerification) {
  const code = details.code.trim();
  const email = details.email.trim().toLowerCase();
  const name = details.name.trim();
  if (!code || !email || !name) return undefined;
  return { code, email, name };
}

async function authenticateWithPasskey(redirectUri: string | undefined) {
  rememberDesktopAuthAfterSignIn({
    origin: window.location.origin,
    redirectUri,
    storage: sessionStorage,
  });
  await completeAuthSession({
    authenticate: async () => await authClient.signIn.passkey(),
    confirmSession: async () => await authClient.getSession(),
    fallbackMessage: "Passkey sign-in failed",
    refreshSession: () => authClient.$store.notify("$sessionSignal"),
  });
  window.location.replace(getSafeAppRedirect(redirectUri));
  return true;
}

async function addPasskey() {
  const result = await authClient.passkey.addPasskey();
  if (result.error) {
    throw new Error(result.error.message ?? "Passkey setup failed");
  }
  toast.success("Passkey added to Rodge Mail");
  return true;
}

async function signOutAndRedirect() {
  await authClient.signOut({
    fetchOptions: {
      onSuccess: () => window.location.replace("/login"),
      onError: () => {
        toast.error("Failed to sign out");
      },
    },
  });
}

async function sendRegistrationCode(email: string) {
  const result = await authClient.emailOtp.sendVerificationOtp({
    email,
    type: "sign-in",
  });
  if (result.error) {
    throw new Error(result.error.message ?? "Could not send the code");
  }
  return true;
}

async function completeRegistration(
  details: NormalizedRegistrationVerification,
  redirectUri: string | undefined,
) {
  const verification = await authClient.signIn.emailOtp({
    email: details.email,
    name: details.name,
    otp: details.code,
  });
  if (verification.error) {
    throw new Error(verification.error.message ?? "Code verification failed");
  }

  const passkey = await authClient.passkey.addPasskey();
  if (passkey.error) {
    await authClient.signOut();
    throw new Error(passkey.error.message ?? "Passkey setup failed");
  }
  window.location.replace(getSafeAppRedirect(redirectUri));
  return true;
}

async function sendRecoveryCode(email: string) {
  const result = await authClient.$fetch<{ success: boolean }>(
    "/passkey-recovery/request",
    { body: { email }, method: "POST" },
  );
  if (result.error) {
    throw new Error(result.error.message ?? "Could not send the code");
  }
  return true;
}

async function completeRecovery(
  email: string,
  code: string,
  redirectUri: string | undefined,
) {
  const redirect = await completeEmailCodeSignIn(
    () =>
      authClient.$fetch<{ success: boolean }>("/passkey-recovery/verify", {
        body: { code, email },
        method: "POST",
      }),
    redirectUri,
  );
  window.location.replace(redirect);
  return true;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  return message.length > 0 ? message : fallback;
}

export const { Store: AuthStore, useStore: useAuthStore } =
  createStore(useInternalStore);
