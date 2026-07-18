import { describe, expect, it } from "vitest";

import type { MobileMailAccount } from "../lib/convex-mail";
import { getAccountConnectionPresentation } from "./account-connection-status";

const now = Date.UTC(2026, 6, 17, 18);

describe("mobile account connection status", () => {
  it("identifies the account that requires reconnection and exposes its error", () => {
    expect(
      getAccountConnectionPresentation(
        account({
          lastSyncError: "Google access was revoked.",
          status: "reauthorization_required",
        }),
        now,
      ),
    ).toEqual({
      canReconnect: true,
      canRetry: false,
      detail: "Google access was revoked.",
      label: "Reconnect required",
      tone: "danger",
    });
  });

  it("offers retry and reconnect for a provider sync issue", () => {
    expect(
      getAccountConnectionPresentation(
        account({
          lastSyncError: "Provider request timed out.",
          status: "error",
        }),
        now,
      ),
    ).toMatchObject({
      canReconnect: true,
      canRetry: true,
      detail: "Provider request timed out.",
      label: "Sync issue",
    });
  });

  it("shows useful healthy and syncing details", () => {
    expect(
      getAccountConnectionPresentation(
        account({ lastSyncedAt: now - 2 * 60 * 60_000 }),
        now,
      ).detail,
    ).toBe("Last synced 2h ago.");
    expect(
      getAccountConnectionPresentation(account({ status: "syncing" }), now),
    ).toMatchObject({ label: "Syncing", tone: "info" });
  });
});

function account(values: Partial<MobileMailAccount> = {}) {
  return {
    accent: "#397367",
    address: "person@example.com",
    displayLabel: undefined,
    displayName: "Person",
    id: "account-1",
    initials: "PE",
    isDemo: false,
    label: "Person",
    lastSyncError: undefined,
    lastSyncedAt: undefined,
    provider: "gmail",
    status: "connected",
    ...values,
  } satisfies MobileMailAccount;
}
