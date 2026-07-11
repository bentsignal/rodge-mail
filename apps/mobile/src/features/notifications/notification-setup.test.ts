import { describe, expect, it } from "vitest";

import {
  isNotificationDeliveryEnabled,
  resolveNotificationSetupState,
  shouldRestoreNotificationRegistration,
} from "./notification-setup";

describe("notification setup state", () => {
  it("does not report delivery ready without both permission and a token", () => {
    expect(
      resolveNotificationSetupState({
        hasStoredToken: false,
        isDevice: true,
        permission: "granted",
      }),
    ).toBe("setup-required");
    expect(
      resolveNotificationSetupState({
        hasStoredToken: true,
        isDevice: true,
        permission: "undetermined",
      }),
    ).toBe("setup-required");
  });

  it("distinguishes denied permission and unsupported simulators", () => {
    expect(
      resolveNotificationSetupState({
        hasStoredToken: true,
        isDevice: true,
        permission: "denied",
      }),
    ).toBe("permission-denied");
    expect(
      resolveNotificationSetupState({
        hasStoredToken: true,
        isDevice: false,
        permission: "granted",
      }),
    ).toBe("unsupported");
  });

  it("only renders an enabled preference as deliverable when ready", () => {
    expect(isNotificationDeliveryEnabled(true, "setup-required")).toBe(false);
    expect(isNotificationDeliveryEnabled(true, "ready")).toBe(true);
    expect(isNotificationDeliveryEnabled(false, "ready")).toBe(false);
  });

  it("restores registration without prompting only after permission exists", () => {
    expect(
      shouldRestoreNotificationRegistration({
        isDevice: true,
        permission: "granted",
        preferenceEnabled: true,
      }),
    ).toBe(true);
    expect(
      shouldRestoreNotificationRegistration({
        isDevice: true,
        permission: "undetermined",
        preferenceEnabled: true,
      }),
    ).toBe(false);
    expect(
      shouldRestoreNotificationRegistration({
        isDevice: true,
        permission: "granted",
        preferenceEnabled: false,
      }),
    ).toBe(false);
  });
});
