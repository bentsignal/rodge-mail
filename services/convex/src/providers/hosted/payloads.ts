/* eslint-disable complexity -- SES event payloads map each optional event shape explicitly. */
import { z } from "zod";

export const snsEnvelopeSchema = z.object({
  Type: z.string(),
  MessageId: z.string(),
  TopicArn: z.string(),
  Message: z.string(),
  Timestamp: z.string(),
  Signature: z.string(),
  SignatureVersion: z.string(),
  SigningCertURL: z.string(),
  Subject: z.string().optional(),
  SubscribeURL: z.string().optional(),
  Token: z.string().optional(),
});

export type SnsEnvelope = z.infer<typeof snsEnvelopeSchema>;

const verdictSchema = z.object({ status: z.string() }).optional();

export const sesReceivedSchema = z.object({
  notificationType: z.literal("Received"),
  mail: z.object({ messageId: z.string(), timestamp: z.string() }),
  receipt: z.object({
    recipients: z.array(z.string()),
    spamVerdict: verdictSchema,
    virusVerdict: verdictSchema,
    dmarcVerdict: verdictSchema,
    dmarcPolicy: z.string().optional(),
    action: z.object({ type: z.string(), objectKey: z.string().optional() }),
  }),
});

const recipientSchema = z.object({
  emailAddress: z.string(),
  diagnosticCode: z.string().optional(),
});

export const sesEventSchema = z.object({
  eventType: z.string(),
  mail: z.object({
    messageId: z.string(),
    timestamp: z.string(),
    destination: z.array(z.string()).optional(),
  }),
  bounce: z
    .object({
      bounceType: z.string().optional(),
      bounceSubType: z.string().optional(),
      bouncedRecipients: z.array(recipientSchema).optional(),
      timestamp: z.string().optional(),
    })
    .optional(),
  complaint: z
    .object({
      complainedRecipients: z.array(recipientSchema).optional(),
      timestamp: z.string().optional(),
    })
    .optional(),
  delivery: z
    .object({
      recipients: z.array(z.string()).optional(),
      timestamp: z.string().optional(),
    })
    .optional(),
  deliveryDelay: z
    .object({
      delayedRecipients: z.array(recipientSchema).optional(),
      delayType: z.string().optional(),
      timestamp: z.string().optional(),
    })
    .optional(),
  reject: z.object({ reason: z.string().optional() }).optional(),
});

export type SesEvent = z.infer<typeof sesEventSchema>;
export type SesReceived = z.infer<typeof sesReceivedSchema>;

export const sesSendResponseSchema = z.object({
  MessageId: z.string().optional(),
  message: z.string().optional(),
});

export function parseJson(value: string) {
  try {
    return z.unknown().parse(JSON.parse(value));
  } catch {
    return undefined;
  }
}

export function mapSesEvent(event: SesEvent) {
  const fallbackAt = Date.parse(event.mail.timestamp) || Date.now();
  switch (event.eventType) {
    case "Bounce":
      return {
        type: "bounce" as const,
        recipients: fromRecipients(event.bounce?.bouncedRecipients),
        detail: [
          event.bounce?.bounceType,
          event.bounce?.bounceSubType,
          event.bounce?.bouncedRecipients?.[0]?.diagnosticCode,
        ]
          .filter(Boolean)
          .join(" · ")
          .slice(0, 500),
        occurredAt: occurredAt(event.bounce?.timestamp, fallbackAt),
      };
    case "Complaint":
      return {
        type: "complaint" as const,
        recipients: fromRecipients(event.complaint?.complainedRecipients),
        occurredAt: occurredAt(event.complaint?.timestamp, fallbackAt),
      };
    case "Delivery":
      return {
        type: "delivery" as const,
        recipients: fromAddresses(event.delivery?.recipients),
        occurredAt: occurredAt(event.delivery?.timestamp, fallbackAt),
      };
    case "DeliveryDelay":
      return {
        type: "delay" as const,
        recipients: fromRecipients(event.deliveryDelay?.delayedRecipients),
        detail: event.deliveryDelay?.delayType,
        occurredAt: occurredAt(event.deliveryDelay?.timestamp, fallbackAt),
      };
    case "Reject":
      return {
        type: "reject" as const,
        recipients: fromAddresses(event.mail.destination),
        detail: event.reject?.reason,
        occurredAt: fallbackAt,
      };
    default:
      return null;
  }
}

export function isJunk(receipt: SesReceived["receipt"]) {
  const dmarcEnforced =
    receipt.dmarcVerdict?.status === "FAIL" &&
    ["quarantine", "reject"].includes(receipt.dmarcPolicy?.toLowerCase() ?? "");
  return receipt.spamVerdict?.status === "FAIL" || dmarcEnforced;
}

export function snsSigningKeys(type: string) {
  return type === "Notification"
    ? ([
        "Message",
        "MessageId",
        "Subject",
        "Timestamp",
        "TopicArn",
        "Type",
      ] as const)
    : ([
        "Message",
        "MessageId",
        "SubscribeURL",
        "Timestamp",
        "Token",
        "TopicArn",
        "Type",
      ] as const);
}

export function snsCanonicalString(envelope: SnsEnvelope) {
  return snsSigningKeys(envelope.Type)
    .flatMap((key) => {
      const value = envelope[key];
      return value === undefined ? [] : [`${key}\n${value}\n`];
    })
    .join("");
}

export function isSnsUrl(value: string, suffix?: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      /^sns\.[a-z0-9-]+\.amazonaws\.com$/u.test(url.hostname) &&
      (!suffix || url.pathname.endsWith(suffix))
    );
  } catch {
    return false;
  }
}

function fromRecipients(recipients: { emailAddress: string }[] | undefined) {
  return (recipients ?? []).map((recipient) => ({
    address: recipient.emailAddress,
  }));
}

function fromAddresses(addresses: string[] | undefined) {
  return (addresses ?? []).map((address) => ({ address }));
}

function occurredAt(timestamp: string | undefined, fallback: number) {
  return (timestamp ? Date.parse(timestamp) : NaN) || fallback;
}
