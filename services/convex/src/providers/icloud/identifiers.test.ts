import { describe, expect, it } from "vitest";

import {
  createAttachmentId,
  createRemoteMessageId,
  createStableMessageId,
  parseRemoteMessageId,
} from "./identifiers";

describe("iCloud identifiers", () => {
  it("round-trips mailbox generations and UIDs", () => {
    const value = createRemoteMessageId("Sent Messages/2026", "482910", 73);

    expect(parseRemoteMessageId(value)).toEqual({
      mailbox: "Sent Messages/2026",
      uidValidity: "482910",
      uid: 73,
    });
  });

  it("rejects identifiers that cannot address an IMAP message", () => {
    expect(parseRemoteMessageId("imap:not-enough-parts")).toBeNull();
    expect(parseRemoteMessageId("gmail:inbox:1:2")).toBeNull();
    expect(parseRemoteMessageId("imap:aW5ib3g:1:0")).toBeNull();
  });

  it("creates stable send and attachment reconciliation identifiers", () => {
    expect(createStableMessageId("outbox-42", "me@icloud.com")).toBe(
      createStableMessageId("outbox-42", "me@icloud.com"),
    );
    expect(createAttachmentId("imap:aW5ib3g:1:2", 0)).toBe(
      "imap:aW5ib3g:1:2:attachment:0",
    );
  });
});
