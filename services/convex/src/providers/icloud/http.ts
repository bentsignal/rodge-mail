/* eslint-disable @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-unsafe-argument -- Zod validates network inputs before they enter generated Convex calls. */
import type { Id } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { httpAction } from "../../_generated/server";
import { urls } from "../../urls";
import { providerEnv } from "../env";
import {
  claimJobsRequestSchema,
  completeConnectionRequestSchema,
  sendAcknowledgementSchema,
  syncBatchRequestSchema,
} from "./contract";
import {
  sha256,
  verifyBridgeRequestSignature,
  verifySetupToken,
} from "./protocol";

const MAX_REQUEST_BYTES = 900_000;

export const completeConnection = httpAction(async (ctx, request) => {
  return await handleSignedJson(ctx, request, async (body) => {
    const input = completeConnectionRequestSchema.parse(JSON.parse(body));
    const setup = await verifySetupToken(input.setupToken, bridgeSecret());
    if (!setup) throw new HttpError(401, "Setup token is invalid or expired");
    const result = await ctx.runMutation(
      internal.providers.icloud.internal.completeConnection,
      {
        ownerId: setup.ownerId,
        challengeHash: await sha256(setup.challengeId),
        bridgeAccountId: input.bridgeAccountId,
        address: input.address.toLowerCase(),
        displayName: input.displayName,
        now: Date.now(),
      },
    );
    const returnUrl = new URL(result.returnPath, urls.web);
    returnUrl.searchParams.set("icloud", "connected");
    return jsonResponse({
      accountId: result.accountId,
      returnUrl: returnUrl.toString(),
    });
  });
});

export const claimJobs = httpAction(async (ctx, request) => {
  return await handleSignedJson(ctx, request, async (body) => {
    const input = claimJobsRequestSchema.parse(JSON.parse(body));
    const result = await ctx.runMutation(
      internal.providers.icloud.internal.claimJobs,
      { ...input, now: Date.now() },
    );
    return jsonResponse(result);
  });
});

export const ingestSyncBatch = httpAction(async (ctx, request) => {
  return await handleSignedJson(ctx, request, async (body) => {
    const input = syncBatchRequestSchema.parse(JSON.parse(body));
    const jobId = input.jobId as Id<"providerBridgeJobs">;
    const context = await ctx.runQuery(
      internal.providers.icloud.internal.getSyncIngestionContext,
      {
        bridgeAccountId: input.bridgeAccountId,
        jobId,
        leaseId: input.leaseId,
      },
    );
    if (!context) throw new HttpError(409, "Sync job lease is no longer valid");
    if (!input.error) {
      for (const folder of input.folders) {
        await ctx.runMutation(internal.sync.internal.upsertProviderFolder, {
          ...context,
          ...folder,
        });
      }
      for (const message of input.messages) {
        await ctx.runMutation(internal.sync.internal.upsertProviderMessage, {
          ...context,
          message,
        });
      }
      for (const remoteMessageId of input.deletedRemoteMessageIds) {
        await ctx.runMutation(internal.sync.internal.deleteProviderMessage, {
          ...context,
          remoteMessageId,
        });
      }
    }
    if (input.complete) {
      await ctx.runMutation(internal.providers.icloud.internal.finishSyncJob, {
        bridgeAccountId: input.bridgeAccountId,
        jobId,
        leaseId: input.leaseId,
        cursor: input.cursor,
        error: input.error,
      });
    }
    return jsonResponse({ accepted: true });
  });
});

export const acknowledgeSend = httpAction(async (ctx, request) => {
  return await handleSignedJson(ctx, request, async (body) => {
    const input = sendAcknowledgementSchema.parse(JSON.parse(body));
    const accepted = await ctx.runMutation(
      internal.providers.icloud.internal.finishSendJob,
      {
        ...input,
        jobId: input.jobId as Id<"providerBridgeJobs">,
      },
    );
    if (!accepted)
      throw new HttpError(409, "Send job lease is no longer valid");
    return jsonResponse({ accepted: true });
  });
});

async function handleSignedJson(
  ctx: ActionCtx,
  request: Request,
  handler: (body: string) => Promise<Response>,
) {
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) {
      throw new HttpError(413, "Bridge request is too large");
    }
    await verifySignedRequest(ctx, request, body);
    return await handler(body);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status);
    }
    return jsonResponse({ error: safeError(error) }, 400);
  }
}

async function verifySignedRequest(
  ctx: ActionCtx,
  request: Request,
  body: string,
) {
  const timestamp = request.headers.get("x-rodge-timestamp") ?? "";
  const requestId = request.headers.get("x-rodge-request-id") ?? "";
  const signature = request.headers.get("x-rodge-signature") ?? "";
  const pathname = new URL(request.url).pathname;
  const valid = await verifyBridgeRequestSignature(
    {
      timestamp,
      requestId,
      signature,
      method: request.method,
      pathname,
      body,
    },
    bridgeSecret(),
  );
  if (!valid || requestId.length < 20 || requestId.length > 200) {
    throw new HttpError(401, "Bridge signature is invalid");
  }
  const unused = await ctx.runMutation(
    internal.providers.icloud.internal.consumeRequestId,
    { requestId, now: Date.now() },
  );
  if (!unused) throw new HttpError(409, "Bridge request was already consumed");
}

function bridgeSecret() {
  const secret = providerEnv.ICLOUD_BRIDGE_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    throw new HttpError(503, "iCloud bridge is not configured");
  }
  return secret;
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function safeError(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 500);
  return "Bridge request failed";
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
