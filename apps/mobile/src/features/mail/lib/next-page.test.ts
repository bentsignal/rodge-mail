import { describe, expect, it } from "vitest";

import type { PageStatus } from "./next-page";
import {
  appendToHeldRows,
  getPageFooter,
  getRowsBelow,
  getThresholdRows,
  shouldRequestNextPage,
} from "./next-page";

const key = (row: string) => row;

const near = {
  requestedSinceScroll: false,
  rowsBelow: 3,
  rowsFitOnScreen: false,
  rowsPending: false,
  status: "CanLoadMore",
  thresholdRows: 10,
} as const;

describe("shouldRequestNextPage", () => {
  it("asks only when a cursor is waiting and the end is near", () => {
    expect(shouldRequestNextPage(near)).toBe(true);
    expect(shouldRequestNextPage({ ...near, rowsBelow: undefined })).toBe(
      true,
    );
    expect(shouldRequestNextPage({ ...near, rowsBelow: 11 })).toBe(false);
    expect(shouldRequestNextPage({ ...near, rowsPending: true })).toBe(false);
    for (const status of [
      "LoadingFirstPage",
      "LoadingMore",
      "Exhausted",
    ] as const) {
      expect(shouldRequestNextPage({ ...near, status })).toBe(false);
    }
  });

  it("waits for the user to scroll again unless every row fits", () => {
    expect(
      shouldRequestNextPage({ ...near, requestedSinceScroll: true }),
    ).toBe(false);
    expect(
      shouldRequestNextPage({
        ...near,
        requestedSinceScroll: true,
        rowsBelow: 0,
        rowsFitOnScreen: true,
      }),
    ).toBe(true);
  });

  it("asks once each time the user reaches the end", () => {
    // The list's end signal and scroll events keep firing while the user
    // rests at the end; pages land below (inbox) or sort in above (search).
    const list = { lastVisible: 25, rows: 30 };
    let status: PageStatus = "CanLoadMore";
    let requestedSinceScroll = false;
    let requests = 0;
    function endSignal() {
      const rowsBelow = getRowsBelow(list.rows, list.lastVisible);
      if (
        !shouldRequestNextPage({
          requestedSinceScroll,
          rowsBelow,
          rowsFitOnScreen: false,
          rowsPending: false,
          status,
          thresholdRows: getThresholdRows(800, 109),
        })
      ) {
        return;
      }
      requests += 1;
      requestedSinceScroll = true;
      status = "LoadingMore";
    }
    function pageLands({ above, below }: { above: number; below: number }) {
      list.rows += above + below;
      list.lastVisible += above;
      status = "CanLoadMore";
      endSignal();
      endSignal();
    }
    function userScrolls(rows: number) {
      requestedSinceScroll = false;
      list.lastVisible += rows;
      endSignal();
    }

    endSignal();
    endSignal();
    expect(requests).toBe(1);
    pageLands({ above: 0, below: 30 });
    expect(requests).toBe(1);
    userScrolls(25);
    expect(requests).toBe(2);

    pageLands({ above: 28, below: 2 });
    expect(requests).toBe(2);
    userScrolls(1);
    expect(requests).toBe(3);

    status = "Exhausted";
    userScrolls(1);
    expect(requests).toBe(3);
  });
});

describe("getThresholdRows", () => {
  it("covers a screen and a half of rows", () => {
    expect(getThresholdRows(800, 109)).toBe(12);
    expect(getThresholdRows(0, 109)).toBe(0);
  });
});

describe("getRowsBelow", () => {
  it("counts the rows after the last visible one", () => {
    expect(getRowsBelow(30, 19)).toBe(10);
    expect(getRowsBelow(30, 29)).toBe(0);
    expect(getRowsBelow(30, -1)).toBeUndefined();
  });
});

describe("getPageFooter", () => {
  it("shows a spinner only while loading and keeps its space while more may follow", () => {
    expect(getPageFooter({ isLoading: false, status: "LoadingMore" })).toBe(
      "loading",
    );
    expect(getPageFooter({ isLoading: true, status: "Exhausted" })).toBe(
      "loading",
    );
    expect(getPageFooter({ isLoading: false, status: "CanLoadMore" })).toBe(
      "reserved",
    );
    expect(getPageFooter({ isLoading: false, status: "Exhausted" })).toBe(
      "none",
    );
    expect(
      getPageFooter({ isLoading: false, status: "LoadingFirstPage" }),
    ).toBe("none");
  });
});

describe("appendToHeldRows", () => {
  it("shows rows appended below the held ones", () => {
    const held = ["a", "b"];
    expect(appendToHeldRows(held, ["a", "b", "c", "d"], key)).toEqual({
      hasAllRows: true,
      rows: ["a", "b", "c", "d"],
    });
  });

  it("keeps the same array when nothing was added", () => {
    const held = ["a", "b"];
    const result = appendToHeldRows(held, ["a", "b"], key);
    expect(result.hasAllRows).toBe(true);
    expect(result.rows).toBe(held);
  });

  it("holds any other change until the list rests", () => {
    const held = ["a", "b", "c"];
    for (const next of [
      ["new", "a", "b", "c"],
      ["b", "a", "c", "d"],
      ["a", "c"],
    ]) {
      const result = appendToHeldRows(held, next, key);
      expect(result.hasAllRows).toBe(false);
      expect(result.rows).toBe(held);
    }
  });

  it("keeps the held objects for rows already on screen", () => {
    const first = { id: "a", read: false };
    const result = appendToHeldRows(
      [first],
      [{ id: "a", read: true }, { id: "b", read: false }],
      (row) => row.id,
    );
    expect(result.rows[0]).toBe(first);
    expect(result.rows).toHaveLength(2);
  });
});

