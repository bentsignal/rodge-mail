import { createRequire } from "node:module";
import type { ConfigContext } from "expo/config";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createUrls } from "@rodge-mail/config/urls";

import createExpoConfig from "./app.config";

const { networkSecurityConfig } = createRequire(import.meta.url)(
  "./expo-plugins/with-android-network-security.cjs",
) as { networkSecurityConfig: (options: { debug: boolean }) => string };

// A worktree with an isolated backend points its overrides elsewhere.
vi.mock("../../shared/config/src/overrides", () => ({
  convexCloudUrl: undefined,
  convexSiteUrl: undefined,
  worktreeId: undefined,
}));

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
  });

  it("serves the hosted web app in production", () => {
    expect(createUrls({ nodeEnv: "production" }).web).toBe(
      "https://mail.rodgers.dev",
    );
  });

  it("uses the Convex development deployment", () => {
    expect(createUrls({ nodeEnv: "development" }).convex).toEqual({
      cloud: "https://dazzling-dog-633.convex.cloud",
      site: "https://dazzling-dog-633.convex.site",
    });
  });
});

describe("Android network security config", () => {
  it("blocks cleartext traffic in release builds", () => {
    const release = networkSecurityConfig({ debug: false });

    expect(release).toContain(
      '<base-config cleartextTrafficPermitted="false">',
    );
    expect(release).not.toContain('cleartextTrafficPermitted="true"');
  });

  it("allows cleartext only to Metro's hosts in debug builds", () => {
    const debug = networkSecurityConfig({ debug: true });

    expect(debug).toContain('<base-config cleartextTrafficPermitted="false">');
    expect(
      [...debug.matchAll(/<domain [^>]*>([^<]+)<\/domain>/g)].map(
        ([, host]) => host,
      ),
    ).toEqual(["10.0.2.2", "localhost", "127.0.0.1"]);
  });

  it("trusts user-installed certificate authorities in every build", () => {
    for (const debug of [false, true]) {
      expect(networkSecurityConfig({ debug })).toContain(
        '<certificates src="user" />',
      );
    }
  });
});
