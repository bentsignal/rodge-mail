import type { ReactTestRenderer } from "react-test-renderer";
import { act, createElement, useEffect } from "react";
import { create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PasskeyListItem } from "./passkeys";
import {
  formatPasskeyAdded,
  getPasskeyLabel,
  useOptimisticPasskeys,
} from "./passkeys";

const appRpId = "fake-deployment.convex.site";
const phone = {
  aaguid: "fbfc3007-154e-4ecc-8c0b-6e020557d7bd",
  createdAt: "2026-10-03T15:00:00.000Z",
  id: "phone",
  rpId: appRpId,
};
const laptop = {
  aaguid: "BADA5566-A7AA-401F-BD96-45619A55120D",
  createdAt: "2026-10-20T15:00:00.000Z",
  id: "laptop",
  rpId: "mail.example.com",
};
const desktop = {
  createdAt: "2026-10-21T15:00:00.000Z",
  id: "desktop",
  rpId: "mail.example.com",
};
const older = {
  createdAt: "2026-09-01T15:00:00.000Z",
  id: "older",
};

describe("getPasskeyLabel", () => {
  it("prefers the passkey's own name", () => {
    expect(getPasskeyLabel({ ...phone, name: " Work Mac " })).toBe("Work Mac");
  });

  it("names known authenticators from their AAGUID", () => {
    expect(getPasskeyLabel(phone)).toBe("iCloud Keychain");
    expect(getPasskeyLabel(laptop)).toBe("1Password");
  });

  it("falls back to a generic label", () => {
    expect(
      getPasskeyLabel({
        aaguid: "00000000-0000-0000-0000-000000000000",
        createdAt: new Date(),
        id: "unknown",
      }),
    ).toBe("Passkey");
  });
});

describe("formatPasskeyAdded", () => {
  it("formats the creation date", () => {
    expect(formatPasskeyAdded(new Date(2026, 9, 3))).toBe("Added Oct 3, 2026");
  });
});

describe("useOptimisticPasskeys", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("groups passkeys by where they sign in", () => {
    const harness = renderHarness(
      [phone, laptop, older],
      vi.fn(() => Promise.resolve<DeleteResult>({ error: null })),
    );

    expect(ids(harness.current.groups.app)).toEqual(["phone"]);
    expect(ids(harness.current.groups.website)).toEqual(["laptop"]);
    expect(ids(harness.current.groups.unknown)).toEqual(["older"]);
    act(() => harness.renderer.unmount());
  });

  it("hides a passkey before the server answers", async () => {
    vi.useFakeTimers();
    const deletePasskey = vi.fn(
      () =>
        new Promise<DeleteResult>((resolve) => {
          setTimeout(() => resolve({ error: null }), 500);
        }),
    );
    const harness = renderHarness([phone, laptop, desktop], deletePasskey);

    let removal: Promise<void> | undefined;
    act(() => {
      removal = harness.current.remove("desktop");
    });

    expect(deletePasskey).toHaveBeenCalledWith("desktop");
    expect(ids(harness.current.groups.website)).toEqual(["laptop"]);
    expect(harness.current.groups.website[0]?.removalBlock).toBe(
      "This is your only passkey for the website.",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
      await removal;
    });
    expect(harness.onRemoveError).not.toHaveBeenCalled();
    act(() => harness.renderer.unmount());
  });

  it("puts the passkey back and reports the error when removal fails", async () => {
    const deletePasskey = vi.fn(() =>
      Promise.resolve<DeleteResult>({ error: { message: "Session expired" } }),
    );
    const harness = renderHarness([phone, laptop, desktop], deletePasskey);

    await act(async () => {
      await harness.current.remove("desktop");
    });

    expect(ids(harness.current.groups.website)).toEqual(["laptop", "desktop"]);
    expect(harness.onRemoveError).toHaveBeenCalledWith("Session expired");
    act(() => harness.renderer.unmount());
  });

  it("refuses to remove a platform's last passkey", async () => {
    const deletePasskey = vi.fn(() =>
      Promise.resolve<DeleteResult>({ error: null }),
    );
    const harness = renderHarness([phone, laptop, desktop], deletePasskey);

    expect(harness.current.groups.app[0]?.removalBlock).toBe(
      "This is your only passkey for the iPhone app.",
    );
    await act(async () => {
      await harness.current.remove("phone");
    });

    expect(deletePasskey).not.toHaveBeenCalled();
    expect(ids(harness.current.groups.app)).toEqual(["phone"]);
    act(() => harness.renderer.unmount());
  });
});

function ids(rows: readonly { passkey: { id: string } }[]) {
  return rows.map((row) => row.passkey.id);
}

interface DeleteResult {
  error: { message: string } | null;
}

function renderHarness(
  passkeys: PasskeyListItem[],
  deletePasskey: (id: string) => Promise<DeleteResult>,
) {
  type State = ReturnType<typeof useOptimisticPasskeys<PasskeyListItem>>;
  let current: State | undefined;
  let renderer: ReactTestRenderer | undefined;
  const onRemoveError = vi.fn();

  function Harness({ onRender }: { onRender: (state: State) => void }) {
    const state = useOptimisticPasskeys({
      appRpId,
      deletePasskey,
      onRemoveError,
      passkeys,
    });
    // eslint-disable-next-line no-restricted-syntax -- The test harness observes committed hook state outside React.
    useEffect(() => onRender(state), [onRender, state]);
    return null;
  }

  function captureState(state: State) {
    current = state;
  }

  act(() => {
    renderer = create(createElement(Harness, { onRender: captureState }));
  });

  if (!current || !renderer) throw new Error("Passkey harness did not mount");
  return {
    get current() {
      if (!current) throw new Error("Passkey harness is unavailable");
      return current;
    },
    onRemoveError,
    renderer,
  };
}
