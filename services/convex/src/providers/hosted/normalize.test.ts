import type { Value } from "convex/values";
import { validate } from "convex-helpers/validators";
import { convexToJson, getConvexSize } from "convex/values";
import { describe, expect, it, vi } from "vitest";

import type { ImportSourceMessage } from "../types";
import { REPLACEMENT_CHARACTER } from "../../mail/text";
import { vNormalizedMessage } from "../../sync/internal";
import { normalizeImportedMessage } from "./importer";
import { parseRawMessage } from "./normalize";

vi.mock("../../convex.env", () => ({
  env: { AUTH_ALLOWED_USER_ID: "owner" },
}));

const EMOJI = "\u{1F600}";
const INBOX = {
  remoteMessageId: "graph-1",
  folder: { kind: "inbox", path: "Inbox" },
  isRead: false,
  receivedAt: Date.parse("2024-03-01T10:00:00Z"),
} satisfies ImportSourceMessage;

describe("hosted message normalization", () => {
  it("doesn't cut an emoji in half at the end of the snippet", async () => {
    const message = await normalize(
      mime({}, `${"a".repeat(499)}${EMOJI} and the rest of the message`),
    );

    expect(message.snippet).toBe("a".repeat(499));
    expectStorable(message);
  });

  it("replaces a lone surrogate decoded from an encoded-word subject", async () => {
    const utf16 = Buffer.from([0xd8, 0x3d, 0x00, 0x48, 0x00, 0x69]);
    const message = await normalize(
      mime({ Subject: `=?utf-16be?B?${utf16.toString("base64")}?=` }, "Body"),
    );

    expect(message.subject).toBe(`${REPLACEMENT_CHARACTER}Hi`);
    expectStorable(message);
  });

  it("keeps long bodies well formed where they are cut", async () => {
    const text = `${"b".repeat(99_999)}${EMOJI}tail`;
    const message = await normalize(
      multipart(text, `<p>${"c".repeat(99_996)}${EMOJI}tail</p>`),
    );

    expect(message.plainText).toBe("b".repeat(99_999));
    expectStorable(message);
  });

  it("caps headers and recipients so the message fits in a document", async () => {
    const recipients = Array.from(
      { length: 2_000 },
      (_, index) => `person${index}@example.com`,
    ).join(", ");
    const headers = Object.fromEntries(
      Array.from({ length: 600 }, (_, index) => [
        `X-Filler-${index}`,
        "x".repeat(500),
      ]),
    );
    const message = await normalize(
      mime(
        {
          To: recipients,
          "X-Huge": "h".repeat(200_000),
          ...headers,
          "List-Unsubscribe": "<https://example.com/unsubscribe>",
        },
        "Body",
      ),
    );

    expect(message.to).toHaveLength(500);
    expect(message.headers.length).toBeLessThanOrEqual(500);
    expect(getConvexSize(message)).toBeLessThan(512 * 1024);
    expectStorable(message);
  });

  it("survives a header block too large for mailparser to read", async () => {
    const message = await normalize(
      mime({ "X-Huge": "h".repeat(1_100_000) }, "Body"),
    );

    expect(message).toMatchObject({
      from: { address: "unknown@invalid" },
      subject: "(no subject)",
      headers: [],
    });
    expectStorable(message);
  });

  it("falls back for attachments without a name or type", async () => {
    const raw = [
      "From: Alex <alex@example.com>",
      "To: me@bentsignal.com",
      "Subject: File",
      "MIME-Version: 1.0",
      'Content-Type: multipart/mixed; boundary="b"',
      "",
      "--b",
      "Content-Type: text/plain",
      "",
      "See attached.",
      "--b",
      "Content-Disposition: attachment",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from("data").toString("base64"),
      "--b--",
      "",
    ].join("\r\n");
    const message = await normalize(raw);

    expect(message.attachments).toEqual([
      expect.objectContaining({ fileName: "attachment-1", size: 4 }),
    ]);
    expectStorable(message);
  });
});

async function normalize(raw: string) {
  return normalizeImportedMessage(
    await parseRawMessage(new TextEncoder().encode(raw)),
    {
      remoteMessageId: "import:graph-1",
      message: INBOX,
      targetAddress: "me@bentsignal.com",
    },
  );
}

function mime(headers: Record<string, string>, body: string) {
  const lines = Object.entries({
    From: "Alex <alex@example.com>",
    To: "me@bentsignal.com",
    Subject: "Hello",
    "Message-ID": "<hello@example.com>",
    "MIME-Version": "1.0",
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Transfer-Encoding": "8bit",
    ...headers,
  }).map(([name, value]) => `${name}: ${value}`);
  return [...lines, "", body, ""].join("\r\n");
}

function multipart(text: string, html: string) {
  return mime(
    { "Content-Type": 'multipart/alternative; boundary="alt"' },
    [
      "--alt",
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      text,
      "--alt",
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      html,
      "--alt--",
    ].join("\r\n"),
  );
}

// The backend parses arguments with serde_json, which rejects the escape
// JSON.stringify writes for a lone surrogate.
function expectStorable(message: Value) {
  expect(validate(vNormalizedMessage, message, { throw: true })).toBe(true);
  const loneSurrogates = new Array<string>();
  JSON.parse(
    JSON.stringify(convexToJson(message)),
    (key: string, value: unknown) => {
      if (typeof value === "string" && /\p{Cs}/u.test(value)) {
        loneSurrogates.push(key);
      }
      return value;
    },
  );
  expect(loneSurrogates).toEqual([]);
}
