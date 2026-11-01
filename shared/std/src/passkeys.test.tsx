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

const phone = {
  aaguid: "fbfc3007-154e-4ecc-8c0b-6e020557d7bd",
  createdAt: "2026-10-03T15:00:00.000Z",
  id: "phone",
};
const laptop = {
  aaguid: "BADA5566-A7AA-401F-BD96-45619A55120D",
  createdAt: "2026-10-20T15:00:00.000Z",
  id: "laptop",
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

  it("hides a passkey before the server answers", async () => {
    vi.useFakeTimers();
    const deletePasskey = vi.fn(
      () =>
        new Promise<DeleteResult>((resolve) => {
          setTimeout(() => resolve({ error: null }), 500);
        }),
    );
    const harness = renderHarness([phone, laptop], deletePasskey);

    let removal: Promise<void> | undefined;
    act(() => {
      removal = harness.current.remove("phone");
    });

    expect(deletePasskey).toHaveBeenCalledWith("phone");
    expect(harness.current.passkeys.map((passkey) => passkey.id)).toEqual([
      "laptop",
    ]);
    expect(harness.current.canRemove).toBe(false);

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
    const harness = renderHarness([phone, laptop], deletePasskey);

    await act(async () => {
      await harness.current.remove("phone");
    });

    expect(harness.current.passkeys.map((passkey) => passkey.id)).toEqual([
      "phone",
      "laptop",
    ]);
    expect(harness.onRemoveError).toHaveBeenCalledWith("Session expired");
    act(() => harness.renderer.unmount());
  });

  it("refuses to remove the only passkey", async () => {
    const deletePasskey = vi.fn(() =>
      Promise.resolve<DeleteResult>({ error: null }),
    );
    const harness = renderHarness([phone], deletePasskey);

    expect(harness.current.canRemove).toBe(false);
    await act(async () => {
      await harness.current.remove("phone");
    });

    expect(deletePasskey).not.toHaveBeenCalled();
    expect(harness.current.passkeys).toHaveLength(1);
    act(() => harness.renderer.unmount());
  });
});

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
