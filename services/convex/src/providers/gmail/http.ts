import type { EncryptedEnvelope } from "../crypto";
import type { ProviderTokens } from "../types";
/* eslint-disable complexity, no-restricted-syntax, @typescript-eslint/consistent-type-assertions -- The unauthenticated OAuth callback validates explicit network response contracts. */
import { internal } from "../../_generated/api";
import { httpAction } from "../../_generated/server";
import { urls } from "../../urls";
import {
  credentialAdditionalData,
  decryptProviderSecret,
  encryptProviderSecret,
  oauthStateAdditionalData,
  sha256Base64Url,
} from "../crypto";
import { exchangeAuthorizationCode } from "./oauth";

const GMAIL_PROFILE_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/profile";

export const oauthCallback = httpAction(async (ctx, request) => {
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get("state");
  const code = requestUrl.searchParams.get("code");
  const providerError = requestUrl.searchParams.get("error");
  if (!state) {
    return redirectWithResult("/settings/accounts", "error", providerError);
  }
  if (!code || providerError) {
    let returnPath = "/settings/accounts";
    try {
      const stateHash = await sha256Base64Url(state);
      const oauthState = await ctx.runMutation(
        internal.sync.internal.consumeOAuthState,
        {
          provider: "gmail",
          stateHash,
          now: Date.now(),
        },
      );
      returnPath = oauthState?.returnPath ?? returnPath;
    } catch {
      // Keep the safe web fallback when the state is invalid or expired.
    }
    return redirectWithResult(returnPath, "error", providerError);
  }

  let returnPath = "/settings/accounts";
  try {
    const stateHash = await sha256Base64Url(state);
    const oauthState: {
      ownerId: string;
      encryptedCodeVerifier: EncryptedEnvelope;
      returnPath: string;
    } | null = await ctx.runMutation(internal.sync.internal.consumeOAuthState, {
      provider: "gmail",
      stateHash,
      now: Date.now(),
    });
    if (!oauthState) throw new Error("OAuth state is invalid or expired");
    returnPath = oauthState.returnPath;
    const codeVerifier = await decryptProviderSecret<string>(
      oauthState.encryptedCodeVerifier,
      oauthStateAdditionalData(oauthState.ownerId, stateHash),
    );
    let tokens = await exchangeAuthorizationCode(code, codeVerifier);
    const profile = await fetchGmailProfile(tokens.accessToken);
    const accountId = await ctx.runMutation(
      internal.sync.internal.upsertGmailAccount,
      {
        ownerId: oauthState.ownerId,
        remoteAccountId: profile.emailAddress.toLowerCase(),
        address: profile.emailAddress.toLowerCase(),
        grantedScopes: tokens.scopes,
      },
    );
    if (!tokens.refreshToken) {
      const existing: { encryptedTokens: EncryptedEnvelope } | null =
        await ctx.runQuery(internal.sync.internal.getProviderCredential, {
          ownerId: oauthState.ownerId,
          accountId,
        });
      if (existing) {
        const previous = await decryptProviderSecret<ProviderTokens>(
          existing.encryptedTokens,
          credentialAdditionalData(oauthState.ownerId, accountId, "gmail"),
        );
        tokens = { ...tokens, refreshToken: previous.refreshToken };
      }
    }
    if (!tokens.refreshToken) {
      throw new Error("Google did not issue an offline refresh token");
    }
    const encryptedTokens = await encryptProviderSecret(
      tokens,
      credentialAdditionalData(oauthState.ownerId, accountId, "gmail"),
    );
    await ctx.runMutation(internal.sync.internal.storeProviderCredential, {
      ownerId: oauthState.ownerId,
      accountId,
      encryptedTokens,
      tokenExpiresAt: tokens.expiresAt,
      grantedScopes: tokens.scopes,
    });
    await ctx.scheduler.runAfter(0, internal.sync.internal.executeGmailSync, {
      ownerId: oauthState.ownerId,
      accountId,
      reason: "initial",
    });
    return redirectWithResult(returnPath, "connected");
  } catch (error) {
    console.error("Gmail OAuth callback failed", safeErrorMessage(error));
    return redirectWithResult(returnPath, "error");
  }
});

async function fetchGmailProfile(accessToken: string) {
  const response = await fetch(GMAIL_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as {
    emailAddress?: string;
    error?: { message?: string };
  };
  if (!response.ok || !body.emailAddress) {
    throw new Error(body.error?.message ?? "Unable to read Gmail profile");
  }
  return { emailAddress: body.emailAddress };
}

function redirectWithResult(
  returnPath: string,
  result: "connected" | "error",
  detail?: string | null,
) {
  const destination = new URL(returnPath, urls.web);
  destination.searchParams.set("gmail", result);
  if (detail) destination.searchParams.set("reason", detail.slice(0, 80));
  return Response.redirect(destination, 302);
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown provider error";
}
