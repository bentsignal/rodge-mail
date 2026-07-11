import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";

import { components } from "./_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  agentRead: {
    kind: "token bucket",
    rate: 120,
    period: MINUTE,
    capacity: 240,
  },
  agentCredentialCreate: {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 10,
  },
  agentSemanticSearch: {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 60,
  },
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
  embedMessage: {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 120,
  },
  semanticSearch: {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 60,
  },
});
