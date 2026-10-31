import { describe, expect, it } from "vitest";

import { isDevToolsDeployment } from "./devToolsPolicy";

const isolated = {
  devTools: "true",
  environment: "development",
  cloudUrl: "https://charming-basilisk-272.convex.cloud",
  siteUrl: "https://charming-basilisk-272.convex.site",
};

describe("dev tools", () => {
  it("run on an isolated development deployment with DEV_TOOLS", () => {
    expect(isDevToolsDeployment(isolated)).toBe(true);
  });

  it("stay off without DEV_TOOLS", () => {
    expect(isDevToolsDeployment({ ...isolated, devTools: undefined })).toBe(
      false,
    );
    expect(isDevToolsDeployment({ ...isolated, devTools: "1" })).toBe(false);
  });

  it("stay off outside development", () => {
    expect(
      isDevToolsDeployment({ ...isolated, environment: "production" }),
    ).toBe(false);
  });

  it("never run on the production deployment", () => {
    expect(
      isDevToolsDeployment({
        ...isolated,
        cloudUrl: "https://dazzling-dog-633.convex.cloud",
      }),
    ).toBe(false);
    expect(
      isDevToolsDeployment({
        ...isolated,
        siteUrl: "https://dazzling-dog-633.convex.site",
      }),
    ).toBe(false);
  });
});
