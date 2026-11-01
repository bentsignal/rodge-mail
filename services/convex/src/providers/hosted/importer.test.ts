/* eslint-disable max-lines, max-lines-per-function -- The fixtures model a whole mailbox: a reply chain, an attachment, and every folder kind. */
import MailComposer from "nodemailer/lib/mail-composer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ImportSourceMessage,
  MailImportSource,
  NormalizedMessage,
} from "../types";
import { MicrosoftGraphError } from "../microsoft/api";
import { fetchHostedAttachment } from "./attachments";
import { putRawMessage } from "./aws";
import { importBatch, importDigest } from "./importer";

vi.mock("../../convex.env", () => ({
  env: { AUTH_ALLOWED_USER_ID: "owner" },
}));

vi.mock("./env", () => ({
  requireHostedMailConfig: () => ({
    region: "us-east-1",
    accessKeyId: "AKIDEXAMPLE",
    secretAccessKey: "secret",
    bucket: "rodge-mail-test",
  }),
}));

const ITINERARY = new TextEncoder().encode("%PDF-1.4 itinerary");

const job = {
  sourceAccountId: "microsoft1",
  targetAccountId: "hosted1",
  targetAddress: "me@bentsignal.com",
};

let s3: Map<string, Uint8Array>;
let s3Puts: string[];

