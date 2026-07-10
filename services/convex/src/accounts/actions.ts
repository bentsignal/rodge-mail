import { v } from "convex/values";

import { internal } from "../_generated/api";
import {
  encryptProviderSecret,
  oauthStateAdditionalData,
  oauthStateAdditionalDataForProvider,
  randomBase64Url,
  sha256Base64Url,
} from "../providers/crypto";
import {
  buildGoogleAuthorizationUrl,
  getGoogleOAuthConfig,
} from "../providers/gmail/oauth";
import {
  buildMicrosoftAuthorizationUrl,
  getMicrosoftOAuthConfig,
} from "../providers/microsoft/oauth";
import { urls } from "../urls";
import { authedAction } from "../utils";

const OAUTH_STATE_LIFETIME_MS = 10 * 60 * 1000;

export const connectGmail = authedAction({
  args: { returnPath: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ authorizationUrl: string }> => {
    const returnPath = normalizeReturnPath(args.returnPath);
    const state = randomBase64Url(32);
    const stateHash = await sha256Base64Url(state);
    const codeVerifier = randomBase64Url(64);
    const codeChallenge = await sha256Base64Url(codeVerifier);
    const encryptedCodeVerifier = await encryptProviderSecret(
      codeVerifier,
      oauthStateAdditionalData(ctx.ownerId, stateHash),
    );

    await ctx.runMutation(internal.sync.internal.storeOAuthState, {
      ownerId: ctx.ownerId,
      provider: "gmail",
      stateHash,
      encryptedCodeVerifier,
      returnPath,
      expiresAt: Date.now() + OAUTH_STATE_LIFETIME_MS,
    });

    return {
      authorizationUrl: buildGoogleAuthorizationUrl({
        ...getGoogleOAuthConfig(),
        state,
        codeChallenge,
      }),
    };
  },
});

export const connectMicrosoft = authedAction({
  args: { returnPath: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ authorizationUrl: string }> => {
    const returnPath = normalizeReturnPath(args.returnPath);
    const state = randomBase64Url(32);
    const stateHash = await sha256Base64Url(state);
    const codeVerifier = randomBase64Url(64);
    const codeChallenge = await sha256Base64Url(codeVerifier);
    const encryptedCodeVerifier = await encryptProviderSecret(
      codeVerifier,
      oauthStateAdditionalDataForProvider(ctx.ownerId, stateHash, "microsoft"),
    );

    await ctx.runMutation(internal.sync.internal.storeOAuthState, {
      ownerId: ctx.ownerId,
      provider: "microsoft",
      stateHash,
      encryptedCodeVerifier,
      returnPath,
      expiresAt: Date.now() + OAUTH_STATE_LIFETIME_MS,
    });

    return {
      authorizationUrl: buildMicrosoftAuthorizationUrl({
        ...getMicrosoftOAuthConfig(),
        state,
        codeChallenge,
      }),
    };
  },
});

function normalizeReturnPath(value?: string) {
  if (!value) return "/settings/accounts";
  const baseUrl = new URL(urls.web);
  const destination = new URL(value, baseUrl);
  if (!value.startsWith("/") || destination.origin !== baseUrl.origin) {
    throw new Error("OAuth return path must be relative to Rodge Mail");
  }
  return `${destination.pathname}${destination.search}${destination.hash}`;
}
