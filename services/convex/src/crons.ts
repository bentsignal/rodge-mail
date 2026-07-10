import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "sync connected providers and recover delivery work",
  { minutes: 5 },
  internal.sync.internal.runScheduledProviderWork,
  {},
);

export default crons;
