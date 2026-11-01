import type { ReactTestRenderer } from "react-test-renderer";
import { act, createElement } from "react";
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
    vi.unstubAllGlobals();
  });

  it("hides a passkey before the server answers", async () => {
    let finish: (value: { error: null }) => void = () => undefined;
    const deletePasskey = vi.fn(
      () =>
        new Promise<{ error: null }>((resolve) => {
          finish = resolve;
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
      finish({ error: null });
      await removal;
    });
    expect(harness.onRemoveError).not.toHaveBeenCalled();
    act(() => harness.renderer.unmount());
  });

  it("puts the passkey back and reports the error when removal fails", async () => {
    const deletePasskey = vi.fn(() =>
      Promise.resolve({ error: { message: "Session expired" } }),
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
    const deletePasskey = vi.fn(() => Promise.resolve({ error: null }));
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

function renderHarness(
  passkeys: PasskeyListItem[],
  deletePasskey: (id: string) => Promise<{ error: unknown }>,
) {
  type State = ReturnType<typeof useOptimisticPasskeys<PasskeyListItem>>;
  let current: State | undefined;
  let renderer: ReactTestRenderer | undefined;
  const onRemoveError = vi.fn();

  function Harness() {
    current = useOptimisticPasskeys({
      deletePasskey: deletePasskey as (
        id: string,
      ) => Promise<{ error?: { message?: string | null } | null }>,
      onRemoveError,
      passkeys,
    });
    return null;
  }

  act(() => {
    renderer = create(createElement(Harness));
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
