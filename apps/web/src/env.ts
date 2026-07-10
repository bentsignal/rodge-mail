import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

const runtimeEnv = import.meta.env.SSR
  ? ((
      globalThis as unknown as {
        process?: { env?: Record<string, string | undefined> };
      }
    ).process?.env ?? {})
  : import.meta.env;

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_DESKTOP_BROWSER_AUTH_URL: z.url().optional(),
    VITE_NODE_ENV: z
      .enum(["development", "production", "test"])
      .default(
        import.meta.env.MODE === "development" ? "development" : "production",
      ),
  },
  runtimeEnv,
  emptyStringAsUndefined: true,
});
