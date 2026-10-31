"use node";

import { v } from "convex/values";

import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { hostedRemoteMessageId } from "./addresses";
import { getRawMessage } from "./aws";
import { normalizeHostedMessage, parseRawMessage } from "./normalize";

export const ingest = internalAction({
  args: {
    sesMessageId: v.string(),
    objectKey: v.string(),
    recipients: v.array(v.string()),
    receivedAt: v.number(),
    junk: v.boolean(),
  },
  handler: async (ctx, args): Promise<void> => {
    const accounts = await ctx.runQuery(
      internal.providers.hosted.internal.resolveRecipients,
      { recipients: args.recipients },
    );
    if (accounts.length === 0) {
      console.warn(
        `No hosted mailbox accepts ${args.recipients.length} recipient(s)`,
      );
      return;
    }
    const parsed = await parseRawMessage(await getRawMessage(args.objectKey));
    const remoteMessageId = hostedRemoteMessageId(args.sesMessageId);
    for (const account of accounts) {
      await ctx.runMutation(internal.sync.internal.upsertProviderMessage, {
        ownerId: account.ownerId,
        accountId: account.accountId,
        message: normalizeHostedMessage(parsed, {
          remoteMessageId,
          direction: "incoming",
          fallbackFrom: "unknown@invalid",
          receivedAt: args.receivedAt,
          junk: args.junk,
        }),
        notifyNewMail: !args.junk,
      });
    }
  },
});
