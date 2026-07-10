import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

const IMAP_HOST = "imap.mail.me.com";
const SMTP_HOST = "smtp.mail.me.com";

export function createImapClient(input: {
  username: string;
  password: string;
}) {
  return new ImapFlow({
    host: IMAP_HOST,
    port: 993,
    secure: true,
    auth: { user: input.username, pass: input.password },
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
  for (const username of new Set(usernames)) {
    const client = createImapClient({ username, password: input.password });
    try {
      await client.connect();
      await client.mailboxOpen("INBOX", { readOnly: true });
      await client.logout();
      const transport = createSmtpTransport(input);
      await transport.verify();
      transport.close();
      return { imapUsername: username };
    } catch (error) {
      lastError = error;
      await safeLogout(client);
    }
  }
  throw new AuthenticationError(safeMessage(lastError));
}

export async function safeLogout(client: ImapFlow) {
  try {
    if (client.usable) await client.logout();
  } catch {
    client.close();
  }
}

export function safeMessage(error: unknown) {
  return error instanceof Error
    ? error.message.slice(0, 300)
    : "Mail connection failed";
}

export class AuthenticationError extends Error {}
