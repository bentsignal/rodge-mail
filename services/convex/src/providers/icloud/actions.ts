"use node";

import { ConvexError, v } from "convex/values";

import type { Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { authedAction } from "../../utils";
import { credentialAdditionalData, encryptProviderSecret } from "../crypto";
import { verifyCredentials } from "./client";

export const connect = authedAction({
  args: {
    address: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{ accountId: Id<"mailAccounts"> }> => {
    const address = normalizeICloudAddress(args.address);
    const password = args.password.trim();
    if (password.length < 8 || password.length > 200) {
      throw new ConvexError("Enter a valid Apple app-specific password");
    }
    const { imapUsername } = await verifyCredentials({ address, password });
    const accountId = await ctx.runMutation(
      internal.providers.icloud.internal.upsertAccount,
      {
        ownerId: ctx.ownerId,
        address,
        displayName: "iCloud",
      },
    );
    const encryptedCredential = await encryptProviderSecret(
      { imapUsername, password },
      credentialAdditionalData(ctx.ownerId, accountId, "icloud"),
    );
    await ctx.runMutation(internal.sync.internal.storeProviderCredential, {
      ownerId: ctx.ownerId,
      accountId,
      encryptedTokens: encryptedCredential,
      grantedScopes: ["imap", "smtp"],
    });
    await ctx.scheduler.runAfter(
      0,
      internal.providers.icloud.sync.synchronize,
      {
        ownerId: ctx.ownerId,
        accountId,
        reason: "initial",
      },
    );
    return { accountId };
  },
});

function normalizeICloudAddress(value: string) {
  const address = value.trim().toLowerCase();
  if (!/^[^\s@]+@(?:icloud\.com|me\.com|mac\.com)$/u.test(address)) {
    throw new ConvexError("Enter an iCloud, me.com, or mac.com mail address");
  }
  return address;
}
