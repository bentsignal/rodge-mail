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

export default crons;
