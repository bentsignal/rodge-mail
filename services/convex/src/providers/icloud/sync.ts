"use node";

import type { ListResponse } from "imapflow";
import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
import type { ICloudCredential } from "./credentialAccess";
import type { ICloudMailboxCursor, ICloudSyncCursor } from "./window";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { vSyncReason } from "../../mail/validators";
import { shouldNotifyForProviderMessage } from "../../notifications/policy";
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
import {
  getTrackedReadStateChanges,
  parseICloudSyncCursor,
  planIncrementalMailboxSync,
  planInitialMailboxSync,
  recentWindowCutoff,
  toUidSequence,
} from "./window";

const FETCH_BATCH_SIZE = 25;

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
    const started = await ctx.runMutation(internal.sync.internal.startRun, {
      syncRunId,
    });
    if (!started) return;
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
      const knownMessages = await ctx.runAction(
        internal.sync.internal.listProviderMessageStates,
        { ownerId: args.ownerId, accountId: args.accountId },
      );
      const cursor = await synchronizeMailboxes({
        ctx,
        ownerId: args.ownerId,
        accountId: args.accountId,
        accountAddress: connection.account.address,
        credential,
        knownMessages,
        reason: args.reason,
        previousCursor: parseICloudSyncCursor(connection.account.syncCursor),
      });
      await ctx.runMutation(internal.sync.internal.finishRun, {
        syncRunId,
        cursor: JSON.stringify(cursor),
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
  knownMessages: { remoteMessageId: string; isRead: boolean }[];
  previousCursor: ICloudSyncCursor | undefined;
  reason: "incremental" | "initial" | "manual" | "reconcile";
}) {
  const client = createImapClient(args.credential);
  try {
    await client.connect();
    const mailboxes = (await client.list()).filter(isSelectableMailbox);
    const nextCursor = {
      version: 3,
      completedAt: Date.now(),
      mailboxes: { ...args.previousCursor?.mailboxes },
    } satisfies ICloudSyncCursor;
    for (const mailbox of mailboxes) {
      await args.ctx.runMutation(internal.sync.internal.upsertProviderFolder, {
        ownerId: args.ownerId,
        accountId: args.accountId,
        ...toNormalizedFolder(mailbox),
      });
      nextCursor.mailboxes[mailbox.path] = await synchronizeMailbox(
        client,
        mailbox,
        args,
      );
    }
    return nextCursor;
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
    knownMessages: { remoteMessageId: string; isRead: boolean }[];
    previousCursor: ICloudSyncCursor | undefined;
    reason: "incremental" | "initial" | "manual" | "reconcile";
  },
) {
  const opened = await client.mailboxOpen(mailbox.path, { readOnly: true });
  const uidValidity = opened.uidValidity.toString();
  const known = args.knownMessages.flatMap((message) => {
    const parsed = parseRemoteMessageId(message.remoteMessageId);
    return parsed?.mailbox === mailbox.path ? [{ ...parsed, ...message }] : [];
  });
  const importedUids = new Set(
    known
      .filter((item) => item.uidValidity === uidValidity)
      .map((item) => item.uid),
  );
  const mailboxHighWaterUid = Math.max(0, opened.uidNext - 1);
  const previous = args.previousCursor?.mailboxes[mailbox.path];
  const plan =
    previous?.uidValidity === uidValidity
      ? await createIncrementalPlan({
          client,
          previous,
          imported: known,
          mailboxHighWaterUid,
        })
      : await createInitialPlan({
          client,
          uidValidity,
          importedUids,
          mailboxHighWaterUid,
        });

  for (const remoteMessageId of plan.deletedRemoteMessageIds) {
    await args.ctx.runMutation(internal.sync.internal.deleteProviderMessage, {
      ownerId: args.ownerId,
      accountId: args.accountId,
      remoteMessageId,
    });
  }
  for (const change of plan.readStateChanges) {
    await args.ctx.runMutation(
      internal.sync.internal.updateProviderMessageReadState,
      {
        ownerId: args.ownerId,
        accountId: args.accountId,
        ...change,
      },
    );
  }
  for (const uidBatch of chunk(plan.pendingUids, FETCH_BATCH_SIZE)) {
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
      const normalized = await normalizeMessage(
        args.accountAddress,
        mailbox,
        uidValidity,
        message,
      );
      await args.ctx.runMutation(internal.sync.internal.upsertProviderMessage, {
        ownerId: args.ownerId,
        accountId: args.accountId,
        message: normalized,
        notifyNewMail: shouldNotifyForProviderMessage({
          fullSync: args.reason !== "incremental",
          now: Date.now(),
          reason: args.reason,
          receivedAt: normalized.receivedAt,
        }),
      });
    }
  }
  return plan.nextCursor;
}

async function createInitialPlan(args: {
  client: ReturnType<typeof createImapClient>;
  uidValidity: string;
  importedUids: Set<number>;
  mailboxHighWaterUid: number;
}) {
  const found = await args.client.search(
    { since: recentWindowCutoff(Date.now()) },
    { uid: true },
  );
  return {
    ...planInitialMailboxSync({
      recentUids: found === false ? [] : found,
      importedUids: args.importedUids,
      mailboxHighWaterUid: args.mailboxHighWaterUid,
      uidValidity: args.uidValidity,
    }),
    readStateChanges: [],
  };
}

async function createIncrementalPlan(args: {
  client: ReturnType<typeof createImapClient>;
  previous: ICloudMailboxCursor;
  imported: (NonNullable<ReturnType<typeof parseRemoteMessageId>> & {
    remoteMessageId: string;
    isRead: boolean;
  })[];
  mailboxHighWaterUid: number;
}) {
  const trackedSequence = toUidSequence(args.previous.trackedUids);
  const observedTracked = new Array<{ uid: number; isRead: boolean }>();
  if (trackedSequence) {
    for await (const message of args.client.fetch(
      trackedSequence,
      { uid: true, flags: true },
      { uid: true },
    )) {
      observedTracked.push({
        uid: message.uid,
        isRead: message.flags?.has("\\Seen") ?? false,
      });
    }
  }
  const newUids =
    args.mailboxHighWaterUid > args.previous.highWaterUid
      ? await args.client.search(
          { uid: `${args.previous.highWaterUid + 1}:*` },
          { uid: true },
        )
      : [];
  return {
    ...planIncrementalMailboxSync({
      cursor: args.previous,
      existingTrackedUids: observedTracked.map((item) => item.uid),
      imported: args.imported,
      mailboxHighWaterUid: args.mailboxHighWaterUid,
      newUids: newUids === false ? [] : newUids,
    }),
    readStateChanges: getTrackedReadStateChanges({
      cursor: args.previous,
      imported: args.imported,
      observed: observedTracked,
    }),
  };
}

function chunk<T>(values: T[], size: number) {
  const batches = new Array<T[]>();
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }
  return batches;
}
