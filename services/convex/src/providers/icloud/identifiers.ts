"use node";

import { createHash } from "node:crypto";

export function createRemoteMessageId(
  mailbox: string,
  uidValidity: string,
  uid: number,
) {
  return `imap:${Buffer.from(mailbox).toString("base64url")}:${uidValidity}:${uid}`;
}

export function parseRemoteMessageId(value: string) {
  const [prefix, encodedMailbox, uidValidity, uidValue, ...rest] =
    value.split(":");
  const uid = Number(uidValue);
  if (
    prefix !== "imap" ||
    !encodedMailbox ||
    !uidValidity ||
    rest.length > 0 ||
    !Number.isSafeInteger(uid) ||
    uid <= 0
  ) {
    return null;
  }
  return {
    mailbox: Buffer.from(encodedMailbox, "base64url").toString("utf8"),
    uidValidity,
    uid,
  };
}

export function createThreadId(
  reference: string | undefined,
  subject: string | undefined,
) {
  const source = reference ?? normalizeSubject(subject ?? "(no subject)");
  return `rfc822:${createHash("sha256").update(source).digest("base64url")}`;
}

export function createStableMessageId(outboxId: string, address: string) {
  const domain = address.split("@")[1] ?? "icloud.com";
  const digest = createHash("sha256").update(outboxId).digest("hex");
  return `<rodge-${digest}@${domain}>`;
}

export function createAttachmentId(remoteMessageId: string, index: number) {
  return `${remoteMessageId}:attachment:${index}`;
}

function normalizeSubject(subject: string) {
  return subject
    .replace(/^(?:(?:re|fw|fwd):\s*)+/iu, "")
    .trim()
    .toLowerCase();
}
