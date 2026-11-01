import { describe, expect, it } from "vitest";

import {
  canMoveMailThreadToInbox,
  getMailLocationTag,
  getMailThreadPlacement,
} from "./location";

describe("mail location", () => {
  it("tags rows outside the inbox", () => {
    expect(
      getMailLocationTag({
        accountLabel: "Rivera",
        location: { kind: "custom", name: "Projects/Trips" },
        showAccount: true,
      }),
    ).toBe("Rivera · Projects/Trips");
    expect(
      getMailLocationTag({
        accountLabel: "Rivera",
        location: { kind: "sent" },
        showAccount: false,
      }),
    ).toBe("Sent");
    expect(
      getMailLocationTag({
        accountLabel: "Rivera",
        location: { kind: "inbox" },
        showAccount: false,
      }),
    ).toBeUndefined();
  });

  it("places threads", () => {
    expect(getMailThreadPlacement({})).toBe("inbox");
    expect(getMailThreadPlacement({ inInbox: false, archivedAt: 1 })).toBe(
      "archived",
    );
    expect(getMailThreadPlacement({ inInbox: false })).toBe("elsewhere");
  });

  it("moves only threads Rodge owns into the inbox", () => {
    expect(
      canMoveMailThreadToInbox({ inInbox: false, provider: "hosted" }),
    ).toBe(true);
    expect(
      canMoveMailThreadToInbox({ inInbox: false, provider: "gmail" }),
    ).toBe(false);
    expect(
      canMoveMailThreadToInbox({
        archivedAt: 1,
        inInbox: false,
        provider: "gmail",
      }),
    ).toBe(true);
    expect(
      canMoveMailThreadToInbox({ inInbox: true, provider: "hosted" }),
    ).toBe(false);
  });
});
