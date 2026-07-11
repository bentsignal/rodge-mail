import { v } from "convex/values";

import { internalMutation } from "../_generated/server";
import { requiredClassificationMetadata } from "./pending";

const BATCH_SIZE = 200;

export const migrateRequiredMetadata = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("messageClassifications").paginate({
      cursor: args.cursor,
      numItems: BATCH_SIZE,
    });
    let patched = 0;
    for (const classification of page.page) {
      const category = legacyField(classification, "category");
      const reason = legacyField(classification, "reason");
      const summary = legacyField(classification, "summary");
      if (
        category !== undefined &&
        reason !== undefined &&
        summary !== undefined
      ) {
        continue;
      }
      const message = await ctx.db.get(classification.messageId);
      await ctx.db.patch(
        classification._id,
        requiredClassificationMetadata(
          { category, reason, summary },
          message?.snippet ?? "",
        ),
      );
      patched += 1;
    }
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      patched,
      scanned: page.page.length,
    };
  },
});

function legacyField<T extends object, K extends keyof T>(value: T, key: K) {
  return Object.prototype.hasOwnProperty.call(value, key)
    ? value[key]
    : undefined;
}
