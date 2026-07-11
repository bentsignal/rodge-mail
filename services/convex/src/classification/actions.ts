import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { classificationRequestKey } from "./jobHelpers";
import { normalizeMail } from "./normalize";
import {
  classifyWithModel,
  configuredClassificationModel,
  isAiConfigured,
} from "./openai";
import { deriveSignals, deterministicClassification } from "./signals";

export const runClassification = internalAction({
  args: { messageId: v.id("messages"), jobKey: v.string() },
  handler: async (ctx, args) => {
    const input = await ctx.runQuery(
      internal.classification.internal.getJobInput,
      { messageId: args.messageId, jobKey: args.jobKey },
    );
    if (!input) return null;
    const mail = normalizeMail(input.message, input.content);
    const signals = deriveSignals(mail);
    const fallback = deterministicClassification(mail, signals);
    const attempt = await ctx.runMutation(
      internal.classification.internal.beginAttempt,
      args,
    );
    if (!attempt.ready || attempt.attempt === undefined) return null;

    if (!isAiConfigured()) {
      await completeWithFallback({
        ctx,
        args,
        fallback,
        signals,
        error: "OPENAI_API_KEY is not configured",
      });
      return null;
    }

    try {
      const result = await classifyWithModel({
        mail,
        signals,
        jobKey: classificationRequestKey(
          args.jobKey,
          attempt.attempt,
          Date.now(),
        ),
      });
      await ctx.runMutation(internal.classification.internal.complete, {
        ...args,
        ...result,
        signals,
        source: "model",
        model: configuredClassificationModel(),
      });
    } catch (error) {
      const message = errorMessage(error);
      const terminal = await ctx.runMutation(
        internal.classification.internal.recordFailure,
        { ...args, error: message },
      );
      if (terminal) {
        await completeWithFallback({
          ctx,
          args,
          fallback,
          signals,
          error: message,
        });
      }
    }
    return null;
  },
});

export const finalizeWithFallback = internalAction({
  args: {
    messageId: v.id("messages"),
    jobKey: v.string(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const input = await ctx.runQuery(
      internal.classification.internal.getJobInput,
      { messageId: args.messageId, jobKey: args.jobKey },
    );
    if (!input) return null;
    const mail = normalizeMail(input.message, input.content);
    const signals = deriveSignals(mail);
    await completeWithFallback({
      ctx,
      args,
      fallback: deterministicClassification(mail, signals),
      signals,
      error: args.error,
    });
    return null;
  },
});

async function completeWithFallback(input: {
  ctx: ActionCtx;
  args: { messageId: Id<"messages">; jobKey: string };
  fallback: ReturnType<typeof deterministicClassification>;
  signals: ReturnType<typeof deriveSignals>;
  error: string;
}) {
  const { ctx, args, fallback, signals, error } = input;
  await ctx.runMutation(internal.classification.internal.complete, {
    ...args,
    ...fallback,
    signals,
    source: "rules",
    error,
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unknown classification error";
}
