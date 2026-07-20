import type { ConfigContext } from "expo/config";
import { afterEach, describe, expect, it } from "vitest";

import { createUrls } from "@rodge-mail/config/urls";

import createExpoConfig from "./app.config";

const originalBuildProfile = process.env.EAS_BUILD_PROFILE;

afterEach(() => {
  if (originalBuildProfile === undefined) {
    delete process.env.EAS_BUILD_PROFILE;
  } else {
    process.env.EAS_BUILD_PROFILE = originalBuildProfile;
  }
});

describe("mobile development configuration", () => {
  it("associates passkeys with the public Convex relying party", () => {
    process.env.EAS_BUILD_PROFILE = "development";

    const config = createExpoConfig({ config: {} } as ConfigContext);

    expect(config.ios?.associatedDomains).toEqual([
      "webcredentials:dazzling-dog-633.convex.site",
    ]);
    expect(config.extra?.deploymentEnvironment).toBe("development");
    expect(JSON.stringify(config).toLowerCase()).not.toContain("vercel");
  });

  it("rejects an unconfigured production build", () => {
    process.env.EAS_BUILD_PROFILE = "production";

    expect(() => createExpoConfig({ config: {} } as ConfigContext)).toThrow(
      "only has development builds configured",
    );
    expect(() => createUrls({ nodeEnv: "production" })).toThrow(
      "production URLs are not configured",
    );
  });

  it("uses the Convex development deployment", () => {
    expect(createUrls({ nodeEnv: "development" }).convex).toEqual({
      cloud: "https://dazzling-dog-633.convex.cloud",
      site: "https://dazzling-dog-633.convex.site",
    });
  });
});
