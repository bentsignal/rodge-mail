import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";

import { components } from "./_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  connectMailAccount: {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 10,
  },
  updateMessageState: {
    kind: "token bucket",
    rate: 120,
    period: MINUTE,
    capacity: 240,
  },
  classifyMessage: {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 120,
  },
});
