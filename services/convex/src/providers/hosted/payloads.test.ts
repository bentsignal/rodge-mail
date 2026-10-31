import { describe, expect, it } from "vitest";

import {
  hostedObjectKey,
  normalizeHostedAddress,
  parseHostedAttachmentIndex,
  sesInternetMessageId,
} from "./addresses";
import { isJunk, isSnsUrl, mapSesEvent, snsCanonicalString } from "./payloads";

describe("SNS validation", () => {
  it("accepts only HTTPS SNS hosts", () => {
    expect(
      isSnsUrl(
        "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc.pem",
        ".pem",
      ),
    ).toBe(true);
    expect(
      isSnsUrl("http://sns.us-east-1.amazonaws.com/cert.pem", ".pem"),
    ).toBe(false);
    expect(
      isSnsUrl("https://sns.us-east-1.amazonaws.com.evil.com/cert.pem"),
    ).toBe(false);
    expect(
      isSnsUrl("https://sns.us-east-1.amazonaws.com/cert.txt", ".pem"),
    ).toBe(false);
  });

  it("builds the notification canonical string without absent keys", () => {
    expect(
      snsCanonicalString({
        Type: "Notification",
        MessageId: "id",
        TopicArn: "arn",
        Message: "body",
        Timestamp: "now",
        Signature: "sig",
        SignatureVersion: "1",
        SigningCertURL: "url",
      }),
    ).toBe(
      "Message\nbody\nMessageId\nid\nTimestamp\nnow\nTopicArn\narn\nType\nNotification\n",
    );
  });
});

describe("SES payloads", () => {
  it("marks spam and enforced DMARC failures as junk", () => {
    const base = { recipients: [], action: { type: "S3" } };
    expect(isJunk({ ...base, spamVerdict: { status: "FAIL" } })).toBe(true);
    expect(
      isJunk({
        ...base,
        dmarcVerdict: { status: "FAIL" },
        dmarcPolicy: "REJECT",
      }),
    ).toBe(true);
    expect(
      isJunk({
        ...base,
        dmarcVerdict: { status: "FAIL" },
        dmarcPolicy: "none",
      }),
    ).toBe(false);
  });

  it("maps bounce events", () => {
    expect(
      mapSesEvent({
        eventType: "Bounce",
        mail: { messageId: "m", timestamp: "2026-01-01T00:00:00Z" },
        bounce: {
          bounceType: "Permanent",
          bouncedRecipients: [{ emailAddress: "a@example.com" }],
        },
      }),
    ).toMatchObject({
      type: "bounce",
      recipients: [{ address: "a@example.com" }],
      detail: "Permanent",
    });
  });
});

describe("hosted identifiers", () => {
  it("normalizes addresses", () => {
    expect(normalizeHostedAddress(" Shawn@Rodgers.dev ")).toEqual({
      address: "shawn@rodgers.dev",
      domain: "rodgers.dev",
    });
    expect(() => normalizeHostedAddress("not-an-address")).toThrow();
  });

  it("derives S3 keys without allowing traversal", () => {
    expect(hostedObjectKey("ses:abc-123", "incoming")).toBe("inbound/abc-123");
    expect(hostedObjectKey("ses:abc-123", "outgoing")).toBe("sent/abc-123");
    expect(() => hostedObjectKey("ses:../secret", "incoming")).toThrow();
  });

  it("parses attachment indexes and SES message ids", () => {
    expect(parseHostedAttachmentIndex("ses:abc:attachment:2")).toBe(2);
    expect(sesInternetMessageId("abc", "us-east-1")).toBe(
      "<abc@email.amazonses.com>",
    );
    expect(sesInternetMessageId("abc", "eu-west-1")).toBe(
      "<abc@eu-west-1.amazonses.com>",
    );
  });
});
