import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { calculateModelCostUsd } from "../aiUsage/pricing";
import { openAiApiKey } from "./env";

export type UsageKind = "classification" | "clean_view" | "embedding";

export class AiDailyLimitError extends Error {
  constructor(public readonly resetAt: number) {
    super(`Daily AI limit reached. Resets ${new Date(resetAt).toISOString()}`);
    this.name = "AiDailyLimitError";
  }
}

export async function postOpenAi(args: {
  ctx: ActionCtx;
  ownerId: string;
  url: string;
  body: unknown;
  requestKey: string;
  kind: UsageKind;
  model: string;
  reservedCostUsd: number;
}) {
  const apiKey = openAiApiKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const reservation = await args.ctx.runMutation(
    internal.aiUsage.internal.reserve,
    {
      ownerId: args.ownerId,
      requestKey: args.requestKey,
      kind: args.kind,
      model: args.model,
      reservedCostUsd: args.reservedCostUsd,
    },
  );
  if (!reservation.allowed) {
    if (reservation.duplicate) {
      throw new Error("Duplicate AI request was blocked");
    }
    throw new AiDailyLimitError(reservation.resetAt);
  }

  let data: unknown;
  try {
    data = await fetchOpenAi(args, apiKey);
  } catch (error) {
    if (error instanceof DefinitiveOpenAiFailure) {
      await args.ctx.runMutation(internal.aiUsage.internal.release, {
        requestKey: args.requestKey,
      });
    }
    throw error;
  }
  await completeUsage(args, data);
  return data;
}

async function fetchOpenAi(
  args: Parameters<typeof postOpenAi>[0],
  apiKey: string,
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(args.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": args.requestKey,
      },
      body: JSON.stringify(args.body),
    });
    if (response.ok) return await readJson(response);
    const error = await response.text();
    if (!isRetryable(response.status) || attempt === 1) {
      throw new DefinitiveOpenAiFailure(
        `OpenAI request failed (${response.status}): ${error.slice(0, 500)}`,
      );
    }
    await wait(retryDelay(response, attempt));
  }
  throw new Error("OpenAI request failed");
}

class DefinitiveOpenAiFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DefinitiveOpenAiFailure";
  }
}

async function completeUsage(
  args: Parameters<typeof postOpenAi>[0],
  data: unknown,
) {
  const usage = extractUsage(data, args.kind);
  await args.ctx.runMutation(internal.aiUsage.internal.complete, {
    requestKey: args.requestKey,
    costUsd: usage
      ? calculateModelCostUsd(args.model, usage)
      : args.reservedCostUsd,
    inputTokens: usage?.inputTokens,
    cachedInputTokens: usage?.cachedInputTokens,
    outputTokens: usage?.outputTokens,
  });
}

function extractUsage(data: unknown, kind: UsageKind) {
  if (!isRecord(data) || !isRecord(data.usage)) return null;
  if (kind === "embedding") {
    if (!isFiniteNumber(data.usage.prompt_tokens)) return null;
    return { inputTokens: data.usage.prompt_tokens };
  }
  if (
    !isFiniteNumber(data.usage.input_tokens) ||
    !isFiniteNumber(data.usage.output_tokens)
  ) {
    return null;
  }
  const details = isRecord(data.usage.input_tokens_details)
    ? data.usage.input_tokens_details
    : undefined;
  return {
    inputTokens: data.usage.input_tokens,
    cachedInputTokens: isFiniteNumber(details?.cached_tokens)
      ? details.cached_tokens
      : 0,
    outputTokens: data.usage.output_tokens,
  };
}

// Response.json is typed as `any` in lib.dom, so this boundary narrows it to unknown.
// eslint-disable-next-line no-restricted-syntax
async function readJson(response: Response): Promise<unknown> {
  return await response.json();
}

function isRetryable(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function retryDelay(response: Response, attempt: number) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(30_000, retryAfter * 1_000);
  }
  return 1_000 * 2 ** attempt;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function wait(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
