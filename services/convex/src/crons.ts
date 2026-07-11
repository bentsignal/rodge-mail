import { cronJobs, makeFunctionReference } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();
const CLEANUP_AGENT_AUDITS = makeFunctionReference<
  "mutation",
  { limit?: number },
  unknown
>("agent/internal:cleanupExpiredAudits");
const CLEANUP_AGENT_CREDENTIALS = makeFunctionReference<
  "mutation",
  { limit?: number },
  unknown
>("agent/internal:cleanupExpiredCredentials");

crons.interval(
  "remove expired agent access audits",
  { hours: 6 },
  CLEANUP_AGENT_AUDITS,
  { limit: 100 },
);

crons.interval(
  "remove expired agent credentials",
  { hours: 6 },
  CLEANUP_AGENT_CREDENTIALS,
  { limit: 100 },
);

crons.interval(
  "sync connected providers and recover delivery work",
  { minutes: 5 },
  internal.sync.internal.runScheduledProviderWork,
  {},
);

crons.interval(
  "remove abandoned draft attachments",
  { hours: 6 },
  internal.attachments.internal.cleanupExpiredDrafts,
  {},
);

crons.interval(
  "recover abandoned embedding jobs",
  { minutes: 5 },
  internal.embedding.maintenance.recoverStaleJobs,
  { limit: 50 },
);

crons.interval(
  "recover abandoned classification jobs",
  { minutes: 5 },
  internal.classification.maintenance.recoverStaleJobs,
  { limit: 25 },
);

export default crons;
