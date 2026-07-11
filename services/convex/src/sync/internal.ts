/* eslint-disable complexity, max-lines, max-lines-per-function, no-restricted-syntax, @typescript-eslint/consistent-type-assertions -- Provider orchestration keeps transaction and action contracts explicit. */
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { NormalizedMessage } from "../providers/types";
import { internal } from "../_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import {
  queueEmbeddingForMessage,
  reconcileEmbeddingSelection,
} from "../embedding/internal";
import { createMessageSearchText } from "../mail/search";
import { getThreadInboxState } from "../mail/threadState";
import {
  vEncryptedEnvelope,
  vMailboxAddress,
  vMailFolderKind,
  vMailProvider,
  vMessageHeader,
  vSyncReason,
} from "../mail/validators";
import { queueNewMailNotification } from "../notifications/internal";
import { shouldNotifyForProviderMessage } from "../notifications/policy";
import { GmailAdapter, GmailApiError } from "../providers/gmail/api";
import { getUsableGmailTokens } from "../providers/gmail/tokenAccess";
import {
  MicrosoftGraphAdapter,
  MicrosoftGraphError,
} from "../providers/microsoft/api";
import { getUsableMicrosoftTokens } from "../providers/microsoft/tokenAccess";

const vNormalizedAttachment = v.object({
  remoteAttachmentId: v.string(),
  fileName: v.string(),
  contentType: v.string(),
  size: v.number(),
  isInline: v.boolean(),
  contentId: v.optional(v.string()),
});

const vNormalizedMessage = v.object({
  remoteMessageId: v.string(),
  remoteThreadId: v.string(),
  internetMessageId: v.optional(v.string()),
  from: vMailboxAddress,
  replyTo: v.optional(v.array(vMailboxAddress)),
  to: v.array(vMailboxAddress),
  cc: v.array(vMailboxAddress),
  bcc: v.array(vMailboxAddress),
  subject: v.string(),
  snippet: v.string(),
  plainText: v.optional(v.string()),
  headers: v.array(vMessageHeader),
  remoteLabelIds: v.array(v.string()),
  sentAt: v.optional(v.number()),
  receivedAt: v.number(),
  hasAttachments: v.boolean(),
  inInbox: v.boolean(),
  isRead: v.boolean(),
  direction: v.union(v.literal("incoming"), v.literal("outgoing")),
  attachments: v.array(vNormalizedAttachment),
});

interface RemoteMessageIdPage {
  continueCursor: string;
  isDone: boolean;
  page: string[];
}

