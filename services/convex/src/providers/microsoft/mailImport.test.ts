/* eslint-disable complexity -- The Graph stub routes every endpoint the import reads. */
import { afterEach, describe, expect, it, vi } from "vitest";

import { MicrosoftMailImportSource } from "./mailImport";

const WELL_KNOWN = new Map([
  ["inbox", "inbox-id"],
  ["sentitems", "sent-id"],
  ["archive", "archive-id"],
  ["junkemail", "junk-id"],
  ["deleteditems", "deleted-id"],
  ["drafts", "drafts-id"],
]);

const FOLDERS = [
  {
    id: "inbox-id",
    displayName: "Inbox",
    childFolderCount: 1,
    totalItemCount: 2,
  },
  { id: "sent-id", displayName: "Sent Items", totalItemCount: 1 },
  {
    id: "deleted-id",
    displayName: "Deleted Items",
    childFolderCount: 1,
    totalItemCount: 9,
  },
  { id: "drafts-id", displayName: "Drafts", totalItemCount: 4 },
  { id: "archive-id", displayName: "Archive", totalItemCount: 0 },
  { id: "junk-id", displayName: "Junk Email", totalItemCount: 1 },
  { id: "receipts-id", displayName: "Receipts", totalItemCount: 1 },
];

const MESSAGES = new Map<string, Record<string, unknown>[][]>([
  [
    "inbox-id",
    [
      [
        {
          id: "m1",
          isRead: false,
          receivedDateTime: "2024-03-01T10:00:00Z",
          subject: "Trip plan",
          from: { emailAddress: { name: "Alex", address: "alex@example.com" } },
        },
      ],
      [
        { id: "m2", isRead: true, receivedDateTime: "2024-03-02T10:00:00Z" },
        {
          id: "draft",
          isDraft: true,
          receivedDateTime: "2024-03-02T11:00:00Z",
        },
      ],
    ],
  ],
  [
    "travel-id",
    [[{ id: "m3", isRead: true, receivedDateTime: "2023-06-01T08:00:00Z" }]],
  ],
  [
    "sent-id",
    [
      [
        {
          id: "m4",
          isRead: false,
          receivedDateTime: "2024-03-01T12:00:05Z",
          sentDateTime: "2024-03-01T12:00:00Z",
        },
      ],
    ],
  ],
  ["archive-id", [[]]],
  [
    "junk-id",
    [[{ id: "m5", isRead: false, receivedDateTime: "2024-01-01T00:00:00Z" }]],
  ],
  [
    "receipts-id",
    [[{ id: "m6", isRead: true, receivedDateTime: "2022-12-24T00:00:00Z" }]],
  ],
]);

const requested = new Array<string>();

afterEach(() => {
  vi.unstubAllGlobals();
  requested.length = 0;
});

describe("Microsoft mail import source", () => {
  it("pages through every mail folder except Deleted Items and Drafts", async () => {
    stubGraph();
    const source = new MicrosoftMailImportSource("token");
    const pages = [];
    let cursor: string | undefined;
    for (;;) {
      const page = await source.listMessages(cursor, 25);
      pages.push(page);
      if (page.nextCursor === null) break;
      cursor = page.nextCursor;
    }

    expect(pages[0]?.estimatedTotal).toBe(6);
    expect(pages.flatMap((page) => page.messages)).toEqual([
      {
        remoteMessageId: "m1",
        folder: { kind: "inbox", path: "Inbox" },
        isRead: false,
        receivedAt: Date.parse("2024-03-01T10:00:00Z"),
        subject: "Trip plan",
        from: "Alex <alex@example.com>",
      },
      {
        remoteMessageId: "m2",
        folder: { kind: "inbox", path: "Inbox" },
        isRead: true,
        receivedAt: Date.parse("2024-03-02T10:00:00Z"),
      },
      {
        remoteMessageId: "m4",
        folder: { kind: "sent", path: "Sent Items" },
        isRead: false,
        receivedAt: Date.parse("2024-03-01T12:00:00Z"),
      },
      {
        remoteMessageId: "m5",
        folder: { kind: "junk", path: "Junk Email" },
        isRead: false,
        receivedAt: Date.parse("2024-01-01T00:00:00Z"),
      },
      {
        remoteMessageId: "m6",
        folder: { kind: "custom", path: "Receipts" },
        isRead: true,
        receivedAt: Date.parse("2022-12-24T00:00:00Z"),
      },
      {
        remoteMessageId: "m3",
        folder: { kind: "custom", path: "Inbox/Travel" },
        isRead: true,
        receivedAt: Date.parse("2023-06-01T08:00:00Z"),
      },
    ]);
    expect(
      requested.some((url) =>
        url.includes(
          "$select=id,isRead,isDraft,receivedDateTime,sentDateTime,subject,from&",
        ),
      ),
    ).toBe(true);
    expect(requested.some((url) => url.includes("deleted-id"))).toBe(false);
    expect(requested.some((url) => url.includes("drafts-id/messages"))).toBe(
      false,
    );
  });

  it("downloads the raw MIME of a message", async () => {
    stubGraph();
    const raw = await new MicrosoftMailImportSource("token").fetchRawMessage(
      "id/with+chars",
    );
    expect(new TextDecoder().decode(raw)).toBe("Subject: raw\r\n\r\nbody");
    expect(requested.at(-1)).toBe(
      "https://graph.microsoft.com/v1.0/me/messages/id%2Fwith%2Bchars/$value",
    );
  });
});

function stubGraph() {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string) => {
      const url = new URL(input);
      requested.push(url.toString());
      return Promise.resolve(graphResponse(url));
    }),
  );
}

function graphResponse(url: URL) {
  const path = url.pathname.replace("/v1.0", "");
  if (path.endsWith("/$value")) {
    return new Response("Subject: raw\r\n\r\nbody");
  }
  const wellKnown = /^\/me\/mailFolders\/([a-z]+)$/u.exec(path)?.[1];
  if (wellKnown) {
    const id = WELL_KNOWN.get(wellKnown);
    return id ? json({ id }) : json({ error: { code: "NotFound" } }, 404);
  }
  if (path === "/me/mailFolders") return json({ value: FOLDERS });
  if (path === "/me/mailFolders/inbox-id/childFolders") {
    return json({
      value: [{ id: "travel-id", displayName: "Travel", totalItemCount: 1 }],
    });
  }
  const folderId = /^\/me\/mailFolders\/([\w-]+)\/messages$/u.exec(path)?.[1];
  const pages = folderId ? MESSAGES.get(folderId) : undefined;
  if (folderId && pages) {
    const index = Number(url.searchParams.get("page") ?? 0);
    const next = index + 1 < pages.length ? new URL(url) : undefined;
    next?.searchParams.set("page", String(index + 1));
    return json({
      value: pages[index],
      ...(next ? { "@odata.nextLink": next.toString() } : {}),
    });
  }
  return json({ error: { code: "Unexpected", message: path } }, 500);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
