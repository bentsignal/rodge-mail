import { describe, expect, it } from "vitest";

import {
  formatRecipientAddresses,
  formatSentRecipients,
  getSentStatusLabel,
  getSentSubject,
} from "./sent";

describe("sent mail presentation", () => {
  it("labels every delivery state", () => {
    expect(getSentStatusLabel("pending")).toBe("Queued");
    expect(getSentStatusLabel("sending")).toBe("Sending");
    expect(getSentStatusLabel("failed")).toBe("Not sent");
    expect(getSentStatusLabel("sent")).toBe("Sent");
  });

  it("names the first recipients and counts the rest", () => {
    const recipients = [
      { address: "maya@example.com", name: "Maya Chen" },
      { address: "sam@example.com" },
      { address: "riley@example.com", name: " " },
    ];
    expect(formatSentRecipients(recipients)).toBe(
      "Maya Chen, sam@example.com +1",
    );
    expect(formatSentRecipients(recipients, 3)).toBe(
      "Maya Chen, sam@example.com, riley@example.com",
    );
    expect(formatSentRecipients([])).toBe("No recipients");
  });

  it("formats full addresses for the reader", () => {
    expect(
      formatRecipientAddresses([
        { address: "maya@example.com", name: "Maya Chen" },
        { address: "sam@example.com" },
      ]),
    ).toBe("Maya Chen <maya@example.com>, sam@example.com");
  });

  it("falls back for an empty subject", () => {
    expect(getSentSubject("  ")).toBe("(no subject)");
    expect(getSentSubject("Hi")).toBe("Hi");
  });
});
