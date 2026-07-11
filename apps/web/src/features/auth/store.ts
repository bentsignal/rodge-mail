import { useState } from "react";
import { useRouteContext } from "@tanstack/react-router";
import { createStore } from "rostra";

import { useLoading } from "@rodge-mail/std/use-loading";
import { toast } from "@rodge-mail/ui-web/toast";

import { authClient } from "./lib/client";
import {
  beginDesktopAuth,
  cancelDesktopAuth,
  exchangeDesktopAuth,
  readPendingDesktopAuth,
  usesDesktopBrowserAuth,
} from "./lib/desktop-handoff";

interface RegistrationCodeRequest {
  email: string;
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
    finishRegistration,
    imSignedIn: isAuthenticated,
    imSignedOut: !isAuthenticated,
    isLoading,
    usesDesktopBrowserAuth: usesDesktopBrowserAuth(),
    requestRegistrationCode,
    signInWithPasskey,
    signOut,
    startDesktopSignIn,
  };
}

function getSafeRedirect(redirectUri: string | undefined) {
  if (!redirectUri?.startsWith("/") || redirectUri.startsWith("//")) return "/";
  return redirectUri;
}

function normalizeRegistrationVerification(details: RegistrationVerification) {
  const code = details.code.trim();
  const email = details.email.trim().toLowerCase();
  const name = details.name.trim();
  if (!code || !email || !name) return undefined;
  return { code, email, name };
}

async function authenticateWithPasskey(redirectUri: string | undefined) {
  const result = await authClient.signIn.passkey();
  if (result.error) {
    throw new Error(result.error.message ?? "Passkey sign-in failed");
  }
  window.location.replace(getSafeRedirect(redirectUri));
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
  window.location.replace(getSafeRedirect(redirectUri));
  return true;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  return message.length > 0 ? message : fallback;
}

export const { Store: AuthStore, useStore: useAuthStore } =
  createStore(useInternalStore);
