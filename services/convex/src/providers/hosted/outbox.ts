"use node";

import { createHash } from "node:crypto";
import type { FunctionReturnType } from "convex/server";
import { v } from "convex/values";
import MailComposer from "nodemailer/lib/mail-composer";

import type { Id } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { createThreadId } from "../icloud/identifiers";
import {
  hostedObjectKey,
  hostedRemoteMessageId,
  sesInternetMessageId,
} from "./addresses";
import { putRawMessage, sendRawEmail, SesSendError } from "./aws";
import { normalizeHostedMessage, parseRawMessage } from "./normalize";

const MAX_ATTEMPTS = 3;

interface Recipient {
  address: string;
  name?: string;
}

export const deliver = internalAction({
  args: { outboxId: v.id("outboxMessages") },
  handler: async (ctx, args): Promise<void> => {
    const outbox = await ctx.runMutation(
      internal.sync.internal.claimOutbox,
      args,
    );
    if (!outbox) return;
    let result: Awaited<ReturnType<typeof sendOutbox>>;
    try {
      result = await sendOutbox(ctx, outbox);
    } catch (error) {
      await ctx.runMutation(internal.sync.internal.finishOutbox, {
        outboxId: outbox._id,
        leaseId: outbox.leaseId,
        error: error instanceof Error ? error.message : "Hosted send failed",
      });
      const retryable = !(error instanceof SesSendError) || error.retryable;
      if (retryable && outbox.attempt < MAX_ATTEMPTS) {
        await ctx.scheduler.runAfter(
          2 ** outbox.attempt * 1_000,
          internal.providers.hosted.outbox.deliver,
          args,
        );
      }
      return;
    }
    const remoteMessageId = hostedRemoteMessageId(result.sesMessageId);
    await ctx.runMutation(internal.sync.internal.finishOutbox, {
      outboxId: outbox._id,
      leaseId: outbox.leaseId,
      remoteMessageId,
    });
    try {
      await recordSentMessage(ctx, outbox, { ...result, remoteMessageId });
    } catch (error) {
      console.error(
        "Sent hosted message could not be recorded locally",
        error instanceof Error ? error.message : error,
      );
    }
  },
});

type ClaimedOutbox = NonNullable<
  FunctionReturnType<typeof internal.sync.internal.claimOutbox>
>;

async function sendOutbox(ctx: ActionCtx, outbox: ClaimedOutbox) {
  const context = await ctx.runQuery(
    internal.providers.hosted.internal.getOutboxContext,
    { outboxId: outbox._id },
  );
  if (!context) throw new Error("Hosted account is unavailable");
  const raw = await composeMessage({
    outboxId: outbox._id,
    from: { address: outbox.from, name: context.displayName },
    to: outbox.to,
    cc: outbox.cc,
    subject: outbox.subject,
    plainText: outbox.plainText,
    inReplyTo: outbox.replyToInternetMessageId,
    references: context.references,
    attachments: await loadAttachments(ctx, outbox.attachments),
  });
  const sent = await sendRawEmail({
    from: outbox.from,
    to: outbox.to.map((recipient) => recipient.address),
    cc: outbox.cc.map((recipient) => recipient.address),
    bcc: outbox.bcc.map((recipient) => recipient.address),
    raw,
  });
  return { ...sent, raw, replyRemoteThreadId: context.replyRemoteThreadId };
}

async function recordSentMessage(
  ctx: ActionCtx,
  outbox: ClaimedOutbox,
  sent: Awaited<ReturnType<typeof sendOutbox>> & { remoteMessageId: string },
) {
  const internetMessageId = sesInternetMessageId(
    sent.sesMessageId,
    sent.region,
  );
  await putRawMessage(
    hostedObjectKey({
      accountId: outbox.accountId,
      remoteMessageId: sent.remoteMessageId,
      direction: "outgoing",
    }),
    sent.raw,
  );
  await ctx.runMutation(internal.sync.internal.upsertProviderMessage, {
    ownerId: outbox.ownerId,
    accountId: outbox.accountId,
    message: normalizeHostedMessage(await parseRawMessage(sent.raw), {
      remoteMessageId: sent.remoteMessageId,
      remoteThreadId:
        sent.replyRemoteThreadId ??
        createThreadId(internetMessageId, outbox.subject),
      internetMessageId,
      direction: "outgoing",
      fallbackFrom: outbox.from,
      receivedAt: Date.now(),
      junk: false,
    }),
    notifyNewMail: false,
  });
}

async function composeMessage(args: {
  outboxId: Id<"outboxMessages">;
  from: Recipient;
  to: Recipient[];
  cc: Recipient[];
  subject: string;
  plainText: string;
  inReplyTo?: string;
  references: string[];
  attachments: { filename: string; contentType: string; content: Buffer }[];
}) {
  const domain = args.from.address.split("@")[1] ?? "localhost";
  const digest = createHash("sha256").update(args.outboxId).digest("hex");
  const composer = new MailComposer({
    from: formatMailbox(args.from),
    to: args.to.map(formatMailbox),
    cc: args.cc.map(formatMailbox),
    subject: args.subject,
    text: args.plainText,
    messageId: `<rodge-${digest}@${domain}>`,
    inReplyTo: args.inReplyTo,
    references: args.references.length > 0 ? args.references : undefined,
    attachments: args.attachments,
  });
  const message = await new Promise<Buffer>((resolve, reject) => {
    composer.compile().build((error, output) => {
      if (error) reject(error);
      else resolve(output);
    });
  });
  return new Uint8Array(message);
}

async function loadAttachments(
  ctx: ActionCtx,
  attachments: {
    fileName: string;
    contentType: string;
    size: number;
    storageId: Id<"_storage">;
  }[],
) {
  return await Promise.all(
    attachments.map(async (attachment) => {
      const blob = await ctx.storage.get(attachment.storageId);
      if (!blob) throw new Error(`${attachment.fileName} is unavailable`);
      const content = Buffer.from(await blob.arrayBuffer());
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
}

function formatMailbox(recipient: Recipient) {
  return { address: recipient.address, name: recipient.name ?? "" };
}