export const storeOAuthState = internalMutation({
  args: {
    ownerId: v.string(),
    provider: vMailProvider,
    stateHash: v.string(),
    encryptedCodeVerifier: vEncryptedEnvelope,
    returnPath: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const previous = await ctx.db
      .query("providerOAuthStates")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", args.ownerId))
      .collect();
    for (const state of previous) {
      if (state.provider === args.provider) await ctx.db.delete(state._id);
    }
    await ctx.db.insert("providerOAuthStates", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const consumeOAuthState = internalMutation({
  args: {
    provider: vMailProvider,
    stateHash: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("providerOAuthStates")
      .withIndex("by_state_hash", (q) => q.eq("stateHash", args.stateHash))
      .unique();
    if (!state) return null;
    if (state.expiresAt < args.now) {
      await ctx.db.delete(state._id);
      return null;
    }
    if (state.provider !== args.provider) return null;
    await ctx.db.delete(state._id);
    return {
      ownerId: state.ownerId,
      encryptedCodeVerifier: state.encryptedCodeVerifier,
      returnPath: state.returnPath,
    };
  },
});

export const upsertGmailAccount = internalMutation({
  args: {
    ownerId: v.string(),
    remoteAccountId: v.string(),
    address: v.string(),
    grantedScopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("mailAccounts")
      .withIndex("by_owner_provider_remote", (q) =>
        q
          .eq("ownerId", args.ownerId)
          .eq("provider", "gmail")
          .eq("remoteAccountId", args.remoteAccountId),
      )
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        address: args.address,
        grantedScopes: args.grantedScopes,
        lastSyncError: undefined,
        status: "syncing",
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("mailAccounts", {
      ownerId: args.ownerId,
      provider: "gmail",
      remoteAccountId: args.remoteAccountId,
      address: args.address,
      status: "syncing",
      grantedScopes: args.grantedScopes,
      connectedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const upsertMicrosoftAccount = internalMutation({
  args: {
    ownerId: v.string(),
    remoteAccountId: v.string(),
    address: v.string(),
    displayName: v.optional(v.string()),
    grantedScopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("mailAccounts")
      .withIndex("by_owner_provider_remote", (q) =>
        q
          .eq("ownerId", args.ownerId)
          .eq("provider", "microsoft")
          .eq("remoteAccountId", args.remoteAccountId),
      )
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        address: args.address,
        displayName: args.displayName,
        grantedScopes: args.grantedScopes,
        lastSyncError: undefined,
        status: "syncing",
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("mailAccounts", {
      ownerId: args.ownerId,
      provider: "microsoft",
      remoteAccountId: args.remoteAccountId,
      address: args.address,
      displayName: args.displayName,
      status: "syncing",
      grantedScopes: args.grantedScopes,
      connectedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getProviderCredential = internalQuery({
  args: { ownerId: v.string(), accountId: v.id("mailAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account || account.ownerId !== args.ownerId) return null;
    return await ctx.db
      .query("providerCredentials")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .unique();
  },
});

export const storeProviderCredential = internalMutation({
  args: {
    ownerId: v.string(),
    accountId: v.id("mailAccounts"),
    encryptedTokens: vEncryptedEnvelope,
    tokenExpiresAt: v.optional(v.number()),
    grantedScopes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account || account.ownerId !== args.ownerId) {
      throw new ConvexError("Mail account not found");
    }
    const existing = await ctx.db
      .query("providerCredentials")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedTokens: args.encryptedTokens,
        tokenExpiresAt: args.tokenExpiresAt,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("providerCredentials", {
        ownerId: args.ownerId,
        accountId: args.accountId,
        provider: account.provider,
        encryptedTokens: args.encryptedTokens,
        tokenExpiresAt: args.tokenExpiresAt,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.patch(account._id, {
      credentialKeyVersion: args.encryptedTokens.keyVersion,
      grantedScopes: args.grantedScopes ?? account.grantedScopes,
      updatedAt: now,
    });
  },
});

export const createRun = internalMutation({
  args: {
    ownerId: v.string(),
    accountId: v.id("mailAccounts"),
    reason: vSyncReason,
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account || account.ownerId !== args.ownerId) {
      throw new ConvexError("Mail account not found");
    }
    const now = Date.now();
    const recentRuns = await ctx.db
      .query("syncRuns")
      .withIndex("by_account_created", (q) => q.eq("accountId", args.accountId))
      .order("desc")
      .take(5);
    if (
      recentRuns.some(
        (run) =>
          ["pending", "running"].includes(run.status) &&
          run.createdAt > now - 10 * 60 * 1000,
      )
    )
      return null;
    return await ctx.db.insert("syncRuns", {
      ownerId: args.ownerId,
      accountId: args.accountId,
      reason: args.reason,
      status: "pending",
      cursor: args.cursor,
      attempt: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const startRun = internalMutation({
  args: { syncRunId: v.id("syncRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.syncRunId);
    if (!run) throw new ConvexError("Sync run not found");
    const now = Date.now();
    await Promise.all([
      ctx.db.patch(run._id, {
        attempt: run.attempt + 1,
        error: undefined,
        startedAt: now,
        status: "running",
        updatedAt: now,
      }),
      ctx.db.patch(run.accountId, {
        lastSyncError: undefined,
        status: "syncing",
        updatedAt: now,
      }),
    ]);
  },
});

export const finishRun = internalMutation({
  args: {
    syncRunId: v.id("syncRuns"),
    cursor: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.syncRunId);
    if (!run) throw new ConvexError("Sync run not found");
    const account = await ctx.db.get(run.accountId);
    if (!account) throw new ConvexError("Mail account not found");
    const now = Date.now();
    const failed = args.error !== undefined;
    await Promise.all([
      ctx.db.patch(run._id, {
        completedAt: now,
        cursor: args.cursor ?? run.cursor,
        error: args.error,
        status: failed ? "failed" : "succeeded",
        updatedAt: now,
      }),
      ctx.db.patch(run.accountId, {
        lastSyncError: args.error,
        ...(failed
          ? {}
          : {
              lastSyncedAt: now,
              syncCursor: args.cursor ?? run.cursor,
            }),
        status:
          failed && account.status === "reauthorization_required"
            ? "reauthorization_required"
            : failed
              ? "error"
              : "connected",
        updatedAt: now,
      }),
    ]);
  },
});

export const executeGmailSync = internalAction({
  args: {
    ownerId: v.string(),
    accountId: v.id("mailAccounts"),
    reason: vSyncReason,
  },
  handler: async (ctx, args): Promise<void> => {
    const syncRunId: Id<"syncRuns"> | null = await ctx.runMutation(
      internal.sync.internal.createRun,
      {
        ownerId: args.ownerId,
        accountId: args.accountId,
        reason: args.reason,
      },
    );
    if (!syncRunId) return;
    await ctx.runMutation(internal.sync.internal.startRun, { syncRunId });
    try {
      const connection = await ctx.runQuery(
        internal.sync.internal.getGmailSyncContext,
        { ownerId: args.ownerId, accountId: args.accountId },
      );
      if (!connection) throw new Error("Gmail connection is unavailable");
      const tokens = await getUsableGmailTokens(ctx, {
        ownerId: args.ownerId,
        accountId: args.accountId,
        encryptedTokens: connection.credential.encryptedTokens,
      });
      const adapter = new GmailAdapter();
      const cursor = connection.account.syncCursor;
      let reconciledDeletedRemoteMessageIds: string[] = [];
      let syncResult:
        | Awaited<ReturnType<GmailAdapter["fullSync"]>>
        | Awaited<ReturnType<GmailAdapter["incrementalSync"]>>;
      let fullSync = !cursor || args.reason === "initial";
      try {
        if (fullSync) {
          syncResult = await adapter.fullSync(tokens.accessToken);
        } else if (cursor) {
          syncResult = await adapter.incrementalSync(
            tokens.accessToken,
            cursor,
          );
        } else {
          throw new Error("Gmail sync cursor is unavailable");
        }
      } catch (error) {
        if (
          !fullSync &&
          error instanceof GmailApiError &&
          error.status === 404
        ) {
          fullSync = true;
          const knownRemoteMessageIds = await ctx.runAction(
            internal.sync.internal.listProviderRemoteMessageIds,
            { ownerId: args.ownerId, accountId: args.accountId },
          );
          reconciledDeletedRemoteMessageIds =
            await adapter.findDeletedMessageIds(
              tokens.accessToken,
              knownRemoteMessageIds,
            );
          syncResult = await adapter.fullSync(tokens.accessToken);
        } else {
          throw error;
        }
      }

      if ("folders" in syncResult) {
        for (const folder of syncResult.folders) {
          await ctx.runMutation(internal.sync.internal.upsertProviderFolder, {
            ownerId: args.ownerId,
            accountId: args.accountId,
            ...folder,
          });
        }
      }
      for (const message of syncResult.messages) {
        await ctx.runMutation(internal.sync.internal.upsertProviderMessage, {
          ownerId: args.ownerId,
          accountId: args.accountId,
          message,
          notifyNewMail: shouldNotifyForProviderMessage({
            fullSync,
            now: Date.now(),
            reason: args.reason,
            receivedAt: message.receivedAt,
          }),
        });
      }
      const deletedRemoteMessageIds = new Set([
        ...reconciledDeletedRemoteMessageIds,
        ...("deletedRemoteMessageIds" in syncResult
          ? syncResult.deletedRemoteMessageIds
          : []),
      ]);
      if (deletedRemoteMessageIds.size > 0) {
        for (const remoteMessageId of deletedRemoteMessageIds) {
          await ctx.runMutation(internal.sync.internal.deleteProviderMessage, {
            ownerId: args.ownerId,
            accountId: args.accountId,
            remoteMessageId,
          });
        }
      }
      await ctx.runMutation(internal.sync.internal.finishRun, {
        syncRunId,
        cursor: syncResult.cursor,
      });
    } catch (error) {
      await ctx.runMutation(internal.sync.internal.finishRun, {
        syncRunId,
        error: safeErrorMessage(error),
      });
    }
  },
});

export const executeMicrosoftSync = internalAction({
  args: {
    ownerId: v.string(),
    accountId: v.id("mailAccounts"),
    reason: vSyncReason,
  },
  handler: async (ctx, args): Promise<void> => {
    const syncRunId: Id<"syncRuns"> | null = await ctx.runMutation(
      internal.sync.internal.createRun,
      {
        ownerId: args.ownerId,
        accountId: args.accountId,
        reason: args.reason,
      },
    );
    if (!syncRunId) return;
    await ctx.runMutation(internal.sync.internal.startRun, { syncRunId });
    try {
      const connection = await ctx.runQuery(
        internal.sync.internal.getMicrosoftSyncContext,
        { ownerId: args.ownerId, accountId: args.accountId },
      );
      if (!connection) throw new Error("Microsoft connection is unavailable");
      const tokens = await getUsableMicrosoftTokens(ctx, {
        ownerId: args.ownerId,
        accountId: args.accountId,
        encryptedTokens: connection.credential.encryptedTokens,
      });
      const adapter = new MicrosoftGraphAdapter();
      const cursor = connection.account.syncCursor;
      let reconciledDeletedRemoteMessageIds: string[] = [];
      let syncResult:
        | Awaited<ReturnType<MicrosoftGraphAdapter["fullSync"]>>
        | Awaited<ReturnType<MicrosoftGraphAdapter["incrementalSync"]>>;
      let fullSync = !cursor || args.reason === "initial";
      try {
        if (fullSync) {
          syncResult = await adapter.fullSync(tokens.accessToken);
        } else if (cursor) {
          syncResult = await adapter.incrementalSync(
            tokens.accessToken,
            cursor,
          );
        } else {
          throw new Error("Microsoft inbox delta cursor is unavailable");
        }
      } catch (error) {
        if (!fullSync && isExpiredMicrosoftDelta(error)) {
          fullSync = true;
          syncResult = await adapter.fullSync(tokens.accessToken);
        } else {
          throw error;
        }
      }

      if (fullSync) {
        const knownRemoteMessageIds = await ctx.runAction(
          internal.sync.internal.listProviderRemoteMessageIds,
          { ownerId: args.ownerId, accountId: args.accountId },
        );
        const remoteIds = new Set(
          syncResult.messages.map((message) => message.remoteMessageId),
        );
        reconciledDeletedRemoteMessageIds = knownRemoteMessageIds.filter(
          (remoteMessageId) => !remoteIds.has(remoteMessageId),
        );
      }

      if ("folders" in syncResult) {
        for (const folder of syncResult.folders) {
          await ctx.runMutation(internal.sync.internal.upsertProviderFolder, {
            ownerId: args.ownerId,
            accountId: args.accountId,
            ...folder,
          });
        }
      }
      for (const message of syncResult.messages) {
        await ctx.runMutation(internal.sync.internal.upsertProviderMessage, {
          ownerId: args.ownerId,
          accountId: args.accountId,
          message,
          notifyNewMail: shouldNotifyForProviderMessage({
            fullSync,
            now: Date.now(),
            reason: args.reason,
            receivedAt: message.receivedAt,
          }),
        });
      }
      const deletedRemoteMessageIds = new Set([
        ...reconciledDeletedRemoteMessageIds,
        ...("deletedRemoteMessageIds" in syncResult
          ? syncResult.deletedRemoteMessageIds
          : []),
      ]);
      for (const remoteMessageId of deletedRemoteMessageIds) {
        await ctx.runMutation(internal.sync.internal.deleteProviderMessage, {
          ownerId: args.ownerId,
          accountId: args.accountId,
          remoteMessageId,
        });
      }
      await ctx.runMutation(internal.sync.internal.finishRun, {
        syncRunId,
        cursor: syncResult.cursor,
      });
    } catch (error) {
      await ctx.runMutation(internal.sync.internal.finishRun, {
        syncRunId,
        error: safeErrorMessage(error),
      });
    }
  },
});

export const getGmailSyncContext = internalQuery({
  args: { ownerId: v.string(), accountId: v.id("mailAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (
      !account ||
      account.ownerId !== args.ownerId ||
      account.provider !== "gmail"
    ) {
      return null;
    }
    const credential = await ctx.db
      .query("providerCredentials")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .unique();
    return credential ? { account, credential } : null;
  },
});

export const getMicrosoftSyncContext = internalQuery({
  args: { ownerId: v.string(), accountId: v.id("mailAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (
      !account ||
      account.ownerId !== args.ownerId ||
      account.provider !== "microsoft"
    ) {
      return null;
    }
    const credential = await ctx.db
      .query("providerCredentials")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .unique();
    return credential ? { account, credential } : null;
  },
});

export const setMicrosoftMessageRead = internalAction({
  args: {
    ownerId: v.string(),
    accountId: v.id("mailAccounts"),
    remoteMessageId: v.string(),
    isRead: v.boolean(),
    attempt: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const attempt = args.attempt ?? 0;
    try {
      const connection = await ctx.runQuery(
        internal.sync.internal.getMicrosoftSyncContext,
        { ownerId: args.ownerId, accountId: args.accountId },
      );
      if (!connection) throw new Error("Microsoft connection is unavailable");
      const tokens = await getUsableMicrosoftTokens(ctx, {
        ownerId: args.ownerId,
        accountId: args.accountId,
        encryptedTokens: connection.credential.encryptedTokens,
      });
      await new MicrosoftGraphAdapter().setRead(
        tokens.accessToken,
        args.remoteMessageId,
        args.isRead,
      );
    } catch (error) {
      if (attempt < 2) {
        await ctx.scheduler.runAfter(
          2 ** attempt * 1_000,
          internal.sync.internal.setMicrosoftMessageRead,
          { ...args, attempt: attempt + 1 },
        );
        return;
      }
      throw error;
    }
  },
});

export const setGmailMessageRead = internalAction({
  args: {
    ownerId: v.string(),
    accountId: v.id("mailAccounts"),
    remoteMessageId: v.string(),
    isRead: v.boolean(),
    attempt: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const attempt = args.attempt ?? 0;
    try {
      const connection = await ctx.runQuery(
        internal.sync.internal.getGmailSyncContext,
        { ownerId: args.ownerId, accountId: args.accountId },
      );
      if (!connection) throw new Error("Gmail connection is unavailable");
      const tokens = await getUsableGmailTokens(ctx, {
        ownerId: args.ownerId,
        accountId: args.accountId,
        encryptedTokens: connection.credential.encryptedTokens,
      });
      await new GmailAdapter().setRead(
        tokens.accessToken,
        args.remoteMessageId,
        args.isRead,
      );
    } catch (error) {
      if (attempt < 2) {
        await ctx.scheduler.runAfter(
          2 ** attempt * 1_000,
          internal.sync.internal.setGmailMessageRead,
          { ...args, attempt: attempt + 1 },
        );
        return;
      }
      throw error;
    }
  },
});

export const listProviderRemoteMessageIds = internalAction({
  args: { ownerId: v.string(), accountId: v.id("mailAccounts") },
  handler: async (ctx, args) => {
    const remoteMessageIds: string[] = [];
    let cursor: string | null = null;
    let isDone = false;
    while (!isDone) {
      const page = (await ctx.runQuery(
        internal.sync.internal.listProviderRemoteMessageIdsPage,
        {
          ...args,
          paginationOpts: { cursor, numItems: 25 },
        },
      )) as RemoteMessageIdPage;
      remoteMessageIds.push(...page.page);
      cursor = page.continueCursor;
      isDone = page.isDone;
    }
    return remoteMessageIds;
  },
});

export const listProviderRemoteMessageIdsPage = internalQuery({
  args: {
    ownerId: v.string(),
    accountId: v.id("mailAccounts"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account || account.ownerId !== args.ownerId) {
      return { continueCursor: "", isDone: true, page: [] };
    }
    const result = await ctx.db
      .query("messages")
      .withIndex("by_account_remote", (q) => q.eq("accountId", args.accountId))
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((message) => message.remoteMessageId),
    };
  },
});

export const listScheduledGmailAccounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("mailAccounts").collect();
    const cutoff = Date.now() - 4 * 60 * 1000;
    return accounts
      .filter(
        (account) =>
          account.provider === "gmail" &&
          !account.isDemo &&
          ["connected", "error"].includes(account.status) &&
          (account.lastSyncedAt ?? 0) < cutoff,
      )
      .map((account) => ({
        ownerId: account.ownerId,
        accountId: account._id,
      }));
  },
});

export const listScheduledMicrosoftAccounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("mailAccounts").collect();
    const cutoff = Date.now() - 4 * 60 * 1000;
    return accounts
      .filter(
        (account) =>
          account.provider === "microsoft" &&
          !account.isDemo &&
          ["connected", "error"].includes(account.status) &&
          (account.lastSyncedAt ?? 0) < cutoff,
      )
      .map((account) => ({
        ownerId: account.ownerId,
        accountId: account._id,
      }));
  },
});

export const listRecoverableProviderOutbox = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const [pending, failed, sending] = await Promise.all([
      ctx.db
        .query("outboxMessages")
        .withIndex("by_status_created", (q) => q.eq("status", "pending"))
        .take(100),
      ctx.db
        .query("outboxMessages")
        .withIndex("by_status_created", (q) => q.eq("status", "failed"))
        .take(100),
      ctx.db
        .query("outboxMessages")
        .withIndex("by_status_created", (q) => q.eq("status", "sending"))
        .take(100),
    ]);
    const recoverable = [...pending, ...failed, ...sending].filter(
      (outbox) =>
        (outbox.status !== "failed" || outbox.attempt < 3) &&
        (outbox.status !== "sending" ||
          outbox.updatedAt < now - 10 * 60 * 1000),
    );
    const providerOutboxIds: Id<"outboxMessages">[] = [];
    for (const outbox of recoverable) {
      const account = await ctx.db.get(outbox.accountId);
      if (
        account &&
        ["gmail", "microsoft", "icloud"].includes(account.provider)
      ) {
        providerOutboxIds.push(outbox._id);
      }
    }
    return providerOutboxIds;
  },
});

export const runScheduledProviderWork = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    const [gmailAccounts, microsoftAccounts, icloudAccounts, outboxIds] =
      await Promise.all([
        ctx.runQuery(internal.sync.internal.listScheduledGmailAccounts, {}),
        ctx.runQuery(internal.sync.internal.listScheduledMicrosoftAccounts, {}),
        ctx.runQuery(
          internal.providers.icloud.internal.listScheduledAccounts,
          {},
        ),
        ctx.runQuery(internal.sync.internal.listRecoverableProviderOutbox, {}),
      ]);
    await Promise.all([
      ...gmailAccounts.map((account, index) =>
        ctx.scheduler.runAfter(
          index * 500,
          internal.sync.internal.executeGmailSync,
          { ...account, reason: "incremental" },
        ),
      ),
      ...microsoftAccounts.map((account, index) =>
        ctx.scheduler.runAfter(
          index * 500,
          internal.sync.internal.executeMicrosoftSync,
          { ...account, reason: "incremental" },
        ),
      ),
      ...icloudAccounts.map((account, index) =>
        ctx.scheduler.runAfter(
          index * 500,
          internal.providers.icloud.sync.synchronize,
          { ...account, reason: "incremental" },
        ),
      ),
      ...outboxIds.map((outboxId, index) =>
        ctx.scheduler.runAfter(
          index * 250,
          internal.sync.internal.deliverProviderOutbox,
          { outboxId },
        ),
      ),
    ]);
  },
});

export const markProviderReauthorization = internalMutation({
  args: {
    ownerId: v.string(),
    accountId: v.id("mailAccounts"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ensureInternalOwnedAccount(
      ctx,
      args.ownerId,
      args.accountId,
    );
    await ctx.db.patch(account._id, {
      status: "reauthorization_required",
      lastSyncError: args.error,
      updatedAt: Date.now(),
    });
  },
});

export const upsertProviderFolder = internalMutation({
  args: {
    ownerId: v.string(),
    accountId: v.id("mailAccounts"),
    remoteFolderId: v.string(),
    name: v.string(),
    kind: vMailFolderKind,
  },
  handler: async (ctx, args) => {
    await ensureInternalOwnedAccount(ctx, args.ownerId, args.accountId);
    const existing = await ctx.db
      .query("mailFolders")
      .withIndex("by_account_remote", (q) =>
        q
          .eq("accountId", args.accountId)
          .eq("remoteFolderId", args.remoteFolderId),
      )
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        kind: args.kind,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("mailFolders", {
        ownerId: args.ownerId,
        accountId: args.accountId,
        remoteFolderId: args.remoteFolderId,
        name: args.name,
        kind: args.kind,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const upsertProviderMessage = internalMutation({
  args: {
    ownerId: v.string(),
    accountId: v.id("mailAccounts"),
    message: vNormalizedMessage,
    notifyNewMail: v.boolean(),
  },
  handler: async (ctx, args) => {
    const account = await ensureInternalOwnedAccount(
      ctx,
      args.ownerId,
      args.accountId,
    );
    const message = args.message as NormalizedMessage;
    const now = Date.now();
    let thread = await ctx.db
      .query("threads")
      .withIndex("by_account_remote", (q) =>
        q
          .eq("accountId", args.accountId)
          .eq("remoteThreadId", message.remoteThreadId),
      )
      .unique();
    if (!thread) {
      const threadId = await ctx.db.insert("threads", {
        ownerId: args.ownerId,
        accountId: args.accountId,
        remoteThreadId: message.remoteThreadId,
        subject: message.subject,
        snippet: message.snippet,
        participants: uniqueAddresses([
          message.from,
          ...message.to,
          ...message.cc,
        ]),
        latestMessageAt: message.receivedAt,
        latestInboxMessageAt: message.inInbox ? message.receivedAt : undefined,
        messageCount: 0,
        unreadCount: 0,
        inInbox: message.inInbox,
        isPinned: false,
        hasAttachments: message.hasAttachments,
        createdAt: now,
        updatedAt: now,
      });
      thread = await ctx.db.get(threadId);
    }
    if (!thread) throw new ConvexError("Unable to create mail thread");

    const existing = await ctx.db
      .query("messages")
      .withIndex("by_account_remote", (q) =>
        q
          .eq("accountId", args.accountId)
          .eq("remoteMessageId", message.remoteMessageId),
      )
      .unique();
    const inInbox = existing?.hiddenAt ? false : message.inInbox;
    const messageFields = {
      ownerId: args.ownerId,
      accountId: args.accountId,
      threadId: thread._id,
      remoteMessageId: message.remoteMessageId,
      internetMessageId: message.internetMessageId,
      direction: message.direction,
      from: message.from,
      replyTo: message.replyTo,
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      subject: message.subject,
      snippet: message.snippet,
      searchText: createMessageSearchText({
        accountAddress: account.address,
        body: message.plainText,
        cc: message.cc,
        from: message.from,
        snippet: message.snippet,
        subject: message.subject,
        to: message.to,
      }),
      headers: message.headers,
      remoteLabelIds: message.remoteLabelIds,
      bodyState: message.plainText
        ? ("available" as const)
        : ("remote" as const),
      sentAt: message.sentAt,
      receivedAt: message.receivedAt,
      hasAttachments: message.hasAttachments,
      inInbox,
      isRead: message.isRead,
      updatedAt: now,
    };
    let messageId: Id<"messages">;
    if (existing) {
      messageId = existing._id;
      await ctx.db.patch(messageId, messageFields);
    } else {
      messageId = await ctx.db.insert("messages", {
        ...messageFields,
        isPinned: false,
        createdAt: now,
      });
    }
    await upsertMessageContent(
      ctx,
      args.ownerId,
      messageId,
      message.plainText,
      now,
    );
    await reconcileAttachments(
      ctx,
      args.ownerId,
      messageId,
      message.attachments,
      now,
    );
    if (inInbox) {
      await queueEmbeddingForMessage(ctx, {
        ownerId: args.ownerId,
        messageId,
        reason: "inbox",
      });
    } else {
      await reconcileEmbeddingSelection(ctx, messageId);
    }
    await recalculateThread(ctx, thread._id);
    if (
      args.notifyNewMail &&
      !existing &&
      message.direction === "incoming" &&
      message.inInbox
    ) {
      await queueNewMailNotification(ctx, {
        ownerId: args.ownerId,
        messageId,
      });
    }
  },
});

export const deleteProviderMessage = internalMutation({
  args: {
    ownerId: v.string(),
    accountId: v.id("mailAccounts"),
    remoteMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureInternalOwnedAccount(ctx, args.ownerId, args.accountId);
    const message = await ctx.db
      .query("messages")
      .withIndex("by_account_remote", (q) =>
        q
          .eq("accountId", args.accountId)
          .eq("remoteMessageId", args.remoteMessageId),
      )
      .unique();
    if (!message) return;
    const [contents, attachments, classifications, embeddingJobs, embeddings] =
      await Promise.all([
        ctx.db
          .query("messageContents")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .collect(),
        ctx.db
          .query("attachments")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .collect(),
        ctx.db
          .query("messageClassifications")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .collect(),
        ctx.db
          .query("messageEmbeddingJobs")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .collect(),
        ctx.db
          .query("messageEmbeddings")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .collect(),
      ]);
    for (const row of [
      ...contents,
      ...attachments,
      ...classifications,
      ...embeddingJobs,
      ...embeddings,
    ]) {
      if ("storageId" in row && row.storageId) {
        await ctx.storage.delete(row.storageId);
      }
      await ctx.db.delete(row._id);
    }
    await ctx.db.delete(message._id);
    await recalculateThread(ctx, message.threadId);
  },
});

export const claimOutbox = internalMutation({
  args: { outboxId: v.id("outboxMessages") },
  handler: async (ctx, args) => {
    const outbox = await ctx.db.get(args.outboxId);
    const now = Date.now();
    const reclaimingExpiredLease =
      outbox?.status === "sending" && outbox.updatedAt < now - 10 * 60 * 1000;
    if (
      !outbox ||
      (!reclaimingExpiredLease &&
        !["pending", "failed"].includes(outbox.status))
    )
      return null;
    const account = await ctx.db.get(outbox.accountId);
    if (!account || account.ownerId !== outbox.ownerId) return null;
    const attachments = await Promise.all(
      (outbox.attachmentIds ?? []).map(async (attachmentId) => {
        return await ctx.db.get(attachmentId);
      }),
    );
    if (
      attachments.some(
        (attachment) =>
          !attachment ||
          attachment.ownerId !== outbox.ownerId ||
          attachment.status !== "claimed" ||
          attachment.outboxId !== outbox._id ||
          !attachment.storageId ||
          attachment.size === undefined,
      )
    ) {
      throw new ConvexError("A queued attachment is unavailable");
    }
    const leaseId = `${now}:${outbox.attempt + 1}`;
    await ctx.db.patch(outbox._id, {
      status: "sending",
      attempt: outbox.attempt + 1,
      leaseId,
      error: undefined,
      updatedAt: now,
    });
    return {
      ...outbox,
      attempt: outbox.attempt + 1,
      from: account.address,
      leaseId,
      attachments: attachments.flatMap((attachment) =>
        attachment?.storageId && attachment.size !== undefined
          ? [
              {
                fileName: attachment.fileName,
                contentType: attachment.contentType,
                size: attachment.size,
                storageId: attachment.storageId,
              },
            ]
          : [],
      ),
    };
  },
});

export const finishOutbox = internalMutation({
  args: {
    outboxId: v.id("outboxMessages"),
    leaseId: v.string(),
    remoteMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const outbox = await ctx.db.get(args.outboxId);
    if (outbox?.status !== "sending" || outbox.leaseId !== args.leaseId) return;
    const now = Date.now();
    await ctx.db.patch(outbox._id, {
      status: args.error ? "failed" : "sent",
      leaseId: undefined,
      error: args.error,
      remoteMessageId: args.remoteMessageId,
      sentAt: args.error ? undefined : now,
      updatedAt: now,
    });
  },
});

export const recordOutboxRemoteMessageId = internalMutation({
  args: {
    outboxId: v.id("outboxMessages"),
    leaseId: v.string(),
    remoteMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    const outbox = await ctx.db.get(args.outboxId);
    if (outbox?.status !== "sending" || outbox.leaseId !== args.leaseId) {
      throw new ConvexError("Outbox lease expired while creating the draft");
    }
    if (
      outbox.remoteMessageId &&
      outbox.remoteMessageId !== args.remoteMessageId
    ) {
      throw new ConvexError("Outbox already references a different draft");
    }
    await ctx.db.patch(outbox._id, {
      remoteMessageId: args.remoteMessageId,
      updatedAt: Date.now(),
    });
  },
});

export const getOutboxProvider = internalQuery({
  args: { outboxId: v.id("outboxMessages") },
  handler: async (ctx, args) => {
    const outbox = await ctx.db.get(args.outboxId);
    if (!outbox) return null;
    const account = await ctx.db.get(outbox.accountId);
    if (!account || account.ownerId !== outbox.ownerId) return null;
    return account.provider;
  },
});

export const deliverProviderOutbox = internalAction({
  args: { outboxId: v.id("outboxMessages") },
  handler: async (ctx, args): Promise<void> => {
    const provider = await ctx.runQuery(
      internal.sync.internal.getOutboxProvider,
      args,
    );
    if (provider === "gmail") {
      await ctx.runAction(internal.sync.internal.deliverGmailOutbox, args);
      return;
    }
    if (provider === "microsoft") {
      await ctx.runAction(internal.sync.internal.deliverMicrosoftOutbox, args);
      return;
    }
    if (provider === "icloud") {
      await ctx.runAction(internal.providers.icloud.outbox.deliver, args);
    }
  },
});

export const deliverGmailOutbox = internalAction({
  args: { outboxId: v.id("outboxMessages") },
  handler: async (ctx, args): Promise<void> => {
    await ctx.runAction(internal.sync.gmailOutbox.deliver, args);
  },
});

export const deliverMicrosoftOutbox = internalAction({
  args: { outboxId: v.id("outboxMessages") },
  handler: async (ctx, args): Promise<void> => {
    const outbox = await ctx.runMutation(
      internal.sync.internal.claimOutbox,
      args,
    );
    if (!outbox) return;
    try {
      const connection = await ctx.runQuery(
        internal.sync.internal.getMicrosoftSyncContext,
        { ownerId: outbox.ownerId, accountId: outbox.accountId },
      );
      if (!connection) throw new Error("Microsoft connection is unavailable");
      const tokens = await getUsableMicrosoftTokens(ctx, {
        ownerId: outbox.ownerId,
        accountId: outbox.accountId,
        encryptedTokens: connection.credential.encryptedTokens,
      });
      const attachments = await Promise.all(
        outbox.attachments.map(async (attachment) => {
          const url = await ctx.storage.getUrl(attachment.storageId);
          if (!url) throw new Error(`${attachment.fileName} is unavailable`);
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(
              `Could not read ${attachment.fileName} from storage`,
            );
          }
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (bytes.byteLength !== attachment.size) {
            throw new Error(`${attachment.fileName} failed its size check`);
          }
          return { ...attachment, bytes };
        }),
      );
      const result = await new MicrosoftGraphAdapter().sendPlainText(
        tokens.accessToken,
        {
          _id: outbox._id,
          accountId: outbox.accountId,
          remoteMessageId: outbox.remoteMessageId,
          from: outbox.from,
          to: outbox.to,
          cc: outbox.cc,
          bcc: outbox.bcc,
          subject: outbox.subject,
          plainText: outbox.plainText,
          replyToInternetMessageId: outbox.replyToInternetMessageId,
          replyToRemoteMessageId: outbox.replyToRemoteMessageId,
          attachments,
        },
        async (remoteMessageId) => {
          await ctx.runMutation(
            internal.sync.internal.recordOutboxRemoteMessageId,
            {
              outboxId: outbox._id,
              leaseId: outbox.leaseId,
              remoteMessageId,
            },
          );
        },
      );
      await ctx.runMutation(internal.sync.internal.finishOutbox, {
        outboxId: outbox._id,
        leaseId: outbox.leaseId,
        remoteMessageId: result.remoteMessageId,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.sync.internal.executeMicrosoftSync,
        {
          ownerId: outbox.ownerId,
          accountId: outbox.accountId,
          reason: "incremental",
        },
      );
    } catch (error) {
      await ctx.runMutation(internal.sync.internal.finishOutbox, {
        outboxId: outbox._id,
        leaseId: outbox.leaseId,
        error: safeErrorMessage(error),
      });
      if (outbox.attempt < 3) {
        await ctx.scheduler.runAfter(
          2 ** outbox.attempt * 1_000,
          internal.sync.internal.deliverMicrosoftOutbox,
          { outboxId: outbox._id },
        );
      }
    }
  },
});

function isExpiredMicrosoftDelta(error: unknown) {
  return (
    error instanceof MicrosoftGraphError &&
    (error.status === 410 ||
      ["syncStateNotFound", "resyncRequired", "InvalidDeltaToken"].includes(
        error.code ?? "",
      ))
  );
}
async function ensureInternalOwnedAccount(
  ctx: MutationCtx,
  ownerId: string,
  accountId: Id<"mailAccounts">,
) {
  const account = await ctx.db.get(accountId);
  if (account?.ownerId !== ownerId) {
    throw new ConvexError("Mail account not found");
  }
  return account;
}

async function upsertMessageContent(
  ctx: MutationCtx,
  ownerId: string,
  messageId: Id<"messages">,
  plainText: string | undefined,
  now: number,
) {
  const existing = await ctx.db
    .query("messageContents")
    .withIndex("by_message", (q) => q.eq("messageId", messageId))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, {
      plainText,
      truncated: false,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("messageContents", {
      ownerId,
      messageId,
      plainText,
      truncated: false,
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function reconcileAttachments(
  ctx: MutationCtx,
  ownerId: string,
  messageId: Id<"messages">,
  attachments: NormalizedMessage["attachments"],
  now: number,
) {
  const existing = await ctx.db
    .query("attachments")
    .withIndex("by_message", (q) => q.eq("messageId", messageId))
    .collect();
  const remoteIds = new Set(
    attachments.map((attachment) => attachment.remoteAttachmentId),
  );
  for (const previous of existing) {
    if (!remoteIds.has(previous.remoteAttachmentId)) {
      if (previous.storageId) await ctx.storage.delete(previous.storageId);
      await ctx.db.delete(previous._id);
    }
  }
  for (const attachment of attachments) {
    const previous = existing.find(
      (entry) => entry.remoteAttachmentId === attachment.remoteAttachmentId,
    );
    if (previous) {
      await ctx.db.patch(previous._id, {
        ...attachment,
        status: previous.storageId ? "available" : "remote",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("attachments", {
        ownerId,
        messageId,
        ...attachment,
        status: "remote",
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

async function recalculateThread(ctx: MutationCtx, threadId: Id<"threads">) {
  const thread = await ctx.db.get(threadId);
  if (!thread) return;
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_thread_received", (q) => q.eq("threadId", threadId))
    .collect();
  if (messages.length === 0) {
    await ctx.db.delete(threadId);
    return;
  }
  const latest = messages.reduce((current, message) =>
    message.receivedAt > current.receivedAt ? message : current,
  );
  const inboxState = getThreadInboxState(messages);
  await ctx.db.patch(threadId, {
    subject: latest.subject,
    snippet: latest.snippet,
    participants: uniqueAddresses(
      messages.flatMap((message) => [
        message.from,
        ...message.to,
        ...message.cc,
      ]),
    ),
    latestMessageAt:
      inboxState.latestInboxMessage?.receivedAt ?? latest.receivedAt,
    latestInboxMessageAt: inboxState.latestInboxMessageAt,
    latestInboxMessageId: inboxState.latestInboxMessageId,
    messageCount: messages.length,
    unreadCount: messages.filter((message) => !message.isRead).length,
    inInbox: inboxState.inInbox,
    isPinned: inboxState.isPinned,
    hasAttachments: messages.some((message) => message.hasAttachments),
    updatedAt: Date.now(),
  });
}

function uniqueAddresses(addresses: { address: string; name?: string }[]) {
  return [
    ...new Map(
      addresses.map((address) => [address.address.toLowerCase(), address]),
    ).values(),
  ];
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Sync failed";
}
