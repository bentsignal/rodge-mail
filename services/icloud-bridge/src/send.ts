import { createHash } from "node:crypto";

import type { BridgeJob } from "@rodge-mail/convex/providers/icloud/contract";

import type { BridgeAccount } from "./database";
import { acknowledgeSend } from "./convex-client";
import { decryptCredential } from "./credentials";
import { getDeliveryState, saveDeliveryState } from "./database";
import {
  createImapClient,
  createSmtpTransport,
  safeLogout,
  safeMessage,
} from "./icloud-client";

type SendJob = Extract<BridgeJob, { kind: "send" }>;

export async function deliverMessage(account: BridgeAccount, job: SendJob) {
  const password = decryptCredential(
    account.encryptedCredential,
    account.bridgeAccountId,
  );
  const messageId = createStableMessageId(job.outboxId, account.address);
  let remoteMessageId: string;
  try {
    const recorded = await getDeliveryState(
      account.bridgeAccountId,
      job.outboxId,
    );
    const reconciled =
      recorded ?? (await findSentMessage(account, password, messageId));
    remoteMessageId =
      reconciled ?? (await sendViaSmtp(account, password, job, messageId));
    await saveDeliveryState(
      account.bridgeAccountId,
      job.outboxId,
      remoteMessageId,
    );
  } catch (error) {
    await acknowledgeSend({
      bridgeAccountId: account.bridgeAccountId,
      jobId: job.jobId,
      leaseId: job.leaseId,
      error: safeMessage(error),
      deliveryUnknown: deliveryMayBeUnknown(error),
    });
    throw error;
  }
  await acknowledgeSend({
    bridgeAccountId: account.bridgeAccountId,
    jobId: job.jobId,
    leaseId: job.leaseId,
    remoteMessageId,
  });
}

async function findSentMessage(
  account: BridgeAccount,
  password: string,
  messageId: string,
) {
  const client = createImapClient({
    username: account.imapUsername,
    password,
  });
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
    if (!uid) return null;
    return `imap:${Buffer.from(sentMailbox.path).toString("base64url")}:${opened.uidValidity}:${uid}`;
  } finally {
    await safeLogout(client);
  }
}

async function sendViaSmtp(
  account: BridgeAccount,
  password: string,
  job: SendJob,
  messageId: string,
) {
  const transport = createSmtpTransport({ address: account.address, password });
  const result = await transport.sendMail({
    from: account.address,
    to: formatAddresses(job.to),
    cc: formatAddresses(job.cc),
    bcc: formatAddresses(job.bcc),
    subject: job.subject,
    text: job.plainText,
    messageId,
    inReplyTo: job.replyToInternetMessageId,
    references: job.replyToInternetMessageId,
  });
  transport.close();
  if (result.rejected.length > 0 || result.accepted.length === 0) {
    throw new Error("iCloud SMTP rejected every recipient");
  }
  return messageId;
}

function createStableMessageId(outboxId: string, address: string) {
  const domain = address.split("@")[1] ?? "icloud.com";
  const digest = createHash("sha256").update(outboxId).digest("hex");
  return `<rodge-${digest}@${domain}>`;
}

function formatAddresses(addresses: { address: string; name?: string }[]) {
  return addresses.map((address) => ({
    address: address.address,
    name: address.name ?? "",
  }));
}

function deliveryMayBeUnknown(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /timeout|timed out|socket|connection reset|ECONNRESET|ETIMEDOUT/iu.test(
    error.message,
  );
}
