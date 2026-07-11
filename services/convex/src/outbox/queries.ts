import { authedQuery } from "../utils";
import {
  MAX_RECENT_OUTBOX_PER_UNRESOLVED_STATUS,
  MAX_RECENT_SENT_OUTBOX,
  mergeRecentOutboxes,
} from "./recent";

const UNRESOLVED_STATUSES = ["pending", "sending", "failed"] as const;

export const listRecent = authedQuery({
  args: {},
  handler: async (ctx) => {
    const unresolvedGroups = await Promise.all(
      UNRESOLVED_STATUSES.map(
        async (status) =>
          await ctx.db
            .query("outboxMessages")
            .withIndex("by_owner_status_created", (q) =>
              q.eq("ownerId", ctx.ownerId).eq("status", status),
            )
            .order("desc")
            .take(MAX_RECENT_OUTBOX_PER_UNRESOLVED_STATUS),
      ),
    );
    const sent = await ctx.db
      .query("outboxMessages")
      .withIndex("by_owner_status_created", (q) =>
        q.eq("ownerId", ctx.ownerId).eq("status", "sent"),
      )
      .order("desc")
      .take(MAX_RECENT_SENT_OUTBOX);
    const outboxes = mergeRecentOutboxes([...unresolvedGroups, sent]);
    const rows = await Promise.all(
      outboxes.map(async (outbox) => {
        const account = await ctx.db.get(outbox.accountId);
        if (!account || account.ownerId !== ctx.ownerId) return undefined;
        return {
          _id: outbox._id,
          account: {
            address: account.address,
            provider: account.provider,
          },
          attempt: outbox.attempt,
          createdAt: outbox.createdAt,
          error: outbox.error,
          sentAt: outbox.sentAt,
          status: outbox.status,
          subject: outbox.subject,
          to: outbox.to,
          updatedAt: outbox.updatedAt,
        };
      }),
    );
    return rows.flatMap((row) => (row ? [row] : []));
  },
});
