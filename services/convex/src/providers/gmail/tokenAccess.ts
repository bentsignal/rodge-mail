import type { Id } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
import type { ProviderTokens } from "../types";
import { internal } from "../../_generated/api";
import {
  credentialAdditionalData,
  decryptProviderSecret,
  encryptProviderSecret,
} from "../crypto";
import { GoogleOAuthError, refreshGoogleTokens } from "./oauth";

export async function getUsableGmailTokens(
  ctx: ActionCtx,
  args: {
    ownerId: string;
    accountId: Id<"mailAccounts">;
    encryptedTokens: {
      formatVersion: 1;
      keyVersion: string;
      iv: string;
      ciphertext: string;
    };
  },
) {
  const additionalData = credentialAdditionalData(
    args.ownerId,
    args.accountId,
    "gmail",
  );
  let tokens = await decryptProviderSecret<ProviderTokens>(
    args.encryptedTokens,
    additionalData,
  );
  if (!tokens.expiresAt || tokens.expiresAt <= Date.now() + 2 * 60 * 1000) {
    if (!tokens.refreshToken) {
      throw new Error("Gmail refresh token is unavailable");
    }
    try {
      tokens = await refreshGoogleTokens(tokens.refreshToken);
    } catch (error) {
      if (error instanceof GoogleOAuthError && error.code === "invalid_grant") {
        await ctx.runMutation(
          internal.sync.internal.markProviderReauthorization,
          {
            ownerId: args.ownerId,
            accountId: args.accountId,
            error: error.message.slice(0, 500),
          },
        );
      }
      throw error;
    }
    const encryptedTokens = await encryptProviderSecret(tokens, additionalData);
    await ctx.runMutation(internal.sync.internal.storeProviderCredential, {
      ownerId: args.ownerId,
      accountId: args.accountId,
      encryptedTokens,
      tokenExpiresAt: tokens.expiresAt,
      grantedScopes: tokens.scopes,
    });
  }
  return tokens;
}
