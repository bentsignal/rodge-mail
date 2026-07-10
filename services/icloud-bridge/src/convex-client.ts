import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
  claimJobsResponseSchema,
  completeConnectionRequestSchema,
  sendAcknowledgementSchema,
  syncBatchRequestSchema,
} from "@rodge-mail/convex/providers/icloud/contract";
import { signBridgeRequest } from "@rodge-mail/convex/providers/icloud/protocol";

import { env } from "./env";

const completeResponseSchema = z
  .object({ accountId: z.string(), returnUrl: z.string().url() })
  .strict();
const acceptedResponseSchema = z.object({ accepted: z.literal(true) }).strict();

export async function completeBridgeConnection(input: {
  setupToken: string;
  bridgeAccountId: string;
  address: string;
  displayName?: string;
}) {
  return await signedPost(
    "/providers/icloud/bridge/connections/complete",
    completeConnectionRequestSchema.parse(input),
    completeResponseSchema,
  );
}

export async function claimBridgeJobs(bridgeAccountId: string) {
  const result = await signedPost(
    "/providers/icloud/bridge/jobs/claim",
    { bridgeAccountId, maxJobs: 5 },
    claimJobsResponseSchema,
  );
  return result.jobs;
}

export async function postSyncBatch(
  input: z.input<typeof syncBatchRequestSchema>,
) {
  return await signedPost(
    "/providers/icloud/bridge/sync",
    syncBatchRequestSchema.parse(input),
    acceptedResponseSchema,
  );
}

export async function acknowledgeSend(
  input: z.input<typeof sendAcknowledgementSchema>,
) {
  return await signedPost(
    "/providers/icloud/bridge/jobs/ack",
    sendAcknowledgementSchema.parse(input),
    acceptedResponseSchema,
  );
}

async function signedPost<TSchema extends z.ZodType>(
  pathname: string,
  value: unknown,
  responseSchema: TSchema,
) {
  const body = JSON.stringify(value);
  const timestamp = Date.now().toString();
  const requestId = randomUUID();
  const signature = await signBridgeRequest(
    { timestamp, requestId, method: "POST", pathname, body },
    env.ICLOUD_BRIDGE_SIGNING_SECRET,
  );
  const response = await fetch(new URL(pathname, env.RODGE_CONVEX_SITE_URL), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-rodge-request-id": requestId,
      "x-rodge-signature": signature,
      "x-rodge-timestamp": timestamp,
    },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  const responseBody = z.unknown().parse(await response.json());
  if (!response.ok) {
    const message = z.object({ error: z.string() }).safeParse(responseBody);
    throw new Error(
      message.success
        ? `Convex bridge request failed: ${message.data.error}`
        : `Convex bridge request failed with HTTP ${response.status}`,
    );
  }
  return responseSchema.parse(responseBody);
}
