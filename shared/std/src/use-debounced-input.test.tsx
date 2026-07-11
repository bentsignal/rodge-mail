import type { ReactTestRenderer } from "react-test-renderer";
import { act, createElement, useEffect } from "react";
import { create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebouncedInput } from "./use-debounced-input";

describe("useDebouncedInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("publishes only the final value after rapid typing settles", () => {
    const harness = renderHarness();

    act(() => {
      harness.current.setValue("r");
      harness.current.setValue("ro");
      harness.current.setValue("rodge");
    });

    expect(harness.current.value).toBe("rodge");
    expect(harness.current.debouncedValue).toBe("");

    act(() => {
      vi.advanceTimersByTime(349);
    });
    expect(harness.current.debouncedValue).toBe("");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(harness.current.debouncedValue).toBe("rodge");

    act(() => harness.renderer.unmount());
  });

  it("can clear both values immediately", () => {
    const harness = renderHarness();

    act(() => harness.current.setValue("invoice"));
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(harness.current.debouncedValue).toBe("invoice");

    act(() => harness.current.setValueImmediately(""));
    expect(harness.current.value).toBe("");
    expect(harness.current.debouncedValue).toBe("");

    act(() => harness.renderer.unmount());
  });
});

function renderHarness() {
  let current: ReturnType<typeof useDebouncedInput<string>> | undefined;
  let renderer: ReactTestRenderer | undefined;

  function Harness({
    onRender,
  }: {
    onRender: (state: ReturnType<typeof useDebouncedInput<string>>) => void;
  }) {
    const state = useDebouncedInput({ initialValue: "", timeInMs: 350 });
    // eslint-disable-next-line no-restricted-syntax -- The test harness observes committed hook state outside React.
    useEffect(() => onRender(state), [onRender, state]);
    return null;
  }

  function captureState(state: ReturnType<typeof useDebouncedInput<string>>) {
    current = state;
  }

  act(() => {
    renderer = create(createElement(Harness, { onRender: captureState }));
  });

  if (!current || !renderer) throw new Error("Debounce harness did not mount");
  return {
    get current() {
      if (!current) throw new Error("Debounce harness is unavailable");
      return current;
    },
    renderer,
  };
}