beforeEach(() => {
  s3 = new Map();
  s3Puts = [];
  vi.stubGlobal("fetch", vi.fn(fakeS3));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("hosted mail import", () => {
  it("files each folder's mail, keeps read state and dates, and threads replies", async () => {
    const source = await fixtureSource();
    const mailbox = new Map<string, NormalizedMessage>();

    const totals = await importAll(source, mailbox);

    expect(totals).toEqual({ imported: 5, skipped: 0, failures: [] });
    const byMessageId = new Map(
      [...mailbox.values()].map((message) => [
        message.internetMessageId,
        message,
      ]),
    );
    const root = byMessageId.get("<root@example.com>");
    const reply = byMessageId.get("<reply-1@bentsignal.com>");
    const answer = byMessageId.get("<reply-2@example.com>");
    expect(root).toMatchObject({
      direction: "incoming",
      remoteLabelIds: ["inbox"],
      inInbox: true,
      isRead: false,
      receivedAt: Date.parse("2024-03-01T10:00:00Z"),
      sentAt: Date.parse("2024-03-01T09:59:00Z"),
    });
    expect(reply).toMatchObject({
      direction: "outgoing",
      from: { address: "me@bentsignal.com", name: "Shawn" },
      remoteLabelIds: ["sent"],
      inInbox: false,
      isRead: true,
      receivedAt: Date.parse("2024-03-01T12:00:00Z"),
      sentAt: Date.parse("2024-03-01T12:00:00Z"),
    });
    expect(answer).toMatchObject({
      direction: "incoming",
      remoteLabelIds: ["folder:Projects/Trips"],
      inInbox: false,
      isRead: true,
      hasAttachments: true,
    });
    expect(byMessageId.get("<archived@example.com>")).toMatchObject({
      remoteLabelIds: ["archive"],
      inInbox: false,
    });
    expect(byMessageId.get("<junk@example.com>")).toMatchObject({
      remoteLabelIds: ["junk"],
      inInbox: false,
      isRead: false,
    });
    expect(reply?.remoteThreadId).toBe(root?.remoteThreadId);
    expect(answer?.remoteThreadId).toBe(root?.remoteThreadId);

    const answerId = `import:${importDigest("microsoft1", "graph-answer")}`;
    expect(answer?.remoteMessageId).toBe(answerId);
    expect(
      s3.has(`import/hosted1/${importDigest("microsoft1", "graph-answer")}`),
    ).toBe(true);
    const attachment = answer?.attachments.at(0);
    expect(attachment).toMatchObject({
      remoteAttachmentId: `${answerId}:attachment:0`,
      fileName: "itinerary.pdf",
      contentType: "application/pdf",
      size: ITINERARY.byteLength,
    });
    const bytes = await fetchHostedAttachment(
      {
        accountId: "hosted1",
        direction: "incoming",
        remoteMessageId: answerId,
      },
      { remoteAttachmentId: attachment?.remoteAttachmentId ?? "" },
    );
    expect(bytes).toEqual(ITINERARY);
  });

  it("skips messages it already imported without downloading them again", async () => {
    const source = await fixtureSource();
    const mailbox = new Map<string, NormalizedMessage>();
    await importAll(source, mailbox);
    const downloads = source.downloads.length;
    const puts = s3Puts.length;

    const totals = await importAll(source, mailbox);

    expect(totals).toEqual({ imported: 0, skipped: 5, failures: [] });
    expect(source.downloads).toHaveLength(downloads);
    expect(s3Puts).toHaveLength(puts);
    expect(mailbox.size).toBe(5);
  });

  it("keys imported messages by source account and remote id", () => {
    expect(importDigest("microsoft1", "graph-root")).toBe(
      importDigest("microsoft1", "graph-root"),
    );
    expect(importDigest("microsoft1", "graph-root")).not.toBe(
      importDigest("microsoft2", "graph-root"),
    );
  });

  it("records a missing message as a failure and keeps going", async () => {
    const source = await fixtureSource(
      new Map([["graph-reply", new MicrosoftGraphError("Not found", 404)]]),
    );
    const mailbox = new Map<string, NormalizedMessage>();

    const totals = await importAll(source, mailbox);

    expect(totals.imported).toBe(4);
    expect(totals.failures).toEqual([
      expect.objectContaining({
        remoteMessageId: "graph-reply",
        folder: "Sent Items",
        reason: "Not found",
      }),
    ]);
  });

  it("stops the batch on throttling so the same page is retried", async () => {
    const source = await fixtureSource(
      new Map([["graph-reply", new MicrosoftGraphError("Throttled", 429)]]),
    );
    const mailbox = new Map<string, NormalizedMessage>();

    const result = await importBatch(job, deps(source, mailbox));

    expect(result).toMatchObject({ imported: 1, error: "Throttled" });
    expect(result).not.toHaveProperty("nextCursor");
  });
});

async function importAll(
  source: MailImportSource,
  mailbox: Map<string, NormalizedMessage>,
) {
  const totals = { imported: 0, skipped: 0, failures: new Array<unknown>() };
  let cursor: string | undefined;
  for (;;) {
    const result = await importBatch({ ...job, cursor }, deps(source, mailbox));
    totals.imported += result.imported;
    totals.skipped += result.skipped;
    totals.failures.push(...result.failures);
    if (!("nextCursor" in result) || result.nextCursor === null) return totals;
    cursor = result.nextCursor;
  }
}

function deps(
  source: MailImportSource,
  mailbox: Map<string, NormalizedMessage>,
) {
  return {
    source,
    putRawMessage,
    findImported: (ids: string[]) =>
      Promise.resolve(ids.filter((id) => mailbox.has(id))),
    ingest: (message: NormalizedMessage) => {
      if (mailbox.has(message.remoteMessageId)) {
        return Promise.resolve("skipped" as const);
      }
      mailbox.set(message.remoteMessageId, message);
      return Promise.resolve("imported" as const);
    },
  };
}

async function fixtureSource(errors = new Map<string, Error>()) {
  const messages = [
    {
      remoteMessageId: "graph-root",
      folder: { kind: "inbox", path: "Inbox" },
      isRead: false,
      receivedAt: Date.parse("2024-03-01T10:00:00Z"),
      raw: await compose({
        from: "Alex <alex@example.com>",
        to: "Shawn <me@bentsignal.com>",
        subject: "Trip plan",
        messageId: "<root@example.com>",
        date: new Date("2024-03-01T09:59:00Z"),
        text: "Want to go to Lisbon?",
      }),
    },
    {
      remoteMessageId: "graph-reply",
      folder: { kind: "sent", path: "Sent Items" },
      isRead: false,
      receivedAt: Date.parse("2024-03-01T12:00:00Z"),
      raw: await compose({
        from: "Shawn <me@bentsignal.com>",
        to: "Alex <alex@example.com>",
        subject: "Re: Trip plan",
        messageId: "<reply-1@bentsignal.com>",
        inReplyTo: "<root@example.com>",
        references: ["<root@example.com>"],
        date: new Date("2024-03-01T12:00:00Z"),
        text: "Yes, send the plan.",
      }),
    },
    {
      remoteMessageId: "graph-answer",
      folder: { kind: "custom", path: "Projects/Trips" },
      isRead: true,
      receivedAt: Date.parse("2024-03-02T08:00:00Z"),
      raw: await compose({
        from: "Alex <alex@example.com>",
        to: "Shawn <me@bentsignal.com>",
        subject: "Re: Trip plan",
        messageId: "<reply-2@example.com>",
        inReplyTo: "<reply-1@bentsignal.com>",
        references: ["<root@example.com>", "<reply-1@bentsignal.com>"],
        date: new Date("2024-03-02T07:59:00Z"),
        text: "Itinerary attached.",
        attachments: [
          {
            filename: "itinerary.pdf",
            contentType: "application/pdf",
            content: Buffer.from(ITINERARY),
          },
        ],
      }),
    },
    {
      remoteMessageId: "graph-archived",
      folder: { kind: "archive", path: "Archive" },
      isRead: true,
      receivedAt: Date.parse("2021-05-05T05:05:00Z"),
      raw: await compose({
        from: "bank@example.com",
        to: "me@bentsignal.com",
        subject: "Statement",
        messageId: "<archived@example.com>",
        text: "Your statement is ready.",
      }),
    },
    {
      remoteMessageId: "graph-junk",
      folder: { kind: "junk", path: "Junk Email" },
      isRead: false,
      receivedAt: Date.parse("2024-02-02T02:02:00Z"),
      raw: await compose({
        from: "prize@example.net",
        to: "me@bentsignal.com",
        subject: "You won",
        messageId: "<junk@example.com>",
        text: "Claim it.",
      }),
    },
  ] satisfies (ImportSourceMessage & { raw: Uint8Array })[];
  const downloads = new Array<string>();
  return {
    downloads,
    listMessages: (cursor: string | undefined, limit: number) => {
      const start = Number(cursor ?? 0);
      const end = Math.min(start + Math.min(limit, 2), messages.length);
      return Promise.resolve({
        messages: messages.slice(start, end).map(({ raw: _, ...item }) => item),
        nextCursor: end < messages.length ? String(end) : null,
      });
    },
    fetchRawMessage: (remoteMessageId: string) => {
      const error = errors.get(remoteMessageId);
      if (error) return Promise.reject(error);
      downloads.push(remoteMessageId);
      const message = messages.find(
        (item) => item.remoteMessageId === remoteMessageId,
      );
      return message
        ? Promise.resolve(message.raw)
        : Promise.reject(new Error("unknown message"));
    },
  };
}

async function compose(options: ConstructorParameters<typeof MailComposer>[0]) {
  const raw = await new Promise<Buffer>((resolve, reject) => {
    new MailComposer(options).compile().build((error, output) => {
      if (error) reject(error);
      else resolve(output);
    });
  });
  return new Uint8Array(raw);
}

async function fakeS3(input: string | URL | Request, init?: RequestInit) {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.hostname !== "rodge-mail-test.s3.us-east-1.amazonaws.com") {
    return new Response("unexpected host", { status: 500 });
  }
  const key = decodeURIComponent(url.pathname.slice(1));
  if (request.method === "PUT") {
    s3Puts.push(key);
    s3.set(key, new Uint8Array(await request.arrayBuffer()));
    return new Response(null, { status: 200 });
  }
  const body = s3.get(key);
  return body
    ? new Response(Buffer.from(body))
    : new Response("NoSuchKey", { status: 404 });
}
