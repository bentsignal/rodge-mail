import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { normalizeMail } from "../classification/normalize";
import { generateCleanView, isAiConfigured } from "../classification/openai";

export const run = internalAction({
  args: { messageId: v.id("messages"), jobKey: v.string() },
  handler: async (ctx, args) => {
    const input = await ctx.runQuery(
      internal.cleanView.internal.getJobInput,
      args,
    );
    if (!input) return null;
    if (!(await ctx.runMutation(internal.cleanView.internal.begin, args))) {
      return null;
    }
    if (!isAiConfigured()) {
      await ctx.runMutation(internal.cleanView.internal.fail, {
        ...args,
        error: "OPENAI_API_KEY is not configured",
      });
      return null;
    }
    try {
      const result = await generateCleanView({
        ctx,
        ownerId: input.message.ownerId,
        mail: normalizeMail(input.message, input.content),
        jobKey: args.jobKey,
      });
      await ctx.runMutation(internal.cleanView.internal.complete, {
        ...args,
        summary: result.summary,
        cleanedMarkdown: result.cleanedMarkdown,
      });
    } catch (error) {
      await ctx.runMutation(internal.cleanView.internal.fail, {
        ...args,
        error:
          error instanceof Error
            ? error.message
            : "Clean view generation failed",
      });
    }
    return null;
  },
});
