import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
  DATABASE_URL: z.string().url(),
  RODGE_CONVEX_SITE_URL: z.string().url(),
  ICLOUD_BRIDGE_SIGNING_SECRET: z.string().min(32),
  BRIDGE_ACTIVE_CREDENTIAL_KEY_VERSION: z.string().min(1),
  BRIDGE_CREDENTIAL_KEYS: z.string().min(1),
  POLL_INTERVAL_MS: z.coerce.number().int().min(1_000).default(15_000),
  SYNC_BATCH_SIZE: z.coerce.number().int().min(1).max(50).default(25),
  MAX_MESSAGE_BYTES: z.coerce
    .number()
    .int()
    .min(64_000)
    .max(10_000_000)
    .default(2_000_000),
});

export const env = envSchema.parse(process.env);
