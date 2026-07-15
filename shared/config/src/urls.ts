import {
  convexCloudUrl as overrideConvexCloudUrl,
  worktreeId as overrideWorktreeId,
} from "./overrides";
import { normalizeWorktreeId } from "./worktrees";

const DEVELOPMENT_CONVEX = {
  cloud: "https://dazzling-dog-633.convex.cloud",
  site: "https://dazzling-dog-633.convex.site",
} as const;

interface UrlOptions {
  nodeEnv?: "development" | "production" | "test";
  worktreeId?: string;
}

function webUrl(options: { effectiveWorktreeId?: string }) {
  const prefix = normalizeWorktreeId(options.effectiveWorktreeId);
  const host = [prefix, "www.rodge-mail", "local"].filter(Boolean).join(".");
  return `https://${host}`;
}

export function createUrls(options: UrlOptions = {}) {
  if (options.nodeEnv === "production") {
    throw new Error("Rodge Mail production URLs are not configured");
  }
  const effectiveWorktreeId = options.worktreeId ?? overrideWorktreeId;
  const effectiveConvexCloudUrl =
    overrideConvexCloudUrl ?? DEVELOPMENT_CONVEX.cloud;

  return {
    web: webUrl({ effectiveWorktreeId }),
    convex: {
      cloud: effectiveConvexCloudUrl,
      site: DEVELOPMENT_CONVEX.site,
    },
  } as const;
}
