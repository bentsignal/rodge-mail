/* eslint-disable complexity, max-lines, max-lines-per-function, no-restricted-syntax, @typescript-eslint/consistent-type-assertions -- Provider orchestration keeps transaction and action contracts explicit. */
import { ConvexError, v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import type { NormalizedMessage, ProviderTokens } from "../providers/types";
import { internal } from "../_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import {
  vEncryptedEnvelope,
  vMailboxAddress,
  vMailFolderKind,
  vMessageHeader,
  vSyncReason,
} from "../mail/validators";
import {
  credentialAdditionalData,
  decryptProviderSecret,
  encryptProviderSecret,
} from "../providers/crypto";
import { GmailAdapter, GmailApiError } from "../providers/gmail/api";
import {
  GoogleOAuthError,
  refreshGoogleTokens,
} from "../providers/gmail/oauth";

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

export const storeOAuthState = internalMutation({
  args: {
    ownerId: v.string(),
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
    for (const state of previous) await ctx.db.delete(state._id);
    await ctx.db.insert("providerOAuthStates", {
      ...args,
      provider: "gmail",
      createdAt: Date.now(),
    });
  },
});

export const consumeOAuthState = internalMutation({
  args: { stateHash: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("providerOAuthStates")
      .withIndex("by_state_hash", (q) => q.eq("stateHash", args.stateHash))
      .unique();
    if (!state) return null;
    await ctx.db.delete(state._id);
    if (state.expiresAt < args.now || state.provider !== "gmail") return null;
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
    ) {
      throw new ConvexError("A sync is already in progress");
    }
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
    const syncRunId: Id<"syncRuns"> = await ctx.runMutation(
      internal.sync.internal.createRun,
      {
        ownerId: args.ownerId,
        accountId: args.accountId,
        reason: args.reason,
      },
    );
    await ctx.runMutation(internal.sync.internal.startRun, { syncRunId });
    try {
      const connection = await ctx.runQuery(
        internal.sync.internal.getGmailSyncContext,
        { ownerId: args.ownerId, accountId: args.accountId },
      );
      if (!connection) throw new Error("Gmail connection is unavailable");
      const tokens = await getUsableTokens(ctx, {
        ownerId: args.ownerId,
        accountId: args.accountId,
        encryptedTokens: connection.credential.encryptedTokens,
      });
      const adapter = new GmailAdapter();
      const cursor = connection.account.syncCursor;
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
        });
      }
      if ("deletedRemoteMessageIds" in syncResult) {
        for (const remoteMessageId of syncResult.deletedRemoteMessageIds) {
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
        messageCount: 0,
        unreadCount: 0,
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
      searchText: createProviderSearchText(message, account.address),
      headers: message.headers,
      remoteLabelIds: message.remoteLabelIds,
      bodyState: message.plainText
        ? ("available" as const)
        : ("remote" as const),
      sentAt: message.sentAt,
      receivedAt: message.receivedAt,
      hasAttachments: message.hasAttachments,
      inInbox: message.inInbox,
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
        focusBucket: "unclassified",
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
    if (!existing) {
      await ctx.db.insert("messageClassifications", {
        ownerId: args.ownerId,
        messageId,
        status: "pending",
        bucket: "unclassified",
        importance: 0,
        confidence: 0,
        shouldEmbed: true,
        source: "rules",
        promptVersion: "provider-v1",
        createdAt: now,
        updatedAt: now,
      });
    }
    await recalculateThread(ctx, thread._id);
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
    const [contents, attachments, classifications] = await Promise.all([
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
    ]);
    for (const row of [...contents, ...attachments, ...classifications]) {
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
    if (!outbox || !["pending", "failed"].includes(outbox.status)) return null;
    const account = await ctx.db.get(outbox.accountId);
    if (!account || account.ownerId !== outbox.ownerId) return null;
    await ctx.db.patch(outbox._id, {
      status: "sending",
      attempt: outbox.attempt + 1,
      error: undefined,
      updatedAt: Date.now(),
    });
    return {
      ...outbox,
      attempt: outbox.attempt + 1,
      from: account.address,
    };
  },
});

export const finishOutbox = internalMutation({
  args: {
    outboxId: v.id("outboxMessages"),
    remoteMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const outbox = await ctx.db.get(args.outboxId);
    if (outbox?.status !== "sending") return;
    const now = Date.now();
    await ctx.db.patch(outbox._id, {
      status: args.error ? "failed" : "sent",
      error: args.error,
      remoteMessageId: args.remoteMessageId,
      sentAt: args.error ? undefined : now,
      updatedAt: now,
    });
  },
});

export const deliverGmailOutbox = internalAction({
  args: { outboxId: v.id("outboxMessages") },
  handler: async (ctx, args): Promise<void> => {
    const outbox = await ctx.runMutation(
      internal.sync.internal.claimOutbox,
      args,
    );
    if (!outbox) return;
    try {
      const connection = await ctx.runQuery(
        internal.sync.internal.getGmailSyncContext,
        { ownerId: outbox.ownerId, accountId: outbox.accountId },
      );
      if (!connection) throw new Error("Gmail connection is unavailable");
      const tokens = await getUsableTokens(ctx, {
        ownerId: outbox.ownerId,
        accountId: outbox.accountId,
        encryptedTokens: connection.credential.encryptedTokens,
      });
      const result = await new GmailAdapter().sendPlainText(
        tokens.accessToken,
        {
          _id: outbox._id,
          accountId: outbox.accountId,
          from: outbox.from,
          to: outbox.to,
          cc: outbox.cc,
          bcc: outbox.bcc,
          subject: outbox.subject,
          plainText: outbox.plainText,
          replyToInternetMessageId: outbox.replyToInternetMessageId,
        },
      );
      await ctx.runMutation(internal.sync.internal.finishOutbox, {
        outboxId: outbox._id,
        remoteMessageId: result.remoteMessageId,
      });
      await ctx.scheduler.runAfter(0, internal.sync.internal.executeGmailSync, {
        ownerId: outbox.ownerId,
        accountId: outbox.accountId,
        reason: "incremental",
      });
    } catch (error) {
      await ctx.runMutation(internal.sync.internal.finishOutbox, {
        outboxId: outbox._id,
        error: safeErrorMessage(error),
      });
      if (outbox.attempt < 3) {
        await ctx.scheduler.runAfter(
          2 ** outbox.attempt * 1_000,
          internal.sync.internal.deliverGmailOutbox,
          { outboxId: outbox._id },
        );
      }
    }
  },
});

async function getUsableTokens(
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
    if (!tokens.refreshToken)
      throw new Error("Gmail refresh token is unavailable");
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
        status: "remote",
        storageId: undefined,
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
    latestMessageAt: latest.receivedAt,
    messageCount: messages.length,
    unreadCount: messages.filter((message) => !message.isRead).length,
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

function createProviderSearchText(
  message: NormalizedMessage,
  accountAddress: string,
) {
  return [
    message.from.name,
    message.from.address,
    ...message.to.flatMap((address) => [address.name, address.address]),
    ...message.cc.flatMap((address) => [address.name, address.address]),
    accountAddress,
    message.subject,
    message.snippet,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Sync failed";
}
