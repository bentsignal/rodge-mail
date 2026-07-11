import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

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
