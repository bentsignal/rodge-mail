"use node";

import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
import type { ICloudCredential } from "./credentialAccess";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import {
  createImapClient,
  createSmtpTransport,
  safeErrorMessage,
  safeLogout,
} from "./client";
import { decryptICloudCredential } from "./credentialAccess";
import {
  createRemoteMessageId,
  createStableMessageId,
  parseRemoteMessageId,
} from "./identifiers";

export const deliver = internalAction({
  args: { outboxId: v.id("outboxMessages") },
  handler: async (ctx, args): Promise<void> => {
    const outbox = await ctx.runMutation(
      internal.sync.internal.claimOutbox,
      args,
    );
    if (!outbox) return;
    try {
      const connection = await getConnection(ctx, {
        ownerId: outbox.ownerId,
        accountId: outbox.accountId,
      });
      const messageId = createStableMessageId(outbox._id, connection.address);
      const reconciled = await findSentMessage(
        connection.credential,
        messageId,
      );
      const remoteMessageId =
        reconciled ?? (await sendViaSmtp(ctx, connection, outbox, messageId));
      await ctx.runMutation(internal.sync.internal.finishOutbox, {
        outboxId: outbox._id,
        leaseId: outbox.leaseId,
        remoteMessageId,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.providers.icloud.sync.synchronize,
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
          internal.providers.icloud.outbox.deliver,
          { outboxId: outbox._id },
        );
      }
    }
  },
});

export const setRead = internalAction({
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
      const parsed = parseRemoteMessageId(args.remoteMessageId);
      if (!parsed) throw new Error("iCloud message identifier is invalid");
      const connection = await getConnection(ctx, args);
      const client = createImapClient(connection.credential);
      try {
        await client.connect();
        const opened = await client.mailboxOpen(parsed.mailbox);
        if (opened.uidValidity.toString() !== parsed.uidValidity) return;
        const method = args.isRead ? "messageFlagsAdd" : "messageFlagsRemove";
        await client[method](parsed.uid, ["\\Seen"], { uid: true });
      } finally {
        await safeLogout(client);
      }
    } catch (error) {
      if (attempt < 2) {
        await ctx.scheduler.runAfter(
          2 ** attempt * 1_000,
          internal.providers.icloud.outbox.setRead,
          { ...args, attempt: attempt + 1 },
        );
        return;
      }
      throw error;
    }
  },
});

async function getConnection(
  ctx: ActionCtx,
  args: { ownerId: string; accountId: Id<"mailAccounts"> },
) {
  const connection = await ctx.runQuery(
    internal.providers.icloud.internal.getConnection,
    args,
  );
  if (!connection) throw new Error("iCloud connection is unavailable");
  const credential = await decryptICloudCredential({
    ownerId: args.ownerId,
    accountId: args.accountId,
    encryptedCredential: connection.credential.encryptedTokens,
  });
  return { address: connection.account.address, credential };
}

async function findSentMessage(
  credential: ICloudCredential,
  messageId: string,
) {
  const client = createImapClient(credential);
  try {
    await client.connect();
    const sentMailbox = (await client.list()).find(
      (mailbox) => mailbox.specialUse?.toLowerCase() === "\\sent",
    );
    if (!sentMailbox) return null;
    const opened = await client.mailboxOpen(sentMailbox.path, {
      readOnly: true,
    });
    const matches =
      (await client.search(
        { header: { "message-id": messageId } },
        { uid: true },
      )) || [];
    const uid = matches.at(-1);
    return uid
      ? createRemoteMessageId(
          sentMailbox.path,
          opened.uidValidity.toString(),
          uid,
        )
      : null;
  } finally {
    await safeLogout(client);
  }
}

async function sendViaSmtp(
  ctx: ActionCtx,
  connection: { address: string; credential: ICloudCredential },
  outbox: {
    to: { address: string; name?: string }[];
    cc: { address: string; name?: string }[];
    bcc: { address: string; name?: string }[];
    subject: string;
    plainText: string;
    replyToInternetMessageId?: string;
    attachments: {
      fileName: string;
      contentType: string;
      size: number;
      storageId: Id<"_storage">;
    }[];
  },
  messageId: string,
) {
  const attachments = await Promise.all(
    outbox.attachments.map(async (attachment) => {
      const url = await ctx.storage.getUrl(attachment.storageId);
      if (!url) throw new Error(`${attachment.fileName} is unavailable`);
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`Could not read ${attachment.fileName}`);
      const content = Buffer.from(await response.arrayBuffer());
      if (content.byteLength !== attachment.size) {
        throw new Error(`${attachment.fileName} failed its size check`);
      }
      return {
        filename: attachment.fileName,
        contentType: attachment.contentType,
        content,
      };
    }),
  );
  const transport = createSmtpTransport({
    address: connection.address,
    password: connection.credential.password,
  });
  try {
    const result = await transport.sendMail({
      from: connection.address,
      to: formatAddresses(outbox.to),
      cc: formatAddresses(outbox.cc),
      bcc: formatAddresses(outbox.bcc),
      subject: outbox.subject,
      text: outbox.plainText,
      messageId,
      inReplyTo: outbox.replyToInternetMessageId,
      references: outbox.replyToInternetMessageId,
      attachments,
    });
    if (result.rejected.length > 0 || result.accepted.length === 0) {
      throw new Error("iCloud SMTP rejected every recipient");
    }
    return messageId;
  } finally {
    transport.close();
  }
}

function formatAddresses(addresses: { address: string; name?: string }[]) {
  return addresses.map((address) => ({
    address: address.address,
    name: address.name ?? "",
  }));
}
