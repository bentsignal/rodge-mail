"use node";

import type { ListResponse } from "imapflow";
import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
import type { ICloudCredential } from "./credentialAccess";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { vSyncReason } from "../../mail/validators";
import {
  createImapClient,
  isAuthenticationFailure,
  safeErrorMessage,
  safeLogout,
} from "./client";
import { decryptICloudCredential } from "./credentialAccess";
import { parseRemoteMessageId } from "./identifiers";
import {
  isSelectableMailbox,
  normalizeMessage,
  toNormalizedFolder,
} from "./normalize";

const FETCH_BATCH_SIZE = 25;
const MAX_MESSAGES_PER_MAILBOX_PER_RUN = 200;

export const synchronize = internalAction({
  args: {
    ownerId: v.string(),
    accountId: v.id("mailAccounts"),
    reason: vSyncReason,
  },
  handler: async (ctx, args): Promise<void> => {
    const syncRunId = await ctx.runMutation(
      internal.sync.internal.createRun,
      args,
    );
    if (!syncRunId) return;
    await ctx.runMutation(internal.sync.internal.startRun, { syncRunId });
    try {
      const connection = await ctx.runQuery(
        internal.providers.icloud.internal.getConnection,
        { ownerId: args.ownerId, accountId: args.accountId },
      );
      if (!connection) throw new Error("iCloud connection is unavailable");
      const credential = await decryptICloudCredential({
        ownerId: args.ownerId,
        accountId: args.accountId,
        encryptedCredential: connection.credential.encryptedTokens,
      });
      const knownRemoteIds = await ctx.runQuery(
        internal.sync.internal.listProviderRemoteMessageIds,
        { ownerId: args.ownerId, accountId: args.accountId },
      );
      const mailboxCount = await synchronizeMailboxes({
        ctx,
        ownerId: args.ownerId,
        accountId: args.accountId,
        accountAddress: connection.account.address,
        credential,
        knownRemoteIds,
      });
      await ctx.runMutation(internal.sync.internal.finishRun, {
        syncRunId,
        cursor: JSON.stringify({
          version: 2,
          completedAt: Date.now(),
          mailboxCount,
        }),
      });
    } catch (error) {
      const message = safeErrorMessage(error);
      if (isAuthenticationFailure(error)) {
        await ctx.runMutation(
          internal.providers.icloud.internal.markReauthorizationRequired,
          { ownerId: args.ownerId, accountId: args.accountId, error: message },
        );
      }
      await ctx.runMutation(internal.sync.internal.finishRun, {
        syncRunId,
        error: message,
      });
    }
  },
});

async function synchronizeMailboxes(args: {
  ctx: ActionCtx;
  ownerId: string;
  accountId: Id<"mailAccounts">;
  accountAddress: string;
  credential: ICloudCredential;
  knownRemoteIds: string[];
}) {
  const client = createImapClient(args.credential);
  try {
    await client.connect();
    const mailboxes = (await client.list()).filter(isSelectableMailbox);
    for (const mailbox of mailboxes) {
      await args.ctx.runMutation(internal.sync.internal.upsertProviderFolder, {
        ownerId: args.ownerId,
        accountId: args.accountId,
        ...toNormalizedFolder(mailbox),
      });
      await synchronizeMailbox(client, mailbox, args);
    }
    return mailboxes.length;
  } finally {
    await safeLogout(client);
  }
}

async function synchronizeMailbox(
  client: ReturnType<typeof createImapClient>,
  mailbox: ListResponse,
  args: {
    ctx: ActionCtx;
    ownerId: string;
    accountId: Id<"mailAccounts">;
    accountAddress: string;
    knownRemoteIds: string[];
  },
) {
  const opened = await client.mailboxOpen(mailbox.path, { readOnly: true });
  const uidValidity = opened.uidValidity.toString();
  const found = await client.search({ all: true }, { uid: true });
  const currentUids = found === false ? [] : found;
  const known = args.knownRemoteIds.flatMap((remoteMessageId) => {
    const parsed = parseRemoteMessageId(remoteMessageId);
    return parsed?.mailbox === mailbox.path
      ? [{ ...parsed, remoteMessageId }]
      : [];
  });
  const currentUidSet = new Set(currentUids);
  const importedUids = new Set(
    known
      .filter((item) => item.uidValidity === uidValidity)
      .map((item) => item.uid),
  );
  const pendingUids = currentUids
    .filter((uid) => !importedUids.has(uid))
    .slice(-MAX_MESSAGES_PER_MAILBOX_PER_RUN);
  for (const remoteMessageId of known
    .filter(
      (item) =>
        item.uidValidity !== uidValidity || !currentUidSet.has(item.uid),
    )
    .map((item) => item.remoteMessageId)) {
    await args.ctx.runMutation(internal.sync.internal.deleteProviderMessage, {
      ownerId: args.ownerId,
      accountId: args.accountId,
      remoteMessageId,
    });
  }
  for (const uidBatch of chunk(pendingUids, FETCH_BATCH_SIZE)) {
    for await (const message of client.fetch(
      uidBatch,
      {
        uid: true,
        flags: true,
        envelope: true,
        internalDate: true,
        size: true,
        source: { maxLength: 5_000_000 },
      },
      { uid: true },
    )) {
      await args.ctx.runMutation(internal.sync.internal.upsertProviderMessage, {
        ownerId: args.ownerId,
        accountId: args.accountId,
        message: await normalizeMessage(
          args.accountAddress,
          mailbox,
          uidValidity,
          message,
        ),
      });
    }
  }
}

function chunk<T>(values: T[], size: number) {
  const batches = new Array<T[]>();
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }
  return batches;
}
