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

crons.interval(
  "finalize abandoned notification deliveries",
  { minutes: 5 },
  internal.notifications.maintenance.recoverStaleDeliveries,
  { limit: 50 },
);

crons.interval(
  "remove Rodge archive records older than 30 days",
  { hours: 24 },
  internal.mail.archiveMaintenance.cleanupArchivedMessages,
  { limit: 100 },
);

export default crons;
