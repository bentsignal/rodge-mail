"use node";

import { createVerify } from "node:crypto";
import { v } from "convex/values";

import type { ActionCtx } from "../../_generated/server";
import type { SnsEnvelope } from "./payloads";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { hostedTopicArns } from "./env";
import {
  isJunk,
  isSnsUrl,
  mapSesEvent,
  parseJson,
  sesEventSchema,
  sesReceivedSchema,
  snsCanonicalString,
  snsEnvelopeSchema,
} from "./payloads";

const certificateCache = new Map<string, string>();

export const handleNotification = internalAction({
  args: { body: v.string() },
  handler: async (ctx, args): Promise<"accepted" | "rejected"> => {
    const envelope = snsEnvelopeSchema.safeParse(parseJson(args.body));
    if (!envelope.success || !hostedTopicArns().has(envelope.data.TopicArn)) {
      return "rejected";
    }
    if (!(await verifySignature(envelope.data))) return "rejected";
    if (envelope.data.Type === "SubscriptionConfirmation") {
      return await confirmSubscription(envelope.data);
    }
    if (envelope.data.Type === "Notification") {
      await handleSesPayload(ctx, parseJson(envelope.data.Message));
    }
    return "accepted";
  },
});

async function confirmSubscription(envelope: SnsEnvelope) {
  const subscribeUrl = envelope.SubscribeURL;
  if (!subscribeUrl || !isSnsUrl(subscribeUrl)) return "rejected";
  const response = await fetch(subscribeUrl);
  if (!response.ok) throw new Error("SNS subscription confirmation failed");
  return "accepted";
}

async function handleSesPayload(ctx: ActionCtx, payload: unknown) {
  const received = sesReceivedSchema.safeParse(payload);
  if (received.success) {
    const { receipt, mail } = received.data;
    if (receipt.action.type !== "S3" || !receipt.action.objectKey) return;
    if (receipt.virusVerdict?.status === "FAIL") {
      console.warn("Dropped inbound message that failed the SES virus scan");
      return;
    }
    await ctx.scheduler.runAfter(0, internal.providers.hosted.ingest.ingest, {
      sesMessageId: mail.messageId,
      objectKey: receipt.action.objectKey,
      recipients: receipt.recipients,
      receivedAt: Date.parse(mail.timestamp) || Date.now(),
      junk: isJunk(receipt),
    });
    return;
  }
  const event = sesEventSchema.safeParse(payload);
  const mapped = event.success ? mapSesEvent(event.data) : null;
  if (!event.success || !mapped) return;
  await ctx.runMutation(
    internal.providers.hosted.internal.recordDeliveryEvent,
    {
      sesMessageId: event.data.mail.messageId,
      ...mapped,
    },
  );
}

async function verifySignature(envelope: SnsEnvelope) {
  const algorithm =
    envelope.SignatureVersion === "2"
      ? "RSA-SHA256"
      : envelope.SignatureVersion === "1"
        ? "RSA-SHA1"
        : null;
  if (!algorithm || !isSnsUrl(envelope.SigningCertURL, ".pem")) return false;
  const certificate = await fetchCertificate(envelope.SigningCertURL);
  return createVerify(algorithm)
    .update(snsCanonicalString(envelope), "utf8")
    .verify(certificate, envelope.Signature, "base64");
}

async function fetchCertificate(url: string) {
  const cached = certificateCache.get(url);
  if (cached) return cached;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Could not fetch the SNS signing certificate");
  }
  const certificate = await response.text();
  certificateCache.set(url, certificate);
  return certificate;
}
