import { z } from "zod";

import { cliAuthRequestSearchSchema } from "./cli-auth-contracts";

const storageKey = "rodge-mail:desktop-auth-after-sign-in";
const authorizationTtlMs = 5 * 60 * 1000;
const pendingAuthorizationSchema = z.object({
  expiresAt: z.number(),
  requestId: z.string(),
});

interface BrowserStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export function rememberCliAuthAfterSignIn({
  now = Date.now(),
  origin,
  redirectUri,
  storage,
}: {
  now?: number;
  origin: string;
  redirectUri: string | undefined;
  storage: BrowserStorage;
}) {
  const request = parseCliAuthRedirect(redirectUri, origin);
  if (!request) {
    storage.removeItem(storageKey);
    return false;
  }

  storage.setItem(
    storageKey,
    JSON.stringify({
      expiresAt: now + authorizationTtlMs,
      requestId: request.request_id,
    }),
  );
  return true;
}

export function consumeCliAuthAfterSignIn({
  now = Date.now(),
  requestId,
  storage,
}: {
  now?: number;
  requestId: string;
  storage: BrowserStorage;
}) {
  const serialized = storage.getItem(storageKey);
  storage.removeItem(storageKey);
  if (!serialized) return false;

  try {
    const parsed = pendingAuthorizationSchema.safeParse(JSON.parse(serialized));
    return (
      parsed.success &&
      parsed.data.expiresAt > now &&
      parsed.data.requestId === requestId
    );
  } catch {
    return false;
  }
}

function parseCliAuthRedirect(redirectUri: string | undefined, origin: string) {
  if (!redirectUri) return undefined;

  try {
    const url = new URL(redirectUri, origin);
    if (url.origin !== origin || url.pathname !== "/desktop-auth" || url.hash) {
      return undefined;
    }

    const parsed = cliAuthRequestSearchSchema.safeParse(
      Object.fromEntries(url.searchParams),
    );
    if (!parsed.success || url.searchParams.size !== 2) return undefined;
    return parsed.data;
  } catch {
    return undefined;
  }
}
