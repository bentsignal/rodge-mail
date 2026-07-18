import { authedQuery } from "../utils";
import { aiUsageAggregate } from "./aggregate";
import { AI_DAILY_LIMIT_USD, utcDayBounds } from "./pricing";

export const today = authedQuery({
  args: {},
  handler: async (ctx) => {
    const { start, end } = utcDayBounds(Date.now());
    const spentUsd = await aiUsageAggregate.sum(ctx, {
      namespace: ctx.ownerId,
      bounds: {
        lower: { key: start, inclusive: true },
        upper: { key: end, inclusive: false },
      },
    });
    return {
      spentUsd,
      remainingUsd: Math.max(0, AI_DAILY_LIMIT_USD - spentUsd),
      limitUsd: AI_DAILY_LIMIT_USD,
      resetAt: end,
    };
  },
});
