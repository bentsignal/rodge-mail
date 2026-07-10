import { useRouteContext } from "@tanstack/react-router";
import { createStore } from "rostra";

import { useLoading } from "@rodge-mail/std/use-loading";
import { toast } from "@rodge-mail/ui-web/toast";

import { authClient } from "./lib/client";

function useInternalStore() {
  const { isLoading, run } = useLoading();
  const isAuthenticated = useRouteContext({
    from: "__root__",
    select: (context) => context.isAuthenticated,
  });

  function signInWithPasskey(redirectUri?: string) {
    if (isAuthenticated) return Promise.resolve(false);
    return run({
      fn: async () => {
        const result = await authClient.signIn.passkey();
        if (result.error) {
          throw new Error(result.error.message ?? "Passkey sign-in failed");
        }
        window.location.replace(getSafeRedirect(redirectUri));
        return true;
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, "Could not sign in with a passkey"));
      },
    });
  }

  function bootstrapOwnerPasskey({
    name,
    token,
  }: {
    name: string;
    token: string;
  }) {
    if (isAuthenticated || !name.trim() || !token) {
      return Promise.resolve(false);
    }
    return run({
      fn: async () => {
        const result = await authClient.passkey.addPasskey({
          context: token,
          name: name.trim(),
        });
        if (result.error) {
          throw new Error(result.error.message ?? "Passkey setup failed");
        }
        toast.success("Owner passkey created");
        return true;
      },
      onError: (error) => {
        toast.error(
          getErrorMessage(error, "Could not create the owner passkey"),
        );
      },
    });
  }

  function addAuthenticatedPasskey(name: string) {
    if (!isAuthenticated || !name.trim()) return Promise.resolve(false);
    return run({
      fn: async () => {
        const result = await authClient.passkey.addPasskey({
          name: name.trim(),
        });
        if (result.error) {
          throw new Error(result.error.message ?? "Passkey setup failed");
        }
        toast.success("Passkey added to Rodge Mail");
        return true;
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, "Could not add this passkey"));
      },
    });
  }

  function signOut() {
    if (!isAuthenticated) return;
    void run({
      fn: async () => {
        await authClient.signOut({
          fetchOptions: {
            onSuccess: () => window.location.replace("/login"),
            onError: () => {
              toast.error("Failed to sign out");
            },
          },
        });
      },
      onError: () => {
        toast.error("Failed to sign out");
      },
    });
  }

  return {
    addAuthenticatedPasskey,
    bootstrapOwnerPasskey,
    imSignedIn: isAuthenticated,
    imSignedOut: !isAuthenticated,
    isLoading,
    signInWithPasskey,
    signOut,
  };
}

function getSafeRedirect(redirectUri: string | undefined) {
  if (!redirectUri?.startsWith("/") || redirectUri.startsWith("//")) return "/";
  return redirectUri;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  return message.length > 0 ? message : fallback;
}

export const { Store: AuthStore, useStore: useAuthStore } =
  createStore(useInternalStore);
