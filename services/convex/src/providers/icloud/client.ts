"use node";

import type { Attachment } from "mailparser";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";

import type { ICloudCredential } from "./credentialAccess";
import { createAttachmentId, parseRemoteMessageId } from "./identifiers";

const IMAP_HOST = "imap.mail.me.com";
const SMTP_HOST = "smtp.mail.me.com";

export function createImapClient(credential: ICloudCredential) {
  return new ImapFlow({
    host: IMAP_HOST,
    port: 993,
    secure: true,
    auth: { user: credential.imapUsername, pass: credential.password },
    logger: false,
  });
}

export function createSmtpTransport(input: {
  address: string;
  password: string;
}) {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user: input.address, pass: input.password },
    tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
  });
}

export async function verifyCredentials(input: {
  address: string;
  password: string;
}) {
  const localPart = input.address.split("@")[0];
  const usernames = localPart ? [localPart, input.address] : [input.address];
  let lastError: unknown;
  for (const imapUsername of new Set(usernames)) {
    const client = createImapClient({
      imapUsername,
      password: input.password,
    });
    try {
      await client.connect();
      await client.mailboxOpen("INBOX", { readOnly: true });
      await safeLogout(client);
      const transport = createSmtpTransport(input);
      await transport.verify();
      transport.close();
      return { imapUsername };
    } catch (error) {
      lastError = error;
      await safeLogout(client);
    }
  }
  throw new ICloudAuthenticationError(safeErrorMessage(lastError));
}

export async function fetchAttachment(args: {
  credential: ICloudCredential;
  remoteMessageId: string;
  remoteAttachmentId: string;
}) {
  const parsedId = parseRemoteMessageId(args.remoteMessageId);
  if (!parsedId) throw new Error("iCloud message identifier is invalid");
  const client = createImapClient(args.credential);
  try {
    await client.connect();
    const opened = await client.mailboxOpen(parsedId.mailbox, {
      readOnly: true,
    });
    if (opened.uidValidity.toString() !== parsedId.uidValidity) {
      throw new Error("The iCloud mailbox generation changed");
    }
    const message = await client.fetchOne(
      parsedId.uid,
      { source: true },
      { uid: true },
    );
    if (!message || !message.source) throw new Error("Attachment not found");
    const parsed = await simpleParser(message.source);
    const attachment = parsed.attachments.find((item, index) => {
      return (
        createAttachmentId(args.remoteMessageId, index) ===
        args.remoteAttachmentId
      );
    });
    if (!attachment) throw new Error("Attachment not found");
    return attachmentBytes(attachment);
  } finally {
    await safeLogout(client);
  }
}

export async function safeLogout(client: ImapFlow) {
  try {
    if (client.usable) await client.logout();
  } catch {
    client.close();
  }
}

export function safeErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message.slice(0, 500)
    : "iCloud Mail request failed";
}

export function isAuthenticationFailure(error: unknown) {
  return (
    error instanceof ICloudAuthenticationError ||
    (error instanceof Error &&
      /auth|authentication|credential|login|password/iu.test(error.message))
  );
}

function attachmentBytes(attachment: Attachment) {
  return new Uint8Array(
    attachment.content.buffer,
    attachment.content.byteOffset,
    attachment.content.byteLength,
  );
}

export class ICloudAuthenticationError extends Error {}
