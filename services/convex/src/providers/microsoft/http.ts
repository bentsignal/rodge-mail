/* eslint-disable complexity, no-restricted-syntax, @typescript-eslint/consistent-type-assertions -- The unauthenticated callback validates explicit OAuth and Graph response contracts. */
import type { EncryptedEnvelope } from "../crypto";
import type { ProviderTokens } from "../types";
import { internal } from "../../_generated/api";
import { httpAction } from "../../_generated/server";
import { urls } from "../../urls";
import {
  credentialAdditionalData,
  decryptProviderSecret,
  encryptProviderSecret,
  oauthStateAdditionalDataForProvider,
  sha256Base64Url,
} from "../crypto";
import { exchangeMicrosoftAuthorizationCode } from "./oauth";

const MICROSOFT_PROFILE_URL =
  "https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName,displayName";

export const oauthCallback = httpAction(async (ctx, request) => {
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get("state");
  const code = requestUrl.searchParams.get("code");
  const providerError = requestUrl.searchParams.get("error");
  if (!state || !code || providerError) {
    return redirectWithResult("/settings/accounts", "error", providerError);
  }

  let returnPath = "/settings/accounts";
  try {
    const stateHash = await sha256Base64Url(state);
    const oauthState: {
      ownerId: string;
      encryptedCodeVerifier: EncryptedEnvelope;
      returnPath: string;
    } | null = await ctx.runMutation(internal.sync.internal.consumeOAuthState, {
      provider: "microsoft",
      stateHash,
      now: Date.now(),
    });
    if (!oauthState) throw new Error("OAuth state is invalid or expired");
    returnPath = oauthState.returnPath;
    const codeVerifier = await decryptProviderSecret<string>(
      oauthState.encryptedCodeVerifier,
      oauthStateAdditionalDataForProvider(
        oauthState.ownerId,
        stateHash,
        "microsoft",
      ),
    );
    let tokens = await exchangeMicrosoftAuthorizationCode(code, codeVerifier);
    const profile = await fetchMicrosoftProfile(tokens.accessToken);
    const mailboxAddress = profile.mail?.trim();
    const address = (
      mailboxAddress?.length ? mailboxAddress : profile.userPrincipalName
    )?.toLowerCase();
    if (!address?.includes("@")) {
      throw new Error("Microsoft account has no usable mailbox address");
    }
    const accountId = await ctx.runMutation(
      internal.sync.internal.upsertMicrosoftAccount,
      {
        ownerId: oauthState.ownerId,
        remoteAccountId: profile.id,
        address,
        displayName: profile.displayName,
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
          credentialAdditionalData(oauthState.ownerId, accountId, "microsoft"),
        );
        tokens = { ...tokens, refreshToken: previous.refreshToken };
      }
    }
    if (!tokens.refreshToken) {
      throw new Error("Microsoft did not issue an offline refresh token");
    }
    const encryptedTokens = await encryptProviderSecret(
      tokens,
      credentialAdditionalData(oauthState.ownerId, accountId, "microsoft"),
    );
    await ctx.runMutation(internal.sync.internal.storeProviderCredential, {
      ownerId: oauthState.ownerId,
      accountId,
      encryptedTokens,
      tokenExpiresAt: tokens.expiresAt,
      grantedScopes: tokens.scopes,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.sync.internal.executeMicrosoftSync,
      {
        ownerId: oauthState.ownerId,
        accountId,
        reason: "initial",
      },
    );
    return redirectWithResult(returnPath, "connected");
  } catch (error) {
    console.error("Microsoft OAuth callback failed", safeErrorMessage(error));
    return redirectWithResult(returnPath, "error");
  }
});

async function fetchMicrosoftProfile(accessToken: string) {
  const response = await fetch(MICROSOFT_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as {
    id?: string;
    mail?: string | null;
    userPrincipalName?: string;
    displayName?: string;
    error?: { message?: string };
  };
  if (!response.ok || !body.id) {
    throw new Error(body.error?.message ?? "Unable to read Microsoft profile");
  }
  return body as {
    id: string;
    mail?: string | null;
    userPrincipalName?: string;
    displayName?: string;
  };
}

function redirectWithResult(
  returnPath: string,
  result: "connected" | "error",
  detail?: string | null,
) {
  const destination = new URL(returnPath, urls.web);
  destination.searchParams.set("microsoft", result);
  if (detail) destination.searchParams.set("reason", detail.slice(0, 80));
  return Response.redirect(destination, 302);
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown provider error";
}
