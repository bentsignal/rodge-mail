import {
  convexCloudUrl as overrideConvexCloudUrl,
  worktreeId as overrideWorktreeId,
} from "./overrides";
import { normalizeWorktreeId } from "./worktrees";

const CONVEX = {
  production: {
    cloud: "https://colorful-ostrich-734.convex.cloud",
    site: "https://colorful-ostrich-734.convex.site",
  },
  development: {
    cloud: "https://dazzling-dog-633.convex.cloud",
    site: "https://dazzling-dog-633.convex.site",
  },
} as const;

interface UrlOptions {
  nodeEnv?: "development" | "production" | "test";
  worktreeId?: string;
}

function webUrl(options: UrlOptions & { effectiveWorktreeId?: string }) {
  if (options.nodeEnv === "production") {
    return "https://rodge-mail.vercel.app";
  }
  const prefix = normalizeWorktreeId(options.effectiveWorktreeId);
  const host = [prefix, "www.rodge-mail", "local"].filter(Boolean).join(".");
  return `https://${host}`;
}

export function createUrls(options: UrlOptions = {}) {
  const tier = options.nodeEnv === "production" ? "production" : "development";
  const effectiveWorktreeId = options.worktreeId ?? overrideWorktreeId;
  const effectiveConvexCloudUrl =
    tier === "production"
      ? CONVEX.production.cloud
      : (overrideConvexCloudUrl ?? CONVEX.development.cloud);

  return {
    web: webUrl({ ...options, effectiveWorktreeId }),
    convex: {
      cloud: effectiveConvexCloudUrl,
      site: CONVEX[tier].site,
    },
  } as const;
}
