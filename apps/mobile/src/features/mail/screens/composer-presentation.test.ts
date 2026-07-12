import { describe, expect, it } from "vitest";

import {
  getComposerAccountLabel,
  getEnqueueConfirmation,
} from "./composer-presentation";

describe("getComposerAccountLabel", () => {
  it("avoids repeating an address-only label", () => {
    expect(
      getComposerAccountLabel({
        address: "ada@example.com",
        label: "ada@example.com",
      }),
    ).toBe("ada@example.com");
  });

  it("keeps a useful account label and address", () => {
    expect(
      getComposerAccountLabel({
        address: "ada@example.com",
        label: "Work",
      }),
    ).toBe("Work · ada@example.com");
  });
});

describe("getEnqueueConfirmation", () => {
  it("describes each delivery state without directing users to Settings", () => {
    const confirmations = [
      getEnqueueConfirmation("pending"),
      getEnqueueConfirmation("sending"),
      getEnqueueConfirmation("sent"),
    ];

    expect(confirmations.map(({ title }) => title)).toEqual([
      "Message queued",
      "Delivery already in progress",
      "Message already delivered",
    ]);
    expect(
      confirmations.every(({ message }) => !message.includes("Settings")),
    ).toBe(true);
  });
});
