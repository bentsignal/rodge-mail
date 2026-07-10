import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { normalizeMail, stableHash } from "./normalize";

export async function isClassificationInputStale(
  ctx: MutationCtx,
  classification: Doc<"messageClassifications">,
) {
  if (!classification.inputHash) return false;
  const [message, content] = await Promise.all([
    ctx.db.get(classification.messageId),
    ctx.db
      .query("messageContents")
      .withIndex("by_message", (q) =>
        q.eq("messageId", classification.messageId),
      )
      .first(),
  ]);
  if (!message) return false;
  return (
    stableHash(normalizeMail(message, content)) !== classification.inputHash
  );
}
