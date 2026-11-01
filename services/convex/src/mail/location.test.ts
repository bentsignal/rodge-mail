import { describe, expect, it } from "vitest";

import {
  isAllMailLocation,
  locationFromFolder,
  locationFromICloudPath,
  resolveMessageLocation,
} from "./location";

const incoming = {
  archivedAt: undefined,
  direction: "incoming",
  hiddenAt: undefined,
  inInbox: false,
  remoteLabelIds: [],
} satisfies Parameters<typeof resolveMessageLocation>[0];

describe("message location", () => {
  it("puts inbox and Rodge-archived mail first", () => {
    expect(
      resolveMessageLocation(
        { ...incoming, inInbox: true, remoteLabelIds: ["SPAM"] },
        "gmail",
      ),
    ).toEqual({ kind: "inbox" });
    expect(
      resolveMessageLocation({ ...incoming, archivedAt: 1 }, "icloud"),
    ).toEqual({ kind: "archive" });
  });

  it("reads hosted import labels", () => {
    function at(label: string) {
      return resolveMessageLocation(
        { ...incoming, remoteLabelIds: [label] },
        "hosted",
      );
    }
    expect(at("archive")).toEqual({ kind: "archive" });
    expect(at("junk")).toEqual({ kind: "junk" });
    expect(at("sent")).toEqual({ kind: "sent" });
    expect(at("folder:Projects/Trips")).toEqual({
      kind: "custom",
      name: "Projects/Trips",
    });
  });

  it("reads Gmail system labels and defers user labels", () => {
    expect(
      resolveMessageLocation(
        { ...incoming, remoteLabelIds: ["UNREAD", "SPAM"] },
        "gmail",
      ),
    ).toEqual({ kind: "junk" });
    expect(
      resolveMessageLocation(
        { ...incoming, remoteLabelIds: ["Label_7"] },
        "gmail",
      ),
    ).toBeUndefined();
  });

  it("falls back to sent or archive", () => {
    expect(resolveMessageLocation(incoming, "microsoft")).toEqual({
      kind: "archive",
    });
    expect(
      resolveMessageLocation({ ...incoming, direction: "outgoing" }, "hosted"),
    ).toEqual({ kind: "sent" });
  });

  it("names custom folders and maps special ones", () => {
    expect(
      locationFromFolder({ kind: "custom", name: "Receipts" }, incoming),
    ).toEqual({ kind: "custom", name: "Receipts" });
    expect(
      locationFromFolder({ kind: "junk", name: "Junk" }, incoming),
    ).toEqual({ kind: "junk" });
    expect(locationFromFolder(null, incoming)).toEqual({ kind: "archive" });
  });

  it("guesses iCloud mailboxes from their path", () => {
    expect(locationFromICloudPath("Junk")).toEqual({ kind: "junk" });
    expect(locationFromICloudPath("Deleted Messages")).toEqual({
      kind: "trash",
    });
    expect(locationFromICloudPath("Sent Messages")).toEqual({ kind: "sent" });
    expect(locationFromICloudPath("Family/Taxes")).toEqual({
      kind: "custom",
      name: "Family/Taxes",
    });
  });

  it("keeps junk, trash, and hidden mail out of All Mail", () => {
    expect(isAllMailLocation({ hiddenAt: undefined }, { kind: "sent" })).toBe(
      true,
    );
    expect(isAllMailLocation({ hiddenAt: undefined }, { kind: "junk" })).toBe(
      false,
    );
    expect(isAllMailLocation({ hiddenAt: undefined }, { kind: "trash" })).toBe(
      false,
    );
    expect(isAllMailLocation({ hiddenAt: 1 }, { kind: "archive" })).toBe(false);
  });
});
